import { useEffect, useState } from 'react'
import { getCycles } from './services/api'
import './App.css'

function formatNumber(value) {
  return new Intl.NumberFormat('es-CL', {
    maximumFractionDigits: 2,
  }).format(Number(value))
}

function formatDate(value) {
  if (!value) {
    return 'Sin operaciones'
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

function App() {
  const [cycles, setCycles] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true

    getCycles()
      .then((data) => {
        if (!active) {
          return
        }

        setCycles(data.items ?? [])
        setTotal(data.total ?? 0)
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
  }, [])

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">ES</span>

          <div>
            <p className="brand-name">
              EnergyShark
            </p>

            <p className="brand-subtitle">
              Panel de administración
            </p>
          </div>
        </div>

        <div className="city-badge">
          King's Landing · KLD
        </div>
      </header>

      <main className="page">
        <section className="page-header">
          <div>
            <p className="eyebrow">
              Operación energética
            </p>

            <h1>Historial de ciclos</h1>

            <p className="page-description">
              Consulte los balances y la última
              operación registrada para cada ciclo.
            </p>
          </div>

          {!loading && !error && (
            <div className="total-card">
              <span className="total-label">
                Ciclos registrados
              </span>

              <strong>{total}</strong>
            </div>
          )}
        </section>

        {loading && (
          <section className="state-card">
            <div className="spinner" />
            <p>Cargando ciclos...</p>
          </section>
        )}

        {error && (
          <section className="state-card error-card">
            <h2>
              No fue posible cargar los ciclos
            </h2>

            <p>{error}</p>
          </section>
        )}

        {!loading &&
          !error &&
          cycles.length === 0 && (
            <section className="state-card">
              <h2>No hay ciclos registrados</h2>

              <p>
                Los ciclos aparecerán aquí cuando
                comiencen a recibirse datos.
              </p>
            </section>
          )}

        {!loading &&
          !error &&
          cycles.length > 0 && (
            <section className="cycles-card">
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Ciclo</th>
                      <th>Budget</th>
                      <th>Balance energético</th>
                      <th>Última operación</th>
                      <th>Fecha</th>
                      <th>Reporte</th>
                    </tr>
                  </thead>

                  <tbody>
                    {cycles.map((cycle) => (
                      <tr key={cycle.cycleId}>
                        <td>
                          <strong className="cycle-id">
                            {cycle.cycleId}
                          </strong>
                        </td>

                        <td>
                          {formatNumber(
                            cycle.budgetBalance,
                          )}
                          <span className="unit">
                            {' '}
                            créditos
                          </span>
                        </td>

                        <td>
                          <span
                            className={
                              Number(
                                cycle.energyBalance,
                              ) < 0
                                ? 'negative-value'
                                : ''
                            }
                          >
                            {formatNumber(
                              cycle.energyBalance,
                            )}
                          </span>

                          <span className="unit">
                            {' '}
                            kWh
                          </span>
                        </td>

                        <td>
                          {formatOperation(
                            cycle.lastOperationType,
                          )}
                        </td>

                        <td>
                          {formatDate(
                            cycle.lastOperationAt,
                          )}
                        </td>

                        <td>
                          <span
                            className={
                              cycle.reported
                                ? 'status status-success'
                                : 'status status-pending'
                            }
                          >
                            {cycle.reported
                              ? 'Enviado'
                              : 'Pendiente'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
      </main>
    </div>
  )
}

export default App
