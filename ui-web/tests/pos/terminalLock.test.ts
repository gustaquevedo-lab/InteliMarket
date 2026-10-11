import test from "node:test"
import assert from "node:assert/strict"
import { createTerminalLock } from "../../src/pages/pos/terminalLock.ts"

test("segundo tryAcquire en la misma IP falla hasta release", () => {
  const lock = createTerminalLock()
  assert.equal(lock.tryAcquire("10.0.0.5"), true)
  assert.equal(lock.tryAcquire("10.0.0.5"), false)
  assert.equal(lock.isBusy("10.0.0.5"), true)
  lock.release("10.0.0.5")
  assert.equal(lock.isBusy("10.0.0.5"), false)
  assert.equal(lock.tryAcquire("10.0.0.5"), true)
})

test("IPs distintas son independientes", () => {
  const lock = createTerminalLock()
  assert.equal(lock.tryAcquire("10.0.0.5"), true)
  assert.equal(lock.tryAcquire("10.0.0.6"), true)
  assert.equal(lock.isBusy("10.0.0.7"), false)
  lock.release("10.0.0.5")
  assert.equal(lock.isBusy("10.0.0.6"), true)
})

test("release es idempotente y libera", () => {
  const lock = createTerminalLock()
  assert.equal(lock.tryAcquire("10.0.0.5"), true)
  lock.release("10.0.0.5")
  assert.doesNotThrow(() => lock.release("10.0.0.5"))
  assert.doesNotThrow(() => lock.release("ip-nunca-usada"))
  assert.equal(lock.isBusy("10.0.0.5"), false)
  assert.equal(lock.tryAcquire("10.0.0.5"), true)
})

test("el candado vence por timeout", () => {
  let now = 1_000_000
  const timeoutMs = 5_000
  const lock = createTerminalLock({ timeoutMs, now: () => now })
  assert.equal(lock.tryAcquire("10.0.0.5"), true)
  now += timeoutMs - 1
  assert.equal(lock.tryAcquire("10.0.0.5"), false)
  assert.equal(lock.isBusy("10.0.0.5"), true)
  now += 2
  assert.equal(lock.isBusy("10.0.0.5"), false)
  assert.equal(lock.tryAcquire("10.0.0.5"), true)
})

test("timeoutMs por defecto cubre dos llamadas Bancard de 90 s (190 s)", () => {
  let now = 0
  const lock = createTerminalLock({ now: () => now })
  assert.equal(lock.tryAcquire("10.0.0.5"), true)
  now = 189_999
  assert.equal(lock.tryAcquire("10.0.0.5"), false)
  now = 190_001
  assert.equal(lock.tryAcquire("10.0.0.5"), true)
})

test("subscribe se notifica al adquirir y al liberar, y el desuscriptor funciona", () => {
  const lock = createTerminalLock()
  let calls = 0
  const unsubscribe = lock.subscribe(() => { calls++ })
  lock.tryAcquire("10.0.0.5")
  assert.equal(calls, 1)
  lock.release("10.0.0.5")
  assert.equal(calls, 2)
  unsubscribe()
  lock.tryAcquire("10.0.0.5")
  lock.release("10.0.0.5")
  assert.equal(calls, 2)
})
