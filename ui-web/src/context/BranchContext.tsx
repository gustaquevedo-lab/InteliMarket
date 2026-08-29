import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react"
import { api, type Branch } from "../api"
import { useAuth } from "./AuthContext"

export interface EmissionPointInfo {
  codigo: string
  nombre: string
  branch_codigo: string
}

export const OFFICIAL_EMISSION_POINTS: EmissionPointInfo[] = [
  { codigo: "001-001", nombre: "Caja Principal 1 (Casa Central)", branch_codigo: "001" },
  { codigo: "001-002", nombre: "Caja Mayorista 2 (Casa Central)", branch_codigo: "001" },
  { codigo: "001-003", nombre: "Caja Preventa 3 (Casa Central)", branch_codigo: "001" },
  { codigo: "002-001", nombre: "Caja Retail 1 (Salón Supermercado)", branch_codigo: "002" },
  { codigo: "003-001", nombre: "Expedición Santa Rosa (Sucursal Santa Rosa)", branch_codigo: "003" },
  { codigo: "003-002", nombre: "Expedición Depósito San Pedro (Sucursal Santa Rosa)", branch_codigo: "003" },
  { codigo: "004-001", nombre: "Expedición Capitán Bado (Sucursal Cap. Bado)", branch_codigo: "004" }
]

interface BranchContextType {
  branches: Branch[]
  selectedBranchId: string // "all" | branch.id
  selectedBranch: Branch | null
  setSelectedBranchId: (id: string) => void
  isConsolidated: boolean
  emissionPoints: EmissionPointInfo[]
  loading: boolean
  refreshBranches: () => Promise<void>
}

const BranchContext = createContext<BranchContextType | undefined>(undefined)

const DEFAULT_BRANCHES: Branch[] = [
  {
    id: "13bab831-185b-56d7-8c10-74ec2feb9dfb",
    company_id: "00000000-0000-0000-0000-000000000010",
    codigo: "001",
    nombre: "Casa Central",
    ciudad: "Pedro Juan Caballero",
    departamento: "Amambay",
    direccion: "Av. Carlos Antonio López e/ Mcal. Estigarribia",
    telefono: "0336 272000",
    email: "central@casagonzalito.com.py",
    ruc: "80012345-6",
    punto_emision: 1,
    activo: true,
    created_at: new Date().toISOString()
  },
  {
    id: "4119a8db-2401-5916-b429-904cf9ebecc4",
    company_id: "00000000-0000-0000-0000-000000000010",
    codigo: "002",
    nombre: "Salón de Ventas (Supermercado)",
    ciudad: "Pedro Juan Caballero",
    departamento: "Amambay",
    direccion: "Av. Carlos Antonio López esq. Curupayty",
    telefono: "0336 272005",
    email: "salon@casagonzalito.com.py",
    ruc: "80012345-6",
    punto_emision: 1,
    activo: true,
    created_at: new Date().toISOString()
  },
  {
    id: "a9a31377-275f-5820-9891-723583b751ed",
    company_id: "00000000-0000-0000-0000-000000000010",
    codigo: "003",
    nombre: "Sucursal Santa Rosa",
    ciudad: "Santa Rosa del Aguaray",
    departamento: "San Pedro",
    direccion: "Ruta PY08 Dr. Blas Garay km 320",
    telefono: "0343 420100",
    email: "santarosa@casagonzalito.com.py",
    ruc: "80012345-6",
    punto_emision: 1,
    activo: true,
    created_at: new Date().toISOString()
  },
  {
    id: "00fdb863-d8c5-5bb7-aa05-03776a6a2444",
    company_id: "00000000-0000-0000-0000-000000000010",
    codigo: "004",
    nombre: "Sucursal Capitán Bado",
    ciudad: "Capitán Bado",
    departamento: "Amambay",
    direccion: "Av. Internacional e/ 14 de Mayo",
    telefono: "0337 230150",
    email: "bado@casagonzalito.com.py",
    ruc: "80012345-6",
    punto_emision: 1,
    activo: true,
    created_at: new Date().toISOString()
  }
]

export function BranchProvider({ children }: { children: React.ReactNode }) {
  const [branches, setBranches] = useState<Branch[]>(DEFAULT_BRANCHES)
  const [selectedBranchId, setSelectedBranchIdState] = useState<string>(() => {
    return localStorage.getItem("intelimarket_selected_branch_id") || "all"
  })
  const [loading, setLoading] = useState(false)

  const { user } = useAuth()

  const refreshBranches = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const res = await api.branches.list()
      if (res && Array.isArray(res) && res.length > 0) {
        setBranches(res)
      }
    } catch {
      // Use fallback
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (user) {
      refreshBranches()
    }
  }, [user, refreshBranches])

  const setSelectedBranchId = useCallback((id: string) => {
    setSelectedBranchIdState(id)
    localStorage.setItem("intelimarket_selected_branch_id", id)
  }, [])

  const selectedBranch = useMemo(() => {
    if (selectedBranchId === "all") return null
    return branches.find(b => b.id === selectedBranchId) || null
  }, [branches, selectedBranchId])

  const isConsolidated = selectedBranchId === "all"

  const emissionPoints = useMemo(() => {
    if (selectedBranchId === "all") return OFFICIAL_EMISSION_POINTS
    if (!selectedBranch) return OFFICIAL_EMISSION_POINTS
    return OFFICIAL_EMISSION_POINTS.filter(ep => ep.branch_codigo === selectedBranch.codigo)
  }, [selectedBranchId, selectedBranch])

  const value = useMemo(() => ({
    branches,
    selectedBranchId,
    selectedBranch,
    setSelectedBranchId,
    isConsolidated,
    emissionPoints,
    loading,
    refreshBranches
  }), [branches, selectedBranchId, selectedBranch, setSelectedBranchId, isConsolidated, emissionPoints, loading, refreshBranches])

  return (
    <BranchContext.Provider value={value}>
      {children}
    </BranchContext.Provider>
  )
}

export function useBranch() {
  const context = useContext(BranchContext)
  if (!context) {
    throw new Error("useBranch must be used within a BranchProvider")
  }
  return context
}
