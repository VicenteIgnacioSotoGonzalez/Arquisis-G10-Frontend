import test from 'node:test'
import assert from 'node:assert/strict'
import { displayNumber, displayDate, offerStatus, routeLabel, sortMarketOffers } from '../src/services/marketBook.js'

test('nulos o inválidos nunca se confunden con cero', () => {
  assert.equal(displayNumber(null), '—')
  assert.equal(displayNumber(undefined), '—')
  assert.equal(displayNumber('texto'), '—')
  assert.equal(displayNumber(0), '0')
  assert.equal(displayDate('invalid'), '—')
})

test('precios efectivos ordenados, faltantes al final y sin mutar el feed', () => {
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

test('rutas deshabilitadas indican tarifa punitiva y datos faltantes', () => {
  assert.match(routeLabel(false), /tarifa punitiva/)
  assert.equal(routeLabel(true), 'Habilitada')
  assert.equal(routeLabel(null), 'Sin datos de ruta')
})

test('marcas de incertidumbre y estados del feed', () => {
  assert.equal(offerStatus({ state: 'ACTIVE', uncertain: false, stale: false }), 'Activa')
  assert.equal(offerStatus({ state: 'ACTIVE', uncertain: true, stale: false }), 'Información incierta')
  assert.equal(offerStatus({ state: 'WITHDRAWN' }), 'Retirada')
  assert.equal(offerStatus({ state: 'UNRESOLVED' }), 'Sin resolver')
})
