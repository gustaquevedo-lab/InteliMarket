import type { LucideIcon } from "lucide-react"

export type MockType =
  | "kpiGrid"
  | "table"
  | "pos"
  | "form"
  | "chart"
  | "list"
  | "map"
  | "chat"
  | "calendar"
  | "recibo"
  | "tradeGrid"
  | "workflow"

export interface MockColumn {
  label: string
  value: string
  badge?: boolean
  currency?: boolean
  badgeColor?: string
}

export interface MockRow {
  [key: string]: string | number | Record<string, string> | undefined
  badges?: Record<string, string>
}

export interface MockKPI {
  label: string
  value: string
  sub?: string
  color?: "green" | "blue" | "amber" | "purple" | "indigo" | "red"
  trend?: "up" | "down"
}

export interface MockItem {
  title: string
  sub?: string
  right?: string
  badge?: string
  badgeColor?: "green" | "amber" | "red" | "blue" | "gray" | "purple"
}

export interface MockChart {
  kind: "line" | "bar" | "area" | "donut"
  points: Array<{ label: string; value: number }>
  unit?: string
}

export interface MockBlock {
  type: MockType
  title?: string
  kpis?: MockKPI[]
  columns?: MockColumn[]
  rows?: MockRow[]
  items?: MockItem[]
  chart?: MockChart
  formFields?: Array<{ label: string; type: string; placeholder?: string; value?: string; required?: boolean; options?: string[] }>
  chatMessages?: Array<{ from: "user" | "bot"; text: string }>
  caption?: string
}

export interface ModuleStep {
  title: string
  detail: string
  mockKey?: string
}

export interface ModuleTab {
  id: string
  label: string
}

export interface ManualModule {
  id: string
  label: string
  path: string
  icon: LucideIcon
  tagline: string
  category: string
  description: string
  color: string
  tabs?: ModuleTab[]
  steps: ModuleStep[]
  mocks: Record<string, MockBlock>
  tips?: string[]
  faq?: Array<{ q: string; a: string }>
}

export interface ManualCategory {
  id: string
  label: string
  icon: LucideIcon
  gradient: string
  description: string
  subtitle: string
  modules: ManualModule[]
}