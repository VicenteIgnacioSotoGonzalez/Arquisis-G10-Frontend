// Conservar la operación HTTP incierta entre reintentos y recargas, nunca su JWT.
export function negotiationIntent(payload, storage, uuid = () => crypto.randomUUID()) {
  const key = 'energyshark.pendingNegotiation'
  const fingerprint = JSON.stringify(payload)
  let previous
  try {
    previous = JSON.parse(storage.getItem(key))
  } catch {
    previous = null
  }
  if (previous?.fingerprint === fingerprint && previous.idpk) {
    return { ...payload, idpk: previous.idpk }
  }
  const idpk = uuid()
  storage.setItem(key, JSON.stringify({ fingerprint, idpk }))
  return { ...payload, idpk }
}

export function clearNegotiationIntent(storage) {
  storage.removeItem('energyshark.pendingNegotiation')
}
