import { Auth0Client } from '@auth0/auth0-spa-js'

export function createSseAccessTokenGetter() {
  const client = new Auth0Client({
    domain: import.meta.env.VITE_AUTH0_DOMAIN,
    clientId: import.meta.env.VITE_AUTH0_CLIENT_ID,
    authorizationParams: { audience: import.meta.env.VITE_AUTH0_AUDIENCE },
    cacheLocation: 'memory',
  })
  return (options) => client.getTokenSilently(options)
}
