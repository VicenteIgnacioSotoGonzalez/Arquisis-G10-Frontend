import test from 'node:test'
import assert from 'node:assert/strict'
import {
  partitionSwaps, swapCounts, swapDate, swapDetailMatches, swapGroup,
  swapHttpState, swapNumber, swapPaymentState, swapRole, swapStatus,
  swapStatusClass, validSwapPage,
} from '../src/services/swaps.js'

test('HTTP 202 no marca el swap como liquidado', () => {
  const bid = { status: 'SUBMITTED', proposalHttpAcceptedAt: '2026-10-27T15:00:00Z' }
  assert.match(swapHttpState(bid), /HTTP 202/)
  assert.match(swapPaymentState(bid), /Pendiente/)
  assert.equal(swapGroup(bid.status), 'active')
})

test('swap-proposed es un estado en curso y no un pago', () => {
  assert.equal(swapStatus('PROPOSED'), 'Swap propuesto')
  assert.equal(swapGroup('PROPOSED'), 'active')
  assert.match(swapPaymentState({ status: 'PROPOSED' }), /Pendiente/)
})

test('accept-submitted no se interpreta como settled', () => {
  assert.equal(swapGroup('ACCEPT_SUBMITTED'), 'active')
  assert.notEqual(swapStatusClass('ACCEPT_SUBMITTED'), swapStatusClass('SETTLED'))
})

test('settled es el único estado mostrado como liquidado', () => {
  for (const status of ['SUBMITTED', 'PROPOSED', 'REJECTED', 'EXPIRED', 'CANCELLED']) {
    assert.doesNotMatch(swapPaymentState({ status }), /^Swap liquidado/)
  }
  assert.equal(swapPaymentState({ status: 'SETTLED' }), 'Swap liquidado por la wallet')
})

test('rejected, expired, cancelled y settled se separan de los activos', () => {
  const records = ['SUBMITTED', 'PROPOSED', 'ACCEPT_SUBMITTED', 'SETTLED', 'REJECTED', 'EXPIRED', 'CANCELLED', 'NEW_STATE'].map((status, id) => ({ id, status }))
  assert.deepEqual(swapCounts(records), { active: 3, finished: 4, unknown: 1 })
  const groups = partitionSwaps(records)
  assert.equal(groups.active.length, 3)
  assert.equal(groups.finished.length, 4)
  assert.equal(groups.unknown[0].status, 'NEW_STATE')
})

test('respuestas mal formadas y fechas inválidas no se presentan como datos válidos', () => {
  assert.equal(validSwapPage({ items: [], total: 0 }), true)
  assert.equal(validSwapPage({ items: {}, total: 5 }), false)
  assert.equal(validSwapPage({ items: [], total: -1 }), false)
  assert.equal(validSwapPage(null), false)
  assert.equal(swapNumber(null), '—')
  assert.equal(swapNumber('abc'), '—')
  assert.equal(swapDate('no-es-fecha'), '—')
})

test('detalle solo se acepta si corresponde a identificador y ciclo seleccionado', () => {
  assert.equal(swapDetailMatches({ id: 2, cycleId: 'A' }, 2, 'A'), true)
  assert.equal(swapDetailMatches({ id: 2, cycleId: 'A' }, 2, ''), true)
  assert.equal(swapDetailMatches({ id: 2, cycleId: 'B' }, 2, 'A'), false)
  assert.equal(swapDetailMatches({ id: 3, cycleId: 'A' }, 2, 'A'), false)
})

test('roles reflejan el contrato backend sin inventar una operación de pago', () => {
  assert.equal(swapRole('PROPOSER'), 'Proponente')
  assert.equal(swapRole('ACCEPTOR'), 'Aceptante')
  assert.equal(swapRole('OTHER'), 'OTHER')
  assert.equal(swapHttpState({ proposalAttemptCount: 1 }), 'Intento de propuesta registrado, sin HTTP 202 confirmado')
})
