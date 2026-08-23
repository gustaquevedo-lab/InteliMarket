// scale-bridge: puente serie dedicado para balanzas de checkout con protocolo
// Toledo/Filizola/ACBrBal (Balmak BCK30 y compatibles).
//
// Reemplaza el enfoque anterior (PowerShell + System.IO.Ports leído como texto)
// por un parser de trama binaria correcto: STX(0x02) + 5 dígitos ASCII + ETX(0x03).
// La razón de que el enfoque anterior fallara no era "PowerShell es lento": es que
// nunca respetaba los delimitadores de trama STX/ETX, así que cualquier ruido,
// eco de comando, o lectura partida producía falsos positivos o cortaba tramas
// a la mitad. Acá se lee byte a byte con una máquina de estados que sólo acepta
// una trama completa y bien formada.
//
// Uso:
//
//	scale-bridge.exe list                    -> lista puertos COM disponibles (JSON)
//	scale-bridge.exe <PUERTO> <BAUDIOS>       -> abre el puerto y transmite lecturas (JSON, una por línea, por stdout)
//
// Salida (una línea JSON por evento, sin buffering):
//
//	{"type":"status","connected":true,"port":"COM3"}
//	{"type":"weight","weight_kg":1.235,"stable":true,"raw":"01235","port":"COM3"}
//	{"type":"log","message":"..."}
//	{"type":"error","message":"..."}
//
// Control desde el proceso padre (Electron) por stdin, una línea por comando:
//
//	RECONFIGURE <PUERTO> <BAUDIOS>   -> cierra el puerto actual y abre otro
//	STOP                             -> cierra el puerto y termina
package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"

	"go.bug.st/serial"
)

const (
	stx = 0x02
	etx = 0x03
	enq = 0x05

	// Cada cuánto se reenvía ENQ mientras se espera una trama. Si la balanza
	// ya está en modo continuo (P03), estos ENQ de más no rompen nada: el
	// parser sólo reacciona a bytes STX/ETX, cualquier otro byte fuera de una
	// trama en curso se ignora.
	enqInterval = 300 * time.Millisecond

	// Ventana de estabilidad: se considera "peso estable" cuando las últimas
	// N lecturas coinciden exactamente. Esto es un criterio pragmático propio
	// de este bridge (el protocolo de la BCK30 no expone un bit de estabilidad
	// documentado) — es el mismo criterio que usan la mayoría de integraciones
	// de punto de venta con básculas Toledo/Filizola cuando no hay bit de
	// estado dedicado.
	stabilityWindow = 3
)

type event map[string]interface{}

var (
	stdoutMu sync.Mutex
	writer   = bufio.NewWriter(os.Stdout)
)

func emit(e event) {
	stdoutMu.Lock()
	defer stdoutMu.Unlock()
	b, err := json.Marshal(e)
	if err != nil {
		return
	}
	writer.Write(b)
	writer.WriteByte('\n')
	writer.Flush() // sin esto, Node puede no ver la línea hasta que el buffer se llene
}

func logMsg(format string, args ...interface{}) {
	emit(event{"type": "log", "message": fmt.Sprintf(format, args...)})
}

func errMsg(format string, args ...interface{}) {
	emit(event{"type": "error", "message": fmt.Sprintf(format, args...)})
}

func main() {
	args := os.Args[1:]

	if len(args) == 0 {
		errMsg("uso: scale-bridge.exe list | scale-bridge.exe <PUERTO> <BAUDIOS>")
		os.Exit(1)
	}

	if args[0] == "list" {
		listPorts()
		return
	}

	if len(args) < 2 {
		errMsg("faltan argumentos: scale-bridge.exe <PUERTO> <BAUDIOS>")
		os.Exit(1)
	}

	baud, err := strconv.Atoi(args[1])
	if err != nil {
		errMsg("baudrate inválido: %s", args[1])
		os.Exit(1)
	}

	run(args[0], baud)
}

