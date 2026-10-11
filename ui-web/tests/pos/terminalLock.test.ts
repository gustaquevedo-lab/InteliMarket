import test from "node:test"
import assert from "node:assert/strict"
import { createTerminalLock } from "../../src/pages/pos/terminalLock.ts"

test("segundo tryAcquire en la misma IP falla hasta release", () => {
  const lock = createTerminalLock()
  const t = lock.tryAcquire("10.0.0.5")
  assert.notEqual(t, null)
  assert.equal(lock.tryAcquire("10.0.0.5"), null)
  assert.equal(lock.isBusy("10.0.0.5"), true)
  lock.release("10.0.0.5", t!)
  assert.equal(lock.isBusy("10.0.0.5"), false)
  assert.notEqual(lock.tryAcquire("10.0.0.5"), null)
})

test("los tokens son monotonicos y distintos", () => {
  const lock = createTerminalLock()
  const a = lock.tryAcquire("10.0.0.5")!
  const b = lock.tryAcquire("10.0.0.6")!
  assert.equal(typeof a, "number")
  assert.ok(b > a)
  lock.release("10.0.0.5", a)
  const c = lock.tryAcquire("10.0.0.5")!
  assert.ok(c > b)
})

test("IPs distintas son independientes", () => {
  const lock = createTerminalLock()
  const t5 = lock.tryAcquire("10.0.0.5")
  assert.notEqual(t5, null)
  assert.notEqual(lock.tryAcquire("10.0.0.6"), null)
  assert.equal(lock.isBusy("10.0.0.7"), false)
  lock.release("10.0.0.5", t5!)
  assert.equal(lock.isBusy("10.0.0.6"), true)
})

test("release es idempotente y libera", () => {
  const lock = createTerminalLock()
  const t = lock.tryAcquire("10.0.0.5")!
  lock.release("10.0.0.5", t)
  assert.doesNotThrow(() => lock.release("10.0.0.5", t))
  assert.doesNotThrow(() => lock.release("ip-nunca-usada", 123))
  assert.equal(lock.isBusy("10.0.0.5"), false)
  assert.notEqual(lock.tryAcquire("10.0.0.5"), null)
})

test("release con token ajeno no libera al titular", () => {
  const lock = createTerminalLock()
  const t = lock.tryAcquire("10.0.0.5")!
  lock.release("10.0.0.5", t + 1000)
  assert.equal(lock.isBusy("10.0.0.5"), true)
  lock.release("10.0.0.5", t)
  assert.equal(lock.isBusy("10.0.0.5"), false)
})

test("el candado vence por timeout", () => {
  let now = 1_000_000
  const timeoutMs = 5_000
  const lock = createTerminalLock({ timeoutMs, now: () => now })
  assert.notEqual(lock.tryAcquire("10.0.0.5"), null)
  now += timeoutMs - 1
  assert.equal(lock.tryAcquire("10.0.0.5"), null)
  assert.equal(lock.isBusy("10.0.0.5"), true)
  now += 2
  assert.equal(lock.isBusy("10.0.0.5"), false)
  assert.notEqual(lock.tryAcquire("10.0.0.5"), null)
})

test("release tardio despues del timeout NO libera al nuevo titular", () => {
  let now = 0
  const timeoutMs = 5_000
  const lock = createTerminalLock({ timeoutMs, now: () => now })
  const viejo = lock.tryAcquire("10.0.0.5")!
  now += timeoutMs + 1
  const nuevo = lock.tryAcquire("10.0.0.5")
  assert.notEqual(nuevo, null)
  lock.release("10.0.0.5", viejo)
  assert.equal(lock.isBusy("10.0.0.5"), true)
  assert.equal(lock.tryAcquire("10.0.0.5"), null)
  lock.release("10.0.0.5", nuevo!)
  assert.equal(lock.isBusy("10.0.0.5"), false)
})

test("timeoutMs por defecto cubre dos llamadas Bancard de 90 s (190 s)", () => {
  let now = 0
  const lock = createTerminalLock({ now: () => now })
  assert.notEqual(lock.tryAcquire("10.0.0.5"), null)
  now = 189_999
  assert.equal(lock.tryAcquire("10.0.0.5"), null)
  now = 190_001
  assert.notEqual(lock.tryAcquire("10.0.0.5"), null)
})

test("subscribe se notifica al adquirir y al liberar, y el desuscriptor funciona", () => {
  const lock = createTerminalLock()
  let calls = 0
  const unsubscribe = lock.subscribe(() => { calls++ })
  const t = lock.tryAcquire("10.0.0.5")!
  assert.equal(calls, 1)
  lock.release("10.0.0.5", t)
  assert.equal(calls, 2)
  unsubscribe()
  const t2 = lock.tryAcquire("10.0.0.5")!
  lock.release("10.0.0.5", t2)
  assert.equal(calls, 2)
})
