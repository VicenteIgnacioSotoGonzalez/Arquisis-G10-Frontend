import test from 'node:test'
import assert from 'node:assert/strict'
import { anomalyLabel, anomalyQuery, anomalyReasonLabel } from '../src/services/anomalyAudit.js'

test('filters anomalies by exact msgId, idpk and identity reason with paging', () => {
  const params = new URLSearchParams(anomalyQuery({
    msgId: '  msg-1 ', idpk: ' operation-1 ', reasonCode: 'IDENTITY_MISMATCH', status: 'NACKED', type: '',
  }, 50, 50))
  assert.deepEqual(Object.fromEntries(params), {
    status: 'NACKED', reasonCode: 'IDENTITY_MISMATCH', idpk: 'operation-1', msgId: 'msg-1', offset: '50', limit: '50',
  })
})

test('identity mismatch is a reason, not an invented anomaly status', () => {
  assert.equal(anomalyLabel('DISCARDED'), 'Descartado')
  assert.equal(anomalyLabel('NACKED'), 'Rechazado (NACK)')
  assert.equal(anomalyReasonLabel('IDENTITY_MISMATCH'), 'Identidad ajena (IDENTITY_MISMATCH)')
  assert.equal(anomalyLabel('DUPLICATE'), 'Duplicado')
})
