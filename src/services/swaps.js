// E2-060 · Presentación fiel de los estados persistidos de E2-057.
// Nunca presentar HTTP 202 como liquidación ni inventar movimientos de wallet.
const ACTIVE = new Set(['SUBMITTED', 'PROPOSED', 'ACCEPT_SUBMITTED'])
const FINISHED = new Set(['SETTLED', 'REJECTED', 'EXPIRED', 'CANCELLED'])

const STATUS_LABELS = {
  SUBMITTED: 'Propuesta enviada (HTTP)',
  PROPOSED: 'Swap propuesto',
  ACCEPT_SUBMITTED: 'Aceptación enviada',
  SETTLED: 'Liquidado',
  REJECTED: 'Rechazado',
  EXPIRED: 'Vencido',
  CANCELLED: 'Cancelado',
}

export function swapStatus(value) {
  const status = String(value ?? '').toUpperCase()
  return STATUS_LABELS[status] ?? (status || 'Sin estado')
}

export function swapStatusClass(value) {
  const status = String(value ?? '').toUpperCase()
  if (status === 'SETTLED') return 'status status-success'
  if (['REJECTED', 'EXPIRED', 'CANCELLED'].includes(status)) return 'status status-error'
  if (ACTIVE.has(status)) return 'status status-pending'
  return 'status'
}

export function swapGroup(value) {
  const status = String(value ?? '').toUpperCase()
  if (ACTIVE.has(status)) return 'active'
  if (FINISHED.has(status)) return 'finished'
  return 'unknown' // No asumir finalización de estados desconocidos.
}

export function swapCounts(items) {
  const list = Array.isArray(items) ? items : []
  return {
    active: list.filter((item) => swapGroup(item.status) === 'active').length,
    finished: list.filter((item) => swapGroup(item.status) === 'finished').length,
    unknown: list.filter((item) => swapGroup(item.status) === 'unknown').length,
  }
}

export function swapRole(value) {
  if (value === 'PROPOSER') return 'Proponente'
  if (value === 'ACCEPTOR') return 'Aceptante'
  return value ?? '—'
}

export function swapNumber(value, digits = 4) {
  if (value === null || value === undefined || value === '') return '—'
  const number = Number(value)
  if (!Number.isFinite(number)) return '—'
  return new Intl.NumberFormat('es-CL', { maximumFractionDigits: digits }).format(number)
}

export function swapDate(value) {
  if (!value) return '—'
  const time = new Date(value)
  if (Number.isNaN(time.getTime())) return '—'
  return new Intl.DateTimeFormat('es-CL', { dateStyle: 'short', timeStyle: 'short' }).format(time)
}

export function swapText(value) {
  return value === null || value === undefined || value === '' ? '—' : String(value)
}

export function swapHttpState(swap) {
  if (swap?.proposalHttpAcceptedAt) return 'HTTP 202 recibido (no liquidado por sí solo)'
  if (swap?.proposalAttemptCount > 0) return 'Intento de propuesta registrado, sin HTTP 202 confirmado'
  return 'Sin HTTP 202 registrado'
}

export function swapPaymentState(swap) {
  if (String(swap?.status).toUpperCase() === 'SETTLED') return 'Swap liquidado por la wallet'
  if (['REJECTED', 'CANCELLED', 'EXPIRED'].includes(String(swap?.status).toUpperCase())) return 'No se registra liquidación'
  return 'Pendiente de liquidación (no equivale a pago)'
}

// Filtrar solo para la visualización actual; los filtros de ciclo/rol y la paginación son de servidor.
export function partitionSwaps(items) {
  const list = Array.isArray(items) ? items : []
  return {
    active: list.filter((item) => swapGroup(item.status) === 'active'),
    finished: list.filter((item) => swapGroup(item.status) === 'finished'),
    unknown: list.filter((item) => swapGroup(item.status) === 'unknown'),
  }
}

export function validSwapPage(value) {
  return Boolean(value && Array.isArray(value.items) && Number.isSafeInteger(value.total) && value.total >= 0)
}

export function swapDetailMatches(item, id, cycleId) {
  return Boolean(item && item.id === id && (!cycleId || item.cycleId === cycleId))
}
