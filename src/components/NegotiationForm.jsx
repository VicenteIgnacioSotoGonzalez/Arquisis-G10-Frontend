import { useEffect, useState } from 'react'
import { useAuth0 } from '@auth0/auth0-react'
import {
  createNegotiation,
  getCycles,
} from '../services/api'

function NegotiationForm({ onBack }) {
  const { loginWithRedirect } = useAuth0()

  const [cycleId, setCycleId] = useState('')
  const [direction, setDirection] =
    useState('give')
  const [quantity, setQuantity] = useState('')
  const [price, setPrice] = useState('')

  const [loadingCycles, setLoadingCycles] =
    useState(true)
  const [submitting, setSubmitting] =
    useState(false)
  const [formError, setFormError] = useState(null)
  const [needsLogin, setNeedsLogin] =
    useState(false)
  const [result, setResult] = useState(null)

  useEffect(() => {
    let active = true

    getCycles()
      .then((data) => {
        if (!active) {
          return
        }

        const latestCycle = data.items?.[0]
        setCycleId(latestCycle?.cycleId ?? '')

        setLoadingCycles(false)
      })
      .catch(() => {
        if (!active) {
          return
        }

        setLoadingCycles(false)
      })

    return () => {
      active = false
    }
  }, [])

  function validate() {
    if (!cycleId) {
      return 'No hay ciclos disponibles para crear una propuesta.'
    }

    if (Number(quantity) <= 0) {
      return 'La cantidad debe ser mayor a 0.'
    }

    if (Number(price) < 0) {
      return 'El precio no puede ser negativo.'
    }

    return null
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setFormError(null)
    setNeedsLogin(false)
    setResult(null)

    const validationError = validate()

    if (validationError) {
      setFormError(validationError)
      return
    }

    setSubmitting(true)

    try {
      const data = await createNegotiation({
        cycleId,
        idpk: crypto.randomUUID(),
        direction,
        requestedQuantity: quantity,
        offeredPrice: price,
      })

      setResult(data)
    } catch (err) {
      if (err.message.includes('status 401')) {
        setNeedsLogin(true)
        setFormError(
          'Inicia sesión para crear negociaciones.',
        )
      } else if (err.message.includes('status 404')) {
        setFormError(
          'El ciclo más reciente ya no existe.',
        )
      } else if (err.message.includes('status 422')) {
        setFormError(
          'Revisa que los datos son correctos o si la ventana de negociación sigue abierta.',
        )
      } else {
        setFormError(err.message)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <section className="page-header">
        <div>
          <p className="eyebrow">
            Negociación voluntaria
          </p>

          <div className="module-title-row">
            <h1>Nueva propuesta</h1>
            <button
              className="module-back-button"
              type="button"
              onClick={onBack}
            >
              ← Volver
            </button>
          </div>

          <p className="page-description">
            {cycleId
              ? `La propuesta se asociará al ciclo más reciente: ${cycleId}.`
              : 'No hay ciclos disponibles para crear una propuesta.'}
          </p>
        </div>
      </section>

      <section className="negotiation-form-card">
        <form
          className="negotiation-form"
          onSubmit={handleSubmit}
        >
          <label className="negotiation-field">
            Dirección
            <select
              value={direction}
              onChange={(event) =>
                setDirection(event.target.value)
              }
              disabled={submitting}
            >
              <option value="give">
                Entregar (give)
              </option>

              <option value="take">
                Recibir (take)
              </option>
            </select>
          </label>

          <label className="negotiation-field">
            Cantidad (kWh)
            <input
              type="number"
              min="0"
              step="0.01"
              value={quantity}
              onChange={(event) =>
                setQuantity(event.target.value)
              }
              disabled={submitting}
            />
          </label>

          <label className="negotiation-field">
            Precio ofrecido (créditos)
            <input
              type="number"
              min="0"
              step="0.01"
              value={price}
              onChange={(event) =>
                setPrice(event.target.value)
              }
              disabled={submitting}
            />
          </label>

          <div className="negotiation-form-actions">
            <button
              className="negotiation-submit-button"
              type="submit"
              disabled={
                submitting || loadingCycles || !cycleId
              }
            >
              {submitting
                ? 'Enviando...'
                : 'Crear propuesta'}
            </button>

          </div>
        </form>
      </section>

      {formError && (
        <section className="state-card error-card">
          <h2>No se pudo crear la propuesta</h2>

          <p>{formError}</p>

          {needsLogin && (
            <button
              type="button"
              onClick={() => loginWithRedirect()}
            >
              Iniciar sesión
            </button>
          )}
        </section>
      )}

      {result && (
        <section className="state-card">
          <h2>Propuesta creada</h2>

          <p>
            ID {result.id} · Estado{' '}
            {result.status}
          </p>
        </section>
      )}
    </div>
  )
}

export default NegotiationForm
