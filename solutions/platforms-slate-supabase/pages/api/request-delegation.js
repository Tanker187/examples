function isValidDomain(domain) {
  if (typeof domain !== 'string') return false
  const trimmed = domain.trim()
  if (!trimmed) return false
  // Basic sane length limits for a DNS name
  if (trimmed.length > 253) return false
  // Split into labels and validate each one
  const labels = trimmed.split('.')
  // Must contain at least one dot and no empty labels
  if (labels.length < 2 || labels.some(label => label.length === 0)) return false
  for (const label of labels) {
    // Labels must be between 1 and 63 characters
    if (label.length < 1 || label.length > 63) return false
    // Only allow letters, digits, and hyphens in each label
    if (!/^[A-Za-z0-9-]+$/.test(label)) return false
    // Labels must not start or end with a hyphen
    if (label.startsWith('-') || label.endsWith('-')) return false
  }
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
