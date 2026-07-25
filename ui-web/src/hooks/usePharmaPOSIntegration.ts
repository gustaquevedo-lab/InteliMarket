import { useState, useEffect, useCallback } from "react"
import { pharmaApi, type PharmaMedication, type PharmaExpirationAlert } from "../api/pharma"
import { useFeatures } from "../context/FeatureContext"

export interface PharmaCartInfo {
  medication_id: string
  es_controlado: boolean
  requiere_cadena_frio: boolean
  es_generico: boolean
  concentracion: string
  forma_farmaceutica: string
  laboratorio: string | null
  registro_sanitario: string | null
}

export function usePharmaPOSIntegration() {
  const { hasFeature } = useFeatures()
  const pharmaEnabled = hasFeature("pharma")
  const [medicationMap, setMedicationMap] = useState<Map<string, PharmaMedication>>(new Map())
  const [expirationAlerts, setExpirationAlerts] = useState<PharmaExpirationAlert[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!pharmaEnabled) { setMedicationMap(new Map()); setExpirationAlerts([]); return }
    setLoading(true)
    Promise.all([
      pharmaApi.medications.list({ limit: 500 }).catch(() => [] as PharmaMedication[]),
      pharmaApi.expirationAlerts.list({ tipo: "critica" }).catch(() => [] as PharmaExpirationAlert[]),
    ]).then(([meds, alerts]) => {
      const map = new Map<string, PharmaMedication>()
      meds.forEach(m => map.set(m.product_id, m))
      setMedicationMap(map)
      setExpirationAlerts(alerts)
    }).finally(() => setLoading(false))
  }, [pharmaEnabled])

  const getMedicationInfo = useCallback((productId: string): PharmaCartInfo | null => {
    const m = medicationMap.get(productId)
    if (!m) return null
    return {
      medication_id: m.id,
      es_controlado: m.es_controlado,
      requiere_cadena_frio: m.requiere_cadena_frio,
      es_generico: m.es_generico,
      concentracion: m.concentracion,
      forma_farmaceutica: m.forma_farmaceutica,
      laboratorio: m.laboratorio,
      registro_sanitario: m.registro_sanitario,
    }
  }, [medicationMap])

  const getMedication = useCallback((productId: string): PharmaMedication | undefined => {
    return medicationMap.get(productId)
  }, [medicationMap])

  const handlePharmaPostSale = useCallback(async (
    saleId: string,
    cart: Array<{ id: string; quantity: number } & Partial<PharmaCartInfo>>,
    customerId?: string,
  ) => {
    if (!pharmaEnabled) return
    for (const item of cart) {
      if (item.es_controlado) {
        try {
          await pharmaApi.controlledLogs.create({
            medication_id: item.medication_id,
            product_id: item.id,
            cantidad: item.quantity,
            tipo_movimiento: "salida",
            patient_nombre: undefined,
            patient_ci: undefined,
          })
        } catch {}
      }
    }
  }, [pharmaEnabled])

  return { pharmaEnabled, medicationMap, expirationAlerts, loading, getMedicationInfo, getMedication, handlePharmaPostSale }
}
