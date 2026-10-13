import React, { useState, useEffect, useRef, useMemo } from "react"
import { Modal } from "../../components/Modal"
import {
  Bot, Plus, Edit, Trash2, Check, ExternalLink, RefreshCw,
  Smartphone, Sparkles, ChevronRight, CheckCircle2, RotateCcw,
  ArrowRight, Search, Zap, Layers, GitBranch, MessageSquare,
  Globe, PhoneCall, ListFilter, CornerDownRight, X, Play, Send, ShieldCheck, Power
} from "lucide-react"

export interface BotButton {
  id: string
  text: string
  type: "reply" | "url" | "call"
  next_node?: string
  url?: string
  phoneNumber?: string
}

export interface BotListRow {
  id: string
  title: string
  description?: string
  next_node?: string
}

export interface BotListSection {
  title: string
  rows: BotListRow[]
}

export interface BotFlowNode {
  id: string
  title: string
  type: "buttons" | "list" | "message" | "action"
  action_type?: "extraclub_points" | "sorteo_cupones" | "promotions_active" | "search_catalog" | "human_handoff"
  content: string
  footer?: string
  button_text?: string
  buttons?: BotButton[]
  sections?: BotListSection[]
  trigger_keywords?: string[]
}

export interface BotFlow {
  id: string
  name: string
  active: boolean
  nodes: BotFlowNode[]
}

export interface BotFlowBuilderProps {
  flow: BotFlow | null
  onSave?: (flow: BotFlow) => Promise<void>
  onSaveFlow?: (flow: BotFlow) => Promise<void>
  onReset?: () => Promise<void>
  onResetFlow?: () => Promise<void>
  saving: boolean
  loading: boolean
}

