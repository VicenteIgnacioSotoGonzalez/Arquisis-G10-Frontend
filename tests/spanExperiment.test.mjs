import test from 'node:test'
import assert from 'node:assert/strict'
import { summarizeBySpan } from '../src/services/spanExperiment.js'

test('aggregates only final cycles with comparable costs and keeps spans separate', () => {
  const values = [
    { spanSeconds: 0, status: 'FINAL', deficitKwh: 100, coveredKwh: 70, rejectedBids: 2, baselineCost: '500.00', realCost: '300.00', savingsVsBaseline: '200.00' },
    { spanSeconds: 0, status: 'AWAITING_SETTLEMENT', deficitKwh: 100, coveredKwh: 20, rejectedBids: 9, baselineCost: '500.00', realCost: null },
    { spanSeconds: 60, status: 'FINAL', deficitKwh: 200, coveredKwh: 100, rejectedBids: 1, baselineCost: '1000.00', realCost: '900.00', savingsVsBaseline: '100.00' },
  ]
  const groups = summarizeBySpan(values)
  assert.deepEqual(groups.map((group) => [group.spanSeconds, group.cycles, group.finalCycles]), [[0, 2, 1], [60, 1, 1]])
  assert.equal(groups[0].coveredKwh, 70)
  assert.equal(groups[0].rejectedBids, 2)
  assert.equal(groups[0].savingsVsBaseline, 200)
})