func listPorts() {
	ports, err := serial.GetPortsList()
	if err != nil {
		errMsg("no se pudieron enumerar los puertos: %v", err)
		emit(event{"type": "ports", "ports": []string{}})
		return
	}
	emit(event{"type": "ports", "ports": ports})
}

// run abre el puerto indicado y queda transmitiendo lecturas hasta recibir
// STOP por stdin, una señal de terminación del proceso, o un error fatal de
// puerto (en cuyo caso se reintenta la apertura, no se aborta el proceso —
// un cable desconectado y reconectado no debería obligar a reiniciar Electron).
type reconfigMsg struct {
	port string
	baud int
}

func run(portName string, baud int) {
	stop := make(chan struct{})
	reconfig := make(chan reconfigMsg)

	go watchStdin(stop, reconfig)

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, os.Interrupt, syscall.SIGTERM)
	go func() {
		<-sigCh
		close(stop)
	}()

	current := portName
	currentBaud := baud

	for {
		select {
		case <-stop:
			return
		default:
		}

		port, err := openPort(current, currentBaud)
		if err != nil {
			errMsg("no se pudo abrir %s a %d bps: %v", current, currentBaud, err)
			emit(event{"type": "status", "connected": false, "port": current})
			// Reintento con backoff: el cable puede estar desconectado todavía.
			select {
			case <-stop:
				return
			case <-time.After(3 * time.Second):
				continue
			}
		}

		emit(event{"type": "status", "connected": true, "port": current})
		logMsg("puerto %s abierto a %d bps (8N1, sin control de flujo)", current, currentBaud)

		exitReason, reconfigured := readLoop(port, current, stop, reconfig)
		port.Close()
		emit(event{"type": "status", "connected": false, "port": current})

		switch exitReason {
		case exitStop:
			return
		case exitReconfig:
			current = reconfigured.port
			currentBaud = reconfigured.baud
			logMsg("reconfigurando a %s @ %d bps", current, currentBaud)
		case exitError:
			logMsg("conexión perdida en %s, reintentando en 3s...", current)
			time.Sleep(3 * time.Second)
		}
	}
}

func openPort(name string, baud int) (serial.Port, error) {
	mode := &serial.Mode{
		BaudRate: baud,
		DataBits: 8,
		Parity:   serial.NoParity,
		StopBits: serial.OneStopBit,
	}
	port, err := serial.Open(name, mode)
	if err != nil {
		return nil, err
	}

	// Muchas básculas Toledo/Filizola/Balmak conectadas por conversor USB-serie
	// necesitan RTS/DTR en alto para energizar el aislador óptico o señalizar
	// DTE-ready. Sin esto, el puerto abre pero la báscula nunca responde.
	_ = port.SetRTS(true)
	_ = port.SetDTR(true)

	// Timeout de lectura corto: permite revisar periódicamente si hay que
	// reenviar ENQ o si llegó un comando de reconfiguración por stdin, sin
	// bloquear indefinidamente esperando bytes que quizás no lleguen.
	_ = port.SetReadTimeout(100 * time.Millisecond)

	return port, nil
}

type exitReason int

const (
	exitError exitReason = iota
	exitStop
	exitReconfig
)

