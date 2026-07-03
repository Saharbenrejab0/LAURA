'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createLOA, updateLOA, submitLOA, getLOA, getAISuggestion, validateDescription } from '@/lib/api'
import type { ActivityType, AISuggestion } from '@/types/loa'
import {
  CLUSTERS, CLUSTER_COUNTRIES, ACTIVITY_TYPES,
  EVENT_TYPES, EVENT_PURPOSES, COT_OPTIONS, CATEGORY_OPTIONS,
  BRAND_OPTIONS, BRANDS_BY_CATEGORY, LEGAL_ENTITIES_BY_COUNTRY,
  EVENT_ACTIVITY_TYPES, DOOR_ACTIVITY_TYPES,
} from '@/types/loa'
import PhotoUpload from '@/components/PhotoUpload'
import type { PhotoUploadRef } from '@/components/PhotoUpload'
import { ThemeToggle } from '@/components/ThemeProvider'
import { useToast } from '@/components/Toast'
import VoiceInput from '@/components/VoiceInput'
import PreviewModal from '@/components/PreviewModal'
import ReviewBeforeSubmit from '@/components/ReviewBeforeSubmit'
import MultiSelect from '@/components/MultiSelect'
import { createPortal } from 'react-dom'
import { useAutoSave, clearDraft, scrollToFirstError, useLeaveConfirmation } from '@/components/useFormGuard'
import { useMyRole } from '@/hooks/usePermissions'

