export function apiErrorMessage(status, detail, retryAfter) {
  if (status === 409 && detail?.code === 'STALE_STRATEGY_VERSION') {
    return 'La estrategia cambió mientras editabas. Recarga los valores antes de guardar.'
  }
  if (status === 401) return 'La sesión venció o el token no es válido. Inicia sesión nuevamente.'
  if (status === 403) return 'No tienes permisos para consultar o modificar esta información.'
  if (status === 429) {
    const wait = /^\d+$/.test(retryAfter ?? '') ? ` Espera ${retryAfter} segundos.` : ' Intenta más tarde.'
    return `Se alcanzó el límite de solicitudes.${wait}`
  }
  if (typeof detail === 'string' && detail.trim()) return detail
  return `La API respondió con estado ${status}`
}

export const TIMEOUT_MESSAGE = 'La API tardó demasiado en responder. Reintenta; la operación puede seguir pendiente.'