// ── Plantillas oficiales de Extra Supermercado ──
const PRESET_TEMPLATES: Record<string, { name: string; description: string; flow: BotFlow }> = {
  principal: {
    name: "Flujo Maestro de Atención & Fidelidad",
    description: "Bienvenida con 3 botones interactivos, consulta de saldo ExtraClub, ofertas del día y lista de servicios.",
    flow: {
      id: "flow-supermercado-master",
      name: "Flujo Oficial Extra Supermercado",
      active: true,
      nodes: [
        {
          id: "start",
          title: "Bienvenida y Menú Principal",
          type: "buttons",
          content: "¡Hola {cliente}! 👋 Bienvenido al canal oficial de atención de *Extra Supermercado Mayorista* 🛒✨\n\n¿En qué podemos ayudarte hoy?",
          footer: "Extra Supermercado • Elija una opción",
          buttons: [
            { id: "btn_puntos", text: "⭐ Mis Puntos", type: "reply", next_node: "node_puntos" },
            { id: "btn_ofertas", text: "🔥 Ofertas del Día", type: "reply", next_node: "node_ofertas" },
            { id: "btn_mas_opciones", text: "📋 Más Opciones", type: "reply", next_node: "node_lista_servicios" },
          ],
          trigger_keywords: ["hola", "buenas", "buen dia", "menu", "inicio", "empezar", "0"],
        },
        {
          id: "node_puntos",
          title: "Saldo ExtraClub",
          type: "action",
          action_type: "extraclub_points",
          content: "⭐ *Tu Saldo ExtraClub — Extra Supermercado* ⭐\n\n👤 Titular: *{cliente}*\n💳 Doc: *{documento}*\n✨ Puntos Disponibles: *{puntos} Pts.*\n💰 Equivalente en Compras: *Gs. {valor_monetario}*\n\n🛒 _Podés canjear tus puntos directamente en línea de caja en tu próxima compra._",
          footer: "1 Punto = Gs. 100",
          buttons: [
            { id: "btn_premios", text: "🎁 Premios Temporada", type: "reply", next_node: "node_premios" },
            { id: "btn_cupones", text: "🎟️ Mis Cupones", type: "reply", next_node: "node_cupones" },
            { id: "btn_volver", text: "⬅️ Menú Principal", type: "reply", next_node: "start" },
          ],
          trigger_keywords: ["puntos", "saldo", "extraclub", "cuanto tengo"],
        },
        {
          id: "node_ofertas",
          title: "Promociones y Ofertas",
          type: "action",
          action_type: "promotions_active",
          content: "🔥 *OFERTAS Y PROMOCIONES ACTIVAS EN EXTRA SUPERMERCADO* 🔥\n\n{promociones_texto}\n\n¡Te esperamos en nuestro salón con los mejores precios del país!",
          footer: "Precios vigentes hasta agotar stock",
          buttons: [
            { id: "btn_catalogo_web", text: "🌐 Ver Tienda Web", type: "url", url: "https://superextra.com.py" },
            { id: "btn_cupones", text: "🎟️ Mis Cupones", type: "reply", next_node: "node_cupones" },
            { id: "btn_volver", text: "⬅️ Menú Principal", type: "reply", next_node: "start" },
          ],
          trigger_keywords: ["ofertas", "oferta", "promociones", "promo", "descuentos"],
        },
        {
          id: "node_cupones",
          title: "Cupones de Sorteo",
          type: "action",
          action_type: "sorteo_cupones",
          content: "🎟️ *Tus Cupones de Sorteo — Extra Supermercado*\n\n👤 Cliente: *{cliente}* (Doc: {documento})\n🏆 Campaña: *{campana_sorteo}*\n\n🎯 Tenés un total de *{cupones_totales} cupones acumulados* a tu nombre.\n¡Cada compra que realizás en caja te suma más chances automáticas!",
          footer: "Sorteo oficial Extra Supermercado",
          buttons: [
            { id: "btn_puntos", text: "⭐ Mis Puntos", type: "reply", next_node: "node_puntos" },
            { id: "btn_ofertas", text: "🔥 Ver Ofertas", type: "reply", next_node: "node_ofertas" },
            { id: "btn_volver", text: "⬅️ Menú Principal", type: "reply", next_node: "start" },
          ],
          trigger_keywords: ["cupones", "sorteo", "cupon", "sorteos"],
        },
        {
          id: "node_lista_servicios",
          title: "Menú Extendido (Lista)",
          type: "list",
          content: "Por favor seleccioná el servicio o departamento que deseás consultar:",
          button_text: "Ver Servicios 📋",
          footer: "Extra Supermercado Mayorista",
          sections: [
            {
              title: "Fidelidad & Sorteos",
              rows: [
                { id: "opt_pts", title: "⭐ Saldo de Puntos", description: "Consultá tus puntos ExtraClub acumulados", next_node: "node_puntos" },
                { id: "opt_cup", title: "🎟️ Cupones de Sorteos", description: "Tus cupones para el sorteo del año", next_node: "node_cupones" },
                { id: "opt_pre", title: "🎁 Catálogo de Premios", description: "Electrodomésticos y canjes disponibles", next_node: "node_premios" },
              ],
            },
            {
              title: "Compras & Envíos",
              rows: [
                { id: "opt_ofe", title: "🔥 Ofertas del Día", description: "Precios especiales y descuentos relámpago", next_node: "node_ofertas" },
                { id: "opt_del", title: "🚚 Envíos a Domicilio", description: "Costos y zonas de cobertura de delivery", next_node: "node_delivery" },
                { id: "opt_ban", title: "💳 Cuentas Bancarias & Pagos", description: "Datos para transferencias y PIX", next_node: "node_banco" },
              ],
            },
            {
              title: "Atención al Cliente",
              rows: [
                { id: "opt_suc", title: "📍 Sucursales & Horarios", description: "Ubicación en Google Maps y horarios", next_node: "node_sucursales" },
                { id: "opt_hum", title: "👤 Hablar con un Asesor", description: "Transferir chat a una persona de soporte", next_node: "node_humano" },
              ],
            },
          ],
          trigger_keywords: ["servicios", "opciones", "mas", "lista"],
        },
        {
          id: "node_premios",
          title: "Catálogo de Premios",
          type: "message",
          content: "🎁 *Premios Disponibles para Canje ExtraClub:*\n\n☕ *1.500 Pts:* Pava Eléctrica Inox 1.8L\n🍳 *2.500 Pts:* Set de Sartenes Antiadherentes\n🥪 *3.500 Pts:* Sandwichera Grill Antiadherente\n💨 *7.000 Pts:* Freidora de Aire Digital 4.5L\n🍲 *12.000 Pts:* Horno Eléctrico de Mesa 45L\n📺 *25.000 Pts:* Smart TV 43\" Full HD\n\n💡 _También podés canjear tus puntos por dinero directo en caja (1 Punto = Gs. 100)._",
          footer: "Canje directo en línea de caja",
          buttons: [
            { id: "btn_puntos", text: "⭐ Mis Puntos", type: "reply", next_node: "node_puntos" },
            { id: "btn_humano", text: "👤 Solicitar Canje", type: "reply", next_node: "node_humano" },
            { id: "btn_volver", text: "⬅️ Menú Principal", type: "reply", next_node: "start" },
          ],
          trigger_keywords: ["premios", "canjes", "catalogo de premios"],
        },
        {
          id: "node_delivery",
          title: "Delivery & Envíos",
          type: "message",
          content: "🚚 *Envíos a Domicilio — Extra Supermercado*\n\n🕒 *Horario:* Lunes a Sábados de 08:00 a 19:00 hs.\n📍 *Cobertura:* Radio de hasta 15 km de nuestras sucursales.\n💵 *Costo de envío:* Gs. 15.000 (¡Envío GRATIS en compras a partir de Gs. 300.000!).\n\nPodés pasarnos tu lista de compras directamente por este medio.",
          footer: "Envíos en el día con cadena de frío",
          buttons: [
            { id: "btn_pedir", text: "👤 Pedir a un Asesor", type: "reply", next_node: "node_humano" },
            { id: "btn_ofertas", text: "🔥 Ver Ofertas", type: "reply", next_node: "node_ofertas" },
            { id: "btn_volver", text: "⬅️ Menú Principal", type: "reply", next_node: "start" },
          ],
          trigger_keywords: ["delivery", "envio", "envíos", "domicilio", "flete"],
        },
        {
          id: "node_banco",
          title: "Datos Bancarios y Pagos",
          type: "message",
          content: "💳 *Datos Bancarios Oficiales — Extra Supermercado*\n\n🏦 *Banco:* Banco Continental\n📄 *Razón Social:* GRUPO SANTA TERESA E.A.S.\n🆔 *RUC:* 80150377-9\n🔢 *Cta. Cte. Gs:* 01-2345678-01\n📲 *Alias / PIX:* compras@superextra.com.py\n\n_Por favor envianos tu comprobante por este medio una vez realizada la transferencia._",
          footer: "Cuentas oficiales verificadas",
          buttons: [
            { id: "btn_enviar_comp", text: "👤 Hablar con Asesor", type: "reply", next_node: "node_humano" },
            { id: "btn_volver", text: "⬅️ Menú Principal", type: "reply", next_node: "start" },
          ],
          trigger_keywords: ["transferencia", "banco", "alias", "pix", "datos bancarios", "pagar"],
        },
        {
          id: "node_sucursales",
          title: "Sucursales & Horarios",
          type: "buttons",
          content: "📍 *Sucursales & Horarios — Extra Supermercado*\n\n🕒 *Horario de Atención:*\n• Lunes a Sábados: 07:00 a 21:00 hs\n• Domingos: 07:30 a 13:00 hs\n\n📌 *Casa Central:* Av. Carlos Antonio López y Curupayty, Pedro Juan Caballero, Paraguay.",
          footer: "Estacionamiento propio y seguridad privada",
          buttons: [
            { id: "btn_maps", text: "📍 Abrir en Google Maps", type: "url", url: "https://maps.google.com/?q=Extra+Supermercado+Mayorista" },
            { id: "btn_humano", text: "👤 Hablar con Asesor", type: "reply", next_node: "node_humano" },
            { id: "btn_volver", text: "⬅️ Menú Principal", type: "reply", next_node: "start" },
          ],
          trigger_keywords: ["horario", "horarios", "ubicacion", "sucursales", "donde estan", "direccion"],
        },
        {
          id: "node_humano",
          title: "Transferencia a Operador Humano",
          type: "action",
          action_type: "human_handoff",
          content: "👤 *¡Un asesor de atención al cliente se pondrá en contacto contigo a la brevedad!*\n\nHemos pausado la respuesta automática para que un operador humano pueda responderte de forma personalizada.\n\n_Si deseás volver al bot en cualquier momento, enviá *0* o *MENU*._",
          footer: "Atención personalizada Extra",
          buttons: [
            { id: "btn_volver", text: "⬅️ Reactivar Menú Bot", type: "reply", next_node: "start" },
          ],
          trigger_keywords: ["asesor", "humano", "persona", "operador", "ayuda", "representante"],
        },
      ],
    },
  },
}

