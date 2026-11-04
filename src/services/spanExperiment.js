const amount = (value) => Number(value ?? 0)

export function summarizeBySpan(metrics) {
  const groups = new Map()
  for (const metric of metrics) {
    const key = metric.spanSeconds
    const group = groups.get(key) ?? {
      spanSeconds: key, cycles: 0, finalCycles: 0, deficitKwh: 0,
      coveredKwh: 0, rejectedBids: 0, baselineCost: 0, realCost: 0,
      savingsVsBaseline: 0,
    }
    group.cycles += 1
    if (metric.status === 'FINAL' && metric.baselineCost != null && metric.realCost != null) {
      group.finalCycles += 1
      group.deficitKwh += amount(metric.deficitKwh)
      group.coveredKwh += amount(metric.coveredKwh)
      group.rejectedBids += amount(metric.rejectedBids)
      group.baselineCost += amount(metric.baselineCost)
      group.realCost += amount(metric.realCost)
      group.savingsVsBaseline += amount(metric.savingsVsBaseline)
    }
    groups.set(key, group)
  }
  return [...groups.values()].sort((a, b) => a.spanSeconds - b.spanSeconds)
}
