function generateSecureRandomString(length: number): string {
  // Try to use a cryptographically secure source of randomness when available.
  try {
    const cryptoObj =
      (typeof globalThis !== 'undefined' && (globalThis as any).crypto) ||
      (typeof window !== 'undefined' && (window as any).crypto)
    if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
      const bytes = new Uint8Array(length)
      cryptoObj.getRandomValues(bytes)
      // Convert bytes to a base36 string and trim/pad to the requested length.
      let result = ''
      for (let i = 0; i < bytes.length; i++) {
        result += bytes[i].toString(36).padStart(2, '0')
      }
      return result.slice(0, length)
    }
  } catch {
    // Fall through to non-crypto fallback below.
  }

  // Fallback: use Math.random if crypto is not available (e.g., non-browser envs).
  return Math.random().toString(36).slice(2, 2 + length)
}

export function getUserId(): string {
  if (typeof window === 'undefined') return 'user_local'
  try {
    const KEY = 'nfca_user_id'
    const existing = window.localStorage.getItem(KEY)
    if (existing && existing.trim()) return existing
    const generated = `user_${Date.now().toString(36)}_${generateSecureRandomString(
      8
    )}`
    window.localStorage.setItem(KEY, generated)
    return generated
  } catch {
    return 'user_local'
  }
}

export function ensureGlobalUserId(): string {
  const id = getUserId()
  try {
    ;(window as unknown as { USER_ID?: string }).USER_ID = id
  } catch {
    // ignore
  }
  return id
}
