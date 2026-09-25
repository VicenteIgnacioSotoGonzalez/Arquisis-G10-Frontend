const API_URL = import.meta.env.VITE_API_URL

if (!API_URL) {
  throw new Error('VITE_API_URL is not configured')
}

const BASE_URL = API_URL.replace(/\/$/, '')

export async function apiFetch(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, options)

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
