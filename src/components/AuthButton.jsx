import { useAuth0 } from '@auth0/auth0-react'

function AuthButton() {
  const {
    isAuthenticated,
    isLoading,
    user,
    loginWithRedirect,
    logout,
  } = useAuth0()

  if (isLoading) {
    return (
      <p className="auth-status">
        Cargando sesión...
      </p>
    )
  }

  if (!isAuthenticated) {
    return (
      <button
        type="button"
        className="auth-button auth-button-primary"
        onClick={() => loginWithRedirect()}
      >
        <span className="auth-button-icon">
          →
        </span>
        Iniciar sesión
      </button>
    )
  }

  return (
    <div className="auth-user">
      <span className="auth-email">
        {user?.email}
      </span>

      <button
        type="button"
        className="auth-button auth-button-secondary"
        onClick={() =>
          logout({
            logoutParams: {
              returnTo: window.location.origin,
            },
          })
        }
      >
        Cerrar sesión
      </button>
    </div>
  )
}

export default AuthButton
