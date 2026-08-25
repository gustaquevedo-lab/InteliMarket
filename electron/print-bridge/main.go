// print-bridge: envia bytes RAW (ESC/POS) directo a una impresora de Windows
// via WinSpool, sin pasar por el pipeline de impresion HTML/GDI de Chromium.
//
// Por que existe: Electron/Chromium imprime HTML convirtiendolo a paginas GDI
// y dejando que el driver de la impresora las traduzca a la resolucion fisica.
// Con el driver OEM de la ZKP8008 (un clon ESC/POS generico), esa traduccion
// no respeta el ancho de pagina pedido -- el ticket sale corrido a la
// izquierda y cortado a la derecha sin importar que ancho se pida desde la
// app. Mandando los comandos ESC/POS directamente (el mismo protocolo que
// entiende el motor de impresion de la maquina, sin ninguna capa GDI en el
// medio) se evita esa traduccion por completo.
//
// Uso:
//
//	print-bridge.exe <NombreImpresora>   -- lee los bytes crudos de stdin y
//	                                         los manda como un trabajo RAW
package main

import (
	"fmt"
	"io"
	"os"
	"syscall"
	"unsafe"
)

var (
	modWinspool          = syscall.NewLazyDLL("winspool.drv")
	procOpenPrinter      = modWinspool.NewProc("OpenPrinterW")
	procClosePrinter     = modWinspool.NewProc("ClosePrinter")
	procStartDocPrinter  = modWinspool.NewProc("StartDocPrinterW")
	procEndDocPrinter    = modWinspool.NewProc("EndDocPrinter")
	procStartPagePrinter = modWinspool.NewProc("StartPagePrinter")
	procEndPagePrinter   = modWinspool.NewProc("EndPagePrinter")
	procWritePrinter     = modWinspool.NewProc("WritePrinter")
)

type docInfo1 struct {
	pDocName    *uint16
	pOutputFile *uint16
	pDatatype   *uint16
}

func fail(format string, args ...interface{}) {
	fmt.Fprintf(os.Stderr, format+"\n", args...)
	os.Exit(1)
}

func main() {
	if len(os.Args) < 2 {
		fail("uso: print-bridge.exe <NombreImpresora> (lee bytes RAW de stdin)")
	}
	printerName := os.Args[1]

	data, err := io.ReadAll(os.Stdin)
	if err != nil {
		fail("error leyendo stdin: %v", err)
	}
	if len(data) == 0 {
		fail("no llegaron datos por stdin")
	}

	pName, err := syscall.UTF16PtrFromString(printerName)
	if err != nil {
		fail("nombre de impresora invalido: %v", err)
	}

	var hPrinter syscall.Handle
	r, _, callErr := procOpenPrinter.Call(uintptr(unsafe.Pointer(pName)), uintptr(unsafe.Pointer(&hPrinter)), 0)
	if r == 0 {
		fail("no se pudo abrir la impresora %q: %v", printerName, callErr)
	}
	defer procClosePrinter.Call(uintptr(hPrinter))

	docName, _ := syscall.UTF16PtrFromString("Ticket InteliMarket POS")
	dataType, _ := syscall.UTF16PtrFromString("RAW")
	di := docInfo1{pDocName: docName, pOutputFile: nil, pDatatype: dataType}

	r, _, callErr = procStartDocPrinter.Call(uintptr(hPrinter), 1, uintptr(unsafe.Pointer(&di)))
	if r == 0 {
		fail("no se pudo iniciar el trabajo de impresion: %v", callErr)
	}
	defer procEndDocPrinter.Call(uintptr(hPrinter))

	r, _, callErr = procStartPagePrinter.Call(uintptr(hPrinter))
	if r == 0 {
		fail("no se pudo iniciar la pagina: %v", callErr)
	}
	defer procEndPagePrinter.Call(uintptr(hPrinter))

	var written uint32
	r, _, callErr = procWritePrinter.Call(uintptr(hPrinter), uintptr(unsafe.Pointer(&data[0])), uintptr(len(data)), uintptr(unsafe.Pointer(&written)))
	if r == 0 {
		fail("error escribiendo a la impresora: %v", callErr)
	}
	if int(written) != len(data) {
		fail("escritura incompleta: %d de %d bytes", written, len(data))
	}

	fmt.Println("OK")
}
