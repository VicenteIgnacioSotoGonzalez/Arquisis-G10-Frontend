export function feedFreshness(book) {
  switch (book?.freshness) {
    case 'CLOSED_CONFIRMED': return 'Mercado cerrado: market-closed recibido.'
    case 'CLOSED_BY_DEADLINE': return 'Mercado cerrado por plazo; market-closed no confirmado.'
    case 'GAP_OBSERVED': return 'Posible pérdida de mensajes tras reconexión; el feed puede estar incompleto.'
    case 'NO_STATUS': return 'Aún no hay status-statement de este ciclo; no se puede verificar la ventana.'
    case 'NO_FEED': return 'Sin ofertas observadas para este ciclo.'
    case 'OBSERVED': return 'Feed observado; la disponibilidad puede cambiar antes de comprar.'
    default: return 'Frescura del feed no verificable.'
  }
}

export function offerAvailability(book, offer) {
  if (book?.marketClosed) return 'Mercado cerrado'
  if (offer.state !== 'ACTIVE' || offer.remaining == null || offer.remaining <= 0) return 'Oferta no activa'
  if (offer.stale) return 'Oferta desactualizada o incierta'
  if (offer.uncertain) return 'Oferta con estado incierto'
  if (!book || book.freshness !== 'OBSERVED') return 'Feed incompleto; disponibilidad no garantizada'
  return 'Oferta observada; disponibilidad no garantizada'
}

export function routeDescription(offer) {
  if (offer.routeEnabled === false) return 'Ruta deshabilitada · tarifa punitiva'
  if (offer.routeEnabled === true) return 'Ruta habilitada'
  return 'Sin ruta o tarifa verificable'
}

export function displayNumber(value, digits = 2) {
  if (value === null || value === undefined || value === '') return '—'
  const number = Number(value)
  if (!Number.isFinite(number)) return '—'
  return new Intl.NumberFormat('es-CL', { maximumFractionDigits: digits }).format(number)
}

export function displayDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('es-CL', { dateStyle: 'short', timeStyle: 'medium' }).format(date)
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
