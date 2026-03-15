import supabase from '@/lib/supabase'

export default async function removeDomain(req, res) {
  const { domain, siteId } = req.query

  // Validate the domain to prevent SSRF and path manipulation
  // This regex enforces a conservative hostname format (labels of letters/digits/hyphens, separated by dots)
  const domainPattern =
    /^(?=.{1,253}$)(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/

  if (typeof domain !== 'string' || !domainPattern.test(domain)) {
    return res.status(400).json({ error: 'Invalid domain' })
  }

  const response = await fetch(
    `https://api.vercel.com/v8/projects/${process.env.PROJECT_ID_VERCEL}/domains/${domain}?teamId=${process.env.TEAM_ID_VERCEL}`,
    {
      headers: {
        Authorization: `Bearer ${process.env.AUTH_BEARER_TOKEN}`,
      },
      method: 'DELETE',
    }
  )

  await response.json()
  await supabase
    .from('sites')
    .update({ customDomain: null })
    .match({ id: siteId })

  res.status(200).end()
}
