import test from 'node:test'
import assert from 'node:assert/strict'
import {
  historyCounts, historyDate, historyLastEffect, historyList, historyMatchesCycle,
  historyNumber, historyStatus, historyStatusClass, historyText,
} from '../src/services/cycleHistory.js'

test('campos faltantes nunca se presentan como saldo cero', () => {
  assert.equal(historyNumber(null), '—')
  assert.equal(historyNumber(undefined), '—')
  assert.equal(historyNumber('not-a-number'), '—')
  assert.equal(historyNumber(0), '0')
  assert.equal(historyText(undefined), '—')
  assert.equal(historyDate('unknown'), '—')
})

test('el historial E2 usa los nombres reales del contrato E2-056', () => {
  const sample = {
    offers: [{ offerId: 'a' }], offerRevisions: [{ msgId: 'm' }],
    bids: [{ idpk: 'b' }, { idpk: 'c' }], swaps: [{ idpk: 's' }],
    trades: [{ swapId: 's' }], settlements: [{ settlementId: 't' }],
    negotiationReports: [{ idpk: 'r' }],
  }
  assert.deepEqual(historyCounts(sample), {
    offers: 1, offerRevisions: 1, bids: 2, swaps: 1,
    trades: 1, settlements: 1, negotiationReports: 1,
  })
})

test('una respuesta parcial devuelve secciones vacías sin inventar eventos', () => {
  assert.equal(historyList(null).length, 0)
  assert.equal(historyList({}).length, 0)
  assert.equal(historyCounts({}).trades, 0)
  assert.equal(historyLastEffect({ ledger: [{ sequence: 1 }] }), null)
})

test('no se muestran datos de otro ciclo por respuestas tardías', () => {
  assert.equal(historyMatchesCycle({ cycleId: 'C2' }, 'C1'), false)
  assert.equal(historyMatchesCycle({ cycleId: 'C1' }, 'C1'), true)
  assert.equal(historyMatchesCycle(null, 'C1'), false)
})

test('HTTP 202 nunca se interpreta como liquidación', () => {
  assert.equal(historyStatus('PROPOSED'), 'Propuesto')
  assert.equal(historyStatus('SETTLED'), 'Liquidado')
  assert.equal(historyStatus('PUBLISHED'), 'Publicado en broker')
  assert.equal(historyStatus('ACCEPTED'), 'Aceptado')
  assert.equal(historyStatusClass('PROPOSED'), 'status status-pending')
  assert.equal(historyStatusClass('SETTLED'), 'status status-success')
})

test('último efecto solo viene de lastOperation de API', () => {
  const effect = { sequence: 7, operationType: 'SWAP_TRANSPORT' }
  assert.equal(historyLastEffect({ lastOperation: effect }), effect)
  assert.equal(historyLastEffect({ lastOperation: null }), null)
})
