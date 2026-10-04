import { useEffect, useState } from 'react'
import {
  getCycleDetail,
  getCycles,
} from '../services/api'

const REFRESH_INTERVAL_MS = 5000

function formatDate(value) {
  if (!value) {
    return null
  }

  return new Intl.DateTimeFormat('es-CL', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))
}

function NegotiationWindowBanner() {
  const [status, setStatus] = useState({
    loading: true,
    active: false,
    cycleId: null,
    validUntil: null,
    error: null,
  })

  useEffect(() => {
    let mounted = true

    async function refreshStatus() {
      try {
        const cyclesData = await getCycles()
        const cycles = cyclesData.items ?? []

        if (cycles.length === 0) {
          if (mounted) {
            setStatus({
              loading: false,
              active: false,
              cycleId: null,
              validUntil: null,
              error: null,
            })
          }

          return
        }

        // /cycles devuelve los ciclos desde el
        // más reciente al más antiguo.
        const latestCycle = cycles[0]

        const detail = await getCycleDetail(
          latestCycle.cycleId,
        )

        const validUntil =
          detail.statusStatement?.validUntil ?? null

        const deadline = validUntil
          ? new Date(validUntil)
          : null

        const active =
          deadline !== null &&
          !Number.isNaN(deadline.getTime()) &&
          deadline.getTime() > Date.now()

        if (mounted) {
          setStatus({
            loading: false,
            active,
            cycleId: latestCycle.cycleId,
            validUntil,
            error: null,
          })
        }
      } catch (err) {
        if (mounted) {
          setStatus((current) => ({
            ...current,
            loading: false,
            error: err.message,
          }))
        }
      }
    }

    refreshStatus()

    const intervalId = window.setInterval(
      refreshStatus,
      REFRESH_INTERVAL_MS,
    )

    return () => {
      mounted = false
      window.clearInterval(intervalId)
    }
  }, [])

  if (status.loading) {
    return (
      <section className="negotiation-banner negotiation-banner-loading">
        <span className="negotiation-banner-dot" />

        <div>
          <strong>
            Verificando ventana de negociación...
          </strong>
        </div>
      </section>
    )
  }

  if (status.error) {
    return (
      <section className="negotiation-banner negotiation-banner-error">
        <span className="negotiation-banner-dot" />

        <div>
          <strong>
            No fue posible verificar la ventana
          </strong>

          <p>
            El estado se actualizará automáticamente.
          </p>
        </div>
      </section>
    )
  }

  if (status.active) {
    return (
      <section className="negotiation-banner negotiation-banner-active">
        <span className="negotiation-banner-dot" />

        <div>
          <strong>
            Ventana de negociación activa
          </strong>

          <p>
            {status.cycleId}
            {' · '}
            Disponible hasta{' '}
            {formatDate(status.validUntil)}
          </p>
        </div>
      </section>
    )
  }

  return (
    <section className="negotiation-banner negotiation-banner-inactive">
      <span className="negotiation-banner-dot" />

      <div>
        <strong>
          No hay una ventana de negociación activa
        </strong>

        <p>
          Esperando la próxima ventana de negociación.
        </p>
      </div>
    </section>
  )
}

export default NegotiationWindowBanner