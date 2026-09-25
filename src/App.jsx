import { useEffect, useState } from 'react'
import { getHealth } from './services/api'
import './App.css'

function App() {
  const [health, setHealth] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true

    getHealth()
      .then((data) => {
        if (active) {
          setHealth(data)
        }
      })
      .catch((err) => {
        if (active) {
          setError(err.message)
        }
      })

    return () => {
      active = false
    }
  }, [])

  return (
    <main>
      <h1>EnergyShark</h1>

      {!health && !error && <p>Conectando con backend...</p>}

      {health && (
        <div>
          <p>Backend conectado</p>
          <p>Status: {health.status}</p>
          <p>Instancia: {health.instance}</p>
        </div>
      )}

      {error && (
        <div>
          <p>No fue posible conectar con el backend.</p>
          <p>{error}</p>
        </div>
      )}
    </main>
  )
}

export default App