// readLoop implementa la máquina de estados de trama y el sondeo ENQ.
// Estados: esperando STX -> acumulando 5 dígitos -> esperando ETX.
// Cualquier byte fuera de una trama en curso (ruido, eco, basura) se descarta
// sin afectar la trama siguiente — a diferencia del parser anterior, que
// concatenaba todo en un buffer de texto y aplicaba regex sueltas.
func readLoop(port serial.Port, portName string, stop <-chan struct{}, reconfig <-chan reconfigMsg) (exitReason, reconfigMsg) {
	buf := make([]byte, 256)
	lastEnq := time.Now()
	_ = sendEnq(port) // primer sondeo inmediato al abrir

	const (
		waitingStx = iota
		readingDigits
		waitingEtx
	)
	state := waitingStx
	digits := make([]byte, 0, 5)

	history := make([]int, 0, stabilityWindow)

	consecutiveReadErrors := 0

	for {
		select {
		case <-stop:
			return exitStop, reconfigMsg{}
		case r := <-reconfig:
			return exitReconfig, r
		default:
		}

		if time.Since(lastEnq) >= enqInterval {
			if err := sendEnq(port); err != nil {
				return exitError, reconfigMsg{}
			}
			lastEnq = time.Now()
		}

		n, err := port.Read(buf)
		if err != nil {
			consecutiveReadErrors++
			if consecutiveReadErrors > 20 {
				errMsg("puerto %s dejó de responder: %v", portName, err)
				return exitError, reconfigMsg{}
			}
			continue
		}
		if n == 0 {
			continue // timeout de lectura normal, sin datos todavía
		}
		consecutiveReadErrors = 0

		for i := 0; i < n; i++ {
			b := buf[i]

			switch state {
			case waitingStx:
				if b == stx {
					state = readingDigits
					digits = digits[:0]
				}
				// cualquier otro byte fuera de una trama se descarta

			case readingDigits:
				if b == stx {
					// nueva trama empezó antes de que termine la anterior:
					// se descarta la parcial y se arranca de nuevo, no se
					// arrastra basura de una trama corrupta.
					digits = digits[:0]
					continue
				}
				if b >= '0' && b <= '9' {
					digits = append(digits, b)
					if len(digits) == 5 {
						state = waitingEtx
					}
				} else if b == etx {
					// trama corta (menos de 5 dígitos) — se descarta, no se adivina
					state = waitingStx
				} else {
					// byte inesperado dentro de la trama: se descarta la trama
					state = waitingStx
					digits = digits[:0]
				}

			case waitingEtx:
				if b == etx {
					handleFrame(string(digits), portName, &history)
				}
				// tanto si vino ETX como si no, se vuelve a esperar la próxima trama
				state = waitingStx
				digits = digits[:0]
			}
		}
	}
}

func sendEnq(port serial.Port) error {
	_, err := port.Write([]byte{enq})
	return err
}

// handleFrame convierte 5 dígitos ASCII (peso en gramos) a kg y actualiza la
// ventana de estabilidad antes de emitir la lectura.
func handleFrame(digits string, portName string, history *[]int) {
	grams, err := strconv.Atoi(digits)
	if err != nil {
		return
	}

	*history = append(*history, grams)
	if len(*history) > stabilityWindow {
		*history = (*history)[len(*history)-stabilityWindow:]
	}
	stable := len(*history) == stabilityWindow && allEqual(*history)

	emit(event{
		"type":      "weight",
		"weight_kg": roundTo3(float64(grams) / 1000.0),
		"stable":    stable,
		"raw":       digits,
		"port":      portName,
	})
}

func allEqual(v []int) bool {
	for i := 1; i < len(v); i++ {
		if v[i] != v[0] {
			return false
		}
	}
	return true
}

func roundTo3(v float64) float64 {
	return float64(int(v*1000+0.5)) / 1000
}

// watchStdin permite que Electron controle el bridge sin tener que matarlo y
// relanzarlo cada vez que el usuario cambia de puerto/baudrate desde la UI.
func watchStdin(stop chan struct{}, reconfig chan reconfigMsg) {
	scanner := bufio.NewScanner(os.Stdin)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}
		fields := strings.Fields(line)
		switch strings.ToUpper(fields[0]) {
		case "STOP":
			close(stop)
			return
		case "RECONFIGURE":
			if len(fields) != 3 {
				errMsg("RECONFIGURE requiere <PUERTO> <BAUDIOS>")
				continue
			}
			baud, err := strconv.Atoi(fields[2])
			if err != nil {
				errMsg("baudrate inválido en RECONFIGURE: %s", fields[2])
				continue
			}
			reconfig <- reconfigMsg{fields[1], baud}
		}
	}
	// stdin cerrado (el padre murió o cerró el pipe) => terminar limpio
	close(stop)
}
