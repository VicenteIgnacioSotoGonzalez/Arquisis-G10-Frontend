// E2-059: funciones de presentación de los datos de E2-056.
// No derivar nuevos eventos ni concluir que HTTP 202 equivale a settlement.

export function historyList(value) {
  return Array.isArray(value) ? value : []
}

export function historyNumber(value, digits = 2) {
  if (value === null || value === undefined || value === '') return '—'
  const number = Number(value)
  if (!Number.isFinite(number)) return '—'
  return new Intl.NumberFormat('es-CL', { maximumFractionDigits: digits }).format(number)
}

export function historyDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('es-CL', { dateStyle: 'short', timeStyle: 'short' }).format(date)
}

export function historyText(value) {
  if (value === null || value === undefined || value === '') return '—'
  return String(value)
}

const statusLabels = {
  ACTIVE: 'Activa', WITHDRAWN: 'Retirada', CLOSED: 'Cerrada',
  PENDING: 'Pendiente', PENDING_PUBLICATION: 'Pendiente de publicación',
  PUBLISHED: 'Publicado en broker', FAILED: 'Falló publicación',
  ACCEPTED: 'Aceptado', REJECTED: 'Rechazado',
  PROPOSED: 'Propuesto', SETTLED: 'Liquidado', EXPIRED: 'Vencido',
  CANCELLED: 'Cancelado', SUPERSEDED: 'Reemplazado',
  INCOMING: 'Recibido', OUTGOING: 'Enviado',
  SELLER: 'Vendedor', BUYER: 'Comprador',
  PROPOSER: 'Proponente', ACCEPTER: 'Aceptante',
}

export function historyStatus(value) {
  if (!value) return '—'
  return statusLabels[String(value).toUpperCase()] || String(value)
}

export function historyStatusClass(value) {
  const state = String(value || '').toUpperCase()
  if (['SETTLED', 'ACCEPTED'].includes(state)) return 'status status-success'
  if (['PENDING', 'PENDING_PUBLICATION', 'PROPOSED'].includes(state)) return 'status status-pending'
  if (['REJECTED', 'EXPIRED', 'CANCELLED', 'FAILED'].includes(state)) return 'status status-error'
  return 'status'
}

export function historyCounts(history) {
  return {
    offers: historyList(history?.offers).length,
    offerRevisions: historyList(history?.offerRevisions).length,
    bids: historyList(history?.bids).length,
    swaps: historyList(history?.swaps).length,
    trades: historyList(history?.trades).length,
    settlements: historyList(history?.settlements).length,
    negotiationReports: historyList(history?.negotiationReports).length,
  }
}

// Las operaciones solo existen si vienen desde la API. Nunca estimar un efecto.
export function historyLastEffect(history) {
  return history?.lastOperation ?? null
}

export function historyMatchesCycle(history, cycleId) {
  return Boolean(history && typeof history === 'object' && history.cycleId === cycleId)
}
