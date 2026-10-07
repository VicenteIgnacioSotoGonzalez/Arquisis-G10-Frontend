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
