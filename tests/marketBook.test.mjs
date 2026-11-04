import test from 'node:test'
import assert from 'node:assert/strict'
import {
  displayDate, displayNumber, feedFreshness, offerAvailability, offerStatus,
  routeDescription, routeLabel, sortMarketOffers,
} from '../src/services/marketBook.js'

test('feed gap and old offers are never presented as guaranteed', () => {
  const offer = { state: 'ACTIVE', remaining: 100, stale: true, uncertain: false }
  assert.match(feedFreshness({ freshness: 'GAP_OBSERVED' }), /puede estar incompleto/)
  assert.match(offerAvailability({ freshness: 'GAP_OBSERVED', marketClosed: false }, offer), /desactualizada o incierta/)
  assert.match(offerAvailability({ freshness: 'OBSERVED', marketClosed: false }, { ...offer, stale: false }), /no garantizada/)
  assert.equal(offerAvailability({ marketClosed: true }, offer), 'Mercado cerrado')
})

test('disabled routes show the penalty context without treating the route as absent', () => {
  assert.match(routeDescription({ routeEnabled: false }), /tarifa punitiva/)
  assert.match(routeDescription({ routeEnabled: null }), /Sin ruta/)
})

test('missing and invalid market values are not confused with zero', () => {
  assert.equal(displayNumber(null), '—')
  assert.equal(displayNumber(undefined), '—')
  assert.equal(displayNumber('texto'), '—')
  assert.equal(displayNumber(0), '0')
  assert.equal(displayDate('invalid'), '—')
})

test('effective prices are sorted without mutating the feed', () => {
  const input = [
    { cityId: 'B', offerId: '3', effectivePricePerEnergy: null },
    { cityId: 'B', offerId: '2', effectivePricePerEnergy: '20.50' },
    { cityId: 'A', offerId: '1', effectivePricePerEnergy: '20.50' },
    { cityId: 'C', offerId: '4', effectivePricePerEnergy: '9' },
  ]
  const output = sortMarketOffers(input)
  assert.deepEqual(output.map((v) => v.offerId), ['4', '1', '2', '3'])
  assert.equal(input[0].offerId, '3')
})

test('disabled routes and unknown route data remain distinguishable', () => {
  assert.match(routeLabel(false), /tarifa punitiva/)
  assert.equal(routeLabel(true), 'Habilitada')
  assert.equal(routeLabel(null), 'Sin datos de ruta')
})

test('uncertain and withdrawn offers keep their states', () => {
  assert.equal(offerStatus({ state: 'ACTIVE', uncertain: false, stale: false }), 'Activa')
  assert.equal(offerStatus({ state: 'ACTIVE', uncertain: true, stale: false }), 'Información incierta')
  assert.equal(offerStatus({ state: 'WITHDRAWN' }), 'Retirada')
  assert.equal(offerStatus({ state: 'UNRESOLVED' }), 'Sin resolver')
})
