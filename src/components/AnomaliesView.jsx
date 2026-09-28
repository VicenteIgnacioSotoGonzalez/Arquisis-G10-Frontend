import { useEffect, useState } from 'react'
import { getAnomalies } from '../services/api'

function formatDate(value) {
  if (!value) {
    return '—'
  }

  return new Intl.DateTimeFormat('es-CL', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))
}

function anomalyStatus(value) {
  switch (value) {
    case 'DUPLICATE':
      return {
        label: 'Duplicado',
        className: 'status status-pending',
      }

    case 'DISCARDED':
      return {
        label: 'Descartado',
        className: 'status status-error',
      }

    case 'NACKED':
      return {
        label: 'Rechazado (NACK)',
        className: 'status status-error',
      }

    default:
      return {
        label: value ?? '—',
        className: 'status',
      }
  }
}

const EMPTY_FILTERS = {
  status: '',
  type: '',
  idpk: '',
  msgId: '',
}

function AnomaliesView({ onBack }) {
  const [anomalies, setAnomalies] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [appliedFilters, setAppliedFilters] =
    useState(EMPTY_FILTERS)

  useEffect(() => {
    let active = true

    getAnomalies(appliedFilters)
      .then((data) => {
        if (!active) {
          return
        }

        setAnomalies(data.items ?? [])
        setTotal(data.total ?? 0)
        setLoading(false)
      })
      .catch((err) => {
        if (!active) {
          return
        }

        setError(err.message)
        setLoading(false)
      })

    return () => {
      active = false
    }
  }, [appliedFilters])

  function handleChange(event) {
    const { name, value } = event.target

    setFilters((current) => ({
      ...current,
      [name]: value,
    }))
  }

  function handleSubmit(event) {
    event.preventDefault()
    setError(null)
    setLoading(true)
    setAppliedFilters(filters)
  }

  function handleClear() {
    setFilters(EMPTY_FILTERS)
    setError(null)
    setLoading(true)
    setAppliedFilters(EMPTY_FILTERS)
  }

  return (
    <div>
      <section className="page-header">
        <div>
          <p className="eyebrow">
            Auditoría de mensajes
          </p>

          <h1>Duplicados y descartes</h1>

          <p className="page-description">
            Mensajes duplicados, descartados o
            rechazados (NACK) registrados por
            la auditoría de entrada.
          </p>
        </div>

        {!loading && !error && (
          <div className="total-card">
            <span className="total-label">
              Anomalías
            </span>

            <strong>{total}</strong>
          </div>
        )}
      </section>

      <section className="cycles-card">
        <form onSubmit={handleSubmit}>
          <label>
            Estado
            <select
              name="status"
              value={filters.status}
              onChange={handleChange}
            >
              <option value="">
                Todos
              </option>

              <option value="DUPLICATE">
                Duplicado
              </option>

              <option value="DISCARDED">
                Descartado
              </option>

              <option value="NACKED">
                Rechazado (NACK)
              </option>
            </select>
          </label>

          <label>
            Tipo de mensaje
            <input
              type="text"
              name="type"
              value={filters.type}
              onChange={handleChange}
              placeholder="demand-statement"
            />
          </label>

          <label>
            idpk
            <input
              type="text"
              name="idpk"
              value={filters.idpk}
              onChange={handleChange}
              placeholder="UUID de la operación"
            />
          </label>

          <label>
            msgId
            <input
              type="text"
              name="msgId"
              value={filters.msgId}
              onChange={handleChange}
              placeholder="UUID del mensaje"
            />
          </label>

          <button type="submit">
            Filtrar
          </button>

          <button type="button" onClick={handleClear}>
            Limpiar
          </button>

          <button type="button" onClick={onBack}>
            Volver
          </button>
        </form>
      </section>

      {loading && (
        <section className="state-card">
          <div className="spinner" />

          <p>Cargando anomalías...</p>
        </section>
      )}

      {!loading && error && (
        <section className="state-card error-card">
          <h2>
            No fue posible cargar las anomalías
          </h2>

          <p>{error}</p>
        </section>
      )}

      {!loading && !error && anomalies.length === 0 && (
        <section className="state-card">
          <h2>Sin anomalías</h2>

          <p>
            No hay mensajes duplicados,
            descartados ni rechazados para los
            filtros elegidos.
          </p>
        </section>
      )}

      {!loading && !error && anomalies.length > 0 && (
        <section className="cycles-card">
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Estado</th>
                  <th>Tipo</th>
                  <th>Motivo</th>
                  <th>idpk</th>
                  <th>Ciclo</th>
                  <th>Recibido</th>
                </tr>
              </thead>

              <tbody>
                {anomalies.map((anomaly) => {
                  const status = anomalyStatus(
                    anomaly.status,
                  )

                  return (
                    <tr key={anomaly.id}>
                      <td>
                        <span
                          className={status.className}
                        >
                          {status.label}
                        </span>
                      </td>

                      <td>
                        {anomaly.type ?? '—'}
                      </td>

                      <td>
                        {anomaly.reasonCode ??
                          anomaly.reason ??
                          '—'}
                      </td>

                      <td>
                        <strong className="cycle-id">
                          {anomaly.idpk ?? '—'}
                        </strong>
                      </td>

                      <td>
                        {anomaly.cycleId ?? '—'}
                      </td>

                      <td>
                        {formatDate(
                          anomaly.receivedAt,
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}

export default AnomaliesView
