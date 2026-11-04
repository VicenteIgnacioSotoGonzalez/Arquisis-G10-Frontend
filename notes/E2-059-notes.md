# E2-059 — Historial y detalle de ciclos para E2 (RF01)

Extiende la vista `CycleDetail` sin modificar los datos E1 que ya presenta.

- Usa `GET /cycles/{cycleId}/history` (E2-056). Requiere que la API E2-056 esté integrada/desplegada. El endpoint es de lectura.
- Muestra `statusStatement` (sellable, buybackPrice, minBid), ventanas, estrategia, funding, ofertas y revisiones, bids, swaps, trade-recorded, transporte, imbalance-settlement, negotiationReports y último efecto del ledger.
- Presenta **HTTP 202** como recepción de la propuesta, **bid-accepted** como aceptación comercial y **SETTLED** como liquidación, sin inferir un paso a partir del otro.
- `publicationStatus=PUBLISHED` solo significa publicación en broker. No implica ejecución ni aceptación.
- No muestra tokens de swap, credenciales, claves de idempotencia de wallet ni payloads arbitrarios.
- Actualiza automáticamente cada 15 segundos, permite actualización manual y conserva datos visibles con aviso si falla la actualización.
- Cancela solicitudes anteriores al cambiar de ciclo y verifica que la respuesta pertenezca al ciclo actual.
- No recalcula valores monetarios ni crea efectos de ledger en el frontend.

## Validación

`npm test`, `npm run lint`, `npm run build`.

Si E2-056 todavía no está desplegado, la nueva sección muestra un mensaje de error y el detalle E1 continúa disponible.
