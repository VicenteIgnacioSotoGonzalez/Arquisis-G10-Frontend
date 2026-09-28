import { useEffect, useState } from 'react'
import { getConnectivity } from '../services/api'

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

function ConnectivityView({ onBack }) {
  const [connectivity, setConnectivity] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let active = true

    getConnectivity()
      .then((data) => {
        if (active) {
          setConnectivity(data)
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
  }, [reloadKey])

  function handleRetry() {
    setError(null)
    setLoading(true)
    setReloadKey((key) => key + 1)
  }

  if (loading) {
    return (
      <section className="state-card">
        <div className="spinner" />

        <p>Cargando conectividad...</p>
      </section>
    )
  }

  if (error) {
    const missingTable = error.includes('status 404')

    return (
      <section className="state-card error-card">
        <h2>
          {missingTable
            ? 'No hay tabla de distancias disponible'
            : 'No fue posible cargar la conectividad'}
        </h2>

        <p>
          {missingTable
            ? 'Aún no se recibe una distance-table desde la central.'
            : error}
        </p>

        <button type="button" onClick={handleRetry}>
          Reintentar
        </button>

        <button type="button" onClick={onBack}>
          Volver
        </button>
      </section>
    )
  }

  const items = connectivity?.items ?? []

  if (items.length === 0) {
    return (
      <section className="state-card">
        <h2>Sin destinos registrados</h2>

        <p>
          La tabla de distancias no contiene
          destinos para mostrar.
        </p>

        <button type="button" onClick={onBack}>
          Volver
        </button>
      </section>
    )
  }

  return (
    <div>
      <section className="page-header">
        <div>
          <p className="eyebrow">
            Red energética
          </p>

          <h1>Conectividad</h1>

          <p className="page-description">
            Destinos alcanzables, distancia,
            costo de transporte y estado según
            la última tabla recibida.
          </p>

          <p className="page-description">
            Actualizado:{' '}
            {formatDate(connectivity.timestamp)}
          </p>
        </div>

        <div className="total-card">
          <span className="total-label">
            Destinos
          </span>

          <strong>
            {connectivity.total ?? items.length}
          </strong>
        </div>
      </section>

      <section className="cycles-card">
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Destino</th>
                <th>Distancia</th>
                <th>Costo transporte</th>
                <th>Estado</th>
              </tr>
            </thead>

            <tbody>
              {items.map((item) => (
                <tr key={item.destination}>
                  <td>
                    <strong className="cycle-id">
                      {item.destination}
                    </strong>
                  </td>

                  <td>
                    {formatNumber(item.distance)}

                    <span className="unit">
                      {' '}
                      km
                    </span>
                  </td>

                  <td>
                    {formatNumber(item.transportCost)}

                    <span className="unit">
                      {' '}
                      créditos
                    </span>
                  </td>

                  <td>
                    <span
                      className={
                        item.enabled
                          ? 'status status-success'
                          : 'status status-pending'
                      }
                    >
                      {item.enabled
                        ? 'Habilitado'
                        : 'Deshabilitado'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <button type="button" onClick={onBack}>
        Volver
      </button>
    </div>
  )
}

export default ConnectivityView
