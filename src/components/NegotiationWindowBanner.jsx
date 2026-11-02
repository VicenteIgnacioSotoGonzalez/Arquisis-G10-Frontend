import { useEffect, useState } from 'react'
import {
  getCycleDetail,
  getCycles,
} from '../services/api'

const API_REFRESH_MS = 5000

const NEGOTIATION_WINDOW_MS =
  20 * 60 * 1000

function formatDate(value) {
  if (!value) {
    return null
  }

  return new Intl.DateTimeFormat('es-CL', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))
}


function formatCountdown(milliseconds) {
  const safeMilliseconds = Math.max(
    0,
    milliseconds,
  )

  const totalSeconds = Math.floor(
    safeMilliseconds / 1000,
  )

  const hours = Math.floor(
    totalSeconds / 3600,
  )

  const minutes = Math.floor(
    (totalSeconds % 3600) / 60,
  )

  const seconds =
    totalSeconds % 60

  return [
    hours,
    minutes,
    seconds,
  ]
    .map((value) =>
      String(value).padStart(2, '0'),
    )
    .join(':')
}


function getCurrentWindow(
  validUntil,
  now,
) {
  const firstWindowStart =
    new Date(validUntil).getTime()
    - NEGOTIATION_WINDOW_MS

  if (now < firstWindowStart) {
    return {
      start: firstWindowStart,
      end: firstWindowStart + NEGOTIATION_WINDOW_MS,
      active: false,
    }
  }

  const elapsedCycles = Math.floor(
    (now - firstWindowStart) / NEGOTIATION_WINDOW_MS,
  )
  const start =
    firstWindowStart + elapsedCycles * NEGOTIATION_WINDOW_MS

  return {
    start,
    end: start + NEGOTIATION_WINDOW_MS,
    active: true,
  }
}


function NegotiationWindowBanner() {
  const [windowData, setWindowData] =
    useState({
      loading: true,
      cycleId: null,
      validUntil: null,
      error: null,
    })

  const [now, setNow] = useState(
    Date.now(),
  )

  /*
   * Reloj visual.
   *
   * Se actualiza cada segundo SIN consultar
   * nuevamente la API.
   */
  useEffect(() => {
    const timerId = window.setInterval(
      () => {
        setNow(Date.now())
      },
      1000,
    )

    return () => {
      window.clearInterval(timerId)
    }
  }, [])

  /*
   * Información real desde backend.
   *
   * Se consulta cada 5 segundos para detectar
   * ciclos nuevos y también al volver a la pestaña.
   */
  useEffect(() => {
    let mounted = true
    let refreshing = false
    let timeoutId

    async function refreshStatus() {
      if (!mounted || refreshing) {
        return
      }

      refreshing = true

      try {
        const cyclesData =
          await getCycles()

        const cycles =
          cyclesData.items ?? []

        if (cycles.length === 0) {
          if (mounted) {
            setWindowData({
              loading: false,
              cycleId: null,
              validUntil: null,
              error: null,
            })
          }
        } else {
          const latestCycle =
            cycles[0]

          const detail =
            await getCycleDetail(
              latestCycle.cycleId,
            )

          const validUntil =
            detail.statusStatement
              ?.validUntil ?? null

          if (mounted) {
            setWindowData({
              loading: false,
              cycleId:
                latestCycle.cycleId,
              validUntil,
              error: null,
            })
          }
        }
      } catch (err) {
        if (mounted) {
          setWindowData(
            (current) => ({
              ...current,
              loading: false,
              error: err.message,
            }),
          )
        }
      } finally {
        refreshing = false

        if (mounted) {
          timeoutId = window.setTimeout(
            refreshStatus,
            API_REFRESH_MS,
          )
        }
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        window.clearTimeout(timeoutId)
        refreshStatus()
      }
    }

    refreshStatus()

    document.addEventListener(
      'visibilitychange',
      handleVisibilityChange,
    )

    return () => {
      mounted = false

      window.clearTimeout(timeoutId)
      document.removeEventListener(
        'visibilitychange',
        handleVisibilityChange,
      )
    }
  }, [])

  if (windowData.loading) {
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

  if (windowData.error) {
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

  if (!windowData.validUntil) {
    return (
      <section className="negotiation-banner negotiation-banner-inactive">
        <span className="negotiation-banner-dot" />

        <div>
          <strong>
            No hay información de negociación
          </strong>

          <p>
            Esperando información del próximo ciclo.
          </p>
        </div>
      </section>
    )
  }

  const currentWindow =
    getCurrentWindow(
      windowData.validUntil,
      now,
    )

  /*
   * VENTANA ACTIVA
   */
  if (currentWindow.active) {
    const remaining =
      currentWindow.end - now

    return (
      <section className="negotiation-banner negotiation-banner-active">
        <span className="negotiation-banner-dot" />

        <div className="negotiation-banner-content">
          <div>
            <strong>
              Ventana de negociación activa
            </strong>

            <p>
              {windowData.cycleId}
              {' · '}
              Cierra a las{' '}
              {formatDate(
                currentWindow.end,
              )}
            </p>
          </div>

          <div className="negotiation-countdown">
            <span>
              Tiempo restante
            </span>

            <strong>
              {formatCountdown(
                remaining,
              )}
            </strong>
          </div>
        </div>
      </section>
    )
  }

  /*
   * VENTANA CERRADA
   */

  const remaining =
    currentWindow.start - now

  return (
    <section className="negotiation-banner negotiation-banner-inactive">
      <span className="negotiation-banner-dot" />

      <div className="negotiation-banner-content">
        <div>
          <strong>
            No hay una ventana de negociación activa
          </strong>

          <p>
            Próxima ventana estimada:{' '}
            {formatDate(
              currentWindow.start,
            )}
          </p>
        </div>

        <div className="negotiation-countdown">
          <span>
            Próxima ventana en
          </span>

          <strong>
            {formatCountdown(
              remaining,
            )}
          </strong>
        </div>
      </div>
    </section>
  )
}

export default NegotiationWindowBanner