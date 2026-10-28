// E2-058: helpers de presentación. No recalcular precios ni tarifas en el frontend.
export function displayNumber(value, digits = 2) {
  if (value === null || value === undefined || value === '') return '—'
  const number = Number(value)
  if (!Number.isFinite(number)) return '—'
  return new Intl.NumberFormat('es-CL', {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(number)
}

export function displayDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('es-CL', {
    dateStyle: 'short',
    timeStyle: 'medium',
  }).format(date)
}

export function routeLabel(enabled) {
  if (enabled === false) return 'Deshabilitada · tarifa punitiva'
  if (enabled === true) return 'Habilitada'
  return 'Sin datos de ruta'
}

export function offerStatus(offer) {
  if (offer.uncertain || offer.stale) return 'Información incierta'
  const state = String(offer.state || '').toUpperCase()
  if (state === 'ACTIVE') return 'Activa'
  if (state === 'WITHDRAWN') return 'Retirada'
  if (state === 'CLOSED') return 'Cerrada'
  if (state === 'UNRESOLVED') return 'Sin resolver'
  return state || 'Sin estado'
}

// Los valores ausentes se muestran al final; no se confunden con precio cero.
export function sortMarketOffers(offers = []) {
  return [...offers].sort((a, b) => {
    const left = a.effectivePricePerEnergy == null ? Infinity : Number(a.effectivePricePerEnergy)
    const right = b.effectivePricePerEnergy == null ? Infinity : Number(b.effectivePricePerEnergy)
    const leftPrice = Number.isFinite(left) ? left : Infinity
    const rightPrice = Number.isFinite(right) ? right : Infinity
    if (leftPrice !== rightPrice) return leftPrice - rightPrice
    const byCity = String(a.cityId ?? '').localeCompare(String(b.cityId ?? ''))
    return byCity || String(a.offerId ?? '').localeCompare(String(b.offerId ?? ''))
  })
}
