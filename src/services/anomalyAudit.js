export const ANOMALY_PAGE_SIZE = 50

export function anomalyQuery(filters = {}, offset = 0, limit = ANOMALY_PAGE_SIZE) {
  const params = new URLSearchParams()
  for (const key of ['status', 'type', 'reasonCode', 'idpk', 'msgId', 'sender', 'cycleId']) {
    const value = filters[key]
    if (typeof value === 'string' && value.trim()) {
      params.set(key, value.trim())
    }
  }
  params.set('offset', String(offset))
  params.set('limit', String(limit))
  return params.toString()
}

export function anomalyLabel(status) {
  if (status === 'DUPLICATE') return 'Duplicado'
  if (status === 'DISCARDED') return 'Descartado'
  if (status === 'NACKED') return 'Rechazado (NACK)'
  return status ?? '—'
}

export function anomalyReasonLabel(reasonCode) {
  if (reasonCode === 'IDENTITY_MISMATCH') return 'Identidad ajena (IDENTITY_MISMATCH)'
  if (reasonCode === 'MALFORMED_MESSAGE') return 'Mensaje malformado (MALFORMED_MESSAGE)'
  return reasonCode ?? null
}
