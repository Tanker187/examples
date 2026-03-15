export default async function checkDomain(req, res) {
  const { domain } = req.query

  const domainStr = typeof domain === 'string' ? domain.trim() : ''
  // Allow only reasonable domain names: letters, digits, hyphens and dots.
  // Reject anything with slashes, schemes, or other unexpected characters.
  const domainPattern = /^(?=.{1,253}$)([a-zA-Z0-9-]{1,63}\.)*[a-zA-Z0-9-]{1,63}$/

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
