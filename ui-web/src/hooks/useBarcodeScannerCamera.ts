import { useState, useRef, useEffect, useCallback } from "react"
import { BrowserMultiFormatReader, DecodeHintType, BarcodeFormat } from "@zxing/library"

export interface UseBarcodeScannerCameraOptions {
  onScan: (code: string) => void | Promise<void>
  formats?: BarcodeFormat[]
  scanCooldownMs?: number
  storageKey?: string
}

export interface UseBarcodeScannerCameraReturn {
  videoRef: (node: HTMLVideoElement | null) => void
  videoElement: HTMLVideoElement | null
  cameraActive: boolean
  cameraLoading: boolean
  cameraError: string | null
  availableCameras: MediaDeviceInfo[]
  selectedCameraId: string
  activeCameraLabel: string
  isRearCamera: boolean
  hasTorch: boolean
  torchActive: boolean
  startCamera: (targetDeviceId?: string) => Promise<void>
  stopCamera: () => void
  switchCamera: () => Promise<void>
  toggleTorch: () => Promise<void>
}

const DEFAULT_FORMATS = [
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
  BarcodeFormat.CODE_128,
  BarcodeFormat.CODE_39,
  BarcodeFormat.ITF,
  BarcodeFormat.QR_CODE,
]

export function useBarcodeScannerCamera(
  options: UseBarcodeScannerCameraOptions
): UseBarcodeScannerCameraReturn {
  const {
    onScan,
    formats = DEFAULT_FORMATS,
    scanCooldownMs = 1500,
    storageKey = "intelimarket_preferred_camera_id",
  } = options

  const onScanRef = useRef(onScan)
  onScanRef.current = onScan

  const [cameraActive, setCameraActive] = useState(false)
  const [cameraLoading, setCameraLoading] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([])
  const [selectedCameraId, setSelectedCameraId] = useState<string>("")
  const [activeCameraLabel, setActiveCameraLabel] = useState<string>("Cámara Trasera")
  const [isRearCamera, setIsRearCamera] = useState<boolean>(true)
  const [hasTorch, setHasTorch] = useState<boolean>(false)
  const [torchActive, setTorchActive] = useState<boolean>(false)

  const videoNodeRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const zxingReaderRef = useRef<BrowserMultiFormatReader | null>(null)
  const scanLoopRef = useRef<number | null>(null)
  const lastScannedCodeRef = useRef<string>("")
  const lastScannedTimeRef = useRef<number>(0)

  // ── Callback Ref para vincular el stream al nodo video de inmediato ──
  const setVideoRef = useCallback((node: HTMLVideoElement | null) => {
    videoNodeRef.current = node
    if (node && streamRef.current) {
      if (node.srcObject !== streamRef.current) {
        node.srcObject = streamRef.current
        node.setAttribute("playsinline", "true")
        node.setAttribute("autoplay", "true")
        node.muted = true
        node.play().catch((err) => console.warn("Video play error en ref callback:", err))
      }
    }
  }, [])

  // Garantizar enlace si cameraActive cambia
  useEffect(() => {
    if (cameraActive && streamRef.current && videoNodeRef.current) {
      if (videoNodeRef.current.srcObject !== streamRef.current) {
        videoNodeRef.current.srcObject = streamRef.current
        videoNodeRef.current.setAttribute("playsinline", "true")
        videoNodeRef.current.setAttribute("autoplay", "true")
        videoNodeRef.current.muted = true
        videoNodeRef.current.play().catch((err) => console.warn("Video play error en effect:", err))
      }
    }
  }, [cameraActive])

  // Despachador seguro con debounce
  const handleCodeScanned = useCallback(
    (raw: string) => {
      const code = (raw || "").trim()
      if (!code) return

      const now = Date.now()
      if (
        now - lastScannedTimeRef.current < scanCooldownMs &&
        code === lastScannedCodeRef.current
      ) {
        return
      }

      lastScannedTimeRef.current = now
      lastScannedCodeRef.current = code

      try {
        if (navigator.vibrate) navigator.vibrate([40, 60, 80])
      } catch {}

      onScanRef.current(code)
    },
    [scanCooldownMs]
  )

  const stopCamera = useCallback(() => {
    if (scanLoopRef.current) {
      cancelAnimationFrame(scanLoopRef.current)
      scanLoopRef.current = null
    }
    if (zxingReaderRef.current) {
      try {
        zxingReaderRef.current.reset()
      } catch {}
      zxingReaderRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    if (videoNodeRef.current) {
      videoNodeRef.current.srcObject = null
    }
    setCameraActive(false)
    setTorchActive(false)
    setHasTorch(false)
  }, [])

  const startCamera = useCallback(
    async (targetDeviceId?: string) => {
      setCameraError(null)
      setCameraLoading(true)

      // Detener sesión previa si existía
      if (scanLoopRef.current) {
        cancelAnimationFrame(scanLoopRef.current)
        scanLoopRef.current = null
      }
      if (zxingReaderRef.current) {
        try {
          zxingReaderRef.current.reset()
        } catch {}
        zxingReaderRef.current = null
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }

      try {
        // 1. Determinar ID de dispositivo preferido
        let chosenDeviceId =
          targetDeviceId ||
          (storageKey ? localStorage.getItem(storageKey) || undefined : undefined)

        let stream: MediaStream | null = null

        // Si tenemos un deviceId guardado o especificado, intentar primero con él
        if (chosenDeviceId) {
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: {
                deviceId: { exact: chosenDeviceId },
                width: { ideal: 1280 },
                height: { ideal: 720 },
              },
              audio: false,
            })
          } catch (err) {
            console.warn("Fallo con deviceId exacto, procediendo con negociación:", err)
            chosenDeviceId = undefined
          }
        }

        // Si no hay stream aún, solicitar cámara trasera preferida
        if (!stream) {
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: {
                facingMode: { ideal: "environment" },
                width: { ideal: 1280 },
                height: { ideal: 720 },
              },
              audio: false,
            })
          } catch {
            try {
              stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "environment" },
                audio: false,
              })
            } catch {
              stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: false,
              })
            }
          }
        }

        // 2. Permiso concedido. Enumerar dispositivos con labels legibles
        let videoDevices: MediaDeviceInfo[] = []
        try {
          if (navigator.mediaDevices?.enumerateDevices) {
            const allDevices = await navigator.mediaDevices.enumerateDevices()
            videoDevices = allDevices.filter((d) => d.kind === "videoinput")
            setAvailableCameras(videoDevices)
          }
        } catch {}

        let activeTrack = stream.getVideoTracks()[0]
        let activeSettings = activeTrack.getSettings ? activeTrack.getSettings() : {}
        let activeLabel = (activeTrack.label || "").toLowerCase()
        let activeDevId = activeSettings.deviceId || chosenDeviceId || ""

        const isBackLabel = (l: string) => /back|rear|trasera|environment|extern/i.test(l)
        const isFrontLabel = (l: string) => /front|delantera|user|selfie/i.test(l)
        const isFrontActive = isFrontLabel(activeLabel) || activeSettings.facingMode === "user"

        // 3. Si Android abrió la cámara frontal involuntariamente y existen más cámaras:
        if (isFrontActive && videoDevices.length > 1 && !targetDeviceId) {
          let backCandidate = videoDevices.find((d) => isBackLabel(d.label))
          if (!backCandidate) {
            backCandidate = videoDevices.find((d) => /camera.*0/i.test(d.label))
          }
          if (!backCandidate) {
            backCandidate = videoDevices.find(
              (d) => !isFrontLabel(d.label) && d.deviceId !== activeDevId
            )
          }
          if (!backCandidate) {
            backCandidate = videoDevices.find((d) => d.deviceId !== activeDevId)
          }

          if (backCandidate && backCandidate.deviceId !== activeDevId) {
            try {
              activeTrack.stop()
              stream = await navigator.mediaDevices.getUserMedia({
                video: {
                  deviceId: { exact: backCandidate.deviceId },
                  width: { ideal: 1280 },
                  height: { ideal: 720 },
                },
                audio: false,
              })
              activeTrack = stream.getVideoTracks()[0]
              activeSettings = activeTrack.getSettings ? activeTrack.getSettings() : {}
              activeLabel = (activeTrack.label || "").toLowerCase()
              activeDevId = backCandidate.deviceId
            } catch (err) {
              console.warn("Fallo al conmutar a cámara trasera confirmada:", err)
            }
          }
        }

        streamRef.current = stream
        if (activeDevId) {
          setSelectedCameraId(activeDevId)
          if (storageKey) localStorage.setItem(storageKey, activeDevId)
        }

        // Evaluar si es trasera o frontal para la UI
        const isCurrentlyBack =
          isBackLabel(activeLabel) ||
          (!isFrontLabel(activeLabel) && videoDevices.length > 1) ||
          activeSettings.facingMode === "environment"
        setIsRearCamera(isCurrentlyBack)
        setActiveCameraLabel(
          isCurrentlyBack
            ? "Cámara Trasera"
            : isFrontLabel(activeLabel)
            ? "Cámara Frontal"
            : activeTrack.label || "Cámara Activa"
        )

        // Comprobar soporte de linterna
        const capabilities: any = activeTrack.getCapabilities
          ? activeTrack.getCapabilities()
          : {}
        setHasTorch(!!capabilities.torch)

        // Asignar al elemento video
        if (videoNodeRef.current) {
          videoNodeRef.current.srcObject = stream
          videoNodeRef.current.setAttribute("playsinline", "true")
          videoNodeRef.current.setAttribute("autoplay", "true")
          videoNodeRef.current.muted = true
          await videoNodeRef.current.play().catch(() => {})
        }

        setCameraActive(true)

        // 4. Iniciar decodificador universal ZXing (soporte absoluto multiplataforma)
        const hints = new Map()
        hints.set(DecodeHintType.POSSIBLE_FORMATS, formats)
        hints.set(DecodeHintType.TRY_HARDER, true)

        const reader = new BrowserMultiFormatReader(hints, 200)
        zxingReaderRef.current = reader

        if (videoNodeRef.current) {
          try {
            reader.decodeFromStream(stream, videoNodeRef.current, (result) => {
              if (result) {
                handleCodeScanned(result.getText())
              }
            })
          } catch (zxingErr) {
            console.warn("Error iniciando ZXing stream reader:", zxingErr)
          }
        }

        // 5. Iniciar aceleración por hardware BarcodeDetector nativo (Chromium) si está soportado
        if ("BarcodeDetector" in window) {
          try {
            const detector = new (window as any).BarcodeDetector({
              formats: [
                "ean_13",
                "ean_8",
                "code_128",
                "qr_code",
                "upc_a",
                "upc_e",
                "code_39",
              ],
            })

            const detectLoop = async () => {
              if (
                !videoNodeRef.current ||
                videoNodeRef.current.readyState < 2 ||
                !streamRef.current
              ) {
                scanLoopRef.current = requestAnimationFrame(detectLoop)
                return
              }
              try {
                const barcodes = await detector.detect(videoNodeRef.current)
                if (barcodes.length > 0 && barcodes[0].rawValue) {
                  handleCodeScanned(barcodes[0].rawValue)
                }
              } catch {}
              scanLoopRef.current = requestAnimationFrame(detectLoop)
            }

            scanLoopRef.current = requestAnimationFrame(detectLoop)
          } catch {}
        }
      } catch (err: any) {
        console.error("Error al activar cámara:", err)
        setCameraActive(false)
        const name = err?.name || ""
        if (name === "NotAllowedError" || name === "PermissionDeniedError") {
          setCameraError(
            "Permiso de cámara denegado. Habilitá el acceso a la cámara en los permisos de la aplicación en los ajustes de tu teléfono."
          )
        } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
          setCameraError("No se encontró ninguna cámara utilizable en este dispositivo.")
        } else if (name === "NotReadableError" || name === "TrackStartError") {
          setCameraError(
            "La cámara está bloqueada o en uso por otra app. Cerrala y volvé a intentar."
          )
        } else if (location.protocol !== "https:" && location.hostname !== "localhost") {
          setCameraError("La cámara requiere conexión HTTPS segura.")
        } else {
          setCameraError(err?.message || "No se pudo iniciar la cámara en el dispositivo.")
        }
      } finally {
        setCameraLoading(false)
      }
    },
    [formats, handleCodeScanned, storageKey]
  )

  const switchCamera = useCallback(async () => {
    if (availableCameras.length <= 1) {
      stopCamera()
      setTimeout(() => startCamera(), 150)
      return
    }

    const currentIdx = availableCameras.findIndex(
      (c) => c.deviceId === selectedCameraId
    )
    const nextIdx = (currentIdx + 1) % availableCameras.length
    const nextDevice = availableCameras[nextIdx]

    stopCamera()
    setTimeout(() => startCamera(nextDevice.deviceId), 150)
  }, [availableCameras, selectedCameraId, startCamera, stopCamera])

  const toggleTorch = useCallback(async () => {
    if (!streamRef.current) return
    const track = streamRef.current.getVideoTracks()[0]
    if (!track) return

    const capabilities: any = track.getCapabilities ? track.getCapabilities() : {}
    if (!capabilities.torch) return

    const nextTorch = !torchActive
    try {
      await (track.applyConstraints as any)({
        advanced: [{ torch: nextTorch }],
      })
      setTorchActive(nextTorch)
    } catch (err) {
      console.warn("Fallo al cambiar estado de linterna:", err)
    }
  }, [torchActive])

  // Limpieza al desmontar
  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [stopCamera])

  return {
    videoRef: setVideoRef,
    videoElement: videoNodeRef.current,
    cameraActive,
    cameraLoading,
    cameraError,
    availableCameras,
    selectedCameraId,
    activeCameraLabel,
    isRearCamera,
    hasTorch,
    torchActive,
    startCamera,
    stopCamera,
    switchCamera,
    toggleTorch,
  }
}
