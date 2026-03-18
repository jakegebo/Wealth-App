// 2025 IRS contribution limits
export const LIMITS_2025 = {
  '401k':       { under50: 23500, over50: 31000,  label: '401(k) / 403(b) / 457(b)' },
  'ira':        { under50: 7000,  over50: 8000,   label: 'IRA (Traditional / Roth)' },
  'hsa_ind':    { under50: 4300,  over50: 4300,   label: 'HSA (individual)' },
  'hsa_fam':    { under50: 8550,  over50: 8550,   label: 'HSA (family)' },
  'simple_ira': { under50: 16500, over50: 20000,  label: 'SIMPLE IRA' },
  'sep_ira':    { under50: 70000, over50: 70000,  label: 'SEP-IRA' },
}

export interface AccountLimit {
  limit: number
  accountType: string
}

/** Infer the contribution limit for a retirement account from its name. */
export function detectAccountLimit(name: string, age?: number): AccountLimit | null {
  const n = name.toLowerCase()
  const over50 = typeof age === 'number' && age >= 50

  // 401k / 403b / 457b — check before generic IRA
  if (/401\s*k|403\s*b|457\s*b/.test(n)) {
    return { limit: over50 ? 31000 : 23500, accountType: over50 ? '401(k) + catch-up' : '401(k)' }
  }
  // SIMPLE IRA — check before generic IRA
  if (/simple/.test(n)) {
    return { limit: over50 ? 20000 : 16500, accountType: 'SIMPLE IRA' }
  }
  // SEP-IRA — check before generic IRA
  if (/sep/.test(n)) {
    return { limit: 70000, accountType: 'SEP-IRA' }
  }
  // HSA
  if (/\bhsa\b/.test(n)) {
    const family = /family|fam/.test(n)
    return { limit: family ? 8550 : 4300, accountType: family ? 'HSA (family)' : 'HSA (individual)' }
  }
  // Roth / Traditional / generic IRA
  if (/roth|traditional|\bira\b/.test(n)) {
    return { limit: over50 ? 8000 : 7000, accountType: over50 ? 'IRA + catch-up' : 'IRA' }
  }

  return null
}

export interface ContributionStatus {
  account: string
  accountType: string
  contributed: number
  limit: number
  pct: number
  maxed: boolean
  remaining: number
}

/** Compute current-year contribution status for all retirement assets. */
export function getContributionStatus(assets: any[], age?: number): ContributionStatus[] {
  const currentYear = new Date().getFullYear()
  const results: ContributionStatus[] = []

  for (const a of assets ?? []) {
    if (a.category !== 'retirement' || !a.yearlyContributions?.length) continue
    const thisYear = a.yearlyContributions.find((c: any) => c.year === currentYear)
    if (!thisYear) continue
    const det = detectAccountLimit(a.name, age)
    if (!det) continue
    const contributed = thisYear.amount || 0
    const pct = Math.min(100, Math.round((contributed / det.limit) * 100))
    results.push({
      account: a.name,
      accountType: det.accountType,
      contributed,
      limit: det.limit,
      pct,
      maxed: contributed >= det.limit,
      remaining: Math.max(0, det.limit - contributed),
    })
  }
  return results
}

/** Build a compact contribution summary string for AI prompts. */
export function contributionSummaryText(assets: any[], age?: number): string {
  const currentYear = new Date().getFullYear()
  const statuses = getContributionStatus(assets, age)
  if (!statuses.length) return 'none recorded'
  return statuses
    .map(s => `${s.account} (${s.accountType}): $${s.contributed.toLocaleString()} of $${s.limit.toLocaleString()} — ${s.pct}%${s.maxed ? ' MAXED ✓' : ` ($${s.remaining.toLocaleString()} left)`}`)
    .join('; ')
}