function formatEuros(n: number) {
  if (!n) return '€0'
  if (n >= 1_000_000) return `€${(n/1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `€${Math.round(n/1_000)}k`
  return `€${n}`
}

function inferTiming(quarters: { year: number; q: number; val: number }[]): string {
  const active = quarters.filter(x => x.val > 0).sort((a, b) => a.year - b.year || a.q - b.q)
  if (active.length === 0) return ''

  const q2026 = active.filter(x => x.year === 2026)
  if (q2026.length === 4) return 'FY 2026'

  if (active.length === 1) {
    const x = active[0]
    return `Q${x.q} ${x.year}`
  }

  const sameYear = active.every(x => x.year === active[0].year)
  if (sameYear) {
    const year = active[0].year
    const qs = active.map(x => x.q)
    const min = Math.min(...qs)
    const max = Math.max(...qs)
    const consecutive = max - min + 1 === qs.length

    if (consecutive) {
      if (min === 1 && max === 2) return `H1 ${year} (Q1\u2013Q2)`
      if (min === 3 && max === 4) return `H2 ${year} (Q3\u2013Q4)`
      return `Q${min}\u2013Q${max} ${year}`
    }
    return qs.map(q => `Q${q}`).join(', ') + ` ${year}`
  }

  const first = active[0]
  const last = active[active.length - 1]
  return `Q${first.q} ${first.year} \u2013 Q${last.q} ${last.year}`
}

function KEurosInput({ value, onChange, placeholder = '0' }: {
  value: number; onChange: (newValueInEuros: number) => void; placeholder?: string
}) {
  const displayValue = value ? value / 1000 : ''
  return (
    <div style={{ position: 'relative' }}>
      <input type="number" className="input" style={{ paddingRight: '32px' }} value={displayValue} min={0} step="0.1"
        onChange={e => { const v = e.target.value; onChange(v === '' ? 0 : Math.round(Number(v) * 1000)) }} placeholder={placeholder} />
      <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '13px', pointerEvents: 'none' }}>k</span>
    </div>
  )
}

function PercentInput({ value, onChange, onComplement, placeholder = '0' }: {
  value: number | ''; onChange: (newDecimalValue: number | '') => void; onComplement?: (complementDecimalValue: number) => void; placeholder?: string
}) {
  const displayValue = value === '' || value === null || value === undefined ? '' : Math.round(Number(value) * 100)
  return (
    <div style={{ position: 'relative' }}>
      <input type="number" className="input" style={{ paddingRight: '32px' }} value={displayValue} min={0} max={100} step="1"
        onChange={e => {
          const raw = e.target.value
          if (raw === '') { onChange(''); return }
          const num = Number(raw); if (isNaN(num)) return
          const clamped = Math.max(0, Math.min(100, num))
          onChange(clamped / 100)
          if (onComplement) onComplement((100 - clamped) / 100)
        }} placeholder={placeholder} />
      <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '13px', pointerEvents: 'none' }}>%</span>
    </div>
  )
}

function SearchableSelect({ value, onChange, options, placeholder, disabled }: {
  value: string; onChange: (v: string) => void; options: string[]; placeholder: string; disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const filtered = options.filter(o => o.toLowerCase().includes(search.toLowerCase()))
  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', handler); return () => document.removeEventListener('mousedown', handler)
  }, [])
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div className="input" style={{ cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.45 : 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
        onClick={() => !disabled && setOpen(o => !o)}>
        <span style={{ color: value ? 'var(--text-primary)' : 'var(--text-muted)', fontSize: '13.5px' }}>{value || placeholder}</span>
        <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: '0 0 10px 10px', boxShadow: 'var(--shadow-md)', maxHeight: '200px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <input autoFocus className="input" style={{ borderRadius: 0, borderBottom: '1px solid var(--border)', flexShrink: 0 }} placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} onClick={e => e.stopPropagation()} />
          <div style={{ overflowY: 'auto' }}>
            {filtered.length === 0 && <div style={{ padding: '10px 12px', fontSize: '13px', color: 'var(--text-muted)' }}>No results</div>}
            {filtered.map(o => (
              <div key={o} className="select-option" style={{ background: o === value ? 'var(--bg-elevated)' : undefined, fontWeight: o === value ? 500 : undefined }}
                onClick={() => { onChange(o); setOpen(false); setSearch('') }}>{o}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ComboInput({ value, onChange, suggestions, placeholder, disabled }: {
  value: string; onChange: (v: string) => void; suggestions: string[]; placeholder: string; disabled?: boolean
}) {
  const [open, setOpen] = useState(false); const [focused, setFocused] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const filtered = suggestions.filter(s => s.toLowerCase().includes((value || '').toLowerCase()))
  const showDropdown = (focused || open) && filtered.length > 0 && !disabled
  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setFocused(false) } }
    document.addEventListener('mousedown', handler); return () => document.removeEventListener('mousedown', handler)
  }, [])
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <input className="input" value={value} onChange={e => { onChange(e.target.value); setOpen(true) }} onFocus={() => { setFocused(true); setOpen(true) }} placeholder={placeholder} disabled={disabled} />
      {showDropdown && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: '0 0 10px 10px', boxShadow: 'var(--shadow-md)', maxHeight: '180px', overflowY: 'auto' }}>
          {filtered.map(s => (
            <div key={s} className="select-option" style={{ background: s === value ? 'var(--bg-elevated)' : undefined, fontWeight: s === value ? 500 : undefined }}
              onClick={() => { onChange(s); setOpen(false); setFocused(false) }}>{s}</div>
          ))}
        </div>
      )}
    </div>
  )
}

function Field({ label, required, hint, children, error, fieldKey }: {
  label: string; required?: boolean; hint?: string; children: React.ReactNode; error?: string; fieldKey?: string
}) {
  return (
    <div data-field={fieldKey}>
      <label className="label">{label}{required && <span className="ml-0.5" style={{ color: 'var(--red)' }}>*</span>}</label>
      {children}
      {error && <p className="text-xs mt-1" style={{ color: 'var(--red-text)' }}>{error}</p>}
      {!error && hint && <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{hint}</p>}
    </div>
  )
}

function CalcField({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <label className="label">{label}</label>
      <div className="input cursor-default font-medium" style={{ color: 'var(--green)', background: 'var(--bg-elevated)' }}>{value}</div>
      <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Auto-calculated · locked</p>
    </div>
  )
}

function SectionCard({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return (
    <div className="card p-5">
      <div className="flex items-center gap-2.5 mb-5" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
        <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: 'var(--accent)', color: 'var(--accent-text)' }}>{number}</div>
        <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>{title}</h2>
      </div>
      {children}
    </div>
  )
}

function LeaveDialog({ onStay, onLeave }: { onStay: () => void; onLeave: () => void }) {
  if (typeof document === 'undefined') return null
  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'fadeIn 0.15s ease' }}>
      <div className="card p-6" style={{ maxWidth: '360px', width: '100%', margin: '0 16px' }}>
        <p className="text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>Unsaved changes</p>
        <p className="text-sm mb-5" style={{ color: 'var(--text-secondary)' }}>You have unsaved changes. If you leave now, they will be lost.</p>
        <div className="flex gap-3">
          <button onClick={onLeave} className="btn-secondary text-sm flex-1">Leave anyway</button>
          <button onClick={onStay} className="btn-primary text-sm flex-1">Stay & save</button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── Main component ─────────────────────────────────────────────────────────
export default function NewLOAPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const editId = searchParams.get('edit')
  const isEditMode = !!editId
  const { success, error: toastError, info } = useToast()
  const { role, loading: roleLoading } = useMyRole()

  const [saving, setSaving]       = useState(false)
  const [showReview, setShowReview] = useState(false)
  const [successReceipt, setSuccessReceipt] = useState<{ loaId: string; draftId: string; budget: number; action: string; nextStep: string } | null>(null)
  const [loadingEdit, setLoadingEdit] = useState(isEditMode)
  const [loaId, setLoaId]         = useState<string | null>(editId)
  const [errors, setErrors]       = useState<Record<string, string>>({})
  const [isDirty, setIsDirty]     = useState(false)
  const [showLeave, setShowLeave] = useState(false)
  const [pendingLeave, setPendingLeave] = useState<string | null>(null)
  const [showPreview, setShowPreview]   = useState(false)
  const [autoSaveAt, setAutoSaveAt]     = useState<string | null>(null)
  const [photos, setPhotos]       = useState<{ index: number; url: string }[]>([])
  const photoRef = useRef<PhotoUploadRef>(null)

  const [cluster, setCluster]           = useState('')
  const [country, setCountry]           = useState('')
  const [legalEntity, setLegalEntity]   = useState('')
  const [activityType, setActivityType] = useState<ActivityType | ''>('')
  const [eventType, setEventType]       = useState('')
  const [eventPurpose, setEventPurpose] = useState('')
  const [sapEventCode, setSapEventCode] = useState('')
  const [cot, setCot]                   = useState('All COT')
  const [category, setCategory]         = useState<string[]>([])
  const [brand, setBrand]               = useState('')
  const [capexOpex, setCapexOpex]       = useState('OpEx')
  const [advSelling, setAdvSelling]     = useState('ADV')
  const [detail, setDetail]             = useState('')
  const [customer, setCustomer]         = useState('')
  const [vendor, setVendor]             = useState('')
  const [currency, setCurrency]         = useState('EUR')
  const [numCustomers, setNumCustomers] = useState<number>(0)
  const [numDoors, setNumDoors]         = useState<number>(0)
  const [q4_2025, setQ4_2025]           = useState<number>(0)
  const [q1, setQ1] = useState<number>(0)
  const [q2, setQ2] = useState<number>(0)
  const [q3, setQ3] = useState<number>(0)
  const [q4, setQ4] = useState<number>(0)
  const [description, setDescription]   = useState('')
  const [tools, setTools]               = useState('')
  const [kpi, setKpi]                   = useState('')
  const [timing, setTiming]             = useState('')
  const [lastAutoTiming, setLastAutoTiming] = useState('')
  const [showQ4_2025, setShowQ4_2025] = useState(false)
  const [costDrillDown, setCostDrillDown] = useState('')
  const [costJustification, setCostJustification] = useState('')
  const [startDate, setStartDate]       = useState('')
  const [endDate, setEndDate]           = useState('')
  const [costSplitLenses, setCostSplitLenses] = useState<number | ''>('')
  const [costSplitFrames, setCostSplitFrames] = useState<number | ''>('')
  const [forecastedLenses, setForecastedLenses]     = useState<number>(0)
  const [forecastedFrames, setForecastedFrames]     = useState<number>(0)
  const [forecastedInstruments, setForecastedInstruments] = useState<number>(0)
  const [requestorEmail, setRequestorEmail] = useState(() => {
    if (typeof window === 'undefined') return ''
    const user = localStorage.getItem('laura_user')
    return user ? JSON.parse(user).email : ''
  })
  const [financeEmail, setFinanceEmail] = useState('')

  const [suggestion, setSuggestion]               = useState<AISuggestion | null>(null)
  const [loadingSuggestion, setLoadingSuggestion] = useState(false)
  const [descFeedback, setDescFeedback]           = useState<any>(null)
  const [checkingDesc, setCheckingDesc]           = useState(false)

  const [scopeApplied, setScopeApplied] = useState(false)
  useEffect(() => {
    if (roleLoading || scopeApplied || isEditMode) return
    if (role?.role_scope_type === 'cluster' && role.role_scope_value?.length === 1) {
      setCluster(role.role_scope_value[0]); setScopeApplied(true)
    }
  }, [role, roleLoading, scopeApplied, isEditMode])

  useEffect(() => {
    if (!editId) return
    async function loadLOA() {
      try {
        const loa = await getLOA(editId!)
        setCluster(loa.cluster || ''); setCountry(loa.country || ''); setLegalEntity(loa.legal_entity || '')
        setActivityType((loa.activity_type as ActivityType) || ''); setEventType(loa.event_type || '')
        setEventPurpose(loa.event_purpose || ''); setSapEventCode((loa as any).sap_event_code || '')
        setCot(loa.cot || 'All COT')
        const cat = loa.category
        if (Array.isArray(cat)) setCategory(cat); else if (typeof cat === 'string' && cat) setCategory([cat]); else setCategory([])
        setBrand(loa.brand || ''); setCapexOpex(loa.capex_opex || 'OpEx'); setAdvSelling(loa.adv_selling || 'ADV')
        setDetail(loa.detail || ''); setCustomer(loa.customer || ''); setVendor(loa.vendor || '')
        setCurrency(loa.currency || 'EUR'); setNumCustomers(loa.num_customers || 0); setNumDoors(loa.num_doors || 0)
        setQ4_2025(loa.q4_2025 || 0); setQ1(loa.q1_2026 || 0); setQ2(loa.q2_2026 || 0); setQ3(loa.q3_2026 || 0); setQ4(loa.q4_2026 || 0)
        setDescription(loa.description || ''); setTools(loa.tools || ''); setKpi(loa.kpi || '')
        setTiming(loa.timing || ''); setCostDrillDown((loa as any).cost_drill_down || '')
        setCostJustification((loa as any).cost_justification || '')
        setStartDate(loa.start_date || ''); setEndDate(loa.end_date || '')
        setCostSplitLenses((loa as any).cost_split_lenses ?? ''); setCostSplitFrames((loa as any).cost_split_frames ?? '')
        setForecastedLenses((loa as any).forecasted_lenses_sales || 0); setForecastedFrames((loa as any).forecasted_frames_sales || 0)
        setForecastedInstruments((loa as any).forecasted_instruments_sales || 0)
        setRequestorEmail(loa.requestor_email || ''); setFinanceEmail((loa as any).finance_validator_email || '')
        info(`Editing LOA ${loa.loa_draft_id}`)
      } catch { toastError('Could not load LOA — it may have been deleted'); router.push('/') }
      finally { setLoadingEdit(false) }
    }
    loadLOA()
  }, [editId])

  const fyTotal     = q1 + q2 + q3 + q4
  const fy2025Total = q4_2025
  const avgPerDoor  = numDoors > 0 ? fyTotal / numDoors : 0
  const pptRequired = fyTotal > 50_000
  const isEvent       = EVENT_ACTIVITY_TYPES.includes(activityType as ActivityType)
  const isPermanent   = activityType === 'Permanent Visibility'
  const isSponsorship = activityType === 'Sponsorship'
  const hasDoors      = !isSponsorship && DOOR_ACTIVITY_TYPES.includes(activityType as ActivityType)
  const showCostSplit = activityType === 'Events'
  const availableBrands = category.length > 0 ? Array.from(new Set(category.flatMap(c => BRANDS_BY_CATEGORY[c] || []))) : BRAND_OPTIONS
  const costSplitTotal = (Number(costSplitLenses)||0) + (Number(costSplitFrames)||0)
  const costSplitValid = costSplitLenses === '' && costSplitFrames === '' ? true : Math.abs(costSplitTotal - 1.0) < 0.001
  const costSplitTotalPct = Math.round(costSplitTotal * 100)

  const [clusterInitialized, setClusterInitialized] = useState(false)
  useEffect(() => { if (!clusterInitialized) { setClusterInitialized(true); return }; if (!isEditMode) { setCountry(''); setLegalEntity('') } }, [cluster])
  useEffect(() => {
  const quarters = [
    { year: 2025, q: 4, val: q4_2025 },
    { year: 2026, q: 1, val: q1 },
    { year: 2026, q: 2, val: q2 },
    { year: 2026, q: 3, val: q3 },
    { year: 2026, q: 4, val: q4 },
  ]
  const inferred = inferTiming(quarters)
  if (!inferred) return
  if (timing === '' || timing === lastAutoTiming) {
    setTiming(inferred)
    setLastAutoTiming(inferred)
  }
}, [q4_2025, q1, q2, q3, q4])
  const [categoryInitialized, setCategoryInitialized] = useState(false)
  useEffect(() => { if (!categoryInitialized) { setCategoryInitialized(true); return }; if (!isEditMode) setBrand('') }, [category])
  const markDirty = () => setIsDirty(true)

  const formSnapshot = { cluster, country, legalEntity, activityType, eventType, eventPurpose, sapEventCode, cot, category, brand, capexOpex, advSelling, detail, customer, vendor, currency, numCustomers, numDoors, q4_2025, q1, q2, q3, q4, description, tools, kpi, timing, costDrillDown, startDate, endDate, requestorEmail, financeEmail }
  useAutoSave(formSnapshot, isEditMode ? `edit_${editId}` : 'new_loa', 30000)
  useEffect(() => { if (!isDirty) return; const id = setInterval(() => { setAutoSaveAt(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })) }, 30000); return () => clearInterval(id) }, [isDirty])
  useLeaveConfirmation(isDirty)
  function handleBack() { const dest = isEditMode ? `/loa/${editId}` : '/'; if (isDirty) { setShowLeave(true); setPendingLeave(dest) } else router.push(dest) }

  async function fetchSuggestion() {
    if (!activityType || category.length === 0 || !brand) return
    setLoadingSuggestion(true)
    try {
      const result = await getAISuggestion({ activity_type: activityType, cluster, category, brand, fy_total: fyTotal, num_doors: numDoors })
      setSuggestion(result)
      if (result.description) { setDescription(result.description); markDirty() }
      if (result.kpi) setKpi(result.kpi)
      if (result.tools) { setTools(result.tools); setDetail(result.tools) }
      info('AI suggestions applied — review and edit below')
    } catch { toastError('AI suggestion failed — try again') } finally { setLoadingSuggestion(false) }
  }
  async function checkDescription() {
    if (!description) return; setCheckingDesc(true)
    try { const result = await validateDescription(description, activityType as string); setDescFeedback(result); if (result.is_valid) info('Good WHY statement ✓'); else toastError('This reads as WHAT, not WHY — see suggestion below') } finally { setCheckingDesc(false) }
  }
  function applySuggestion(field: 'description' | 'kpi' | 'tools') {
    if (!suggestion) return
    if (field === 'description') { setDescription(suggestion.description); setDescFeedback(null) }
    if (field === 'kpi') setKpi(suggestion.kpi)
    if (field === 'tools') { setTools(suggestion.tools); setDetail(suggestion.tools) }
    markDirty()
  }

  const DOOR_MANDATORY_TYPES: ActivityType[] = ['Permanent Visibility', 'Seasonal Visibility', 'Coop Advertising', 'Trade Incentive', 'Catalogues & Brochures']

  function validate(): boolean {
    const e: Record<string, string> = {}
    if (!cluster) e.cluster = 'Required'; if (!country) e.country = 'Required'
    if (!activityType) e.activityType = 'Required'; if (category.length === 0) e.category = 'Required'
    if (!brand) e.brand = 'Required'; if (!cot) e.cot = 'Required'
    if (!requestorEmail) e.requestorEmail = 'Required'
    if (!description) e.description = 'Required — must answer WHY'
    if (!detail) e.detail = 'Required — must answer HOW'
    if (activityType !== 'Others (non ADV)' && !kpi) e.kpi = 'Required'
    if (!startDate) e.startDate = 'Required'; if (!isPermanent && !endDate) e.endDate = 'Required'
    if (isEvent && !eventType) e.eventType = 'Required'; if (isEvent && !eventPurpose) e.eventPurpose = 'Required'
    if (fyTotal === 0 && fy2025Total === 0) e.q1 = 'At least one quarterly value required'
    if (showCostSplit && !costSplitValid) e.costSplit = `Lenses + Frames must equal 100% (currently ${costSplitTotalPct}%)`
    if (fyTotal > 100_000 && !costJustification.trim()) e.costJustification = 'Required — explain why this investment exceeds €100K'
    if (!vendor) e.vendor = 'Required — vendor or agency name'
    if (!costDrillDown) e.costDrillDown = 'Required — investment breakdown'
    if (isEvent && !sapEventCode) e.sapEventCode = 'Required for Events — create in SAP first'
    if (DOOR_MANDATORY_TYPES.includes(activityType as ActivityType) && (!numDoors || numDoors <= 0)) e.numDoors = 'Required for this activity type'
    setErrors(e); if (Object.keys(e).length > 0) scrollToFirstError(e); return Object.keys(e).length === 0
  }

  function buildPayload() {
    return {
      cluster, country, legal_entity: legalEntity, activity_type: activityType as ActivityType,
      event_type: eventType || undefined, event_purpose: eventPurpose || undefined, sap_event_code: sapEventCode || undefined,
      cot, category, brand, capex_opex: capexOpex as any, adv_selling: advSelling as any,
      detail, description, customer, vendor, currency,
      num_customers: numCustomers || undefined, num_doors: numDoors || undefined,
      q4_2025: q4_2025||0, q1_2026: q1||0, q2_2026: q2||0, q3_2026: q3||0, q4_2026: q4||0,
      tools, kpi, timing, cost_drill_down: costDrillDown, cost_justification: costJustification || undefined,
      start_date: startDate || undefined, end_date: isPermanent ? '31/12/2026' : (endDate||undefined),
      cost_split_lenses: costSplitLenses!=='' ? Number(costSplitLenses) : undefined,
      cost_split_frames: costSplitFrames!=='' ? Number(costSplitFrames) : undefined,
      forecasted_lenses_sales: forecastedLenses||undefined, forecasted_frames_sales: forecastedFrames||undefined,
      forecasted_instruments_sales: forecastedInstruments||undefined,
      finance_validator_email: financeEmail||undefined, requestor_email: requestorEmail,
    }
  }

  function handleReviewSubmit() { if (!validate()) return; setShowReview(true) }

  async function handleSubmit(asDraft = false) {
    if (!asDraft && !validate()) return
    setSaving(true)
    try {
      const payload = buildPayload()
      if (isEditMode && editId) {
        await updateLOA(editId, payload as any); clearDraft(`edit_${editId}`); setIsDirty(false)
        success(asDraft ? 'Changes saved ✓' : 'LOA updated ✓')
        if (!asDraft) {
          try {
            await submitLOA(editId); setSaving(false)
            setSuccessReceipt({ loaId: editId, draftId: '', budget: fyTotal, action: 'resubmitted', nextStep: 'Now awaiting Local Prep review' })
            return
          } catch { /* already submitted is fine */ }
        }
        router.push(`/loa/${editId}`)
      } else {
        const loa = await createLOA(payload as any)
        await photoRef.current?.uploadPending(loa.id); setLoaId(loa.id)
        if (!asDraft) {
          try {
            await submitLOA(loa.id); clearDraft('new_loa'); setIsDirty(false); setSaving(false)
            setSuccessReceipt({ loaId: loa.id, draftId: loa.loa_draft_id, budget: fyTotal, action: 'submitted', nextStep: 'Now awaiting Local Prep review' })
            return
          } catch (e: any) {
            if (e.response?.data?.detail?.validation_errors) {
              const newErrors: Record<string, string> = {}
              e.response.data.detail.validation_errors.forEach((err: any) => { newErrors[err.field] = err.message })
              setErrors(newErrors); scrollToFirstError(newErrors)
              toastError(`${Object.keys(newErrors).length} validation errors — check highlighted fields`)
              setSaving(false); return
            }
          }
        } else { success('Draft saved ✓'); setIsDirty(false) }
        router.push(`/loa/${loa.id}`)
      }
    } catch { toastError('Failed to save — check backend is running') } finally { setSaving(false) }
  }

  if (loadingEdit) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-base)' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="w-8 h-8 border-2 rounded-full animate-spin mx-auto mb-3" style={{ borderColor: 'var(--border)', borderTopColor: 'var(--accent)' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading LOA…</p>
        </div>
      </div>
    )
  }

  const pageTitle = isEditMode ? 'Edit LOA' : 'New LOA'
  const draftLabel  = isEditMode ? 'Save changes' : 'Save draft'
  const categoryLabel = category.length > 0 ? category.join(' + ') : ''

  return (
    <div className="min-h-screen page-enter" style={{ background: 'var(--bg-base)' }}>
      {showLeave && <LeaveDialog onStay={() => setShowLeave(false)} onLeave={() => { setIsDirty(false); router.push(pendingLeave || '/') }} />}
      {showPreview && <PreviewModal isOpen={showPreview} onClose={() => setShowPreview(false)} category={categoryLabel} country={country} brand={brand} fyTotal={fyTotal} description={description} tools={tools} kpi={kpi} costDrillDown={costDrillDown} numDoors={numDoors} avgPerDoor={avgPerDoor} activityType={activityType} detail={detail} photos={photos} />}

      <header className="sticky top-0 z-20 px-6 py-3.5 flex items-center justify-between" style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-3">
          <button onClick={handleBack} className="btn-ghost text-sm px-2">← Back</button>
          <span style={{ color: 'var(--border)', opacity: 0.4 }}>|</span>
          <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{pageTitle}</span>
          {role && !isEditMode && role.role_scope_type === 'cluster' && (
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--blue-bg)', color: 'var(--blue-text)', border: '1px solid var(--blue-border)' }}>{role.role_scope_value?.join(', ')} scope</span>
          )}
          {isEditMode && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--amber-bg)', color: 'var(--amber-text)', border: '1px solid var(--amber-border)' }}>Editing</span>}
          {autoSaveAt && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>· Saved {autoSaveAt}</span>}
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {pptRequired && <span className="text-xs px-2 py-1 rounded-full" style={{ background: 'var(--green-bg)', color: 'var(--green-text)', border: '1px solid var(--green-border)' }}>PPT required (over €50k)</span>}
          <button onClick={() => handleSubmit(true)} disabled={saving} className="btn-secondary text-sm">{draftLabel}</button>
          <button onClick={handleReviewSubmit} disabled={saving} className="btn-primary text-sm">{saving ? 'Saving…' : isEditMode ? 'Save & resubmit' : 'Review & submit'}</button>
        </div>
      </header>

      {Object.keys(errors).length > 0 && (
        <div className="px-6 py-3" style={{ background: 'var(--red-bg)', borderBottom: '1px solid var(--red-border)' }}>
          <p className="text-xs font-medium" style={{ color: 'var(--red-text)' }}>{Object.keys(errors).length} error{Object.keys(errors).length > 1 ? 's' : ''} — scroll down to fix highlighted fields</p>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-6 py-6 grid grid-cols-[1fr_320px] gap-6">
        <div className="space-y-4">
          <SectionCard number={1} title="Location">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Cluster" required error={errors.cluster} fieldKey="cluster">
                <select className="input" value={cluster} onChange={e => { setCluster(e.target.value); markDirty() }}><option value="">Select cluster…</option>{CLUSTERS.map(c => <option key={c} value={c}>{c}</option>)}</select>
              </Field>
              <Field label="Country" required hint="Filters from cluster" error={errors.country} fieldKey="country">
                <select className="input" value={country} onChange={e => { setCountry(e.target.value); markDirty() }} disabled={!cluster}><option value="">Select country…</option>{(CLUSTER_COUNTRIES[cluster]||[]).map(c => <option key={c} value={c}>{c}</option>)}</select>
              </Field>
              <Field label="Legal Entity" hint="Pick from list or type freely">
                <ComboInput value={legalEntity} onChange={v => { setLegalEntity(v); markDirty() }} suggestions={country ? (LEGAL_ENTITIES_BY_COUNTRY[country] || []) : []} placeholder={country ? 'Type or select legal entity…' : 'Select a country first'} disabled={!country} />
              </Field>
            </div>
          </SectionCard>

          <SectionCard number={2} title="Activity Classification">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Activity Type" required error={errors.activityType} fieldKey="activityType">
                <select className="input" value={activityType} onChange={e => { setActivityType(e.target.value as ActivityType); markDirty() }}><option value="">Select type…</option>{ACTIVITY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select>
              </Field>
              <Field label="Channel of Trade (COT)" required error={errors.cot} fieldKey="cot">
                <select className="input" value={cot} onChange={e => { setCot(e.target.value); markDirty() }}>{COT_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}</select>
              </Field>
              {isEvent && (<>
                <Field label="Event Type" required error={errors.eventType} fieldKey="eventType">
                  <select className="input" value={eventType} onChange={e => { setEventType(e.target.value); markDirty() }}><option value="">Select event type…</option>{EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select>
                </Field>
                <Field label="Event Purpose" required error={errors.eventPurpose} fieldKey="eventPurpose">
                  <select className="input" value={eventPurpose} onChange={e => { setEventPurpose(e.target.value); markDirty() }}><option value="">Select purpose…</option>{EVENT_PURPOSES.map(p => <option key={p} value={p}>{p}</option>)}</select>
                </Field>
                <Field label="SAP Event Code" hint="Created in SAP first, then entered here" error={errors.sapEventCode} fieldKey="sapEventCode">
                  <input className="input" value={sapEventCode} onChange={e => { setSapEventCode(e.target.value); markDirty() }} placeholder="e.g. 2026N1FRRO001" />
                </Field>
              </>)}
              <Field label="CapEx / OpEx" required>
                <select className="input" value={capexOpex} onChange={e => { setCapexOpex(e.target.value); markDirty() }}><option value="OpEx">OpEx</option><option value="CapEx">CapEx</option></select>
                {capexOpex === 'CapEx' && !isPermanent && <p className="text-xs mt-1" style={{ color: 'var(--amber-text)' }}>⚠ CapEx is typically only for Permanent Visibility</p>}
              </Field>
              <Field label="ADV / Selling / Others" required>
                <select className="input" value={advSelling} onChange={e => { setAdvSelling(e.target.value); markDirty() }}><option value="ADV">ADV</option><option value="Selling">Selling</option><option value="Others">Others</option></select>
              </Field>
            </div>
          </SectionCard>

          <SectionCard number={3} title="Product">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Category" required error={errors.category} fieldKey="category">
                <MultiSelect options={CATEGORY_OPTIONS} values={category} onChange={v => { setCategory(v); markDirty() }} placeholder="Select one or more categories…" />
              </Field>
              <Field label="Brand" required hint="Type to search" error={errors.brand} fieldKey="brand">
                <SearchableSelect value={brand} onChange={v => { setBrand(v); markDirty() }} options={availableBrands} placeholder="Search brand…" disabled={category.length === 0} />
              </Field>
            </div>
          </SectionCard>

          <SectionCard number={4} title="Investment Detail">
            <div className="grid grid-cols-3 gap-4">
              <Field label="Customer" hint="Account/company name"><input className="input" value={customer} onChange={e => { setCustomer(e.target.value); markDirty() }} placeholder="e.g. Hans Anders, Krys" /></Field>
              <Field label="Vendor" required hint="External agency or supplier" error={errors.vendor} fieldKey="vendor"><input className="input" value={vendor} onChange={e => { setVendor(e.target.value); markDirty() }} placeholder="e.g. Altavia, TBC" /></Field>
              <Field label="Currency"><select className="input" value={currency} onChange={e => { setCurrency(e.target.value); markDirty() }}><option value="EUR">EUR</option><option value="GBP">GBP</option><option value="CHF">CHF</option><option value="USD">USD</option></select></Field>
              <Field label="# Customers" hint="Number of accounts (not stores)"><input type="number" className="input" value={numCustomers||''} min={0} onChange={e => { setNumCustomers(Number(e.target.value)); markDirty() }} placeholder="0" /></Field>
              {activityType && <Field label="# Doors (total)" hint="ONE total across ALL brands" error={errors.numDoors} fieldKey="numDoors"><input type="number" className="input" value={numDoors||''} min={0} onChange={e => { setNumDoors(Number(e.target.value)); markDirty() }} placeholder="0" /></Field>}
            </div>
            {showCostSplit && (
              <div className="mt-4 p-4 rounded-xl" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                <p className="section-heading mb-3">Cost Split — Lenses + Frames must equal 100%</p>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="% Lenses" error={errors.costSplit} fieldKey="costSplit"><PercentInput value={costSplitLenses} onChange={v => { setCostSplitLenses(v); markDirty() }} onComplement={c => setCostSplitFrames(c)} placeholder="30" /></Field>
                  <Field label="% Frames"><PercentInput value={costSplitFrames} onChange={v => { setCostSplitFrames(v); markDirty() }} onComplement={c => setCostSplitLenses(c)} placeholder="70" /></Field>
                </div>
                {costSplitLenses!=='' && costSplitFrames!=='' && <p className="text-xs mt-2" style={{ color: costSplitValid ? 'var(--green)' : 'var(--red)' }}>Total: {costSplitTotalPct}% {costSplitValid ? '✓' : '— must equal 100%'}</p>}
              </div>
            )}
            {isEvent && (
              <div className="mt-4 p-4 rounded-xl" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                <p className="section-heading mb-3">Forecasted Sales</p>
                <div className="grid grid-cols-3 gap-4">
                  <Field label="Lenses (€)"><input type="number" className="input" value={forecastedLenses||''} onChange={e => { setForecastedLenses(Number(e.target.value)); markDirty() }} placeholder="0" /></Field>
                  <Field label="Frames (€)"><input type="number" className="input" value={forecastedFrames||''} onChange={e => { setForecastedFrames(Number(e.target.value)); markDirty() }} placeholder="0" /></Field>
                  <Field label="Instruments (€)"><input type="number" className="input" value={forecastedInstruments||''} onChange={e => { setForecastedInstruments(Number(e.target.value)); markDirty() }} placeholder="0" /></Field>
                </div>
              </div>
            )}
          </SectionCard>

          <SectionCard number={5} title="Budget">
            {errors.q1 && <p className="text-xs mb-3" style={{ color: 'var(--red-text)' }}>{errors.q1}</p>}
            <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>Enter amounts in thousands of euros. Example: type 45 for €45,000.</p>
            <div className="grid grid-cols-3 gap-4" data-field="q1">
              {[{ label:'Q1 2026 (k€)', val:q1, set:setQ1 },{ label:'Q2 2026 (k€)', val:q2, set:setQ2 },{ label:'Q3 2026 (k€)', val:q3, set:setQ3 },{ label:'Q4 2026 (k€)', val:q4, set:setQ4 }].map(({ label, val, set }) => (
                <Field key={label} label={label}><KEurosInput value={val} onChange={n => { set(n); markDirty() }} placeholder="0" /></Field>
              ))}
            </div>

            {!showQ4_2025 && q4_2025 === 0 && (
              <button
                type="button"
                onClick={() => setShowQ4_2025(true)}
                className="mt-3 text-xs"
                style={{ color: 'var(--text-muted)', textDecoration: 'underline', textUnderlineOffset: '3px' }}
              >
                + Add Q4 2025 (post-event or carryover)
              </button>
            )}

            {(showQ4_2025 || q4_2025 > 0) && (
              <div className="mt-4 p-4 rounded-xl" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                <div className="flex items-center justify-between mb-2">
                  <p className="section-heading" style={{ margin: 0 }}>Q4 2025 (post-event or carryover)</p>
                  {q4_2025 === 0 && (
                    <button
                      type="button"
                      onClick={() => setShowQ4_2025(false)}
                      className="text-xs"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      Hide
                    </button>
                  )}
                </div>
                <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
                  Only fill if this LOA covers an event that already happened in Q4 2025 (Oct–Dec) or a carryover from a previous session.
                </p>
                <Field label="Q4 2025 (k€)">
                  <KEurosInput value={q4_2025} onChange={n => { setQ4_2025(n); markDirty() }} placeholder="0" />
                </Field>
              </div>
            )}
            <div className="grid grid-cols-3 gap-4 mt-4">
              <CalcField label="FY 2025 Total" value={formatEuros(fy2025Total)} />
              <CalcField label="FY 2026 Total" value={formatEuros(fyTotal)} highlight={pptRequired} />
              <CalcField label="Avg / Door" value={numDoors>0 ? formatEuros(avgPerDoor) : '—'} />
            </div>
            {pptRequired && <div className="mt-3 text-xs px-3 py-2 rounded-lg" style={{ background:'var(--green-bg)', color:'var(--green-text)', border:'1px solid var(--green-border)' }}>✓ FY 2026 total exceeds €50,000 — PPT slide will be automatically generated</div>}
            {fyTotal > 100_000 && (
              <div className="mt-4" data-field="costJustification">
                <Field label="Cost Justification" required hint="Required for investments over €100K — explain why this level of spend is needed" error={errors.costJustification} fieldKey="costJustification">
                  <textarea className="input resize-none" rows={3} value={costJustification} onChange={e => { setCostJustification(e.target.value); markDirty() }} placeholder="e.g. This investment covers 3 major seasonal campaigns across 400+ doors with proven 15% sell-out uplift from prior year" />
                </Field>
              </div>
            )}
          </SectionCard>

          <SectionCard number={6} title="Dates">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Start Date" required hint="When spend hits P&L" error={errors.startDate} fieldKey="startDate"><input type="date" className="input" value={startDate} onChange={e => { setStartDate(e.target.value); markDirty() }} /></Field>
              {!isPermanent ? (
                <Field label="End Date" required error={errors.endDate} fieldKey="endDate"><input type="date" className="input" value={endDate} onChange={e => { setEndDate(e.target.value); markDirty() }} /></Field>
              ) : (
                <div><label className="label">End Date</label><div className="input cursor-not-allowed text-xs" style={{ color:'var(--text-muted)', background:'var(--bg-elevated)' }}>Hidden — Permanent Visibility uses 01/01 → 31/12</div></div>
              )}
            </div>
          </SectionCard>

          <SectionCard number={7} title="Description & PPT Content">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Fill description, tools and KPI — or let LAURA suggest</p>
              <button onClick={fetchSuggestion} disabled={!activityType||category.length===0||!brand||loadingSuggestion} className="btn-secondary text-xs py-1.5 px-3 disabled:opacity-40">{loadingSuggestion ? 'Asking LAURA…' : '✦ Suggest with AI'}</button>
            </div>
            {suggestion && (
              <div className="rounded-xl p-4 mb-4 space-y-2" style={{ background:'var(--blue-bg)', border:'1px solid var(--blue-border)' }}>
                <p className="text-xs font-medium mb-2" style={{ color:'var(--blue-text)' }}>✦ LAURA suggests — click to re-apply individually</p>
                {(['description','kpi','tools'] as const).map(field => suggestion[field] && (
                  <button key={field} onClick={() => applySuggestion(field)} className="w-full text-left rounded-lg px-3 py-2 transition-colors" style={{ background:'var(--bg-surface)', border:'1px solid var(--blue-border)' }}>
                    <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color:'var(--blue-text)' }}>{field}</p>
                    <p className="text-xs" style={{ color:'var(--text-secondary)' }}>{suggestion[field]}</p>
                  </button>
                ))}
              </div>
            )}
            <div className="space-y-4">
              <Field label="Description (the WHY)" required hint='One sentence: the business objective.' error={errors.description} fieldKey="description">
                <div className="flex gap-2 items-start">
                  <textarea className="input resize-none flex-1" rows={3} value={description} onChange={e => { setDescription(e.target.value); setDescFeedback(null); markDirty() }} placeholder="e.g. Drive Varilux penetration among independent ECPs in France via targeted seasonal visibility" />
                  <VoiceInput onResult={t => { setDescription(prev => prev ? prev + ' ' + t : t); markDirty() }} />
                </div>
                <button onClick={checkDescription} disabled={checkingDesc||!description} className="text-xs mt-1 disabled:opacity-40 transition-colors" style={{ color:'var(--blue)' }}>{checkingDesc ? 'Checking…' : '✦ Check WHY vs WHAT with AI'}</button>
                {descFeedback && (
                  <div className="p-3 rounded-lg text-xs mt-2" style={{ background: descFeedback.is_valid ? 'var(--green-bg)' : 'var(--amber-bg)', color: descFeedback.is_valid ? 'var(--green-text)' : 'var(--amber-text)', border: `1px solid ${descFeedback.is_valid ? 'var(--green-border)' : 'var(--amber-border)'}` }}>
                    <p className="font-medium mb-1">{descFeedback.is_valid ? '✓ Good WHY statement' : '⚠ This reads as WHAT, not WHY'}</p>
                    <p>{descFeedback.feedback}</p>
                    {descFeedback.suggested_correction && (<div className="mt-2"><p className="opacity-70 mb-1">Suggested:</p><p className="italic">{descFeedback.suggested_correction}</p><button onClick={() => { setDescription(descFeedback.suggested_correction); setDescFeedback(null); markDirty() }} className="mt-2 text-xs px-2 py-1 rounded" style={{ background:'var(--amber)', color:'white' }}>Accept suggestion</button></div>)}
                  </div>
                )}
              </Field>
              <Field label="Detail / Tools (the HOW)" required hint="What exactly will the money be spent on" error={errors.detail} fieldKey="detail">
                <div className="flex gap-2 items-start"><textarea className="input resize-none flex-1" rows={3} value={detail} onChange={e => { setDetail(e.target.value); markDirty() }} placeholder="e.g. Seasonal POS materials · ECP staff training · Digital campaign support" /><VoiceInput onResult={t => { setDetail(prev => prev ? prev + ' ' + t : t); markDirty() }} /></div>
              </Field>
              <Field label="KPI" required={activityType!=='Others (non ADV)'} error={errors.kpi} fieldKey="kpi">
                <div className="flex gap-2 items-center"><input className="input flex-1" value={kpi} onChange={e => { setKpi(e.target.value); markDirty() }} placeholder="+12% sell-out uplift · 500 doors activated · 85% sell-through" /><VoiceInput onResult={t => { setKpi(prev => prev ? prev + ' ' + t : t); markDirty() }} /></div>
              </Field>
              <Field label="Cost Drill Down" required hint="Investment breakdown for PPT slide" error={errors.costDrillDown} fieldKey="costDrillDown">
                <textarea className="input resize-none" rows={2} value={costDrillDown} onChange={e => { setCostDrillDown(e.target.value); markDirty() }} placeholder="e.g. Space rental: 87K€ · Design & booth: 98K€ · Catering: 15K€" />
              </Field>
              <Field label="Timing"><input className="input" value={timing} onChange={e => { setTiming(e.target.value); markDirty() }} placeholder="e.g. H1 2026, Q1-Q2" /></Field>
              <div className="pt-4" style={{ borderTop: '1px solid var(--border)' }}><PhotoUpload ref={photoRef} loaId={loaId} onPhotosChange={setPhotos} /></div>
            </div>
          </SectionCard>

          <SectionCard number={8} title="Requestor">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Requestor Email" required error={errors.requestorEmail} fieldKey="requestorEmail"><input type="email" className="input" value={requestorEmail} onChange={e => { setRequestorEmail(e.target.value); markDirty() }} placeholder="your.name@essilor.com" /></Field>
              <Field label="Finance Validator Email" hint="New 2026 — Thibault to confirm routing"><input type="email" className="input" value={financeEmail} onChange={e => { setFinanceEmail(e.target.value); markDirty() }} placeholder="simona.smacchia@ae.luxottica.com" /></Field>
            </div>
          </SectionCard>

          <div className="flex gap-3 pb-6">
            <button onClick={handleReviewSubmit} disabled={saving} className="btn-primary">{saving ? 'Saving…' : isEditMode ? 'Save & resubmit' : 'Review & submit'}</button>
            <button onClick={() => handleSubmit(true)} disabled={saving} className="btn-secondary">{draftLabel}</button>
            <button onClick={handleBack} className="btn-secondary">Cancel</button>
          </div>
        </div>

        {/* RIGHT — sidebar */}
        <div className="flex flex-col gap-4 sticky top-20 self-start">
          {/* Sprint 4 #66 — Completion checklist */}
          <div className="card overflow-hidden order-0">
            <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}><span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Completion checklist</span></div>
            {(() => {
              const items: { label: string; done: boolean }[] = [
                { label: 'Cluster', done: !!cluster },{ label: 'Country', done: !!country },
                { label: 'Activity Type', done: !!activityType },{ label: 'COT', done: !!cot },
                { label: 'Category', done: category.length > 0 },{ label: 'Brand', done: !!brand },
                { label: 'Vendor', done: !!vendor },{ label: 'Budget (≥1 quarter)', done: fyTotal > 0 || fy2025Total > 0 },
                { label: 'Description (WHY)', done: !!description },{ label: 'Detail (HOW)', done: !!detail },
                { label: 'KPI', done: activityType === 'Others (non ADV)' || !!kpi },
                { label: 'Cost drill-down', done: !!costDrillDown },
                { label: 'Start date', done: !!startDate },{ label: 'End date', done: isPermanent || !!endDate },
                { label: 'Requestor email', done: !!requestorEmail },
              ]
              if (isEvent) { items.push({ label: 'Event type', done: !!eventType }); items.push({ label: 'Event purpose', done: !!eventPurpose }); items.push({ label: 'SAP Event Code', done: !!sapEventCode }) }
              if (['Permanent Visibility','Seasonal Visibility','Coop Advertising','Trade Incentive','Catalogues & Brochures'].includes(activityType)) items.push({ label: '# Doors', done: numDoors > 0 })
              if (fyTotal > 100_000) items.push({ label: 'Cost justification (>100K)', done: !!costJustification.trim() })
              const doneCount = items.filter(i => i.done).length; const total = items.length; const pct = Math.round((doneCount / total) * 100)
              return (
                <div className="px-4 py-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium" style={{ color: pct === 100 ? 'var(--green)' : 'var(--text-muted)' }}>{doneCount}/{total} complete</span>
                    <span className="text-xs" style={{ color: pct === 100 ? 'var(--green)' : 'var(--text-muted)' }}>{pct}%</span>
                  </div>
                  <div className="w-full rounded-full h-1.5 mb-3" style={{ background: 'var(--border)' }}><div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, background: pct === 100 ? 'var(--green)' : 'var(--accent)' }} /></div>
                  <div className="space-y-1">
                    {items.map(item => (
                      <div key={item.label} className="flex items-center gap-2 text-xs py-0.5">
                        <span style={{ color: item.done ? 'var(--green)' : 'var(--red)', fontSize: '10px', width: '14px', textAlign: 'center' }}>{item.done ? '✓' : '✗'}</span>
                        <span style={{ color: item.done ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: item.done ? 'line-through' : 'none', opacity: item.done ? 0.6 : 1 }}>{item.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}
          </div>

          <div className="card overflow-hidden order-2">
            <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
              <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>PPT slide preview</span>
              <button onClick={() => setShowPreview(true)} className="btn-ghost text-xs px-2 py-1">⤢ Expand</button>
            </div>
            <div className="m-3 rounded-lg overflow-hidden text-[10px]" style={{ border: '1px solid var(--border)' }}>
              <div className="px-3 py-1.5 flex justify-between" style={{ background: '#0D1B2A' }}>
                <span style={{ color: '#aaa' }}>{categoryLabel||'Category'}</span>
                <span className="font-semibold" style={{ color: 'white' }}>{country||'COUNTRY'} · {formatEuros(fyTotal)}</span>
              </div>
              <div className="px-3 py-1.5 font-semibold text-xs truncate" style={{ color:'var(--text-primary)', borderBottom:'1px solid var(--border)', background:'var(--bg-surface)' }}>{brand ? `${brand}: ` : ''}{detail||activityType||'Activity title'}</div>
              <div className="grid grid-cols-2 divide-x" style={{ borderColor: 'var(--border)' }}>
                <div className="px-3 py-3 space-y-2" style={{ background: 'var(--bg-surface)' }}>
                  {description && <div><p className="font-medium" style={{ color:'var(--text-muted)' }}>Description:</p><p style={{ color:'var(--text-secondary)' }} className="line-clamp-2">{description}</p></div>}
                  {tools && <div><p className="font-medium" style={{ color:'var(--text-muted)' }}>Tools:</p><p style={{ color:'var(--text-secondary)' }} className="line-clamp-2">{tools}</p></div>}
                  {kpi && <div><p className="font-medium" style={{ color:'var(--text-muted)' }}>KPI:</p><p style={{ color:'var(--text-secondary)' }}>{kpi}</p></div>}
                  {numDoors > 0 && <p className="font-medium" style={{ color:'var(--green)' }}>Avg: {formatEuros(avgPerDoor)} | #{numDoors} doors</p>}
                  {!description && !tools && !kpi && <p style={{ color:'var(--text-muted)' }} className="italic">Fill section 7 to preview</p>}
                </div>
                <div style={{ background: 'var(--bg-elevated)' }}>
                  {photos.length > 0 ? (
                    <div className="h-full flex flex-col">
                      {photos.map((p, i) => (<div key={p.index} className="flex-1 overflow-hidden min-h-[40px]" style={{ borderBottom: i < photos.length - 1 ? '1px solid var(--border)' : 'none' }}><img src={p.url} alt="" className="w-full h-full object-cover" /></div>))}
                      {photos.length < 2 && <div className="flex-1 flex items-center justify-center min-h-[40px]" style={{ color:'var(--text-muted)' }}>Photo 2</div>}
                    </div>
                  ) : (<div className="flex items-center justify-center min-h-[80px]" style={{ color:'var(--text-muted)' }}><p className="text-center px-2">Photos zone<br />(max 2)</p></div>)}
                </div>
              </div>
            </div>
          </div>

          <div className="card overflow-hidden order-1">
            <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}><span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Excel row preview</span></div>
            <div className="px-4 py-3 space-y-1.5 text-xs">
              {[['Cluster',cluster],['Country',country],['Activity',activityType],['Category',categoryLabel],['Brand',brand],['COT',cot],['Customer',customer],['Vendor',vendor],['Q4-25',q4_2025?formatEuros(q4_2025):'—'],['Q1-26',q1?formatEuros(q1):'—'],['Q2-26',q2?formatEuros(q2):'—'],['Q3-26',q3?formatEuros(q3):'—'],['Q4-26',q4?formatEuros(q4):'—']].map(([label,val]) => (
                <div key={label} className="flex justify-between"><span style={{ color:'var(--text-muted)' }}>{label}</span><span className="truncate max-w-[140px] text-right" style={{ color:'var(--text-primary)' }}>{val||'—'}</span></div>
              ))}
              <div className="pt-1.5 mt-1.5 space-y-1" style={{ borderTop:'1px solid var(--border)' }}>
                <div className="flex justify-between"><span style={{ color:'var(--text-muted)' }}>FY-26 total</span><span className="font-medium" style={{ color:'var(--green)' }}>{formatEuros(fyTotal)} ✓ auto</span></div>
                {numDoors>0 && <div className="flex justify-between"><span style={{ color:'var(--text-muted)' }}>Avg/door</span><span className="font-medium" style={{ color:'var(--green)' }}>{formatEuros(avgPerDoor)} ✓ auto</span></div>}
                <div className="flex justify-between"><span style={{ color:'var(--text-muted)' }}>PPT required</span><span className="font-medium" style={{ color: pptRequired ? 'var(--green)' : 'var(--text-muted)' }}>{pptRequired ? 'YES ✓ auto' : 'NO — auto'}</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sprint 4 #67 — Calm loading overlay */}
      {saving && createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, backgroundColor: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px' }}>
          <div className="w-10 h-10 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--border)', borderTopColor: '#2C3E5D' }} />
          <p style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)' }}>LAURA is saving your LOA...</p>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>This usually takes a few seconds</p>
        </div>,
        document.body
      )}

      {/* Sprint 4 #68 — Elegant success receipt */}
      {successReceipt && createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 10001, backgroundColor: 'var(--bg-primary, #ffffff)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
          <div style={{ textAlign: 'center', maxWidth: '440px', padding: '24px' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'rgba(34, 120, 80, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', fontSize: '28px' }}>✓</div>
            <h2 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '28px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>LOA {successReceipt.action}</h2>
            {successReceipt.draftId && <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '4px' }}>{successReceipt.draftId}</p>}
            <p style={{ fontSize: '15px', color: 'var(--text-primary)', marginBottom: '24px' }}>Budget: {formatEuros(successReceipt.budget)}</p>
            <div style={{ padding: '12px 20px', borderRadius: '10px', backgroundColor: 'rgba(34, 120, 80, 0.06)', border: '1px solid rgba(34, 120, 80, 0.15)', marginBottom: '32px' }}>
              <p style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{successReceipt.nextStep}</p>
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button onClick={() => router.push(`/loa/${successReceipt.loaId}`)} className="btn-primary text-sm" style={{ padding: '10px 24px' }}>View LOA</button>
              <button onClick={() => router.push('/')} className="btn-secondary text-sm" style={{ padding: '10px 24px' }}>Back to tracker</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      <ReviewBeforeSubmit
        open={showReview} onClose={() => setShowReview(false)} onConfirm={() => { setShowReview(false); handleSubmit(false) }}
        saving={saving} errors={errors} cluster={cluster} country={country} legalEntity={legalEntity}
        activityType={activityType} eventType={eventType} eventPurpose={eventPurpose} sapEventCode={sapEventCode}
        cot={cot} category={category} brand={brand} capexOpex={capexOpex} advSelling={advSelling} currency={currency}
        q4_2025={q4_2025} q1={q1} q2={q2} q3={q3} q4={q4} fyTotal={fyTotal} avgPerDoor={avgPerDoor} pptRequired={pptRequired}
        customer={customer} vendor={vendor} numCustomers={numCustomers} numDoors={numDoors}
        description={description} detail={detail} tools={tools} kpi={kpi} timing={timing}
        costDrillDown={costDrillDown} costJustification={costJustification} startDate={startDate} endDate={endDate} isPermanent={isPermanent}
        costSplitLenses={costSplitLenses} costSplitFrames={costSplitFrames}
        forecastedLenses={forecastedLenses} forecastedFrames={forecastedFrames} forecastedInstruments={forecastedInstruments}
        requestorEmail={requestorEmail} financeEmail={financeEmail} photos={photos}
      />
    </div>
  )
}
