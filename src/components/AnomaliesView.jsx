import { useEffect, useState } from 'react'
import { getAnomalies } from '../services/api'
import { ANOMALY_PAGE_SIZE, anomalyLabel, anomalyReasonLabel } from '../services/anomalyAudit'

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
  return {
    label: anomalyLabel(value),
    className: value === 'DUPLICATE' ? 'status status-pending' : 'status status-error',
  }
}

const EMPTY_FILTERS = {
  status: '',
  type: '',
  reasonCode: '',
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
  const [offset, setOffset] = useState(0)

  useEffect(() => {
    let active = true

    getAnomalies(appliedFilters, offset, ANOMALY_PAGE_SIZE)
      .then((data) => {
        if (!active) {
          return
        }

        setAnomalies(data.items ?? [])
        setTotal(data.total ?? 0)
        setError(null)
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
  }, [appliedFilters, offset])

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
    setOffset(0)
    setAppliedFilters({ ...filters })
  }

  function handleClear() {
    setFilters({ ...EMPTY_FILTERS })
    setError(null)
    setLoading(true)
    setOffset(0)
    setAppliedFilters({ ...EMPTY_FILTERS })
  }

  return (
    <div>
      <section className="page-header anomalies-page-header">
        <div>
          <p className="eyebrow">
            Auditoría de mensajes
          </p>

          <div className="module-title-row">
            <h1>Duplicados y descartes</h1>
            <button
              className="module-back-button"
              type="button"
              onClick={onBack}
            >
              ← Volver
            </button>
          </div>

          <p className="page-description">
            Mensajes duplicados, descartados, identidad ajena y
            rechazos NACK registrados por la auditoría de entrada.
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

      <section className="anomalies-filter-card">
        <form
          className="anomalies-filter-form"
          onSubmit={handleSubmit}
        >
          <label className="anomalies-filter-field">
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

          <label className="anomalies-filter-field">
            Código de motivo
            <input name="reasonCode" list="audit-reason-codes" value={filters.reasonCode} onChange={handleChange} placeholder="IDENTITY_MISMATCH" />
            <datalist id="audit-reason-codes">
              <option value="IDENTITY_MISMATCH" />
              <option value="MALFORMED_MESSAGE" />
            </datalist>
          </label>

          <label className="anomalies-filter-field">
            Tipo de mensaje
            <input
              type="text"
              name="type"
              value={filters.type}
              onChange={handleChange}
              placeholder="bid, swap-settled..."
            />
          </label>

          <label className="anomalies-filter-field">
            idpk
            <input
              type="text"
              name="idpk"
              value={filters.idpk}
              onChange={handleChange}
              placeholder="UUID de la operación"
            />
          </label>

          <label className="anomalies-filter-field">
            msgId
            <input
              type="text"
              name="msgId"
              value={filters.msgId}
              onChange={handleChange}
              placeholder="UUID del mensaje"
            />
          </label>

          <div className="anomalies-filter-actions">
            <button
              className="anomalies-filter-submit"
              type="submit"
            >
              Aplicar filtros
            </button>

            <button
              className="anomalies-filter-secondary"
              type="button"
              onClick={handleClear}
            >
              Limpiar
            </button>

          </div>
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
                  <th>msgId</th>
                  <th>idpk</th>
                  <th>Mensaje original</th>
                  <th>Emisor</th>
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
                        {anomalyReasonLabel(anomaly.reasonCode) ??
                          anomaly.reason ??
                          '—'}
                        {anomaly.reasonCode && anomaly.reason && <small className="audit-reason">{anomaly.reason}</small>}
                      </td>

                      <td className="audit-identifier">{anomaly.msgId ?? '—'}</td>

                      <td>
                        <strong className="cycle-id">
                          {anomaly.idpk ?? '—'}
                        </strong>
                      </td>

                      <td className="audit-identifier">{anomaly.relatedMsgId && anomaly.relatedMsgId !== anomaly.msgId ? anomaly.relatedMsgId : '—'}</td>

                      <td>{anomaly.sender ?? '—'}</td>

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
          <div className="market-pagination">
            <button type="button" disabled={offset === 0} onClick={() => { setLoading(true); setOffset(Math.max(0, offset - ANOMALY_PAGE_SIZE)) }}>Anterior</button>
            <span>{offset + 1}–{Math.min(offset + anomalies.length, total)} de {total}</span>
            <button type="button" disabled={offset + anomalies.length >= total} onClick={() => { setLoading(true); setOffset(offset + ANOMALY_PAGE_SIZE) }}>Siguiente</button>
          </div>
        </section>
      )}
    </div>
  )
}

export default AnomaliesView
