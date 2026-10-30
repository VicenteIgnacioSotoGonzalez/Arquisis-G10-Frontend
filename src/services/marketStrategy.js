export function strategyFormFrom(config) {
  return {
    offerPriceMarkup: String(config?.offerPriceMarkup ?? '1.2'),
    offerQuantityFraction: String(config?.offerQuantityFraction ?? '1'),
    offerPriceOverride: String(config?.offerPriceOverride ?? ''),
    offerQuantityCap: String(config?.offerQuantityCap ?? ''),
    bidAcceptancePolicy: config?.bidAcceptancePolicy ?? 'FIFO',
    offerSelectionPolicy: config?.offerSelectionPolicy ?? 'CHEAPEST_EFFECTIVE_PRICE',
    spanSeconds: String(config?.spanSeconds ?? '60'),
  }
}

export function validateStrategyForm(form, options) {
  const markup = Number(form.offerPriceMarkup)
  const fraction = Number(form.offerQuantityFraction)
  const span = Number(form.spanSeconds)
  if (!Number.isFinite(markup) || markup <= 0 || !/^\d+(?:\.\d{1,4})?$/.test(form.offerPriceMarkup)) {
    return 'El multiplicador de precio debe ser positivo y tener hasta cuatro decimales.'
  }
  if (!Number.isFinite(fraction) || fraction < 0 || fraction > 1 || !/^\d+(?:\.\d{1,4})?$/.test(form.offerQuantityFraction)) {
    return 'La fracción ofertada debe estar entre 0 y 1, con hasta cuatro decimales.'
  }
  if (form.offerPriceOverride !== '' && (!Number.isFinite(Number(form.offerPriceOverride)) || Number(form.offerPriceOverride) <= 0 || !/^\d{1,16}(?:\.\d{1,4})?$/.test(form.offerPriceOverride))) {
    return 'El precio fijo debe ser positivo y tener hasta cuatro decimales.'
  }
  if (form.offerQuantityCap !== '' && (!/^\d+$/.test(form.offerQuantityCap) || !Number.isSafeInteger(Number(form.offerQuantityCap)))) {
    return 'El máximo de KWH debe ser un entero no negativo.'
  }
  if (!Number.isSafeInteger(span) || span < (options?.minSpanSeconds ?? 0) || !/^\d+$/.test(form.spanSeconds)) {
    return 'El span debe ser un número entero de segundos no negativo.'
  }
  if (!options?.bidAcceptancePolicies?.includes(form.bidAcceptancePolicy)) {
    return 'Selecciona una política de aceptación válida.'
  }
  if (!options?.offerSelectionPolicies?.includes(form.offerSelectionPolicy)) {
    return 'Selecciona una política de selección válida.'
  }
  return null
}

export function strategyPayload(form, expectedVersion) {
  return {
    offerPriceMarkup: form.offerPriceMarkup,
    offerQuantityFraction: form.offerQuantityFraction,
    offerPriceOverride: form.offerPriceOverride === '' ? null : form.offerPriceOverride,
    offerQuantityCap: form.offerQuantityCap === '' ? null : Number(form.offerQuantityCap),
    bidAcceptancePolicy: form.bidAcceptancePolicy,
    offerSelectionPolicy: form.offerSelectionPolicy,
    spanSeconds: Number(form.spanSeconds),
    ...(expectedVersion ? { expectedVersion } : {}),
  }
}
