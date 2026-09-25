import { useEffect, useState } from 'react'
import { getCycleDetail } from '../services/api'

function formatNumber(value) {
  if (value === null || value === undefined) {
    return '—'
  }

  return new Intl.NumberFormat('es-CL', {
    maximumFractionDigits: 2,
  }).format(Number(value))
}

function formatDate(value) {
  if (!value) {
    return '—'
  }

  return new Intl.DateTimeFormat('es-CL', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))
}

function formatOperation(value) {
  if (!value) {
    return 'Sin operaciones'
  }

  return value
    .toLowerCase()
    .split('_')
    .map(
      (word) =>
        word.charAt(0).toUpperCase() +
        word.slice(1),
    )
    .join(' ')
}

function LedgerTable({ entries }) {
  if (!entries?.length) {
    return (
      <p className="empty-detail">
        No hay operaciones registradas.
      </p>
    )
  }

  return (
    <div className="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Operación</th>
            <th>Δ Budget</th>
            <th>Δ Energía</th>
            <th>Budget después</th>
            <th>Energía después</th>
            <th>Fecha</th>
          </tr>
        </thead>

        <tbody>
          {entries.map((entry) => (
            <tr key={entry.sequence}>
              <td>{entry.sequence}</td>

              <td>
                {formatOperation(
                  entry.operationType,
                )}
              </td>

              <td>
                {formatNumber(
                  entry.budgetDelta,
                )}
              </td>

              <td>
                {formatNumber(
                  entry.energyDelta,
                )}
              </td>

              <td>
                {formatNumber(
                  entry.budgetAfter,
                )}
              </td>

              <td>
                {formatNumber(
                  entry.energyAfter,
                )}
              </td>

              <td>
                {formatDate(entry.appliedAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function CycleDetail({ cycleId, onBack }) {
  const [cycle, setCycle] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true

    getCycleDetail(cycleId)
      .then((data) => {
        if (active) {
          setCycle(data)
        }
      })
      .catch((err) => {
        if (active) {
          setError(err.message)
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [cycleId])

  if (loading) {
    return (
      <section className="state-card">
        <div className="spinner" />
        <p>Cargando detalle del ciclo...</p>
      </section>
    )
  }

  if (error) {
    return (
      <>
        <button
          className="back-button"
          type="button"
          onClick={onBack}
        >
          ← Volver al historial
        </button>

        <section className="state-card error-card">
          <h2>
            No fue posible cargar el ciclo
          </h2>

          <p>{error}</p>
        </section>
      </>
    )
  }

  const status = cycle.statusStatement ?? {}
  const energy = status.energy ?? {}

  return (
    <div className="cycle-detail">
      <button
        className="back-button"
        type="button"
        onClick={onBack}
      >
        ← Volver al historial
      </button>

      <section className="detail-heading">
        <div>
          <p className="eyebrow">
            Detalle del ciclo
          </p>

          <h1>{cycle.cycleId}</h1>

          <p className="page-description">
            Información completa y operaciones
            registradas durante el ciclo.
          </p>
        </div>

        <span
          className={
            cycle.snapshotConsistent
              ? 'status status-success'
              : 'status status-error'
          }
        >
          {cycle.snapshotConsistent
            ? 'Ledger consistente'
            : 'Ledger inconsistente'}
        </span>
      </section>

      <section className="summary-grid">
        <article className="summary-card">
          <span>Budget final</span>

          <strong>
            {formatNumber(
              cycle.finalBudgetBalance,
            )}{' '}
            <small className="summary-unit">
              créditos
            </small>
          </strong>
        </article>

        <article className="summary-card">
          <span>Energía final</span>

          <strong>
            {formatNumber(
              cycle.finalEnergyBalance,
            )}{' '}
            <small className="summary-unit">
              kWh
            </small>
          </strong>
        </article>

        <article className="summary-card">
          <span>Última operación</span>

          <strong>
            {formatOperation(
              cycle.lastOperation
                ?.operationType,
            )}
          </strong>
        </article>

        <article className="summary-card">
          <span>Operaciones</span>

          <strong>
            {cycle.ledger?.length ?? 0}
          </strong>
        </article>
      </section>

      <section className="detail-card">
        <h2>Estado energético</h2>

        <div className="detail-values">
          <div>
            <span>Consumo</span>

            <strong>
              {formatNumber(
                energy.consumption,
              )}{' '}
              kWh
            </strong>
          </div>

          <div>
            <span>
              Capacidad de generación
            </span>

            <strong>
              {formatNumber(
                energy.generationCapacity,
              )}{' '}
              kWh
            </strong>
          </div>

          <div>
            <span>
              Costo de generación
            </span>

            <strong>
              {formatNumber(
                energy.generationCost,
              )}
            </strong>
          </div>

          <div>
            <span>Válido hasta</span>

            <strong>
              {formatDate(
                status.validUntil,
              )}
            </strong>
          </div>
        </div>
      </section>

      <section className="detail-card">
        <h2>Fondos recibidos</h2>

        <LedgerTable
          entries={cycle.fundsReceived}
        />
      </section>

      <section className="detail-card">
        <h2>Demand statements aplicados</h2>

        <LedgerTable
          entries={cycle.demandStatements}
        />
      </section>

      <section className="detail-card">
        <h2>Negociaciones voluntarias</h2>

        {!cycle.negotiations?.length ? (
          <p className="empty-detail">
            No se registraron negociaciones
            voluntarias en este ciclo.
          </p>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Dirección</th>
                  <th>Cantidad</th>
                  <th>Precio ofrecido</th>
                  <th>Estado</th>
                  <th>
                    Energía confirmada
                  </th>
                  <th>
                    Precio confirmado
                  </th>
                </tr>
              </thead>

              <tbody>
                {cycle.negotiations.map(
                  (negotiation) => (
                    <tr key={negotiation.id}>
                      <td>
                        {negotiation.direction}
                      </td>

                      <td>
                        {formatNumber(
                          negotiation.requestedQuantity,
                        )}
                      </td>

                      <td>
                        {formatNumber(
                          negotiation.offeredPrice,
                        )}
                      </td>

                      <td>
                        {negotiation.status}
                      </td>

                      <td>
                        {formatNumber(
                          negotiation.confirmedEnergy,
                        )}
                      </td>

                      <td>
                        {formatNumber(
                          negotiation.confirmedPrice,
                        )}
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="detail-card">
        <h2>Negotiation report</h2>

        {cycle.negotiationReport ? (
          <div className="detail-values">
            <div>
              <span>
                Budget reportado
              </span>

              <strong>
                {formatNumber(
                  cycle.negotiationReport
                    .budgetBalance,
                )}
              </strong>
            </div>

            <div>
              <span>
                Energía reportada
              </span>

              <strong>
                {formatNumber(
                  cycle.negotiationReport
                    .energyBalance,
                )}
              </strong>
            </div>

            <div>
              <span>Creado</span>

              <strong>
                {formatDate(
                  cycle.negotiationReport
                    .createdAt,
                )}
              </strong>
            </div>

            <div>
              <span>Enviado</span>

              <strong>
                {formatDate(
                  cycle.negotiationReport
                    .sentAt,
                )}
              </strong>
            </div>
          </div>
        ) : (
          <p className="empty-detail">
            El negotiation-report aún no ha
            sido registrado para este ciclo.
          </p>
        )}
      </section>

      <section className="detail-card">
        <div className="section-heading">
          <div>
            <h2>Ledger del ciclo</h2>

            <p>
              Secuencia completa de operaciones
              aplicadas.
            </p>
          </div>
        </div>

        <LedgerTable entries={cycle.ledger} />
      </section>
    </div>
  )
}

export default CycleDetail