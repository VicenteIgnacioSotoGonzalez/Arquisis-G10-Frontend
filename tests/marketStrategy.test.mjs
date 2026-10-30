import test from 'node:test'
import assert from 'node:assert/strict'
import { strategyFormFrom, strategyPayload, validateStrategyForm } from '../src/services/marketStrategy.js'

const options = { bidAcceptancePolicies: ['FIFO', 'BATCH'], offerSelectionPolicies: ['MIN_DISTANCE'], minSpanSeconds: 0 }

test('strategy form matches the backend fields and pins the version being edited', () => {
  const form = strategyFormFrom({ offerPriceMarkup: '1.2500', offerQuantityFraction: '0.7500', bidAcceptancePolicy: 'BATCH', offerSelectionPolicy: 'MIN_DISTANCE', spanSeconds: 90 })
  assert.equal(validateStrategyForm(form, options), null)
  assert.deepEqual(strategyPayload(form, 4), { offerPriceMarkup: '1.2500', offerQuantityFraction: '0.7500', bidAcceptancePolicy: 'BATCH', offerSelectionPolicy: 'MIN_DISTANCE', spanSeconds: 90, expectedVersion: 4 })
})

test('invalid price, quantity, span and policies are rejected before POST', () => {
  const valid = strategyFormFrom({ offerSelectionPolicy: 'MIN_DISTANCE' })
  for (const [field, value] of [['offerPriceMarkup', '0'], ['offerPriceMarkup', '1.12345'], ['offerQuantityFraction', '1.1'], ['spanSeconds', '1.5'], ['bidAcceptancePolicy', 'unknown']]) {
    assert.ok(validateStrategyForm({ ...valid, [field]: value }, options), `${field}=${value}`)
  }
})
