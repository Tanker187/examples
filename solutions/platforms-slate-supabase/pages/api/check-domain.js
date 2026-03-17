export default async function checkDomain(req, res) {
  const { domain } = req.query

  const domainStr = typeof domain === 'string' ? domain.trim() : ''
  // Allow only valid domain names: letters, digits, hyphens and dots.
  // Each label must be 1-63 chars, cannot start or end with a hyphen, and no slashes/schemes are allowed.
  const domainPattern = /^(?=.{1,253}$)([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/

  if (!domainStr || !domainPattern.test(domainStr)) {
    return res.status(400).json({ error: 'Invalid domain parameter' })
  }

  const response = await fetch(
    `https://api.vercel.com/v6/domains/${domainStr}/config?teamId=${process.env.TEAM_ID_VERCEL}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${process.env.AUTH_BEARER_TOKEN}`,
        'Content-Type': 'application/json',
      },
    }
  )

  const data = await response.json()

  const valid = data?.configuredBy ? true : false

  res.status(200).json(valid)
}
