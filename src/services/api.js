import { getToken } from './auth'

const API_URL = import.meta.env.VITE_API_URL

if (!API_URL) {
  throw new Error('VITE_API_URL is not configured')
}

const BASE_URL = API_URL.replace(/\/$/, '')

export async function apiFetch(path, options = {}) {
  const token = await getToken()
  const headers = { ...(options.headers || {}) }

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const response = await fetch(
    `${BASE_URL}${path}`,
    { ...options, headers },
  )

  if (!response.ok) {
    const body = await response.json().catch(() => null)
    const detail = body?.detail
    const message = typeof detail === 'string'
      ? detail
      : detail?.code === 'STALE_STRATEGY_VERSION'
        ? 'La estrategia cambió mientras editabas. Recarga los valores antes de guardar.'
        : `La API respondió con estado ${response.status}`
    const error = new Error(message)
    error.status = response.status
    throw error
  }

  return response.json()
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

export function getAnomalies(filters = {}) {
  const params = new URLSearchParams()

  for (const [key, value] of Object.entries(filters)) {
    if (value !== null && value !== undefined && value !== '') {
      params.append(key, value)
    }
  }

  const query = params.toString()

  return apiFetch(
    query ? `/audit/anomalies?${query}` : '/audit/anomalies',
  )
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

export function getCycleReconciliation(cycleId) {
  return apiFetch(`/audit/reconciliations?cycleId=${encodeURIComponent(cycleId)}&limit=1`)
}
