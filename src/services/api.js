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
    throw new Error(
      `API request failed with status ${response.status}`,
    )
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

// E2-058: libro de ofertas del ciclo, usando el contrato existente de E2-035/036.
export function getMarketBook(cycleId, { includeInactive = false, signal } = {}) {
  const params = new URLSearchParams({
    cycleId: String(cycleId),
    includeInactive: String(includeInactive),
  })
  return apiFetch(`/market/book?${params.toString()}`, { signal })
}

// E2-059: historial E2 de solo lectura (E2-056), independiente del detalle E1.
export function getCycleHistory(cycleId, { signal } = {}) {
  return apiFetch(`/cycles/${encodeURIComponent(cycleId)}/history`, { signal })
}

// E2-060: swaps E2-057. No exponer tokens ni ejecutar escrituras wallet.
export function getSwaps({ cycleId = '', role = '', status = '', offset = 0, limit = 20, signal } = {}) {
  const params = new URLSearchParams({ offset: String(offset), limit: String(limit) })
  if (cycleId) params.set('cycleId', cycleId)
  if (role) params.set('role', role)
  if (status) params.set('status', status)
  return apiFetch(`/market/swaps?${params.toString()}`, { signal })
}

export function getSwapDetail(id, { signal } = {}) {
  if (!Number.isSafeInteger(id) || id < 1) throw new Error('Identificador interno de swap inválido')
  return apiFetch(`/market/swaps/${id}`, { signal })
}
