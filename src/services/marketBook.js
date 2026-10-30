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
  if (offer.stale) return 'Oferta desactualizada tras brecha del feed'
  if (offer.uncertain) return 'Oferta con estado incierto'
  if (!book || book.freshness !== 'OBSERVED') return 'Feed incompleto; disponibilidad no garantizada'
  return 'Oferta observada; disponibilidad no garantizada'
}

export function routeDescription(offer) {
  if (offer.routeEnabled === false) return 'Ruta deshabilitada · tarifa punitiva'
  if (offer.routeEnabled === true) return 'Ruta habilitada'
  return 'Sin ruta o tarifa verificable'
}
