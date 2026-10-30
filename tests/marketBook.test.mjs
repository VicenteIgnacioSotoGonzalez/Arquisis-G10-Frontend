import test from 'node:test'
import assert from 'node:assert/strict'
import { feedFreshness, offerAvailability, routeDescription } from '../src/services/marketBook.js'

test('feed gap and old offers are never presented as guaranteed', () => {
  const offer = { state: 'ACTIVE', remaining: 100, stale: true, uncertain: false }
  assert.match(feedFreshness({ freshness: 'GAP_OBSERVED' }), /puede estar incompleto/)
  assert.match(offerAvailability({ freshness: 'GAP_OBSERVED', marketClosed: false }, offer), /desactualizada/)
  assert.match(offerAvailability({ freshness: 'OBSERVED', marketClosed: false }, { ...offer, stale: false }), /no garantizada/)
  assert.equal(offerAvailability({ marketClosed: true }, offer), 'Mercado cerrado')
})

test('disabled routes show the penalty context without treating the route as absent', () => {
  assert.match(routeDescription({ routeEnabled: false }), /tarifa punitiva/)
  assert.match(routeDescription({ routeEnabled: null }), /Sin ruta/)
})
