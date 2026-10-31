export function swapStage(swap) {
  if (swap.status === 'SETTLED' && swap.settledAt) return 'Liquidado: swap-settled recibido'
  if (swap.status === 'REJECTED') return 'Rechazado por Wallet'
  if (swap.status === 'EXPIRED') return 'Swap vencido'
  if (swap.status === 'CANCELLED') return 'Swap cancelado'
  if (swap.status === 'ACCEPT_SUBMITTED') return 'Aceptación enviada; falta swap-settled'
  if (swap.status === 'PROPOSED') return 'Swap propuesto; falta swap-settled'
  if (swap.proposalHttpAcceptedAt) return 'Wallet recibió POST /swaps (HTTP 202); falta evento final'
  return 'Solicitud de swap pendiente; sin liquidación confirmada'
}

export function bidStage(bid) {
  if (bid.status === 'ACCEPTED') return 'Bid aceptado; la liquidación se verifica en el swap'
  if (bid.status === 'REJECTED') return `Bid rechazado${bid.rejectionReason ? `: ${bid.rejectionReason}` : ''}`
  return 'Bid enviado o recibido; respuesta comercial pendiente'
}

export function ackStage(message) {
  if (message.type === 'ack') return 'ACK de protocolo: recepción, no aceptación comercial'
  if (message.type === 'nack') return `NACK de protocolo${message.reasonCode ? `: ${message.reasonCode}` : ''}`
  return null
}
