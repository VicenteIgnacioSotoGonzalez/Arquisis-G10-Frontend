import { useEffect, useState } from 'react'
import {
  getCycleDetail,
  getCycles,
} from '../services/api'

const API_REFRESH_MS = 5000

const NEGOTIATION_WINDOW_MS =
  20 * 60 * 1000

const CYCLE_DURATION_MS =
  2 * 60 * 60 * 1000

// Desde el cierre de una ventana hasta
// el comienzo de la siguiente:
// 120 min - 20 min = 100 min.
const TIME_BETWEEN_WINDOWS_MS =
  CYCLE_DURATION_MS - NEGOTIATION_WINDOW_MS


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


function getNextWindowStart(
  validUntil,
  now,
) {
  const currentWindowEnd =
    new Date(validUntil).getTime()

  let nextStart =
    currentWindowEnd
    + TIME_BETWEEN_WINDOWS_MS

  /*
   * Si por alguna razón el último ciclo de la API
   * está muy antiguo, avanzamos de 2 h en 2 h hasta
   * encontrar la siguiente ventana futura.
   */
  while (
    nextStart
    + NEGOTIATION_WINDOW_MS
    <= now
  ) {
    nextStart += CYCLE_DURATION_MS
  }

  return nextStart
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
   * ciclos nuevos.
   */
  useEffect(() => {
    let mounted = true

    async function refreshStatus() {
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

          return
        }

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
      }
    }

    refreshStatus()

    const intervalId =
      window.setInterval(
        refreshStatus,
        API_REFRESH_MS,
      )

    return () => {
      mounted = false

      window.clearInterval(
        intervalId,
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

  const windowEnd =
    new Date(
      windowData.validUntil,
    ).getTime()

  const windowStart =
    windowEnd
    - NEGOTIATION_WINDOW_MS

  const isActive =
    now >= windowStart
    && now < windowEnd

  /*
   * VENTANA ACTIVA
   */
  if (isActive) {
    const remaining =
      windowEnd - now

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
                windowData.validUntil,
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

  const nextWindowStart =
    getNextWindowStart(
      windowData.validUntil,
      now,
    )

  const remaining =
    nextWindowStart - now

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
              nextWindowStart,
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