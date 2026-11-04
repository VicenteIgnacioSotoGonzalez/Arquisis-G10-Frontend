# E2-060 · Swaps en curso e historial de resultados (RF04)

Vista de solo lectura basada en E2-057: `GET /market/swaps` con paginación y filtros
`cycleId`, `status`, `role`; `GET /market/swaps/{id}` por identificador interno.

- Separar en curso (`SUBMITTED`, `PROPOSED`, `ACCEPT_SUBMITTED`) de finalizados
  (`SETTLED`, `REJECTED`, `EXPIRED`, `CANCELLED`). Los estados desconocidos no
  se consideran finalizados por defecto.
- Mostrar intento y recepción HTTP 202 por separado del estado `PROPOSED`.
  HTTP 202 no implica que el swap se liquidó.
- Presentar entrega/recepción de KWH o CR como montos **previstos** hasta que
  el backend indique `SETTLED`. La confirmación económica proviene de la wallet
  central, no del frontend. No ejecutar pagos desde esta vista.
- Consultar estados, rechazo, fecha de liquidación, reintentos e incidencias
  sin exponer `swapToken`, `idpk`, ni llaves de idempotencia.
- Actualizar lista automáticamente cada 15 s, recarga manual y filtros
  por ciclo, rol y estado. Totales por estado son de la **página actual**;
  el total general filtrado procede del backend.
- Cancelar solicitudes al cambiar filtro o detalle para no mezclar swaps
  entre ciclos.

**Dependencias:** E2-057, E2-058 y E2-059 como base de interfaz.

**Validación:** `npm test`, `npm run lint`, `npm run build`.
