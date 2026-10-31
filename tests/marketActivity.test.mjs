import test from 'node:test'
import assert from 'node:assert/strict'
import { apiErrorMessage, TIMEOUT_MESSAGE } from '../src/services/apiErrors.js'
import { ackStage, bidStage, swapStage } from '../src/services/marketActivity.js'

test('HTTP 202 and ACK do not appear as swap settlement', () => {
  assert.match(swapStage({ status: 'SUBMITTED', proposalHttpAcceptedAt: '2026-10-30T00:00:00Z' }), /HTTP 202.*falta evento final/)
  assert.match(swapStage({ status: 'PROPOSED' }), /falta swap-settled/)
  assert.match(ackStage({ type: 'ack' }), /recepción, no aceptación/)
  assert.match(bidStage({ status: 'ACCEPTED' }), /liquidación se verifica en el swap/)
  assert.match(swapStage({ status: 'SETTLED', settledAt: '2026-10-30T00:01:00Z' }), /Liquidado: swap-settled/)
  assert.doesNotMatch(swapStage({ status: 'SETTLED', settledAt: null }), /Liquidado/)
})

test('market API errors distinguish permissions, limits, timeout and stale strategy', () => {
  assert.match(apiErrorMessage(403), /permisos/)
  assert.match(apiErrorMessage(429, null, '30'), /30 segundos/)
  assert.match(apiErrorMessage(409, { code: 'STALE_STRATEGY_VERSION' }), /estrategia cambió/)
  assert.match(TIMEOUT_MESSAGE, /pendiente/)
})