export default function BotFlowBuilder({ flow, onSave, onSaveFlow, onReset, onResetFlow, saving, loading }: BotFlowBuilderProps) {
  const handleSaveTrigger = onSave || onSaveFlow || (async () => {})
  const handleResetTrigger = onReset || onResetFlow || (async () => {})

  // Estado local del flujo editable
  const [localFlow, setLocalFlow] = useState<BotFlow | null>(flow)
  const [selectedNodeId, setSelectedNodeId] = useState<string>("start")
  const [searchFilter, setSearchFilter] = useState<string>("")

  // Estado del modal de edición de nodo
  const [showModal, setShowModal] = useState<boolean>(false)
  const [editingNode, setEditingNode] = useState<BotFlowNode | null>(null)
  const [nodeForm, setNodeForm] = useState<{
    id: string
    title: string
    type: "buttons" | "list" | "message" | "action"
    action_type: string
    content: string
    footer: string
    button_text: string
    buttons: BotButton[]
    sections: BotListSection[]
    trigger_keywords: string
  }>({
    id: "",
    title: "",
    type: "buttons",
    action_type: "",
    content: "",
    footer: "Extra Supermercado Mayorista",
    button_text: "Ver Opciones 📋",
    buttons: [],
    sections: [],
    trigger_keywords: "",
  })

  // Estado del Simulador WhatsApp en tiempo real
  const [simName, setSimName] = useState<string>("Juan Pérez")
  const [simMessages, setSimMessages] = useState<Array<{
    id: string
    sender: "bot" | "user"
    text: string
    time: string
    type?: string
    buttons?: BotButton[]
    sections?: BotListSection[]
    button_text?: string
    footer?: string
  }>>([])
  const [simInput, setSimInput] = useState<string>("")
  const [showSimListDrawer, setShowSimListDrawer] = useState<boolean>(false)
  const [activeSimListSections, setActiveSimListSections] = useState<BotListSection[]>([])
  const simChatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (flow) {
      setLocalFlow(flow)
    }
  }, [flow])

  // Iniciar el simulador con el nodo start
  useEffect(() => {
    if (localFlow && localFlow.nodes.length > 0) {
      resetSimulator()
    }
  }, [localFlow?.id])

  useEffect(() => {
    simChatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [simMessages])

  // Nodos filtrados
  const filteredNodes = useMemo(() => {
    if (!localFlow?.nodes) return []
    if (!searchFilter.trim()) return localFlow.nodes
    const q = searchFilter.toLowerCase()
    return localFlow.nodes.filter(
      (n) => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q) || n.id.toLowerCase().includes(q)
    )
  }, [localFlow?.nodes, searchFilter])

  // Renderizador de variables en el simulador
  const renderTextForSim = (rawText: string): string => {
    return rawText
      .replace(/{cliente}/g, simName || "Cliente")
      .replace(/{documento}/g, "1.234.567-8")
      .replace(/{socio_numero}/g, "EC-88421")
      .replace(/{puntos}/g, "1.450")
      .replace(/{valor_monetario}/g, "145.000")
      .replace(/{cupones_totales}/g, "12")
      .replace(/{campana_sorteo}/g, "Gran Sorteo Aniversario Extra")
      .replace(
        /{promociones_texto}/g,
        "1️⃣ *Costilla de Primera* 🏷️ Gs. 32.000/Kg\n2️⃣ *Arroz Supremo 5Kg* 🏷️ Gs. 24.500\n3️⃣ *Aceite de Soja 900ml* 🏷️ Gs. 8.500\n4️⃣ *Detergente Activo 1L* 🏷️ *2x1*"
      )
  }

  const resetSimulator = () => {
    if (!localFlow || !localFlow.nodes.length) return
    const startNode = localFlow.nodes.find((n) => n.id === "start") || localFlow.nodes[0]
    setSelectedNodeId(startNode.id)
    const nowStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    setSimMessages([
      {
        id: "msg-0",
        sender: "bot",
        text: renderTextForSim(startNode.content),
        time: nowStr,
        type: startNode.type,
        buttons: startNode.buttons,
        sections: startNode.sections,
        button_text: startNode.button_text,
        footer: startNode.footer,
      },
    ])
  }

  // Interacción en el simulador: Clic en Botón
  const handleSimButtonClick = (btn: BotButton) => {
    const nowStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    const userMsg = {
      id: `msg-${Date.now()}-u`,
      sender: "user" as const,
      text: btn.text,
      time: nowStr,
    }

    if (btn.type === "url" && btn.url) {
      window.open(btn.url, "_blank")
      setSimMessages((prev) => [
        ...prev,
        userMsg,
        {
          id: `msg-${Date.now()}-b`,
          sender: "bot",
          text: `🌐 *Abriendo enlace externo:*\n${btn.url}`,
          time: nowStr,
        },
      ])
      return
    }

    const nextId = btn.next_node
    if (!nextId || !localFlow) {
      setSimMessages((prev) => [...prev, userMsg])
      return
    }

    const targetNode = localFlow.nodes.find((n) => n.id === nextId)
    if (!targetNode) {
      setSimMessages((prev) => [
        ...prev,
        userMsg,
        {
          id: `msg-${Date.now()}-b`,
          sender: "bot",
          text: `⚠️ _Nodo destino no encontrado (${nextId})_`,
          time: nowStr,
        },
      ])
      return
    }

    setSelectedNodeId(targetNode.id)
    const botMsg = {
      id: `msg-${Date.now()}-b`,
      sender: "bot" as const,
      text: renderTextForSim(targetNode.content),
      time: nowStr,
      type: targetNode.type,
      buttons: targetNode.buttons,
      sections: targetNode.sections,
      button_text: targetNode.button_text,
      footer: targetNode.footer,
    }

    setSimMessages((prev) => [...prev, userMsg, botMsg])
  }

  // Interacción en el simulador: Selección en Menú de Lista
  const handleSimListRowClick = (row: BotListRow) => {
    setShowSimListDrawer(false)
    const nowStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    const userMsg = {
      id: `msg-${Date.now()}-u`,
      sender: "user" as const,
      text: row.title,
      time: nowStr,
    }

    const nextId = row.next_node
    if (!nextId || !localFlow) {
      setSimMessages((prev) => [...prev, userMsg])
      return
    }

    const targetNode = localFlow.nodes.find((n) => n.id === nextId)
    if (!targetNode) return

    setSelectedNodeId(targetNode.id)
    const botMsg = {
      id: `msg-${Date.now()}-b`,
      sender: "bot" as const,
      text: renderTextForSim(targetNode.content),
      time: nowStr,
      type: targetNode.type,
      buttons: targetNode.buttons,
      sections: targetNode.sections,
      button_text: targetNode.button_text,
      footer: targetNode.footer,
    }

    setSimMessages((prev) => [...prev, userMsg, botMsg])
  }

  // Interacción en el simulador: Enviar mensaje de texto tipeado
  const handleSimSendText = (e: React.FormEvent) => {
    e.preventDefault()
    const raw = simInput.trim()
    if (!raw || !localFlow) return
    setSimInput("")

    const nowStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    const userMsg = {
      id: `msg-${Date.now()}-u`,
      sender: "user" as const,
      text: raw,
      time: nowStr,
    }

    const lower = raw.toLowerCase()
    const currentNode = localFlow.nodes.find((n) => n.id === selectedNodeId) || localFlow.nodes[0]
    let targetNode: BotFlowNode | undefined

    // 1. Reseteo universal
    if (["0", "menu", "inicio", "volver", "cancelar", "start"].includes(lower)) {
      targetNode = localFlow.nodes.find((n) => n.id === "start") || localFlow.nodes[0]
    } else if (currentNode) {
      // 2. Verificar botones de nodo actual
      for (const [idx, b] of (currentNode.buttons || []).entries()) {
        if (
          b.id.toLowerCase() === lower ||
          b.text.toLowerCase() === lower ||
          String(idx + 1) === lower ||
          (lower.length >= 3 && b.text.toLowerCase().includes(lower))
        ) {
          targetNode = localFlow.nodes.find((n) => n.id === b.next_node)
          break
        }
      }
      // 3. Verificar filas de lista
      if (!targetNode && currentNode.sections) {
        let rowNum = 1
        for (const sec of currentNode.sections) {
          for (const row of sec.rows || []) {
            if (
              row.id.toLowerCase() === lower ||
              row.title.toLowerCase() === lower ||
              String(rowNum) === lower ||
              (lower.length >= 4 && row.title.toLowerCase().includes(lower))
            ) {
              targetNode = localFlow.nodes.find((n) => n.id === row.next_node)
              break
            }
            rowNum++
          }
          if (targetNode) break
        }
      }
    }

    // 4. Verificar palabras clave en todo el flujo
    if (!targetNode) {
      for (const n of localFlow.nodes) {
        const kws = (n.trigger_keywords || []).map((k) => k.toLowerCase())
        if (kws.some((k) => k === lower || (k.length >= 4 && lower.includes(k)))) {
          targetNode = n
          break
        }
      }
    }

    if (!targetNode) {
      targetNode = localFlow.nodes.find((n) => n.id === "start") || localFlow.nodes[0]
    }

    setSelectedNodeId(targetNode.id)
    const botMsg = {
      id: `msg-${Date.now()}-b`,
      sender: "bot" as const,
      text: renderTextForSim(targetNode.content),
      time: nowStr,
      type: targetNode.type,
      buttons: targetNode.buttons,
      sections: targetNode.sections,
      button_text: targetNode.button_text,
      footer: targetNode.footer,
    }

    setSimMessages((prev) => [...prev, userMsg, botMsg])
  }

  // ── Modal de Edición de Nodo ──
  const handleOpenEditNode = (node?: BotFlowNode) => {
    if (node) {
      setEditingNode(node)
      setNodeForm({
        id: node.id,
        title: node.title,
        type: node.type,
        action_type: node.action_type || "",
        content: node.content,
        footer: node.footer || "Extra Supermercado Mayorista",
        button_text: node.button_text || "Ver Opciones 📋",
        buttons: node.buttons ? [...node.buttons] : [],
        sections: node.sections ? JSON.parse(JSON.stringify(node.sections)) : [],
        trigger_keywords: (node.trigger_keywords || []).join(", "),
      })
    } else {
      const newId = `node_${Date.now()}`
      setEditingNode(null)
      setNodeForm({
        id: newId,
        title: "Nuevo Bloque Interactivo",
        type: "buttons",
        action_type: "",
        content: "Escribí aquí tu mensaje personalizado para el cliente.",
        footer: "Extra Supermercado Mayorista",
        button_text: "Ver Opciones 📋",
        buttons: [
          { id: "btn_1", text: "⭐ Opción 1", type: "reply", next_node: "start" },
          { id: "btn_2", text: "⬅️ Menú Principal", type: "reply", next_node: "start" },
        ],
        sections: [],
        trigger_keywords: "",
      })
    }
    setShowModal(true)
  }

  const handleSaveNode = (e: React.FormEvent) => {
    e.preventDefault()
    if (!nodeForm.title.trim() || !nodeForm.content.trim()) return

    const kws = nodeForm.trigger_keywords
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean)

    const updatedNode: BotFlowNode = {
      id: nodeForm.id,
      title: nodeForm.title,
      type: nodeForm.type,
      action_type: (nodeForm.action_type as any) || undefined,
      content: nodeForm.content,
      footer: nodeForm.footer,
      button_text: nodeForm.button_text,
      buttons: nodeForm.type === "buttons" ? nodeForm.buttons : undefined,
      sections: nodeForm.type === "list" ? nodeForm.sections : undefined,
      trigger_keywords: kws.length > 0 ? kws : undefined,
    }

    if (!localFlow) return

    let nextNodes: BotFlowNode[]
    if (editingNode) {
      nextNodes = localFlow.nodes.map((n) => (n.id === editingNode.id ? updatedNode : n))
    } else {
      nextNodes = [...localFlow.nodes, updatedNode]
    }

    const updatedFlow = { ...localFlow, nodes: nextNodes }
    setLocalFlow(updatedFlow)
    setShowModal(false)
  }

  const handleDeleteNode = (nodeId: string) => {
    if (nodeId === "start") {
      alert("El nodo de inicio 'start' es obligatorio y no puede eliminarse.")
      return
    }
    if (!confirm("¿Eliminar este bloque del flujo?")) return
    if (!localFlow) return

    const nextNodes = localFlow.nodes.filter((n) => n.id !== nodeId)
    setLocalFlow({ ...localFlow, nodes: nextNodes })
    if (selectedNodeId === nodeId) {
      setSelectedNodeId("start")
    }
  }

  const handleLoadTemplate = (templateKey: string) => {
    const tpl = PRESET_TEMPLATES[templateKey]
    if (!tpl) return
    if (!confirm(`¿Cargar la plantilla "${tpl.name}"? Reemplazará los bloques actuales en edición.`)) return
    setLocalFlow(JSON.parse(JSON.stringify(tpl.flow)))
    setSelectedNodeId("start")
  }

  const insertVariable = (varName: string) => {
    setNodeForm((prev) => ({
      ...prev,
      content: prev.content + `{${varName}}`,
    }))
  }

  return (
    <div className="space-y-6">
      {/* Barra de Acciones del Flow Builder */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-600 text-white flex items-center justify-center shadow-sm">
            <GitBranch className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {localFlow?.name || "Flujo Oficial Extra Supermercado"}
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> Botones & Listas Activos
              </span>
            </div>
            <p className="text-xs text-slate-500">
              {localFlow?.nodes.length || 0} Bloques configurados • Respuestas interactivas con datos reales
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Selector de Plantillas */}
          <div className="relative group">
            <button className="btn-secondary text-xs px-3 py-2 flex items-center gap-1.5 rounded-xl text-slate-600">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Plantillas Rápidas
            </button>
            <div className="absolute right-0 mt-1 w-64 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-2 hidden group-hover:block z-20">
              {Object.entries(PRESET_TEMPLATES).map(([k, v]) => (
                <button
                  key={k}
                  onClick={() => handleLoadTemplate(k)}
                  className="w-full text-left p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  <p className="text-xs font-bold text-slate-900 dark:text-white">{v.name}</p>
                  <p className="text-[10px] text-slate-400 line-clamp-2 mt-0.5">{v.description}</p>
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleResetTrigger}
            disabled={loading}
            className="btn-secondary text-xs px-3 py-2 flex items-center gap-1.5 rounded-xl text-slate-600"
            title="Restaurar flujo oficial"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Restaurar
          </button>

          <button
            onClick={() => handleOpenEditNode()}
            className="btn-secondary text-xs px-3 py-2 flex items-center gap-1.5 rounded-xl text-indigo-600 dark:text-indigo-400 font-bold border-indigo-200/60 hover:bg-indigo-50/50"
          >
            <Plus className="w-3.5 h-3.5" /> Nuevo Bloque
          </button>

          {/* Toggle Activo / Pausado del Flujo */}
          <button
            type="button"
            onClick={() => {
              if (!localFlow) return
              const nextActive = !localFlow.active
              const updated = { ...localFlow, active: nextActive }
              setLocalFlow(updated)
              handleSaveTrigger(updated)
            }}
            disabled={saving || !localFlow}
            className={`text-xs px-3.5 py-2 flex items-center gap-1.5 rounded-xl font-black transition-all shadow-sm cursor-pointer ${
              localFlow?.active
                ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700"
                : "bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-700 animate-pulse"
            }`}
            title="Alternar estado activo/pausado del flujo"
          >
            <Power className="w-3.5 h-3.5" />
            <span>{localFlow?.active ? "Flujo: ACTIVO" : "Flujo: PAUSADO"}</span>
          </button>

          <button
            onClick={() => localFlow && handleSaveTrigger(localFlow)}
            disabled={saving || !localFlow}
            className="btn-primary text-xs px-4 py-2 flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold shadow-sm hover:from-emerald-700 hover:to-teal-700"
          >
            {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            Guardar Cambios
          </button>
        </div>
      </div>

      {/* Grid Principal: Canvas Visual a la izquierda (7 cols) + Simulador Móvil a la derecha (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ── COLUMNA IZQUIERDA: CANVAS / ÁRBOL VISUAL DE BLOQUES ── */}
        <div className="lg:col-span-7 space-y-4">
          {/* Barra de Filtro y Métricas */}
          <div className="flex items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Buscar bloque por título, texto o ID..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="input pl-9 py-1.5 text-xs w-full"
              />
            </div>
            <span className="text-xs text-slate-400 font-mono">
              {filteredNodes.length} de {localFlow?.nodes.length || 0} nodos
            </span>
          </div>

          {/* Lista de Nodos / Tarjetas Visuales */}
          <div className="space-y-3">
            {filteredNodes.map((node, index) => {
              const isStart = node.id === "start"
              const isSelected = selectedNodeId === node.id

              return (
                <div
                  key={node.id}
                  onClick={() => setSelectedNodeId(node.id)}
                  className={`bg-white dark:bg-slate-900 rounded-3xl p-5 border transition-all cursor-pointer relative overflow-hidden shadow-xs hover:shadow-md ${
                    isSelected
                      ? "border-emerald-500 ring-2 ring-emerald-500/20 shadow-emerald-500/5"
                      : "border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                  }`}
                >
                  {/* Barra superior de la tarjeta */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold ${
                          isStart
                            ? "bg-emerald-500 text-white"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                        }`}
                      >
                        #{index + 1}
                      </span>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        {node.title}
                        {isStart && (
                          <span className="px-2 py-0.5 rounded-md text-[9px] font-bold uppercase bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400">
                            Inicio / Trigger
                          </span>
                        )}
                      </h3>
                    </div>

                    {/* Badge de Tipo */}
                    <div className="flex items-center gap-1.5">
                      {node.type === "buttons" && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-400 border border-indigo-200/50 flex items-center gap-1">
                          <MessageSquare className="w-3 h-3" /> Botones ({node.buttons?.length || 0})
                        </span>
                      )}
                      {node.type === "list" && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400 border border-amber-200/50 flex items-center gap-1">
                          <ListFilter className="w-3 h-3" /> Menú Lista
                        </span>
                      )}
                      {node.type === "action" && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-50 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-400 border border-cyan-200/50 flex items-center gap-1">
                          <Zap className="w-3 h-3" /> Acción: {node.action_type}
                        </span>
                      )}
                      {node.type === "message" && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                          💬 Texto
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Previsualización del Contenido del Mensaje */}
                  <div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-2xl border border-slate-100 dark:border-slate-800/60 mb-3 text-xs text-slate-700 dark:text-slate-300 font-mono whitespace-pre-line line-clamp-3">
                    {node.content}
                  </div>

                  {/* Botones / Enlaces / Opciones del Nodo */}
                  {node.type === "buttons" && node.buttons && node.buttons.length > 0 && (
                    <div className="space-y-1.5 mb-3">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Botones Interactivos de Salida:
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {node.buttons.map((b) => (
                          <span
                            key={b.id}
                            className={`px-2.5 py-1 rounded-xl text-xs font-semibold flex items-center gap-1.5 border shadow-2xs ${
                              b.type === "url"
                                ? "bg-cyan-50 text-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-300 border-cyan-200/60"
                                : "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700"
                            }`}
                          >
                            {b.type === "url" ? <Globe className="w-3 h-3 text-cyan-600" /> : <ArrowRight className="w-3 h-3 text-emerald-600" />}
                            {b.text}
                            {b.next_node && (
                              <span className="text-[10px] text-slate-400 font-mono">
                                ➔ {localFlow?.nodes.find((n) => n.id === b.next_node)?.title || b.next_node}
                              </span>
                            )}
                            {b.type === "url" && b.url && (
                              <span className="text-[10px] text-cyan-500 font-mono truncate max-w-[100px]">
                                ➔ {b.url}
                              </span>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* List Menu Sections Preview */}
                  {node.type === "list" && node.sections && (
                    <div className="space-y-1.5 mb-3">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Opciones del Menú Desplegable ({node.button_text || "Ver Opciones"}):
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {node.sections.flatMap((s) => s.rows || []).map((r) => (
                          <span
                            key={r.id}
                            className="px-2.5 py-1 rounded-xl text-xs font-semibold bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 border border-amber-200/60 flex items-center gap-1.5"
                          >
                            <ListFilter className="w-3 h-3 text-amber-600" />
                            {r.title}
                            {r.next_node && (
                              <span className="text-[10px] text-slate-400 font-mono">
                                ➔ {localFlow?.nodes.find((n) => n.id === r.next_node)?.title || r.next_node}
                              </span>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Botones de acción del nodo */}
                  <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
                    <span className="text-[10px] text-slate-400 font-mono">ID: {node.id}</span>
                    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleOpenEditNode(node)}
                        className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 flex items-center gap-1 font-bold text-[11px]"
                      >
                        <Edit className="w-3.5 h-3.5" /> Editar
                      </button>
                      {!isStart && (
                        <button
                          onClick={() => handleDeleteNode(node.id)}
                          className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-500 flex items-center gap-1 text-[11px]"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Eliminar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── COLUMNA DERECHA: SIMULADOR INTERACTIVO WHATSAPP (MÓVIL) ── */}
        <div className="lg:col-span-5 sticky top-6">
          <div className="bg-slate-900 text-white rounded-[40px] p-3 shadow-2xl border-4 border-slate-800 max-w-sm mx-auto overflow-hidden">
            {/* Notch / Speaker del Móvil */}
            <div className="w-36 h-4 bg-slate-800 rounded-full mx-auto mb-2 flex items-center justify-center">
              <div className="w-10 h-1 bg-slate-700 rounded-full" />
            </div>

            {/* Pantalla del Teléfono */}
            <div className="bg-[#efeae2] dark:bg-[#0b141a] rounded-[32px] overflow-hidden flex flex-col h-[580px] text-slate-900 dark:text-slate-100 relative">
              {/* WhatsApp Header */}
              <div className="bg-[#008069] dark:bg-[#202c33] text-white px-4 py-3 flex items-center justify-between shadow-md z-10">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-white text-[#008069] font-black flex items-center justify-center text-xs shadow-inner">
                    EX
                  </div>
                  <div>
                    <h4 className="text-xs font-bold flex items-center gap-1 leading-tight">
                      Extra Supermercado
                      <CheckCircle2 className="w-3 h-3 text-white fill-emerald-400" />
                    </h4>
                    <p className="text-[10px] text-emerald-100 dark:text-slate-400 leading-tight">en línea</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={resetSimulator}
                    className="p-1.5 rounded-full hover:bg-white/10 text-white transition-colors"
                    title="Reiniciar chat simulado"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Área de Mensajes del Chat */}
              <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-[radial-gradient(#d1d7db_1px,transparent_1px)] dark:bg-[radial-gradient(#1f2c34_1px,transparent_1px)] [background-size:16px_16px]">
                <div className="text-center my-1">
                  <span className="px-2.5 py-1 rounded-md text-[10px] bg-white/80 dark:bg-slate-800/80 text-slate-500 shadow-2xs font-medium">
                    Hoy • Mensajes cifrados de extremo a extremo
                  </span>
                </div>

                {simMessages.map((msg) => {
                  const isBot = msg.sender === "bot"

                  return (
                    <div key={msg.id} className={`flex flex-col ${isBot ? "items-start" : "items-end"}`}>
                      {/* Burbuja Principal */}
                      <div
                        className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs shadow-sm relative ${
                          isBot
                            ? "bg-white dark:bg-[#202c33] text-slate-800 dark:text-slate-100 rounded-tl-none"
                            : "bg-[#d9fdd3] dark:bg-[#005c4b] text-slate-900 dark:text-slate-100 rounded-tr-none"
                        }`}
                      >
                        <p className="whitespace-pre-line leading-relaxed font-sans">{msg.text}</p>

                        {/* Footer si tiene */}
                        {msg.footer && (
                          <p className="text-[10px] text-slate-400 border-t border-slate-100 dark:border-slate-700/60 pt-1 mt-1.5 font-sans">
                            {msg.footer}
                          </p>
                        )}

                        <span className="text-[9px] text-slate-400 block text-right mt-1 font-mono">
                          {msg.time}
                        </span>
                      </div>

                      {/* Botones Interactivos Nativos en la burbuja */}
                      {isBot && msg.buttons && msg.buttons.length > 0 && (
                        <div className="w-[85%] space-y-1 mt-1">
                          {msg.buttons.map((b) => (
                            <button
                              key={b.id}
                              onClick={() => handleSimButtonClick(b)}
                              className="w-full py-2 px-3 rounded-xl bg-white dark:bg-[#202c33] hover:bg-slate-50 dark:hover:bg-[#2a3942] text-emerald-600 dark:text-emerald-400 font-bold text-xs text-center border border-slate-200/80 dark:border-slate-700/80 shadow-xs transition-all flex items-center justify-center gap-1.5 active:scale-[0.98]"
                            >
                              {b.type === "url" ? <Globe className="w-3.5 h-3.5" /> : <MessageSquare className="w-3.5 h-3.5" />}
                              {b.text}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Menú de Lista Nativo en la burbuja */}
                      {isBot && msg.type === "list" && msg.sections && msg.sections.length > 0 && (
                        <div className="w-[85%] mt-1">
                          <button
                            onClick={() => {
                              setActiveSimListSections(msg.sections || [])
                              setShowSimListDrawer(true)
                            }}
                            className="w-full py-2.5 px-3 rounded-xl bg-white dark:bg-[#202c33] hover:bg-slate-50 dark:hover:bg-[#2a3942] text-emerald-600 dark:text-emerald-400 font-bold text-xs text-center border border-slate-200/80 dark:border-slate-700/80 shadow-xs transition-all flex items-center justify-center gap-1.5"
                          >
                            <ListFilter className="w-4 h-4 text-emerald-600" />
                            {msg.button_text || "Ver Opciones 📋"}
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
                <div ref={simChatEndRef} />
              </div>

              {/* Drawer de Lista Interactiva en el Simulador */}
              {showSimListDrawer && (
                <div className="absolute inset-0 bg-black/60 z-20 flex flex-col justify-end animate-in fade-in">
                  <div className="bg-white dark:bg-[#202c33] rounded-t-3xl max-h-[75%] overflow-y-auto p-4 space-y-3 shadow-2xl">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-2">
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <ListFilter className="w-4 h-4 text-emerald-600" /> Menú de Opciones
                      </h4>
                      <button onClick={() => setShowSimListDrawer(false)} className="text-slate-400 hover:text-slate-600">
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="space-y-3">
                      {activeSimListSections.map((sec, sIdx) => (
                        <div key={sIdx} className="space-y-1.5">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{sec.title}</p>
                          <div className="space-y-1">
                            {sec.rows.map((r) => (
                              <button
                                key={r.id}
                                onClick={() => handleSimListRowClick(r)}
                                className="w-full text-left p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-[#2a3942] border border-slate-100 dark:border-slate-700/60 transition-colors"
                              >
                                <p className="text-xs font-bold text-slate-900 dark:text-white">{r.title}</p>
                                {r.description && <p className="text-[10px] text-slate-400 mt-0.5">{r.description}</p>}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Barra de Input del Simulador */}
              <form
                onSubmit={handleSimSendText}
                className="bg-slate-100 dark:bg-[#202c33] p-2 flex items-center gap-2 border-t border-slate-200/60 dark:border-slate-700/60"
              >
                <input
                  type="text"
                  placeholder="Escribí como cliente (ej: puntos, hola)..."
                  value={simInput}
                  onChange={(e) => setSimInput(e.target.value)}
                  className="input py-1.5 px-3 text-xs flex-1 bg-white dark:bg-[#2a3942] rounded-full border-none"
                />
                <button
                  type="submit"
                  disabled={!simInput.trim()}
                  className="w-8 h-8 rounded-full bg-[#00a884] text-white flex items-center justify-center shrink-0 disabled:opacity-40"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>

            {/* Ajuste de Nombre Simulado */}
            <div className="mt-2 px-2 flex items-center justify-between text-[11px] text-slate-400">
              <span className="flex items-center gap-1">👤 Cliente:</span>
              <input
                type="text"
                value={simName}
                onChange={(e) => setSimName(e.target.value)}
                placeholder="Nombre para {cliente}"
                className="bg-slate-800 text-slate-200 px-2 py-0.5 rounded text-[11px] font-mono w-32 border border-slate-700"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── MODAL PARA CREAR / EDITAR NODO ── */}
      {showModal && (
        <Modal
          open={showModal}
          onClose={() => setShowModal(false)}
          title={editingNode ? `Editar Bloque: ${editingNode.title}` : "Crear Nuevo Bloque Interactivo"}
          size="lg"
        >
          <form onSubmit={handleSaveNode} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Título del Bloque (Referencia)
                </label>
                <input
                  type="text"
                  value={nodeForm.title}
                  onChange={(e) => setNodeForm({ ...nodeForm, title: e.target.value })}
                  placeholder="Ej: Saldo de Puntos"
                  className="input text-xs"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Identificador Único (ID)
                </label>
                <input
                  type="text"
                  value={nodeForm.id}
                  disabled={nodeForm.id === "start"}
                  onChange={(e) => setNodeForm({ ...nodeForm, id: e.target.value.toLowerCase().replace(/\s+/g, "_") })}
                  className="input text-xs font-mono"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Tipo de Respuesta de WhatsApp
                </label>
                <select
                  value={nodeForm.type}
                  onChange={(e) => setNodeForm({ ...nodeForm, type: e.target.value as any })}
                  className="input text-xs"
                >
                  <option value="buttons">🔘 Mensaje con Botones Interactivos (hasta 3)</option>
                  <option value="list">📋 Menú Desplegable (Lista de Opciones)</option>
                  <option value="action">⚡ Acción del Sistema (ExtraClub, Sorteos, Ofertas)</option>
                  <option value="message">💬 Mensaje de Texto Simple</option>
                </select>
              </div>

              {nodeForm.type === "action" && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Acción Dinámica del Sistema
                  </label>
                  <select
                    value={nodeForm.action_type}
                    onChange={(e) => setNodeForm({ ...nodeForm, action_type: e.target.value })}
                    className="input text-xs font-bold text-cyan-600"
                  >
                    <option value="extraclub_points">⭐ Consultar Puntos ExtraClub Verídicos</option>
                    <option value="sorteo_cupones">🎟️ Consultar Cupones de Sorteo Acumulados</option>
                    <option value="promotions_active">🔥 Listar Ofertas y Descuentos Activos</option>
                    <option value="human_handoff">👤 Transferir a Operador Humano (Pausar Bot)</option>
                    <option value="search_catalog">📦 Búsqueda de Productos y Stock</option>
                  </select>
                </div>
              )}
            </div>

            {/* Inserción de Variables */}
            <div className="bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-2xl border border-slate-200/60 dark:border-slate-800">
              <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1 mb-1.5">
                <Sparkles className="w-3 h-3 text-emerald-600" /> Insertar Variable Dinámica al Mensaje:
              </span>
              <div className="flex flex-wrap gap-1">
                {[
                  { key: "cliente", label: "Nombre Cliente" },
                  { key: "puntos", label: "Puntos ExtraClub" },
                  { key: "valor_monetario", label: "Equiv. Gs." },
                  { key: "documento", label: "Doc / RUC" },
                  { key: "socio_numero", label: "N° Socio" },
                  { key: "cupones_totales", label: "Cupones Sorteo" },
                  { key: "campana_sorteo", label: "Campaña Sorteo" },
                  { key: "promociones_texto", label: "Listado de Ofertas" },
                ].map((v) => (
                  <button
                    key={v.key}
                    type="button"
                    onClick={() => insertVariable(v.key)}
                    className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-emerald-500 hover:text-emerald-600"
                  >
                    +{`{${v.key}}`}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Cuerpo del Mensaje (WhatsApp)
              </label>
              <textarea
                rows={5}
                value={nodeForm.content}
                onChange={(e) => setNodeForm({ ...nodeForm, content: e.target.value })}
                className="input text-xs font-mono resize-none"
                placeholder="Escribí el texto del mensaje. Soporta negrita *texto* y emojis."
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Pie de Mensaje (Footer gris inferior)
              </label>
              <input
                type="text"
                value={nodeForm.footer}
                onChange={(e) => setNodeForm({ ...nodeForm, footer: e.target.value })}
                placeholder="Ej: Extra Supermercado Mayorista"
                className="input text-xs"
              />
            </div>

            {/* Configuración de Botones si tipo es 'buttons' */}
            {nodeForm.type === "buttons" && (
              <div className="space-y-2 border-t border-slate-100 dark:border-slate-800 pt-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-emerald-600" /> Botones Interactivos (Máximo 3)
                  </label>
                  {nodeForm.buttons.length < 3 && (
                    <button
                      type="button"
                      onClick={() =>
                        setNodeForm({
                          ...nodeForm,
                          buttons: [
                            ...nodeForm.buttons,
                            {
                              id: `btn_${nodeForm.buttons.length + 1}`,
                              text: `Opción ${nodeForm.buttons.length + 1}`,
                              type: "reply",
                              next_node: "start",
                            },
                          ],
                        })
                      }
                      className="text-xs text-emerald-600 font-bold hover:underline flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> Agregar Botón
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  {nodeForm.buttons.map((btn, bIdx) => (
                    <div
                      key={bIdx}
                      className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/60 dark:border-slate-700 flex flex-wrap items-center gap-2"
                    >
                      <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-bold">
                        {bIdx + 1}
                      </span>
                      <input
                        type="text"
                        placeholder="Texto del botón (máx 20 chars)"
                        maxLength={20}
                        value={btn.text}
                        onChange={(e) => {
                          const updated = [...nodeForm.buttons]
                          updated[bIdx].text = e.target.value
                          setNodeForm({ ...nodeForm, buttons: updated })
                        }}
                        className="input text-xs py-1 px-2.5 flex-1 min-w-[140px]"
                        required
                      />

                      <select
                        value={btn.type}
                        onChange={(e) => {
                          const updated = [...nodeForm.buttons]
                          updated[bIdx].type = e.target.value as any
                          setNodeForm({ ...nodeForm, buttons: updated })
                        }}
                        className="input text-xs py-1 px-2 w-28"
                      >
                        <option value="reply">💬 Respuesta</option>
                        <option value="url">🌐 Enlace Web</option>
                      </select>

                      {btn.type === "reply" ? (
                        <select
                          value={btn.next_node || "start"}
                          onChange={(e) => {
                            const updated = [...nodeForm.buttons]
                            updated[bIdx].next_node = e.target.value
                            setNodeForm({ ...nodeForm, buttons: updated })
                          }}
                          className="input text-xs py-1 px-2 flex-1 min-w-[140px]"
                        >
                          <option value="start">➔ Inicio / Menú Principal</option>
                          {localFlow?.nodes
                            .filter((n) => n.id !== nodeForm.id)
                            .map((n) => (
                              <option key={n.id} value={n.id}>
                                ➔ {n.title} ({n.id})
                              </option>
                            ))}
                        </select>
                      ) : (
                        <input
                          type="url"
                          placeholder="https://..."
                          value={btn.url || ""}
                          onChange={(e) => {
                            const updated = [...nodeForm.buttons]
                            updated[bIdx].url = e.target.value
                            setNodeForm({ ...nodeForm, buttons: updated })
                          }}
                          className="input text-xs py-1 px-2.5 flex-1 min-w-[140px]"
                          required
                        />
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          const updated = nodeForm.buttons.filter((_, i) => i !== bIdx)
                          setNodeForm({ ...nodeForm, buttons: updated })
                        }}
                        className="text-rose-500 hover:text-rose-700 p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Palabras clave disparadoras */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Palabras Clave Disparadoras (Separadas por coma)
              </label>
              <input
                type="text"
                value={nodeForm.trigger_keywords}
                onChange={(e) => setNodeForm({ ...nodeForm, trigger_keywords: e.target.value })}
                placeholder="ej: asado, delivery, carniceria, horario"
                className="input text-xs"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Si el cliente escribe cualquiera de estas palabras, el bot saltará directamente a este bloque.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button type="button" onClick={() => setShowModal(false)} className="btn-secondary text-xs px-4 py-2">
                Cancelar
              </button>
              <button type="submit" className="btn-primary text-xs px-4 py-2 bg-emerald-600 hover:bg-emerald-700">
                Guardar Bloque
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
