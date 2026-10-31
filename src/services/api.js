import { getToken } from './auth'
import { anomalyQuery } from './anomalyAudit'
import { apiErrorMessage, TIMEOUT_MESSAGE } from './apiErrors'

const API_URL = import.meta.env.VITE_API_URL

if (!API_URL) {
  throw new Error('VITE_API_URL is not configured')
}

const BASE_URL = API_URL.replace(/\/$/, '')

export async function apiFetch(path, options = {}) {
  const token = await getToken()
  const headers = { ...(options.headers || {}) }
  const { timeoutMs = 15000, ...requestOptions } = options
  const controller = options.signal ? null : new AbortController()
  const timeout = controller ? window.setTimeout(() => controller.abort(), timeoutMs) : null

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  let response
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      ...requestOptions, headers, signal: options.signal ?? controller.signal,
    })
  } catch (error) {
    if (error?.name === 'AbortError') {
      const timeoutError = new Error(TIMEOUT_MESSAGE, { cause: error })
      timeoutError.code = 'TIMEOUT'
      throw timeoutError
    }
    throw new Error('No fue posible conectar con la API. Revisa la conexión e inténtalo otra vez.', { cause: error })
  } finally {
    if (timeout) window.clearTimeout(timeout)
  }

  if (!response.ok) {
    const body = await response.json().catch(() => null)
    const detail = body?.detail
    const message = apiErrorMessage(response.status, detail, response.headers.get('Retry-After'))
    const error = new Error(message)
    error.status = response.status
    throw error
  }

  return response.status === 204 ? null : response.json()
}

export function getHealth() {
  return apiFetch('/health')
}

export function getCycles() {
  return apiFetch('/cycles')
}

export function getCycleDetail(cycleId) {
  return apiFetch(
    `/cycles/${encodeURIComponent(cycleId)}`,
  )
}

export function getCycleHistory(cycleId) {
  return apiFetch(`/cycles/${encodeURIComponent(cycleId)}/history`)
}

export function getIntercityAudit(cycleId, limit = 50) {
  return apiFetch(`/audit/intercity?cycleId=${encodeURIComponent(cycleId)}&limit=${limit}`)
}

export function getMarketBook(cycleId, includeInactive = true) {
  return apiFetch(`/market/book?cycleId=${encodeURIComponent(cycleId)}&includeInactive=${includeInactive}`)
}

export function getConnectivity() {
  return apiFetch('/connectivity')
}

export function createNegotiation(body) {
  return apiFetch('/negotiations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

export function getAnomalies(filters = {}, offset = 0, limit = 50) {
  return apiFetch(`/audit/anomalies?${anomalyQuery(filters, offset, limit)}`)
}

export function getNegotiation(id) {
  return apiFetch(`/negotiations/${encodeURIComponent(id)}`)
}

export function getStrategy(cycleId) {
  const query = cycleId ? `?cycleId=${encodeURIComponent(cycleId)}` : ''
  return apiFetch(`/market/strategy${query}`)
}

export function getStrategyOptions() {
  return apiFetch('/market/strategy/options')
}

export function updateStrategy(body) {
  return apiFetch('/market/strategy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export function getMarketSwaps() {
  return apiFetch('/market/swaps?limit=20')
}

export function getCycleMetrics(offset = 0, limit = 50) {
  return apiFetch(`/market/cycle-metrics/compare?offset=${offset}&limit=${limit}`)
}

export async function getAllCycleMetrics() {
  const items = new Map()
  let offset = 0
  let total = 1
  while (offset < total) {
    const page = await getCycleMetrics(offset, 200)
    total = page.total ?? 0
    const rows = page.items ?? []
    if (!rows.length) break
    for (const row of rows) items.set(row.cycleId, row)
    offset += rows.length
  }
  return { total: items.size, items: [...items.values()] }
}

export function getCycleReconciliation(cycleId) {
  return apiFetch(`/audit/reconciliations?cycleId=${encodeURIComponent(cycleId)}&limit=1`)
}
