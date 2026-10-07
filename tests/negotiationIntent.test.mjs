import test from 'node:test'
import assert from 'node:assert/strict'
import { negotiationIntent, clearNegotiationIntent } from '../src/services/negotiationIntent.js'

function storage() {
  const data = new Map()
  return { getItem: key => data.get(key), setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) }
}
const proposal = { cycleId: 'opaque-z', direction: 'take', requestedQuantity: '10', offeredPrice: '20' }

test('uncertain HTTP submission retains idpk through retry and remount', () => {
  const store = storage()
  const first = negotiationIntent(proposal, store, () => 'original-operation')
  const retry = negotiationIntent(proposal, store, () => 'must-not-be-used')
  assert.deepEqual(retry, first)
})

test('changed proposal or explicit next operation gets a new idpk', () => {
  const store = storage()
  negotiationIntent(proposal, store, () => 'first')
  const changed = negotiationIntent({ ...proposal, requestedQuantity: '11' }, store, () => 'second')
  assert.equal(changed.idpk, 'second')
  clearNegotiationIntent(store)
  assert.equal(negotiationIntent(proposal, store, () => 'third').idpk, 'third')
})
