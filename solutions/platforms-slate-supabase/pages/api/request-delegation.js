function isValidDomain(domain) {
  if (typeof domain !== 'string') return false
  const trimmed = domain.trim()
  if (!trimmed) return false
  // Basic sane length limits for a DNS name
  if (trimmed.length > 253) return false
  // Only allow letters, digits, hyphens, and dots
  if (!/^[A-Za-z0-9.-]+$/.test(trimmed)) return false
  // Must contain at least one dot and not start/end with dot or hyphen
  if (!trimmed.includes('.')) return false
  if (trimmed.startsWith('.') || trimmed.endsWith('.') || trimmed.startsWith('-') || trimmed.endsWith('-')) return false
  return true
}

export default async function requestDelegation(req, res) {
  const { domain } = req.query

  if (!isValidDomain(domain)) {
    res.status(400).end()
    return
  }

  const response = await fetch(
    `https://api.vercel.com/v6/domains/${domain}/request-delegation?teamId=${process.env.TEAM_ID_VERCEL}`,
    {
      headers: {
        Authorization: `Bearer ${process.env.AUTH_BEARER_TOKEN}`,
        'Content-Type': 'application/json',
      },
      method: 'POST',
    }
  )

  if (response.ok) {
    res.status(200).end()
  } else {
    res.status(403).end()
  }
}
