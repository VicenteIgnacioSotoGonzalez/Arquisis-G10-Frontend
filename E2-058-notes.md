# E2-058 · Libro de ofertas en vivo

Vista de solo lectura para RF02. Consumir `GET /cycles` y `GET /market/book?cycleId=...&includeInactive=...`.

- Se usa el precio efectivo calculado por el backend del comprador; no se recalcula ninguna tarifa en el frontend.
- Se muestran precio nominal, cantidad inicial y restante, distancia, transporte por unidad, precio efectivo y estado de la ruta.
- Las rutas deshabilitadas se identifican como tarifas punitivas, no como ofertas descartadas.
- El feed puede ser incierto y no equivale a confirmación en tiempo real de la central.
- Actualización cada 10 segundos, manual o por cambio de ciclo/filtro. Al fallar la consulta se indica que los datos visibles pueden estar desactualizados.
- Sin escrituras ni acciones comerciales; ofertas, bids y swaps pertenecen a otras tarjetas.

## Verificación

Ejecutar `npm ci`, `npm test`, `npm run lint` y `npm run build` en el repositorio frontend.
