let tokenGetter = null

export function setTokenGetter(getter) {
  tokenGetter = getter
}

export async function getToken() {
  if (!tokenGetter) {
    return null
  }

  return tokenGetter()
}
