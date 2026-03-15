type RULE_RESPONSE = 'block' | 'whitelist' | 'captcha'

export async function addIpRule(
  ip: string,
  ruleResponse: RULE_RESPONSE = 'block'
) {
  // TODO: Check if IP is valid.
  try {
    // Adding new Custom Rule
    const req = await fetch(
      `https://customer-api.datadome.co/1.0/protection/custom-rules?apikey=${process.env.DATADOME_MANAGEMENT_KEY}`,
      {
        method: 'POST',
        headers: { Accept: '*/*', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: {
            rule_name: `ip_rule_${ip}`, // Needs to be unique
            query: `ip:${ip}`,
            rule_response: ruleResponse,
            rule_priority: 'high',
          },
        }),
      }
    )
    const response = await req.json()
    if (response.status !== 200) {
      throw new Error(JSON.stringify(response))
    }
    return response
  } catch (err: any) {
    console.log('Error', err)
    throw new Error(err)
  }
}

export async function removeRuleById(customRuleId: string) {
  // Validate the rule ID to avoid using arbitrary user input in the request URL.
  // Allow only common identifier characters and enforce a reasonable length.
  const isValidCustomRuleId =
    typeof customRuleId === 'string' &&
    customRuleId.length > 0 &&
    customRuleId.length <= 256 &&
    /^[A-Za-z0-9_-]+$/.test(customRuleId)

  if (!isValidCustomRuleId) {
    throw new Error('Invalid custom rule id')
  }

  try {
    const safeCustomRuleId = encodeURIComponent(customRuleId)
    const req = await fetch(
      `https://customer-api.datadome.co/1.0/protection/custom-rules/${safeCustomRuleId}?apikey=${process.env.DATADOME_MANAGEMENT_KEY}`,
      {
        method: 'DELETE',
        headers: { Accept: '*/*', 'Content-Type': 'application/json' },
      }
    )
    return req.json()
  } catch (err) {
    console.log('Error', err)
  }
}

export async function getAllRules() {
  try {
    const req = await fetch(
      `https://customer-api.datadome.co/1.0/protection/custom-rules?apikey=${process.env.DATADOME_MANAGEMENT_KEY}`,
      {
        method: 'GET',
        headers: { Accept: '*/*', 'Content-Type': 'application/json' },
      }
    )
    const {
      data: { custom_rules },
    } = await req.json()
    return custom_rules
  } catch (err) {
    console.log('Error', err)
  }
}
