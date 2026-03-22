import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useProfile } from '../contexts/ProfileContext'
import { detectAccountLimit, getContributionStatus } from '../lib/retirementLimits'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js'
import { Line } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, LineElement, PointElement, Title, Tooltip, Legend, Filler)

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface RetirementPlan {
  currentAge: number
  targetAge: number
  currentSavings: number
  monthlyContribution: number
  targetNestEgg: number
  projectedNestEgg: number
  onTrack: boolean
  yearsToRetirement: number
  monthlyInRetirement: number
  shortfall: number
}

function StrategyTab({ profile, plan }: { profile: any; plan: RetirementPlan }) {
  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(isFinite(n) ? n : 0)

  const surplus = (profile?.monthly_income || 0) - (profile?.monthly_expenses || 0)
  const { currentAge, targetAge, yearsToRetirement: yearsLeft } = plan

  // Phase boundaries
  const p1End = currentAge + Math.round(yearsLeft * 0.35)
  const p2End = currentAge + Math.round(yearsLeft * 0.70)

  // === Account status checks (all data-driven) ===
  const liquidSavings = (profile?.assets || []).filter((a: any) => a.category === 'savings').reduce((s: number, a: any) => s + (a.value || 0), 0)
  const monthlyExp = profile?.monthly_expenses || 0
  const emergencyMonths = monthlyExp > 0 ? liquidSavings / monthlyExp : 0
  const emergencyDone = emergencyMonths >= 6
  const emergencyGap = Math.max(0, monthlyExp * 6 - liquidSavings)

  // Risk tolerance and income context — used to align advice with rest of app
  const riskTolerance = profile?.risk_tolerance || 'moderate'
  const grossIncome = profile?.annual_gross_income || 0
  const filingStatus = profile?.filing_status || 'single'
  const isSelfEmployed = ['self_employed', 'business_owner'].includes(profile?.employment_type)

  // Roth IRA income phase-out (2025): single $146k–$161k, MFJ $230k–$240k
  const rothPhaseoutStart = filingStatus === 'married_jointly' ? 230000 : 146000
  const rothHardLimit = filingStatus === 'married_jointly' ? 240000 : 161000
  const rothOverLimit = grossIncome > rothHardLimit
  const rothInPhaseout = !rothOverLimit && grossIncome > rothPhaseoutStart

  const k401Asset = (profile?.assets || []).find((a: any) => a.category === 'retirement' && /401|403|457/i.test(a.name))
  const has401k = !!k401Asset
  const matchCap = k401Asset?.employer_match_cap
  const contribPct = k401Asset?.contribution_pct || 0
  const matchCaptured = matchCap ? contribPct >= matchCap : has401k

  // Self-employed retirement account label
  const selfEmpAcctLabel = isSelfEmployed ? 'Solo 401k or SEP-IRA' : '401k'
  const selfEmpAcctDetail = isSelfEmployed ? 'Solo 401k (up to $69,500/yr) or SEP-IRA (25% of net self-employment income, up to $70,000)' : null

  const highInterestDebts = (profile?.debts || []).filter((d: any) => (d.interest_rate || 0) > 7)
  const hasHighDebt = highInterestDebts.length > 0
  const debtFree = (profile?.debts || []).length === 0
  const debtOk = debtFree || !hasHighDebt
  const highDebtTotal = highInterestDebts.reduce((s: number, d: any) => s + (d.balance || 0), 0)
  const highDebtTopRate = highInterestDebts.length > 0 ? Math.max(...highInterestDebts.map((d: any) => d.interest_rate || 0)) : 0

  const contribStatuses = getContributionStatus(profile?.assets || [], profile?.age)
  const iraMaxed = contribStatuses.some(s => /ira/i.test(s.account) && s.maxed)
  const k401Maxed = contribStatuses.some(s => /401|403|457/i.test(s.account) && s.maxed)
  const hasIRA = (profile?.assets || []).some((a: any) => a.category === 'retirement' && /ira/i.test(a.name))
  const hasHSA = (profile?.assets || []).some((a: any) => /hsa/i.test(a.name))
  const hsaStatus = contribStatuses.find(s => /hsa/i.test(s.account))
  const hsaMaxed = hsaStatus?.maxed || false
  const hasTaxableBrokerage = (profile?.assets || []).some((a: any) => a.category === 'brokerage')

  // === Dynamically generated phase focus items ===
  const foundationItems: { text: string; done: boolean }[] = [
    {
      text: emergencyDone
        ? `Emergency fund: ${emergencyMonths.toFixed(1)} months covered ✓`
        : emergencyMonths > 0
          ? `Grow emergency fund to ${fmt(monthlyExp * 6)} — you have ${emergencyMonths.toFixed(1)} months, still need ${fmt(emergencyGap)}`
          : `Build a 6-month emergency fund (${fmt(monthlyExp * 6)}) in a high-yield savings account`,
      done: emergencyDone,
    },
    {
      text: isSelfEmployed
        ? has401k && matchCaptured
          ? `${selfEmpAcctLabel} in use and contributing ✓`
          : `Open a ${selfEmpAcctLabel} — ${selfEmpAcctDetail}`
        : has401k && matchCaptured
          ? matchCap
            ? `401k employer match fully captured at ${contribPct}% ✓`
            : `Contributing to 401k and capturing employer match ✓`
          : has401k && matchCap
            ? `Raise 401k contribution from ${contribPct}% → ${matchCap}% to capture full employer match — it's a guaranteed return`
            : has401k
              ? 'Confirm you\'re capturing your full 401k employer match'
              : 'Ask HR if a 401k is available — employer matching is free money',
      done: has401k && matchCaptured,
    },
    {
      text: debtFree
        ? 'No debt ✓'
        : hasHighDebt
          ? `Pay off ${highInterestDebts.length > 1 ? `${highInterestDebts.length} high-interest debts` : highInterestDebts[0]?.name} — ${fmt(highDebtTotal)} at up to ${highDebtTopRate}% is costing more than investments return`
          : `Only low-rate debt — minimums are fine, this isn't blocking your investing ✓`,
      done: debtOk,
    },
    {
      text: iraMaxed
        ? `${rothOverLimit ? 'Backdoor Roth IRA' : 'Roth IRA'} maxed at $7,000/yr ✓`
        : rothOverLimit
          ? `Your income (~$${Math.round(grossIncome / 1000)}k) exceeds the Roth IRA limit — use the Backdoor Roth: contribute $7,000 to a traditional IRA then convert to Roth`
          : rothInPhaseout
            ? `Your income puts you in the Roth IRA phase-out range — contribute a reduced amount or use Backdoor Roth for the full $7,000`
            : hasIRA
              ? 'Increase Roth IRA contributions to $583/mo to hit the $7,000/yr limit'
              : 'Open a Roth IRA at Fidelity or Vanguard — invest in VTI or a target-date fund, contribute $583/mo',
      done: iraMaxed,
    },
  ]

  const foundationComplete = foundationItems.every(i => i.done)

  const accelerationItems: { text: string; done: boolean }[] = [
    {
      text: iraMaxed
        ? 'Roth IRA maxed at $7,000/yr ✓'
        : 'Push Roth IRA to $583/mo — max the $7,000/yr limit for tax-free compounding',
      done: iraMaxed,
    },
    {
      text: k401Maxed
        ? `${selfEmpAcctLabel} maxed ✓`
        : isSelfEmployed
          ? has401k
            ? `Max your ${selfEmpAcctLabel} — contributions reduce self-employment taxable income significantly`
            : `Open a ${selfEmpAcctLabel} — ${selfEmpAcctDetail}`
          : has401k
            ? `Max 401k to $23,500/yr — pre-tax contributions reduce your taxable income now`
            : 'Open a Solo 401k or SEP-IRA if self-employed and max contributions',
      done: k401Maxed,
    },
    {
      text: hasHSA
        ? hsaMaxed
          ? 'HSA maxed at $4,300/yr — triple tax advantage secured ✓'
          : 'Max your HSA at $4,300/yr ($358/mo) — invest the funds, don\'t spend them'
        : surplus > 2000
          ? 'Consider switching to a HDHP to unlock an HSA — triple tax advantage (deductible, grows tax-free, withdraws tax-free for medical)'
          : 'HSA not applicable — focus on maxing 401k and IRA first',
      done: hsaMaxed,
    },
    {
      text: hasTaxableBrokerage
        ? `Taxable brokerage open — invest all remaining surplus in VTI + VXUS`
        : surplus > 0
          ? `Open a taxable brokerage and invest leftover surplus in VTI + VXUS — no annual limit, fully flexible`
          : 'Once tax-advantaged accounts are maxed, open a taxable brokerage for the rest',
      done: hasTaxableBrokerage,
    },
    {
      text: 'Automate contribution increases with every raise — keep lifestyle inflation below income growth',
      done: false,
    },
  ]

  const finalPushItems: { text: string; done: boolean }[] = [
    {
      text: currentAge >= 50
        ? `Use catch-up contributions (you're ${currentAge}) — 401k allows $31,000/yr, IRA allows $8,000/yr`
        : `At age 50, unlock catch-up contributions — 401k jumps from $23,500 → $31,000/yr, IRA from $7,000 → $8,000/yr`,
      done: false,
    },
    {
      text: `Shift toward bonds gradually — target roughly ${Math.max(40, 110 - currentAge - 10)}% stocks at retirement to reduce sequence-of-returns risk`,
      done: false,
    },
    {
      text: 'Plan withdrawal order: taxable accounts first → traditional 401k/IRA → Roth IRA last (tax-free growth preserved longest)',
      done: false,
    },
    {
      text: currentAge >= 55
        ? 'Healthcare is critical — arrange coverage now to bridge the gap before Medicare at 65'
        : 'Plan healthcare before Medicare at 65 — a gap in coverage is one of the biggest retirement risks',
      done: false,
    },
  ]

  // Determine current phase — advance past Foundation if user has completed all its items
  const currentPhase = foundationComplete
    ? currentAge <= p2End ? 1 : 2
    : currentAge <= p1End ? 0 : currentAge <= p2End ? 1 : 2

  const phases = [
    { name: 'Foundation', ageRange: `Now–${p1End}`, items: foundationItems },
    { name: 'Acceleration', ageRange: `${p1End}–${p2End}`, items: accelerationItems },
    { name: 'Final push', ageRange: `${p2End}–${targetAge}`, items: finalPushItems },
  ]

  // Next actions — only incomplete items from the current phase, max 3
  const nextActions = phases[currentPhase].items.filter(i => !i.done).slice(0, 3)

  // Account priority stack — all steps with done status
  const priorities = [
    {
      label: 'Emergency fund (3–6 months)',
      detail: emergencyDone
        ? `${emergencyMonths.toFixed(1)} months covered ✓`
        : emergencyMonths > 0
          ? `${emergencyMonths.toFixed(1)} months now — need ${fmt(emergencyGap)} more to reach 6 months`
          : `Build ${fmt(monthlyExp * 6)} in a high-yield savings account`,
      done: emergencyDone,
      tag: null,
    },
    {
      label: isSelfEmployed ? `Open ${selfEmpAcctLabel}` : 'Capture full 401k employer match',
      detail: isSelfEmployed
        ? has401k && matchCaptured
          ? `${selfEmpAcctLabel} active and contributing ✓`
          : selfEmpAcctDetail || `Open a ${selfEmpAcctLabel}`
        : has401k && matchCaptured
          ? matchCap ? `Contributing ${contribPct}% — full match captured ✓` : 'Full match captured ✓'
          : has401k && matchCap
            ? `Currently at ${contribPct}% — increase to ${matchCap}% to stop leaving money behind`
            : has401k
              ? 'Verify contribution rate covers full employer match'
              : 'No 401k on file — check with HR',
      done: has401k && matchCaptured,
      tag: isSelfEmployed ? 'High limit' : 'Free return',
    },
    {
      label: 'Pay off high-interest debt (>7%)',
      detail: debtFree
        ? 'Debt-free ✓'
        : hasHighDebt
          ? `${fmt(highDebtTotal)} at up to ${highDebtTopRate}% — clear this before investing more`
          : 'Only low-rate debt — minimums are fine ✓',
      done: debtOk,
      tag: null,
    },
    {
      label: rothOverLimit ? 'Backdoor Roth IRA ($7,000/yr)' : 'Max Roth IRA ($7,000/yr · $583/mo)',
      detail: iraMaxed
        ? 'Maxed ✓'
        : rothOverLimit
          ? `Income too high for direct Roth — contribute $7,000 to a traditional IRA then convert (Backdoor Roth)`
          : rothInPhaseout
            ? `Partial Roth contribution allowed at your income — or use Backdoor Roth for the full $7,000`
            : hasIRA
              ? 'Contributing — push to $583/mo to hit the annual limit'
              : 'Open at Fidelity or Vanguard — invest in VTI or a target-date fund',
      done: iraMaxed,
      tag: 'Tax-free growth',
    },
    {
      label: 'Max HSA — triple tax advantage',
      detail: hasHSA
        ? hsaMaxed ? 'Maxed ✓' : 'Have HSA — max is $4,300/yr individual ($358/mo), invest don\'t spend'
        : 'Requires HDHP — invest funds like a retirement account, pay medical expenses out of pocket',
      done: hsaMaxed,
      tag: 'If eligible',
    },
    {
      label: isSelfEmployed ? `Max ${selfEmpAcctLabel}` : 'Max 401k ($23,500/yr · $1,958/mo)',
      detail: k401Maxed
        ? 'Maxed ✓'
        : isSelfEmployed
          ? selfEmpAcctDetail || `Max your ${selfEmpAcctLabel}`
          : has401k
            ? 'Increase beyond the match — pre-tax dollars lower your tax bill now'
            : 'After IRA, ask HR if a 401k is available to max',
      done: k401Maxed,
      tag: 'Tax-deferred',
    },
    {
      label: 'Taxable brokerage — invest the rest',
      detail: hasTaxableBrokerage
        ? 'Open and investing — VTI + VXUS, no annual limits ✓'
        : 'VTI + VXUS in a simple two-fund portfolio. No annual limits, fully flexible.',
      done: hasTaxableBrokerage,
      tag: 'No limit',
    },
  ]

  // Monthly allocation — waterfall from surplus, skipping already-done items
  const iraMonthly = 583
  const allocations: { label: string; amount: number; colorIdx: number }[] = []
  let remaining = surplus

  if (!emergencyDone && remaining > 0) {
    const amt = Math.min(remaining, Math.ceil(emergencyGap / 12))
    if (amt > 0) { allocations.push({ label: 'Emergency fund', amount: amt, colorIdx: 0 }); remaining -= amt }
  }
  if (!iraMaxed && remaining > 0) {
    const amt = Math.min(remaining, iraMonthly)
    if (amt > 0) { allocations.push({ label: 'Roth IRA', amount: amt, colorIdx: 1 }); remaining -= amt }
  }
  if (!k401Maxed && has401k && remaining > 0) {
    const current = k401Asset?.annual_contribution ? k401Asset.annual_contribution / 12 : 0
    const toMax = Math.max(0, 1958 - current)
    const amt = Math.min(remaining, toMax)
    if (amt > 0) { allocations.push({ label: '401k boost', amount: amt, colorIdx: 1 }); remaining -= amt }
  }
  if (!hsaMaxed && hasHSA && remaining > 0) {
    const amt = Math.min(remaining, 358)
    if (amt > 0) { allocations.push({ label: 'HSA', amount: amt, colorIdx: 1 }); remaining -= amt }
  }
  if (remaining > 50) { allocations.push({ label: 'Brokerage / invest', amount: remaining, colorIdx: 2 }); remaining = 0 }

  const allocationTotal = allocations.reduce((s, a) => s + a.amount, 0)
  const ALLOC_COLORS = ['var(--warning)', 'var(--accent)', '#6a8aae']

  // Asset allocation — adjusted for age AND risk tolerance, matching chat.ts life stage guidance
  const baseRule = riskTolerance === 'conservative' ? 100 : riskTolerance === 'aggressive' ? 120 : 110
  const stockPct = Math.min(riskTolerance === 'aggressive' ? 100 : 95, Math.max(riskTolerance === 'conservative' ? 40 : 50, baseRule - currentAge))
  const bondPct = 100 - stockPct
  const intlPct = Math.round(stockPct * 0.25)
  const usPct = stockPct - intlPct

  const TIMELINE_DOTS = [
    { age: currentAge, label: 'Now', pct: 0 },
    { age: p1End, label: 'Accel.', pct: 33 },
    { age: p2End, label: 'Push', pct: 67 },
    { age: targetAge, label: '🏖️ Retire', pct: 100 },
  ]

  return (
    <div className="animate-fade">

      {/* What to do right now */}
      {nextActions.length > 0 && (
        <div style={{ background: 'var(--accent-light)', border: '0.5px solid var(--accent-border)', borderRadius: 'var(--radius-lg)', padding: '16px', marginBottom: '16px' }}>
          <p style={{ fontSize: '11px', fontWeight: '700', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 10px' }}>Your next moves</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {nextActions.map((action, i) => (
              <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '1px' }}>
                  <span style={{ color: 'var(--sand-50)', fontSize: '9px', fontWeight: '700' }}>{i + 1}</span>
                </div>
                <p style={{ fontSize: '13px', color: 'var(--sand-800)', margin: 0, lineHeight: '1.5' }}>{action.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Phase Timeline */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <p className="label" style={{ marginBottom: '18px' }}>Your retirement roadmap</p>

        {/* Track */}
        <div style={{ position: 'relative', height: '18px', marginBottom: '6px' }}>
          <div style={{ position: 'absolute', top: '8px', left: '9px', right: '9px', height: '3px', background: 'var(--sand-200)', borderRadius: '2px' }}>
            <div style={{ height: '100%', width: `${currentPhase === 0 ? 4 : currentPhase === 1 ? 37 : 70}%`, background: 'var(--accent)', borderRadius: '2px', transition: 'width 1.1s cubic-bezier(0.22, 1, 0.36, 1)' }} />
          </div>
          {TIMELINE_DOTS.map((dot, i) => (
            <div key={i} style={{ position: 'absolute', top: '0', left: dot.pct === 0 ? '0' : dot.pct === 100 ? 'auto' : `calc(${dot.pct}% - 9px)`, right: dot.pct === 100 ? '0' : 'auto' }}>
              <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: i < currentPhase ? 'var(--accent)' : i === currentPhase ? 'var(--sand-50)' : 'var(--sand-200)', border: `2px solid ${i <= currentPhase ? 'var(--accent)' : 'var(--sand-300)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {i < currentPhase && <span style={{ color: 'var(--sand-50)', fontSize: '8px', fontWeight: '700' }}>✓</span>}
                {i === currentPhase && <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--accent)' }} />}
              </div>
            </div>
          ))}
        </div>

        {/* Labels */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '18px' }}>
          {TIMELINE_DOTS.map((dot, i) => (
            <div key={i} style={{ textAlign: i === 0 ? 'left' : i === TIMELINE_DOTS.length - 1 ? 'right' : 'center', flex: i === 0 || i === TIMELINE_DOTS.length - 1 ? '0 0 auto' : 1 }}>
              <p style={{ fontSize: '12px', fontWeight: '700', color: i <= currentPhase ? 'var(--accent)' : 'var(--sand-700)', margin: 0 }}>{dot.age}</p>
              <p style={{ fontSize: '10px', color: 'var(--sand-400)', margin: 0 }}>{dot.label}</p>
            </div>
          ))}
        </div>

        {/* Phase cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {phases.map((phase, i) => {
            const isCurrent = i === currentPhase
            const isDone = i < currentPhase
            const pendingItems = phase.items.filter(item => !item.done)
            const doneItems = phase.items.filter(item => item.done)
            return (
              <div key={i} style={{ padding: '12px 14px', borderRadius: '12px', background: isCurrent ? 'var(--accent-light)' : isDone ? 'var(--sand-100)' : 'var(--sand-50)', border: `0.5px solid ${isCurrent ? 'var(--accent-border)' : 'var(--sand-200)'}`, opacity: isDone ? 0.65 : 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: (isCurrent || isDone) ? '10px' : '6px' }}>
                  <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: isDone ? 'var(--accent)' : isCurrent ? 'var(--accent)' : 'var(--sand-300)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ color: 'var(--sand-50)', fontSize: '9px', fontWeight: '700' }}>{isDone ? '✓' : i + 1}</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '13px', fontWeight: '700', color: 'var(--sand-900)', margin: 0 }}>{phase.name}</p>
                    <p style={{ fontSize: '10px', color: 'var(--sand-500)', margin: 0 }}>Ages {phase.ageRange}</p>
                  </div>
                  {isCurrent && <span style={{ fontSize: '9px', fontWeight: '700', color: 'var(--accent)', background: 'rgba(122,158,110,0.18)', padding: '2px 8px', borderRadius: '20px', flexShrink: 0 }}>YOU ARE HERE</span>}
                  {isDone && <span style={{ fontSize: '9px', fontWeight: '700', color: 'var(--success)', background: 'rgba(122,158,110,0.12)', padding: '2px 8px', borderRadius: '20px', flexShrink: 0 }}>COMPLETE</span>}
                </div>
                <div style={{ paddingLeft: '28px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  {/* Show completed items with checkmarks */}
                  {doneItems.map((item, j) => (
                    <div key={`done-${j}`} style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                      <span style={{ color: 'var(--success)', fontSize: '11px', marginTop: '2px', flexShrink: 0 }}>✓</span>
                      <p style={{ fontSize: '12px', color: 'var(--sand-500)', margin: 0, lineHeight: '1.4' }}>{item.text}</p>
                    </div>
                  ))}
                  {/* Show pending items with arrows — only for current/future phases */}
                  {!isDone && pendingItems.map((item, j) => (
                    <div key={`pending-${j}`} style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                      <span style={{ color: isCurrent ? 'var(--accent)' : 'var(--sand-300)', fontSize: '11px', marginTop: '2px', flexShrink: 0 }}>→</span>
                      <p style={{ fontSize: '12px', color: isCurrent ? 'var(--sand-800)' : 'var(--sand-500)', margin: 0, lineHeight: '1.4' }}>{item.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Account Priority Stack */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <p className="label" style={{ marginBottom: '4px' }}>Account priority order</p>
        <p style={{ fontSize: '12px', color: 'var(--sand-500)', margin: '0 0 14px', lineHeight: '1.4' }}>Fund in this order. Each step maximizes return before the next.</p>
        {priorities.map((p, i) => (
          <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', padding: '11px 0', borderBottom: i < priorities.length - 1 ? '0.5px solid var(--sand-200)' : 'none' }}>
            <div style={{ width: '24px', height: '24px', borderRadius: '50%', flexShrink: 0, marginTop: '1px', background: p.done ? 'var(--accent)' : 'var(--sand-200)', border: `1.5px solid ${p.done ? 'var(--accent)' : 'var(--sand-300)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {p.done
                ? <span style={{ color: 'var(--sand-50)', fontSize: '11px', fontWeight: '700' }}>✓</span>
                : <span style={{ fontSize: '10px', fontWeight: '700', color: 'var(--sand-500)' }}>{i + 1}</span>}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '2px' }}>
                <p style={{ fontSize: '13px', fontWeight: '600', margin: 0, color: p.done ? 'var(--sand-400)' : 'var(--sand-900)', textDecoration: p.done ? 'line-through' : 'none' }}>{p.label}</p>
                {p.tag && <span style={{ fontSize: '9px', color: 'var(--accent)', background: 'var(--accent-light)', border: '0.5px solid var(--accent-border)', padding: '1px 6px', borderRadius: '10px', fontWeight: '700' }}>{p.tag}</span>}
              </div>
              <p style={{ fontSize: '11px', color: p.done ? 'var(--success)' : 'var(--sand-500)', margin: 0, lineHeight: '1.45' }}>{p.detail}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Monthly Allocation */}
      {surplus > 0 && allocations.length > 0 && (
        <div className="card" style={{ marginBottom: '16px' }}>
          <p className="label" style={{ marginBottom: '2px' }}>Monthly allocation plan</p>
          <p style={{ fontSize: '12px', color: 'var(--sand-500)', margin: '0 0 14px' }}>Where your {fmt(surplus)}/mo surplus should go right now</p>

          {/* Stacked bar */}
          <div style={{ display: 'flex', height: '10px', borderRadius: '6px', overflow: 'hidden', marginBottom: '14px' }}>
            {allocations.map((a, i) => (
              <div key={i} style={{ flex: a.amount, background: ALLOC_COLORS[a.colorIdx], transition: 'flex 0.4s ease' }} />
            ))}
          </div>

          {allocations.map((a, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: i < allocations.length - 1 ? '0.5px solid var(--sand-200)' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: ALLOC_COLORS[a.colorIdx], flexShrink: 0 }} />
                <p style={{ fontSize: '13px', color: 'var(--sand-800)', margin: 0 }}>{a.label}</p>
              </div>
              <div>
                <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--sand-900)' }}>{fmt(a.amount)}/mo</span>
                <span style={{ fontSize: '11px', color: 'var(--sand-400)', marginLeft: '6px' }}>{allocationTotal > 0 ? Math.round((a.amount / allocationTotal) * 100) : 0}%</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Portfolio Blueprint */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div>
            <p className="label" style={{ margin: 0 }}>Portfolio blueprint</p>
            <p style={{ fontSize: '12px', color: 'var(--sand-500)', margin: '2px 0 0' }}>Recommended mix for age {currentAge} · {yearsLeft}yr runway · {riskTolerance} risk</p>
          </div>
          <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--accent)', background: 'var(--accent-light)', padding: '4px 10px', borderRadius: '20px', border: '0.5px solid var(--accent-border)', flexShrink: 0 }}>
            {stockPct}% stocks · {bondPct}% bonds
          </span>
        </div>

        {[
          { label: 'US Stocks', ticker: 'VTI or FXAIX', pct: usPct, color: 'var(--accent)', note: 'Core holding — total US market, low-cost index' },
          { label: 'International', ticker: 'VXUS', pct: intlPct, color: '#6a8aae', note: 'Global diversification, reduces home-country bias' },
          { label: 'Bonds', ticker: 'BND', pct: bondPct, color: 'var(--sand-400)', note: 'Stability cushion — increase by ~1%/yr as you age' },
        ].map((item, i) => (
          <div key={i} style={{ marginBottom: i < 2 ? '14px' : 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '5px' }}>
              <div>
                <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--sand-900)' }}>{item.label}</span>
                <span style={{ fontSize: '11px', color: 'var(--sand-400)', marginLeft: '8px', fontFamily: 'monospace' }}>{item.ticker}</span>
              </div>
              <span style={{ fontSize: '16px', fontWeight: '700', color: item.color }}>{item.pct}%</span>
            </div>
            <div style={{ height: '6px', background: 'var(--sand-200)', borderRadius: '3px', overflow: 'hidden', marginBottom: '4px' }}>
              <div style={{ height: '100%', width: `${item.pct}%`, background: item.color, borderRadius: '3px', transition: 'width 1.1s cubic-bezier(0.22, 1, 0.36, 1)' }} />
            </div>
            <p style={{ fontSize: '11px', color: 'var(--sand-500)', margin: 0 }}>{item.note}</p>
          </div>
        ))}

        <div style={{ marginTop: '14px', padding: '10px 12px', background: 'var(--sand-100)', borderRadius: '10px', border: '0.5px solid var(--sand-200)' }}>
          <p style={{ fontSize: '12px', color: 'var(--sand-700)', margin: 0, lineHeight: '1.5' }}>
            <strong>Glide path:</strong> Shift ~1% from stocks → bonds each year. At retirement (age {targetAge}), target roughly {Math.max(40, stockPct - yearsLeft)}% stocks / {Math.min(60, bondPct + yearsLeft)}% bonds to reduce sequence-of-returns risk.
          </p>
        </div>
      </div>

    </div>
  )
}

export default function Retirement() {
  const navigate = useNavigate()
  const { userId, profileData: profile, updateProfile, loading: profileLoading } = useProfile()
  const [plan, setPlan] = useState<RetirementPlan | null>(profile?.retirement_plan || null)
  const [built, setBuilt] = useState(!!profile?.retirement_plan)
  const [building, setBuilding] = useState(false)
  const [currentAge, setCurrentAge] = useState(profile?.retirement_plan?.currentAge || profile?.age || 23)
  const [targetAge, setTargetAge] = useState(profile?.retirement_plan?.targetAge || 52)
  const [chatMessages, setChatMessages] = useState<Message[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)

  const [activeTab, setActiveTab] = useState<'overview' | 'projections' | 'strategy' | 'chat'>('overview')
  const [editingAge, setEditingAge] = useState(false)
  const [draftAge, setDraftAge] = useState(profile?.retirement_plan?.targetAge || 52)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (profile?.retirement_plan) {
      setPlan(profile.retirement_plan)
      setBuilt(true)
      setCurrentAge(profile.retirement_plan.currentAge || profile.age || 23)
      setTargetAge(profile.retirement_plan.targetAge || 52)
    } else if (profile?.age) {
      setCurrentAge(profile.age)
    }
  }, [profile?.retirement_plan, profile?.age])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [chatMessages])

  const buildPlan = async () => {
    if (!userId) return
    setBuilding(true)

    const retirementAssets = profile?.assets?.filter((a: any) => ['retirement', 'investment'].includes(a.category))
      .reduce((s: number, a: any) => s + (a.value || 0), 0) || 0
    const availableToSave = (profile?.monthly_income || 0) - (profile?.monthly_expenses || 0)
    const yearsToRetirement = targetAge - currentAge
    const targetNestEgg = availableToSave * 12 * 25
    const monthlyContribution = Math.min(availableToSave, availableToSave * 0.7)

    // Project at 7% average return
    const projectedNestEgg = retirementAssets * Math.pow(1.07, yearsToRetirement) +
      monthlyContribution * 12 * ((Math.pow(1.07, yearsToRetirement) - 1) / 0.07)

    const newPlan: RetirementPlan = {
      currentAge,
      targetAge,
      currentSavings: retirementAssets,
      monthlyContribution,
      targetNestEgg,
      projectedNestEgg,
      onTrack: projectedNestEgg >= targetNestEgg,
      yearsToRetirement,
      monthlyInRetirement: targetNestEgg / (30 * 12),
      shortfall: Math.max(0, targetNestEgg - projectedNestEgg)
    }

    setPlan(newPlan)
    setBuilt(true)

    // Save to profile
    const updatedProfile = { ...(profile || {}), retirement_plan: newPlan }
    await updateProfile({ profile_data: updatedProfile })

    setBuilding(false)
    setActiveTab('overview')
  }

  const updateTargetAge = async (newTargetAge: number) => {
    if (!plan) return
    const yearsToRetirement = newTargetAge - plan.currentAge
    const projectedNestEgg = plan.currentSavings * Math.pow(1.07, yearsToRetirement) +
      plan.monthlyContribution * 12 * ((Math.pow(1.07, yearsToRetirement) - 1) / 0.07)
    const updatedPlan: RetirementPlan = {
      ...plan,
      targetAge: newTargetAge,
      yearsToRetirement,
      projectedNestEgg,
      onTrack: projectedNestEgg >= plan.targetNestEgg,
      shortfall: Math.max(0, plan.targetNestEgg - projectedNestEgg),
    }
    setPlan(updatedPlan)
    setTargetAge(newTargetAge)
    setEditingAge(false)
    const updatedProfile = { ...(profile || {}), retirement_plan: updatedPlan }
    await updateProfile({ profile_data: updatedProfile })
  }

  const sendChat = async () => {
    if (!chatInput.trim() || chatLoading) return
    const userMsg: Message = { role: 'user', content: chatInput.trim() }
    const newMessages = [...chatMessages, userMsg]
    setChatMessages(newMessages)
    setChatInput('')
    setChatLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages, profile, topic: 'retirement' })
      })
      const data = await res.json()
      setChatMessages(prev => [...prev, { role: 'assistant', content: data.message || '' }])
    } catch { }

    setChatLoading(false)
  }

  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

  // Chart data
  const buildChartData = () => {
    if (!plan) return null
    const years = Array.from({ length: plan.yearsToRetirement + 1 }, (_, i) => i)
    const labels = years.map(y => `Age ${plan.currentAge + y}`)

    const conservative = years.map(y => Math.round(
      plan.currentSavings * Math.pow(1.04, y) +
      plan.monthlyContribution * 12 * ((Math.pow(1.04, y) - 1) / 0.04)
    ))
    const moderate = years.map(y => Math.round(
      plan.currentSavings * Math.pow(1.07, y) +
      plan.monthlyContribution * 12 * ((Math.pow(1.07, y) - 1) / 0.07)
    ))
    const aggressive = years.map(y => Math.round(
      plan.currentSavings * Math.pow(1.10, y) +
      plan.monthlyContribution * 12 * ((Math.pow(1.10, y) - 1) / 0.10)
    ))

    return { labels, conservative, moderate, aggressive }
  }

  const chartData = plan ? buildChartData() : null

  const lineChartData = chartData && plan ? {
    labels: chartData.labels,
    datasets: [
      {
        // Upper bound (aggressive) - fills down to conservative to create the band
        label: 'High (10%)',
        data: chartData.aggressive,
        borderColor: 'rgba(122,158,110,0.25)',
        backgroundColor: 'rgba(122,158,110,0.08)',
        fill: '+1', // fill to the next dataset (conservative) to create the band
        tension: 0.4,
        pointRadius: 0,
        borderWidth: 1,
      },
      {
        // Lower bound (conservative)
        label: 'Low (4%)',
        data: chartData.conservative,
        borderColor: 'rgba(192,57,43,0.25)',
        backgroundColor: 'transparent',
        fill: false,
        tension: 0.4,
        pointRadius: 0,
        borderWidth: 1,
      },
      {
        // Main projection (moderate)
        label: 'Expected (7%)',
        data: chartData.moderate,
        borderColor: 'var(--accent)',
        backgroundColor: 'transparent',
        fill: false,
        tension: 0.4,
        pointRadius: 0,
        borderWidth: 2.5,
      },
      {
        // Target nest egg horizontal line
        label: `Target: ${fmt(plan.targetNestEgg)}`,
        data: Array(chartData.labels.length).fill(plan.targetNestEgg),
        borderColor: 'rgba(192,57,43,0.5)',
        backgroundColor: 'transparent',
        fill: false,
        tension: 0,
        pointRadius: 0,
        borderWidth: 1.5,
        borderDash: [5, 4],
      }
    ]
  } : null

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index' as const, intersect: false },
    plugins: {
      legend: { labels: { color: '#9e8e7e', font: { size: 11 }, usePointStyle: true, padding: 16 } },
      tooltip: {
        backgroundColor: '#f2ede6',
        borderColor: '#ddd4c4',
        borderWidth: 1,
        titleColor: '#1a1208',
        bodyColor: '#7a6a5a',
        padding: 10,
        callbacks: { label: (ctx: any) => ` ${ctx.dataset.label}: ${fmt(ctx.parsed.y)}` }
      }
    },
    scales: {
      x: { ticks: { color: '#9e8e7e', maxTicksLimit: 6, font: { size: 10 } }, grid: { color: '#ede8e3' } },
      y: { ticks: { color: '#9e8e7e', font: { size: 10 }, callback: (v: any) => `$${(v/1000000).toFixed(1)}M` }, grid: { color: '#ede8e3' } }
    }
  }

  if (profileLoading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--sand-100)' }}>
      <div style={{ width: '32px', height: '32px', border: '2px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--sand-100)' }}>

      {/* Header */}
      <div style={{ background: 'var(--sand-50)', borderBottom: '0.5px solid var(--sand-300)', padding: '52px 20px 0' }}>
        <div style={{ maxWidth: '680px', margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <button onClick={() => navigate(-1)}
              style={{ background: 'var(--sand-200)', border: 'none', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--sand-700)', fontSize: '16px', flexShrink: 0 }}>
              ←
            </button>
            <div>
              <h1 style={{ fontSize: '18px', fontWeight: '600', margin: 0, color: 'var(--sand-900)' }}>Retirement Plan</h1>
              {plan && <p style={{ fontSize: '12px', color: plan.onTrack ? 'var(--success)' : 'var(--warning)', margin: 0 }}>{plan.onTrack ? 'On track ✓' : 'Needs attention'}</p>}
            </div>
          </div>

          {/* Tabs */}
          {built && (
            <div style={{ display: 'flex', gap: '0', borderBottom: 'none' }}>
              {(['overview', 'projections', 'strategy', 'chat'] as const).map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  style={{ padding: '10px 16px', background: 'none', border: 'none', borderBottom: activeTab === tab ? `2px solid var(--accent)` : '2px solid transparent', color: activeTab === tab ? 'var(--accent)' : 'var(--sand-500)', fontSize: '13px', fontWeight: activeTab === tab ? '600' : '400', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s', textTransform: 'capitalize' }}>
                  {tab}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ maxWidth: '680px', margin: '0 auto', padding: '20px' }}>

        {/* Build Plan Form */}
        {!built && (
          <div className="animate-fade">
            <div style={{ textAlign: 'center', padding: '20px 0 32px' }}>
              <div style={{ width: '60px', height: '60px', background: 'var(--accent)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <span style={{ fontSize: '24px' }}>🏖️</span>
              </div>
              <h2 style={{ fontSize: '22px', fontWeight: '400', color: 'var(--sand-900)', margin: '0 0 8px', letterSpacing: '-0.3px' }}>Build your retirement plan</h2>
              <p style={{ fontSize: '14px', color: 'var(--sand-500)', margin: 0, lineHeight: '1.5' }}>We'll use your financial profile to create a personalized retirement roadmap with projections and AI strategy.</p>
            </div>

            <div className="card" style={{ marginBottom: '16px' }}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--sand-700)', marginBottom: '8px' }}>Current age</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <input type="range" min="18" max="70" value={currentAge} onChange={e => setCurrentAge(parseInt(e.target.value))}
                    style={{ flex: 1, accentColor: 'var(--accent)' }} />
                  <span style={{ fontSize: '20px', fontWeight: '300', color: 'var(--sand-900)', minWidth: '40px', textAlign: 'right' }}>{currentAge}</span>
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--sand-700)', marginBottom: '8px' }}>Target retirement age</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <input type="range" min={currentAge + 5} max="80" value={targetAge} onChange={e => setTargetAge(parseInt(e.target.value))}
                    style={{ flex: 1, accentColor: 'var(--accent)' }} />
                  <span style={{ fontSize: '20px', fontWeight: '300', color: 'var(--sand-900)', minWidth: '40px', textAlign: 'right' }}>{targetAge}</span>
                </div>
              </div>
            </div>

            <div className="card-muted" style={{ marginBottom: '20px', padding: '16px' }}>
              <p style={{ fontSize: '13px', color: 'var(--sand-700)', margin: '0 0 4px', fontWeight: '500' }}>Your plan will include:</p>
              {['Personalized nest egg target', 'Projection chart (3 scenarios)', 'Monthly contribution strategy', 'AI retirement advisor'].map((item, i) => (
                <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '6px' }}>
                  <div style={{ width: '16px', height: '16px', background: 'var(--accent)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ color: 'var(--sand-50)', fontSize: '9px', fontWeight: '700' }}>✓</span>
                  </div>
                  <span style={{ fontSize: '13px', color: 'var(--sand-700)' }}>{item}</span>
                </div>
              ))}
            </div>

            <button className="btn-primary" onClick={buildPlan} disabled={building}
              style={{ width: '100%', padding: '16px', fontSize: '15px', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              {building ? (
                <>
                  <div style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  Building your plan...
                </>
              ) : 'Build my retirement plan →'}
            </button>
          </div>
        )}

        {/* Overview Tab */}
        {built && plan && activeTab === 'overview' && (
          <div className="animate-fade">

            {/* Hero numbers */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
              <div className="card" style={{ gridColumn: '1 / -1', padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <p className="label" style={{ margin: 0 }}>Projected at retirement (age {plan.targetAge})</p>
                  <button
                    onClick={() => { setDraftAge(plan.targetAge); setEditingAge(e => !e) }}
                    style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '12px', fontWeight: '600', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>
                    {editingAge ? 'Cancel' : 'Change age'}
                  </button>
                </div>
                {editingAge ? (
                  <div style={{ marginTop: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '13px', color: 'var(--sand-600)' }}>Retire at age</span>
                      <span style={{ fontSize: '28px', fontWeight: '300', color: 'var(--sand-900)', letterSpacing: '-0.5px' }}>{draftAge}</span>
                    </div>
                    <input
                      type="range" min={plan.currentAge + 1} max="85" value={draftAge}
                      onChange={e => setDraftAge(parseInt(e.target.value))}
                      style={{ width: '100%', accentColor: 'var(--accent)', marginBottom: '12px' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--sand-400)', marginBottom: '14px' }}>
                      <span>Age {plan.currentAge + 1}</span>
                      <span>Age 85</span>
                    </div>
                    <button
                      onClick={() => updateTargetAge(draftAge)}
                      className="btn-primary"
                      style={{ width: '100%', padding: '12px', fontSize: '14px' }}>
                      Update plan →
                    </button>
                  </div>
                ) : (
                  <>
                    <p style={{ fontSize: '40px', fontWeight: '300', color: plan.onTrack ? 'var(--success)' : 'var(--warning)', margin: '0 0 4px', letterSpacing: '-1.5px' }}>{fmt(plan.projectedNestEgg ?? 0)}</p>
                    <p style={{ fontSize: '13px', color: 'var(--sand-500)', margin: 0 }}>at 7% avg annual return · {plan.yearsToRetirement} years away</p>
                  </>
                )}
              </div>
              <div className="card" style={{ padding: '16px' }}>
                <p className="label" style={{ marginBottom: '4px' }}>Target</p>
                <p style={{ fontSize: '22px', fontWeight: '400', color: 'var(--sand-900)', margin: '0 0 2px', letterSpacing: '-0.5px' }}>{fmt(plan.targetNestEgg ?? 0)}</p>
                <p style={{ fontSize: '11px', color: 'var(--sand-500)', margin: 0 }}>25× annual spend</p>
              </div>
              <div className="card" style={{ padding: '16px' }}>
                <p className="label" style={{ marginBottom: '4px' }}>{plan.onTrack ? 'Surplus' : 'Shortfall'}</p>
                <p style={{ fontSize: '22px', fontWeight: '400', color: plan.onTrack ? 'var(--success)' : 'var(--danger)', margin: '0 0 2px', letterSpacing: '-0.5px' }}>
                  {plan.onTrack ? '+' : '-'}{fmt(Math.abs((plan.projectedNestEgg ?? 0) - (plan.targetNestEgg ?? 0)))}
                </p>
                <p style={{ fontSize: '11px', color: 'var(--sand-500)', margin: 0 }}>{plan.onTrack ? 'ahead of target' : 'behind target'}</p>
              </div>
            </div>

            {/* Key stats */}
            <div className="card" style={{ marginBottom: '16px' }}>
              <p className="label" style={{ marginBottom: '12px' }}>Key numbers</p>
              {[
                { label: 'Current retirement savings', value: fmt(plan.currentSavings ?? 0) },
                { label: 'Monthly contribution', value: fmt(plan.monthlyContribution ?? 0) },
                { label: 'Years to retirement', value: `${plan.yearsToRetirement ?? 0} years` },
                { label: 'Monthly income in retirement', value: `${fmt(plan.monthlyInRetirement ?? 0)}/mo` },
              ].map((item, i, arr) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: i < arr.length - 1 ? '0.5px solid var(--sand-200)' : 'none' }}>
                  <span style={{ fontSize: '13px', color: 'var(--sand-600)' }}>{item.label}</span>
                  <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--sand-900)' }}>{item.value}</span>
                </div>
              ))}
            </div>

            {/* Yearly Contributions per retirement account */}
            {profile?.assets?.some((a: any) => a.category === 'retirement' && a.yearlyContributions?.length > 0) && (() => {
              const currentYear = new Date().getFullYear()
              const fmt$ = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
              const retirementAssets = profile.assets.filter((a: any) => a.category === 'retirement' && a.yearlyContributions?.length > 0)
              const allStatuses = getContributionStatus(profile.assets, profile.age)
              const allMaxed = allStatuses.length > 0 && allStatuses.every(s => s.maxed)
              return (
                <div className="card" style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <p className="label" style={{ margin: 0 }}>Yearly contributions</p>
                    {allMaxed && (
                      <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--success)', background: 'rgba(122,158,110,0.12)', border: '0.5px solid var(--success)', borderRadius: '20px', padding: '3px 10px', letterSpacing: '0.02em' }}>
                        All accounts maxed ✓
                      </span>
                    )}
                  </div>
                  {retirementAssets.map((a: any, ai: number) => {
                    const sorted = [...a.yearlyContributions].sort((x: any, y: any) => y.year - x.year)
                    const total = sorted.reduce((s: number, c: any) => s + (c.amount || 0), 0)
                    const thisYear = sorted.find((c: any) => c.year === currentYear)
                    const det = detectAccountLimit(a.name, profile.age)
                    const limit = det?.limit ?? null
                    const accountType = det?.accountType ?? null
                    const contributed = thisYear?.amount || 0
                    const pct = limit && thisYear ? Math.min(100, Math.round((contributed / limit) * 100)) : 0
                    const maxed = !!limit && contributed >= limit
                    const remaining = limit ? Math.max(0, limit - contributed) : null
                    return (
                      <div key={ai} style={{ marginBottom: ai < retirementAssets.length - 1 ? '20px' : 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <div>
                            <p style={{ fontSize: '13px', fontWeight: '600', color: 'var(--sand-800)', margin: '0 0 1px' }}>{a.name}</p>
                            {accountType && <p style={{ fontSize: '10px', color: 'var(--sand-500)', margin: 0 }}>{accountType}</p>}
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            {maxed ? (
                              <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--success)' }}>Maxed ✓</span>
                            ) : limit && thisYear ? (
                              <span style={{ fontSize: '11px', color: 'var(--sand-500)' }}>{fmt$(remaining!)} left</span>
                            ) : null}
                          </div>
                        </div>
                        {thisYear && limit && (
                          <div style={{ marginBottom: '8px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                              <span style={{ fontSize: '11px', color: 'var(--sand-500)' }}>
                                {currentYear} — {fmt$(contributed)} of {fmt$(limit)} limit
                              </span>
                              <span style={{ fontSize: '11px', fontWeight: '700', color: maxed ? 'var(--success)' : 'var(--accent)' }}>{pct}%</span>
                            </div>
                            <div style={{ height: '5px', background: 'var(--sand-200)', borderRadius: '3px', overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${pct}%`, background: maxed ? 'var(--success)' : 'var(--accent)', borderRadius: '3px', transition: 'width 0.3s' }} />
                            </div>
                          </div>
                        )}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          {sorted.map((c: any, ci: number) => (
                            <div key={ci} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: ci < sorted.length - 1 ? '0.5px solid var(--sand-200)' : 'none' }}>
                              <span style={{ fontSize: '12px', color: 'var(--sand-600)' }}>{c.year}</span>
                              <span style={{ fontSize: '13px', fontWeight: '500', color: 'var(--sand-900)' }}>{fmt$(c.amount)}</span>
                            </div>
                          ))}
                        </div>
                        {!limit && thisYear && (
                          <p style={{ fontSize: '11px', color: 'var(--sand-400)', marginTop: '6px' }}>
                            Add account type to name (e.g. "401k", "Roth IRA") to see limit progress
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })()}

            {/* Account limits */}
            {(() => {
              const statuses = getContributionStatus(profile?.assets || [], profile?.age)
              const maxedAccounts = statuses.filter(s => s.maxed).map(s => s.account)
              const catchUp = profile?.age >= 50
              const limits = [
                { label: 'Roth / Traditional IRA', limit: catchUp ? '$8,000/yr' : '$7,000/yr', monthly: catchUp ? '$667/mo' : '$583/mo', keywords: ['roth', 'ira', 'traditional'] },
                { label: '401(k) / 403(b) / 457(b)', limit: catchUp ? '$31,000/yr' : '$23,500/yr', monthly: catchUp ? '$2,583/mo' : '$1,958/mo', keywords: ['401', '403', '457'] },
                { label: 'HSA (individual)', limit: '$4,300/yr', monthly: '$358/mo', keywords: ['hsa'] },
                { label: 'SIMPLE IRA', limit: catchUp ? '$20,000/yr' : '$16,500/yr', monthly: catchUp ? '$1,667/mo' : '$1,375/mo', keywords: ['simple'] },
                { label: 'SEP-IRA', limit: '$70,000/yr', monthly: 'varies', keywords: ['sep'] },
              ]
              const accountNames = (profile?.assets || []).filter((a: any) => a.category === 'retirement').map((a: any) => a.name.toLowerCase())
              const hasAccount = (keywords: string[]) => accountNames.some((n: string) => keywords.some(k => n.includes(k)))
              return (
                <div className="card-muted" style={{ marginBottom: '16px' }}>
                  <p className="label" style={{ marginBottom: '10px' }}>2025 contribution limits{catchUp ? ' (catch-up eligible)' : ''}</p>
                  {limits.map((item, i) => {
                    const owned = hasAccount(item.keywords)
                    const maxed = owned && statuses.filter(s => item.keywords.some(k => s.account.toLowerCase().includes(k))).every(s => s.maxed) && statuses.some(s => item.keywords.some(k => s.account.toLowerCase().includes(k)))
                    return (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: i < limits.length - 1 ? '0.5px solid var(--sand-300)' : 'none', opacity: owned ? 1 : 0.55 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '13px', fontWeight: '500', color: 'var(--sand-800)' }}>{item.label}</span>
                          {maxed && <span style={{ fontSize: '10px', fontWeight: '700', color: 'var(--success)' }}>✓</span>}
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: '13px', fontWeight: '600', color: maxed ? 'var(--success)' : 'var(--sand-900)' }}>{item.limit}</span>
                          <span style={{ fontSize: '11px', color: 'var(--sand-500)', marginLeft: '6px' }}>{item.monthly}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })()}

            <button onClick={() => setActiveTab('projections')} className="btn-primary" style={{ width: '100%', padding: '14px', fontSize: '14px', borderRadius: 'var(--radius-md)' }}>
              View projections →
            </button>
          </div>
        )}

        {/* Projections Tab */}
        {built && plan && activeTab === 'projections' && (
          <div className="animate-fade">
            <div className="card" style={{ marginBottom: '16px' }}>
              <p className="label" style={{ marginBottom: '4px' }}>Growth projection</p>
              <p style={{ fontSize: '12px', color: 'var(--sand-500)', margin: '0 0 16px' }}>Three scenarios based on avg annual return</p>
              <div style={{ height: '280px' }}>
                {lineChartData && <Line data={lineChartData} options={chartOptions} />}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '16px' }}>
              {chartData && [
                { label: 'Conservative', value: chartData.conservative[chartData.conservative.length - 1], rate: '4%', color: 'rgba(192,57,43,0.7)', note: 'floor' },
                { label: 'Expected', value: chartData.moderate[chartData.moderate.length - 1], rate: '7%', color: 'var(--accent)', note: 'most likely' },
                { label: 'Optimistic', value: chartData.aggressive[chartData.aggressive.length - 1], rate: '10%', color: 'var(--success)', note: 'ceiling' },
              ].map((item, i) => (
                <div key={i} className="card" style={{ padding: '14px', textAlign: 'center' }}>
                  <p style={{ fontSize: '10px', color: item.color, fontWeight: '700', margin: '0 0 4px', letterSpacing: '0.05em' }}>{item.rate}</p>
                  <p style={{ fontSize: '13px', fontWeight: '600', color: 'var(--sand-900)', margin: '0 0 2px' }}>{fmt(item.value)}</p>
                  <p style={{ fontSize: '10px', color: 'var(--sand-500)', margin: 0 }}>{item.note}</p>
                </div>
              ))}
            </div>

            {plan && (
              <div style={{ marginBottom: '16px', padding: '12px 14px', background: plan.onTrack ? 'rgba(122,158,110,0.08)' : 'rgba(192,57,43,0.05)', borderRadius: 'var(--radius-sm)', border: `0.5px solid ${plan.onTrack ? 'rgba(122,158,110,0.2)' : 'rgba(192,57,43,0.15)'}` }}>
                <p style={{ fontSize: '13px', fontWeight: '600', color: plan.onTrack ? 'var(--success)' : 'var(--danger)', margin: '0 0 2px' }}>
                  {plan.onTrack ? `On track — projected to exceed your target by ${fmt((plan.projectedNestEgg ?? 0) - (plan.targetNestEgg ?? 0))}` : `Shortfall of ${fmt(plan.shortfall ?? 0)} at expected 7% return`}
                </p>
                <p style={{ fontSize: '12px', color: 'var(--sand-500)', margin: 0 }}>Target: {fmt(plan.targetNestEgg ?? 0)} (25× annual spend). The shaded band shows your range of outcomes.</p>
              </div>
            )}

            <div className="card-muted" style={{ padding: '16px' }}>
              <p style={{ fontSize: '13px', color: 'var(--sand-700)', margin: '0 0 6px', fontWeight: '500' }}>Contributing {fmt(plan.monthlyContribution ?? 0)}/mo starting now</p>
              <p style={{ fontSize: '12px', color: 'var(--sand-500)', margin: 0, lineHeight: '1.5' }}>The shaded range shows your 4%–10% return scenarios. The dashed red line is your target nest egg. The solid line is the expected 7% projection, matching historical S&P 500 averages.</p>
            </div>
          </div>
        )}

        {/* Strategy Tab */}
        {built && plan && activeTab === 'strategy' && (
          <StrategyTab profile={profile} plan={plan} />
        )}

        {/* Chat Tab */}
        {built && activeTab === 'chat' && (
          <div className="animate-fade">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '16px', maxHeight: '60vh', overflowY: 'auto', paddingBottom: '8px' }}>
              {chatMessages.slice(1).map((msg, i) => (
                <div key={i} style={{ display: 'flex', gap: '10px', flexDirection: msg.role === 'user' ? 'row-reverse' : 'row' }}>
                  {msg.role === 'assistant' && (
                    <div style={{ width: '28px', height: '28px', background: 'var(--accent)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px' }}>
                      <span style={{ color: 'var(--sand-50)', fontSize: '9px', fontWeight: '700' }}>AI</span>
                    </div>
                  )}
                  <div style={{ maxWidth: '80%', background: msg.role === 'user' ? 'var(--accent)' : 'var(--sand-50)', border: msg.role === 'user' ? 'none' : '0.5px solid var(--sand-300)', borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px', padding: '12px 16px' }}>
                    {msg.role === 'user'
                      ? <p style={{ fontSize: '14px', margin: 0, color: 'var(--sand-50)', lineHeight: '1.5' }}>{msg.content}</p>
                      : <div>{msg.content.split('\n').map((line, li) => {
                          if (!line.trim()) return <div key={li} style={{ height: '5px' }} />
                          if (line.startsWith('**') && line.endsWith('**')) return <p key={li} style={{ fontWeight: '700', color: 'var(--sand-900)', margin: '8px 0 2px', fontSize: '13px' }}>{line.slice(2, -2)}</p>
                          if (line.startsWith('- ')) return <div key={li} style={{ display: 'flex', gap: '7px', marginTop: '3px' }}><span style={{ color: 'var(--accent)', fontWeight: '700' }}>·</span><span style={{ fontSize: '13px', lineHeight: '1.5', color: 'var(--sand-800)' }}>{line.slice(2)}</span></div>
                          if (/^\d+\./.test(line)) return <div key={li} style={{ display: 'flex', gap: '7px', marginTop: '3px' }}><span style={{ color: 'var(--accent)', fontWeight: '700', fontSize: '12px', flexShrink: 0 }}>{line.match(/^\d+/)![0]}.</span><span style={{ fontSize: '13px', lineHeight: '1.5', color: 'var(--sand-800)' }}>{line.replace(/^\d+\.\s*/, '')}</span></div>
                          return <p key={li} style={{ fontSize: '13px', lineHeight: '1.6', margin: '2px 0', color: 'var(--sand-800)' }}>{line}</p>
                        })}</div>
                    }
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div style={{ display: 'flex', gap: '10px' }}>
                  <div style={{ width: '28px', height: '28px', background: 'var(--accent)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ color: 'var(--sand-50)', fontSize: '9px', fontWeight: '700' }}>AI</span>
                  </div>
                  <div style={{ background: 'var(--sand-50)', border: '0.5px solid var(--sand-300)', borderRadius: '18px 18px 18px 4px', padding: '14px 16px', display: 'flex', gap: '5px' }}>
                    {[0,150,300].map(d => <div key={d} style={{ width: '6px', height: '6px', background: 'var(--sand-400)', borderRadius: '50%', animation: 'pulse 1.2s infinite', animationDelay: `${d}ms` }} />)}
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
              <input
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendChat()}
                placeholder="Ask about your retirement..."
                style={{ flex: 1, borderRadius: '20px' }}
              />
              <button onClick={sendChat} disabled={!chatInput.trim() || chatLoading}
                style={{ width: '42px', height: '42px', borderRadius: '50%', background: chatInput.trim() ? 'var(--accent)' : 'var(--sand-300)', border: 'none', cursor: chatInput.trim() ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={chatInput.trim() ? 'var(--sand-50)' : 'var(--sand-500)'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>
                </svg>
              </button>
            </div>

            {chatMessages.length <= 1 && (
              <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {['How can I retire earlier?', 'What should I invest in?', 'How much do I need to save each month?', 'What are the tax advantages I should use?'].map((q, i) => (
                  <button key={i} onClick={() => { setChatInput(q); }}
                    style={{ background: 'var(--sand-50)', border: '0.5px solid var(--sand-300)', borderRadius: 'var(--radius-md)', padding: '12px 16px', textAlign: 'left', cursor: 'pointer', fontSize: '13px', color: 'var(--sand-700)', fontFamily: 'inherit' }}>
                    {q}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
