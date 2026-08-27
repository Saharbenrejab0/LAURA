'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createLOA, updateLOA, submitLOA, getLOA, getAISuggestion, validateDescription } from '@/lib/api'
import type { ActivityType, AISuggestion } from '@/types/loa'
import {
  CLUSTERS, CLUSTER_COUNTRIES, LEGAL_ENTITIES_BY_COUNTRY, BRAND_OPTIONS,
  ACTIVITY_TYPES, EVENT_TYPES, EVENT_PURPOSES, COT_OPTIONS, CATEGORY_OPTIONS,
  EVENT_ACTIVITY_TYPES, DOOR_ACTIVITY_TYPES, activityLabel,
} from '@/types/loa'
import PhotoUpload from '@/components/PhotoUpload'
import type { PhotoUploadRef } from '@/components/PhotoUpload'
import { useToast } from '@/components/Toast'
import VoiceInput from '@/components/VoiceInput'
import PreviewModal from '@/components/PreviewModal'
import ReviewBeforeSubmit from '@/components/ReviewBeforeSubmit'
import MultiSelect from '@/components/MultiSelect'
import LoaLineRows, {
  emptyLine, lineTotal, linesTotal, lineComplete,
  MIN_LINES, MAX_LINES,
  type LoaLine, type LoaKind,
} from '@/components/loa/LoaLineRows'
import { createPortal } from 'react-dom'
import { useAutoSave, clearDraft, scrollToFirstError, useLeaveConfirmation } from '@/components/useFormGuard'
import { slidePageCount, rowTotal, type SlideRow } from '@/lib/slideRows'
import {
  takeCarriedContext, WARNING_FIELD_TO_KEY, type CarriedContext,
} from '@/lib/campaign-library'
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

function Field({ label, required, hint, children, error, fieldKey, carried }: {
  label: string; required?: boolean; hint?: string; children: React.ReactNode; error?: string; fieldKey?: string
  /**
   * What "Use as starting point" did to this field, if anything.
   *
   * A cleared controlled value has to say WHY it is empty and WHAT was there
   * before, or the marketer just sees a blank required field on a form they did
   * not fill in. The text comes from the duplicate endpoint's own warnings, so
   * it names the historical value: "Cluster 'South Europe' not recognized."
   */
  carried?: { severity: string; message: string }
}) {
  const cleared = carried?.severity === 'invalid_cleared'
  return (
    <div data-field={fieldKey}>
      <label className="label">{label}{required && <span className="ml-0.5" style={{ color: 'var(--red)' }}>*</span>}</label>
      {children}
      {error && <p className="text-xs mt-1" style={{ color: 'var(--red-text)' }}>{error}</p>}
      {!error && carried && (
        <p className="text-xs mt-1" style={{ color: cleared ? 'var(--amber-text)' : 'var(--blue-text)' }}>
          {cleared ? '⚠ ' : '↺ '}{carried.message}
        </p>
      )}
      {!error && !carried && hint && <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{hint}</p>}
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
    <div id={`sec-${number}`} style={{ scrollMarginTop: 76 }}>
    <div className="card p-5">
      <div className="flex items-center gap-2.5 mb-5" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
        <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: 'var(--accent)', color: 'var(--accent-text)' }}>{number}</div>
        <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>{title}</h2>
      </div>
      {children}
    </div>
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

  // ── Arrived from the Campaign Library ─────────────────────────────────────
  //
  // `from=library` means this draft was just seeded by "Use as starting point".
  // The duplicate endpoint's per-field warnings were stashed in sessionStorage
  // by the library (different page, so the form never saw the response) and are
  // read exactly once here — a later manual edit of the same draft must not be
  // re-annotated as if it were fresh.
  const fromLibrary = searchParams.get('from') === 'library'
  const [carried, setCarried] = useState<CarriedContext | null>(null)
  useEffect(() => {
    if (!fromLibrary || !editId) return
    setCarried(takeCarriedContext(editId))
  }, [fromLibrary, editId])

  /** Warning for one form field, keyed by the form's own fieldKey. */
  const carriedByKey = useMemo(() => {
    const map: Record<string, { severity: string; message: string }> = {}
    for (const w of carried?.warnings ?? []) {
      const key = WARNING_FIELD_TO_KEY[w.field]
      // `empty_required` is not a carry-over problem — the field is simply
      // blank, and the normal required-field validation already says so.
      if (key && w.severity !== 'empty_required') {
        map[key] = { severity: w.severity, message: w.message }
      }
    }
    return map
  }, [carried])

  // Multi-row shape. Comes from the type selector as ?type=, and from the loaded
  // LOA in edit mode. 'standard' keeps every existing behaviour untouched.
  const typeParam = searchParams.get('type')
  const [loaType, setLoaType] = useState<'standard' | LoaKind>(
    typeParam === 'multi_brand' || typeParam === 'multi_activity' ? typeParam : 'standard'
  )
  const isMulti      = loaType !== 'standard'
  const isMultiBrand = loaType === 'multi_brand'
  const isMultiAct   = loaType === 'multi_activity'
  // Emergency LOA context — set when arriving from the tracker's emergency window.
  const isEmergencyNew = !isEditMode && searchParams.get('emergency') === '1'
  const emergencyCycleId = searchParams.get('cycle')
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
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
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

  // Per-brand / per-activity rows. Seeded with MIN_LINES blanks for a new multi LOA.
  const [lines, setLines] = useState<LoaLine[]>(() =>
    typeParam === 'multi_brand' || typeParam === 'multi_activity'
      ? Array.from({ length: MIN_LINES }, emptyLine)
      : []
  )

  const [refClusters, setRefClusters]           = useState<{id: number; name: string}[]>([])
  const [refCountries, setRefCountries]         = useState<{id: number; name: string}[]>([])
  const [refLegalEntities, setRefLegalEntities] = useState<{id: number; name: string}[]>([])
  const [refBrands, setRefBrands]               = useState<{id: number; code: string; name: string}[]>([])

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

  // Fetch clusters + brands once on mount
  useEffect(() => {
    fetch('/api/reference/clusters').then(r => r.json()).then(setRefClusters).catch(() => {})
    fetch('/api/reference/brands').then(r => r.json()).then(setRefBrands).catch(() => {})
  }, [])

  // Fetch countries whenever cluster changes or cluster list arrives
  useEffect(() => {
    if (!cluster || refClusters.length === 0) { setRefCountries([]); setRefLegalEntities([]); return }
    const c = refClusters.find(x => x.name === cluster)
    if (!c) return
    fetch(`/api/reference/countries?cluster_id=${c.id}`).then(r => r.json()).then(setRefCountries).catch(() => {})
    setRefLegalEntities([])
  }, [cluster, refClusters])

  // Fetch legal entities whenever country changes or country list arrives
  useEffect(() => {
    if (!country || refCountries.length === 0) { setRefLegalEntities([]); return }
    const c = refCountries.find(x => x.name === country)
    if (!c) return
    // In new-LOA mode, reset the field before fetching so stale values don't persist
    if (!isEditMode) setLegalEntity('')
    fetch(`/api/reference/legal-entities?country_id=${c.id}`)
      .then(r => r.json())
      .then((data: {id: number; name: string}[]) => {
        setRefLegalEntities(data)
        if (data.length === 1 && !isEditMode) setLegalEntity(data[0].name)
      })
      .catch(() => {})
  }, [country, refCountries, isEditMode])

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

        // Restore the multi-row shape from the loaded LOA, not the URL.
        const lt = ((loa as any).loa_type || 'standard') as 'standard' | LoaKind
        setLoaType(lt)
        const srcLines = (loa as any).lines
        if (lt !== 'standard' && Array.isArray(srcLines) && srcLines.length > 0) {
          setLines(srcLines.map((l: any) => ({
            brand:         l.brand || '',
            activityType:  l.activity_type || '',
            customer:      l.customer || '',
            vendor:        l.vendor || '',
            detail:        l.detail || '',
            numDoors:      l.num_doors || 0,
            q4_2025:       l.q4_2025 || 0,
            q1_2026:       l.q1_2026 || 0,
            q2_2026:       l.q2_2026 || 0,
            q3_2026:       l.q3_2026 || 0,
            q4_2026:       l.q4_2026 || 0,
            costDrillDown: l.cost_drill_down || '',
          })))
        }
        info(`Editing LOA ${loa.loa_draft_id}`)
      } catch { toastError('Could not load LOA — it may have been deleted'); router.push('/') }
      finally { setLoadingEdit(false) }
    }
    loadLOA()
  }, [editId])

  // On a multi-row LOA the budget lives on the rows, so the shared totals are
  // aggregates of the lines rather than the (hidden) shared quarter inputs.
  const linesFyTotal   = linesTotal(lines)
  const linesQ4_2025   = lines.reduce((s, l) => s + (l.q4_2025 || 0), 0)
  const linesDoorCount = lines.reduce((s, l) => s + (l.numDoors || 0), 0)

  const fyTotal     = isMulti ? linesFyTotal : q1 + q2 + q3 + q4
  const fy2025Total = isMulti ? linesQ4_2025 : q4_2025
  const doorCount   = isMulti ? linesDoorCount : numDoors
  const avgPerDoor  = doorCount > 0 ? fyTotal / doorCount : 0
  const pptRequired = fyTotal > 50_000
  const isEvent       = EVENT_ACTIVITY_TYPES.includes(activityType as ActivityType)
  const isPermanent   = activityType === 'TM_PERMANENT'
  const isSponsorship = activityType === 'SPONSORSHIP'
  const hasDoors      = !isSponsorship && DOOR_ACTIVITY_TYPES.includes(activityType as ActivityType)
  const showCostSplit = activityType === 'EVENTS'
  const availableBrands = refBrands.length > 0 ? refBrands.map(b => `${b.name} (${b.code})`) : BRAND_OPTIONS

  // ── What "Suggest with AI" sends, and when it is allowed ────────────────────
  //
  // Description / Tools / KPI are ONE set of fields per LOA, not per row, so a
  // multi-row LOA still gets exactly one suggestion. The axis that lives on the
  // rows is collapsed into a single joined string ("Ray-Ban (RB) + Oakley (OO)")
  // so the model sees every brand it has to write for.
  //
  // The gate used to be `!activityType || !brand`, which is dead in both multi
  // modes by construction: multi-brand leaves the shared `brand` empty (brands
  // are on the rows) and multi-activity leaves the shared `activityType` empty.
  // Either way one half of the condition was permanently true and the button
  // could never be clicked.
  // Codes, not labels — the backend resolves them to labels for the prompt and
  // keys the KPI templates off the codes.
  const aiActivityType = isMultiAct
    ? lines.map(l => l.activityType).filter(Boolean).join(' + ')
    : activityType
  const aiBrand = isMultiBrand
    ? lines.map(l => l.brand).filter(Boolean).join(' + ')
    : brand

  // Every row must be finished — axis, vendor and budget. A half-filled row
  // would give the model a brand with no money behind it and the text would be
  // written for the wrong split.
  const rowsReadyForAI = isMulti
    && lines.length >= MIN_LINES
    && lines.every(l => {
      const c = lineComplete(l, loaType as LoaKind)
      return c.axis && c.vendor && c.budget
    })

  const canSuggest = category.length > 0 && !!aiActivityType && !!aiBrand
    && (isMulti ? rowsReadyForAI : true)

  // ── Rows as the slide will draw them ───────────────────────────────────────
  // Empty on a standard LOA — the preview then treats the LOA itself as its one
  // row, which is what ppt.py's `_loa_rows` does.
  const previewRows: SlideRow[] = isMulti ? lines.map(l => ({
    brand:        isMultiBrand ? l.brand : brand,
    activityType: isMultiAct   ? l.activityType : activityType,
    customer:     l.customer,
    vendor:       l.vendor,
    detail:       l.detail,
    numDoors:     l.numDoors,
    q1: l.q1_2026, q2: l.q2_2026, q3: l.q3_2026, q4: l.q4_2026,
  })) : []

  /** Why the button is off, for the marketer. '' when it is on. */
  const suggestBlockedReason = canSuggest ? '' :
    category.length === 0 ? 'Pick a category first' :
    isMulti && !rowsReadyForAI ? `Finish all ${lines.length} rows first — brand, vendor and budget on each` :
    !aiActivityType ? 'Pick an activity type first' :
    !aiBrand ? 'Pick a brand first' : ''
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
    if (!canSuggest) return
    setLoadingSuggestion(true)
    try {
      // aiActivityType / aiBrand collapse the per-row axis into one string on a
      // multi-row LOA — see the comment where they are computed.
      const result = await getAISuggestion({ activity_type: aiActivityType, cluster, category, brand: aiBrand, fy_total: fyTotal, num_doors: doorCount })
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

  const DOOR_MANDATORY_TYPES: ActivityType[] = ['TM_PERMANENT', 'TM_SEASONAL', 'COOP_ADVERTISING', 'TRADE_INCENTIVE', 'CATALOGUES_BROCHURES']

  function validate(): boolean {
    const e: Record<string, string> = {}
    if (!cluster) e.cluster = 'Required'; if (!country) e.country = 'Required'
    if (!isMultiAct && !activityType) e.activityType = 'Required'; if (category.length === 0) e.category = 'Required'
    if (!isMultiBrand && !brand) e.brand = 'Required'; if (!cot) e.cot = 'Required'
    if (!requestorEmail) e.requestorEmail = 'Required'
    if (!description) e.description = 'Required — must answer WHY'
    if (!isMultiAct && !detail) e.detail = 'Required — must answer HOW'
    if (activityType !== 'OTHER' && !kpi) e.kpi = 'Required'
    if (!startDate) e.startDate = 'Required'; if (!isPermanent && !endDate) e.endDate = 'Required'
    if (isEvent && !eventType) e.eventType = 'Required'; if (isEvent && !eventPurpose) e.eventPurpose = 'Required'
    if (fyTotal === 0 && fy2025Total === 0) e.q1 = 'At least one quarterly value required'
    if (showCostSplit && !costSplitValid) e.costSplit = `Lenses + Frames must equal 100% (currently ${costSplitTotalPct}%)`
    if (fyTotal > 100_000 && !costJustification.trim()) e.costJustification = 'Required — explain why this investment exceeds €100K'
    if (!isMulti && !vendor) e.vendor = 'Required — vendor or agency name'
    if (!isMulti && !costDrillDown) e.costDrillDown = 'Required — investment breakdown'
    if (isEvent && !sapEventCode) e.sapEventCode = 'Required for Events — create in SAP first'
    if (!isMulti && DOOR_MANDATORY_TYPES.includes(activityType as ActivityType) && (!numDoors || numDoors <= 0)) e.numDoors = 'Required for this activity type'

    // Per-row rules for multi-brand / multi-activity.
    if (isMulti) {
      if (lines.length < MIN_LINES) {
        e.lines = `A ${isMultiBrand ? 'multi-brand' : 'multi-activity'} LOA needs at least ${MIN_LINES} rows.`
      } else if (lines.length > MAX_LINES) {
        e.lines = `At most ${MAX_LINES} rows.`
      } else {
        const bad: string[] = []
        lines.forEach((l, i) => {
          const c = lineComplete(l, loaType as LoaKind)
          const missing = [
            !c.axis   && (isMultiBrand ? 'brand' : 'activity type'),
            !c.vendor && 'vendor',
            !c.budget && 'budget',
          ].filter(Boolean)
          if (missing.length) bad.push(`Row ${i + 1}: ${missing.join(', ')}`)
        })
        if (bad.length) e.lines = `Incomplete rows — ${bad.join(' · ')}`
      }
    }

    setErrors(e); if (Object.keys(e).length > 0) scrollToFirstError(e); return Object.keys(e).length === 0
  }

  function buildPayload() {
    return {
      loa_type: loaType,
      // The axis that varies per row is omitted; the backend nulls it on the parent
      // and recomputes the shared budget totals from the lines.
      lines: isMulti ? lines.map((l, i) => ({
        position: i,
        brand:         isMultiBrand ? l.brand : undefined,
        activity_type: isMultiAct   ? l.activityType : undefined,
        customer: l.customer || undefined,
        vendor:   l.vendor   || undefined,
        detail:   l.detail   || undefined,
        num_doors: l.numDoors || undefined,
        cost_drill_down: l.costDrillDown || undefined,
        q4_2025: l.q4_2025||0, q1_2026: l.q1_2026||0, q2_2026: l.q2_2026||0,
        q3_2026: l.q3_2026||0, q4_2026: l.q4_2026||0,
      })) : [],
      cluster, country, legal_entity: legalEntity,
      activity_type: (isMultiAct ? '' : activityType) as ActivityType,
      event_type: eventType || undefined, event_purpose: eventPurpose || undefined, sap_event_code: sapEventCode || undefined,
      cot, category, brand: isMultiBrand ? '' : brand,
      capex_opex: capexOpex as any, adv_selling: advSelling as any,
      detail, description,
      customer: isMulti ? undefined : customer,
      vendor:   isMulti ? undefined : vendor,
      currency,
      num_customers: isMulti ? undefined : (numCustomers || undefined),
      num_doors:     isMulti ? undefined : (numDoors || undefined),
      q4_2025: isMulti ? 0 : (q4_2025||0),
      q1_2026: isMulti ? 0 : (q1||0), q2_2026: isMulti ? 0 : (q2||0),
      q3_2026: isMulti ? 0 : (q3||0), q4_2026: isMulti ? 0 : (q4||0),
      tools, kpi, timing, cost_drill_down: costDrillDown, cost_justification: costJustification || undefined,
      start_date: startDate || undefined, end_date: isPermanent ? '31/12/2026' : (endDate||undefined),
      cost_split_lenses: costSplitLenses!=='' ? Number(costSplitLenses) : undefined,
      cost_split_frames: costSplitFrames!=='' ? Number(costSplitFrames) : undefined,
      forecasted_lenses_sales: forecastedLenses||undefined, forecasted_frames_sales: forecastedFrames||undefined,
      forecasted_instruments_sales: forecastedInstruments||undefined,
      finance_validator_email: financeEmail||undefined, requestor_email: requestorEmail,
      ...(isEmergencyNew ? { is_emergency: true, cycle_id: emergencyCycleId || undefined } : {}),
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
      {showPreview && <PreviewModal isOpen={showPreview} onClose={() => setShowPreview(false)} category={categoryLabel} country={country} brand={brand} fyTotal={fyTotal} description={description} tools={tools} kpi={kpi} costDrillDown={costDrillDown} numDoors={doorCount} avgPerDoor={avgPerDoor} activityType={activityType} detail={detail} photos={photos}
        rows={previewRows} customer={customer} vendor={vendor} sapEventCode={sapEventCode} eventType={eventType} numCustomers={numCustomers} startDate={startDate} />}

      <header className="sticky top-0 z-20 px-6 py-3.5 flex items-center justify-between" style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{pageTitle}</span>
          {role && !isEditMode && role.role_scope_type === 'cluster' && (
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--blue-bg)', color: 'var(--blue-text)', border: '1px solid var(--blue-border)' }}>{role.role_scope_value?.join(', ')} scope</span>
          )}
          {isEditMode && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--amber-bg)', color: 'var(--amber-text)', border: '1px solid var(--amber-border)' }}>Editing</span>}
          {autoSaveAt && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>· Saved {autoSaveAt}</span>}
        </div>
        <div className="flex items-center gap-2">
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

      <div className="max-w-7xl mx-auto px-6 py-6 grid grid-cols-[150px_1fr_320px] gap-6">
          <nav className="hidden lg:grid gap-0.5 sticky self-start" style={{ top: 76 }}>
            {([[1,'Location'],[2,'Classification'],[3,'Product'],[4,'Investment'],[5,'Budget'],[6,'Dates'],[7,'Description'],[8,'Requestor']] as [number,string][]).map(([n,t]) => (
              <button key={n} type="button" onClick={() => document.getElementById(`sec-${n}`)?.scrollIntoView({behavior:'smooth',block:'start'})}
                style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 10px', borderRadius:8, border:'none', background:'transparent', cursor:'pointer', textAlign:'left', fontFamily:'var(--font-sans)', fontSize:12.5, color:'var(--text-secondary)' }}
                onMouseEnter={e => e.currentTarget.style.background='var(--surface-sunken)'}
                onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                <span style={{ fontFamily:'var(--font-mono)', fontSize:10.5, width:14, color:'var(--text-tertiary)' }}>{n}</span>
                <span>{t}</span>
              </button>
            ))}
          </nav>
        <div className="space-y-4">
          {/* ── Seeded from the Campaign Library ──────────────────────────────
              A cleared field with no explanation reads as a broken form, so say
              what came from where. Per-field detail is on the fields themselves;
              this is the summary and the "what was NOT carried" note. */}
          {carried && (
            <div style={{ padding: '12px 16px', borderRadius: 10, background: 'var(--blue-bg)', border: '1px solid var(--blue-border)', fontSize: 12.5, lineHeight: 1.6 }}>
              <p style={{ margin: 0, fontWeight: 600, color: 'var(--blue-text)' }}>
                ↺ Started from {carried.sourceKind === 'completed_cycle' ? 'a completed LAURA cycle' : 'imported history'}: “{carried.sourceTitle}”
              </p>
              <p style={{ margin: '6px 0 0', color: 'var(--text-secondary)' }}>
                Text, budget and classification were copied and are fully editable.{' '}
                <strong style={{ color: 'var(--text-primary)' }}>Dates were not carried</strong> — enter the new campaign&rsquo;s dates in section 6.
                {' '}Nothing from the original&rsquo;s approval history came with it: this is a fresh draft.
              </p>
              {(() => {
                const cleared = carried.warnings.filter(w => w.severity === 'invalid_cleared')
                const fixed   = carried.warnings.filter(w => w.severity === 'auto_fixed')
                if (cleared.length === 0 && fixed.length === 0) return null
                return (
                  <ul style={{ margin: '8px 0 0', paddingLeft: 18, color: 'var(--text-secondary)' }}>
                    {cleared.map((w, i) => (
                      <li key={`c${i}`} style={{ color: 'var(--amber-text)' }}>{w.message}</li>
                    ))}
                    {fixed.map((w, i) => (
                      <li key={`f${i}`}>{w.message}</li>
                    ))}
                  </ul>
                )
              })()}
            </div>
          )}

          {/* Laura preview — where this LOA lands in the deck (design 2d "will appear as" hint) */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 14px', borderRadius: 10, background: 'var(--bg-elevated)', border: '1px solid var(--border)', fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            <span style={{ color: 'var(--accent)', flex: 'none' }}>✦</span>
            <span>Will appear as <strong style={{ color: 'var(--text-primary)' }}>{[category.join(' / '), activityType, country].filter(Boolean).join(' › ') || 'Category › Activity › Country'}</strong>{brand ? <> · <strong style={{ color: 'var(--text-primary)' }}>{brand}</strong></> : null} — the slide title &amp; deck section come from the details below.</span>
          </div>
          <SectionCard number={1} title="Location">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Cluster" required error={errors.cluster} fieldKey="cluster" carried={carriedByKey.cluster}>
                <select className="input" value={cluster} onChange={e => { setCluster(e.target.value); markDirty() }}>
                  <option value="">Select cluster…</option>
                  {(refClusters.length > 0 ? refClusters.map(c => c.name) : Array.from(CLUSTERS)).map(name => <option key={name} value={name}>{name}</option>)}
                </select>
              </Field>
              <Field label="Country" required hint="Filters from cluster" error={errors.country} fieldKey="country" carried={carriedByKey.country}>
                <select className="input" value={country} onChange={e => { setCountry(e.target.value); markDirty() }} disabled={!cluster}>
                  <option value="">Select country…</option>
                  {(refCountries.length > 0 ? refCountries.map(c => c.name) : (CLUSTER_COUNTRIES[cluster] || [])).map(name => <option key={name} value={name}>{name}</option>)}
                </select>
              </Field>
              <Field label="Legal Entity" hint="Filters from country">
                <select className="input" value={legalEntity} onChange={e => { setLegalEntity(e.target.value); markDirty() }} disabled={!country}>
                  <option value="">Select legal entity…</option>
                  {(refLegalEntities.length > 0 ? refLegalEntities.map(e => e.name) : (LEGAL_ENTITIES_BY_COUNTRY[country] || [])).map(name => <option key={name} value={name}>{name}</option>)}
                </select>
              </Field>
            </div>
          </SectionCard>

          <SectionCard number={2} title="Activity Classification">
            <div className="grid grid-cols-2 gap-4">
              {/* Multi-activity: the type is per-row, not shared. */}
              {!isMultiAct && (
                <Field label="Activity Type" required error={errors.activityType} fieldKey="activityType" carried={carriedByKey.activityType}>
                  <select className="input" value={activityType} onChange={e => { setActivityType(e.target.value as ActivityType); markDirty() }}><option value="">Select type…</option>{ACTIVITY_TYPES.map(t => <option key={t} value={t}>{activityLabel(t)}</option>)}</select>
                </Field>
              )}
              <Field label="Channel of Trade (COT)" required error={errors.cot} fieldKey="cot" carried={carriedByKey.cot}>
                <select className="input" value={cot} onChange={e => { setCot(e.target.value); markDirty() }}>{COT_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}</select>
              </Field>
              {isEvent && (<>
                <Field label="Event Type" required error={errors.eventType} fieldKey="eventType" carried={carriedByKey.eventType}>
                  <select className="input" value={eventType} onChange={e => { setEventType(e.target.value); markDirty() }}><option value="">Select event type…</option>{EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select>
                </Field>
                <Field label="Event Purpose" required error={errors.eventPurpose} fieldKey="eventPurpose" carried={carriedByKey.eventPurpose}>
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
              {/* Multi-brand: the brand is per-row, not shared. */}
              {!isMultiBrand && (
                <Field label="Brand" required hint="Type name or SAP code" error={errors.brand} fieldKey="brand" carried={carriedByKey.brand}>
                  <SearchableSelect value={brand} onChange={v => { setBrand(v); markDirty() }} options={availableBrands} placeholder="Search brand…" />
                </Field>
              )}
            </div>
          </SectionCard>

          <SectionCard number={4} title="Investment Detail">
            <div className="grid grid-cols-3 gap-4">
              {/* Customer, Vendor, # Customers and # Doors are per-row on a multi LOA. */}
              {!isMulti && <Field label="Customer" hint="Account/company name"><input className="input" value={customer} onChange={e => { setCustomer(e.target.value); markDirty() }} placeholder="e.g. Hans Anders, Krys" /></Field>}
              {!isMulti && <Field label="Vendor" required hint="External agency or supplier" error={errors.vendor} fieldKey="vendor"><input className="input" value={vendor} onChange={e => { setVendor(e.target.value); markDirty() }} placeholder="e.g. Altavia, TBC" /></Field>}
              <Field label="Currency"><select className="input" value={currency} onChange={e => { setCurrency(e.target.value); markDirty() }}><option value="EUR">EUR</option><option value="GBP">GBP</option><option value="CHF">CHF</option><option value="USD">USD</option></select></Field>
              {!isMulti && <Field label="# Customers" hint="Number of accounts (not stores)"><input type="number" className="input" value={numCustomers||''} min={0} onChange={e => { setNumCustomers(Number(e.target.value)); markDirty() }} placeholder="0" /></Field>}
              {!isMulti && activityType && <Field label="# Doors (total)" hint="ONE total across ALL brands" error={errors.numDoors} fieldKey="numDoors"><input type="number" className="input" value={numDoors||''} min={0} onChange={e => { setNumDoors(Number(e.target.value)); markDirty() }} placeholder="0" /></Field>}
              {isMulti && <CalcField label="# Doors (all rows)" value={doorCount > 0 ? String(doorCount) : '—'} />}
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
            {/* Carried, not committed. Last year's spend is a starting number,
                not this year's ask, and it must not look approved. */}
            {carried && fyTotal > 0 && (
              <p className="text-xs mb-3" style={{ color: 'var(--blue-text)' }}>
                ↺ {formatEuros(fyTotal)} carried from “{carried.sourceTitle}” — a suggested figure. Review each quarter before submitting.
              </p>
            )}
            {errors.q1 && <p className="text-xs mb-3" style={{ color: 'var(--red-text)' }}>{errors.q1}</p>}
            {isMulti ? (
              <>
                <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
                  Budget is entered per row below — these totals are the sum of all {lines.length} rows.
                </p>
                <div className="grid grid-cols-4 gap-4" data-field="q1">
                  {([
                    ['Q1 2026', 'q1_2026'],
                    ['Q2 2026', 'q2_2026'],
                    ['Q3 2026', 'q3_2026'],
                    ['Q4 2026', 'q4_2026'],
                  ] as const).map(([label, key]) => (
                    <CalcField
                      key={key}
                      label={label}
                      value={formatEuros(lines.reduce((s, l) => s + (l[key] || 0), 0))}
                    />
                  ))}
                </div>
              </>
            ) : (
              <>
                <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>Enter amounts in thousands of euros. Example: type 45 for €45,000.</p>
                <div className="grid grid-cols-3 gap-4" data-field="q1">
                  {[{ label:'Q1 2026 (k€)', val:q1, set:setQ1 },{ label:'Q2 2026 (k€)', val:q2, set:setQ2 },{ label:'Q3 2026 (k€)', val:q3, set:setQ3 },{ label:'Q4 2026 (k€)', val:q4, set:setQ4 }].map(({ label, val, set }) => (
                    <Field key={label} label={label}><KEurosInput value={val} onChange={n => { set(n); markDirty() }} placeholder="0" /></Field>
                  ))}
                </div>
              </>
            )}

            {!isMulti && !showQ4_2025 && q4_2025 === 0 && (
              <button
                type="button"
                onClick={() => setShowQ4_2025(true)}
                className="mt-3 text-xs"
                style={{ color: 'var(--text-muted)', textDecoration: 'underline', textUnderlineOffset: '3px' }}
              >
                + Add Q4 2025 (post-event or carryover)
              </button>
            )}

            {!isMulti && (showQ4_2025 || q4_2025 > 0) && (
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
              <CalcField label="Avg / Door" value={doorCount>0 ? formatEuros(avgPerDoor) : '—'} />
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
              <button onClick={fetchSuggestion} disabled={!canSuggest||loadingSuggestion} title={suggestBlockedReason} className="btn-secondary text-xs py-1.5 px-3 disabled:opacity-40">{loadingSuggestion ? 'Asking LAURA…' : '✦ Suggest with AI'}</button>
            </div>
            {/* A disabled button with no reason next to it reads as broken — say why. */}
            {suggestBlockedReason && (
              <p className="text-xs -mt-2 mb-4" style={{ color: 'var(--amber-text, var(--text-muted))' }}>
                ✦ {suggestBlockedReason}
              </p>
            )}
            {isMulti && canSuggest && (
              <p className="text-xs -mt-2 mb-4" style={{ color: 'var(--text-muted)' }}>
                One suggestion covers all {lines.length} rows — LAURA is told about{' '}
                {isMultiBrand ? aiBrand : lines.map(l => activityLabel(l.activityType)).filter(Boolean).join(' + ')}.
              </p>
            )}
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
              <Field label="Description (the WHY)" required hint='One sentence: the business objective.' error={errors.description} fieldKey="description" carried={carriedByKey.description}>
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
              {/* Multi-activity: the HOW is per-row, entered as each row's Detail. */}
              {!isMultiAct && (
                <Field label="Detail / Tools (the HOW)" required hint="What exactly will the money be spent on" error={errors.detail} fieldKey="detail" carried={carriedByKey.detail}>
                  <div className="flex gap-2 items-start"><textarea className="input resize-none flex-1" rows={3} value={detail} onChange={e => { setDetail(e.target.value); markDirty() }} placeholder="e.g. Seasonal POS materials · ECP staff training · Digital campaign support" /><VoiceInput onResult={t => { setDetail(prev => prev ? prev + ' ' + t : t); markDirty() }} /></div>
                </Field>
              )}
              <Field label="KPI" required={activityType !== 'OTHER'} error={errors.kpi} fieldKey="kpi" carried={carriedByKey.kpi}>
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

          {/* Per-brand / per-activity rows — appended below the shared sections. */}
          {isMulti && (
            <LoaLineRows
              kind={loaType as LoaKind}
              lines={lines}
              onChange={next => { setLines(next); markDirty() }}
              brandOptions={availableBrands}
              activityOptions={ACTIVITY_TYPES as unknown as string[]}
              error={errors.lines}
            />
          )}

          <div className="flex gap-3 pb-6 items-center">
            <button onClick={handleReviewSubmit} disabled={saving} className="btn-primary">{saving ? 'Saving…' : isEditMode ? 'Save & resubmit' : 'Review & submit'}</button>
            <button onClick={() => handleSubmit(true)} disabled={saving} className="btn-secondary">{draftLabel}</button>
            <button onClick={handleBack} className="btn-secondary">Cancel</button>
            {isMulti && (
              <span className="ml-auto text-sm" style={{ color: 'var(--text-secondary)' }}>
                {lines.length} {lines.length === 1 ? 'row' : 'rows'} · {formatEuros(fyTotal)} requested
              </span>
            )}
          </div>
        </div>

        {/* RIGHT — sidebar */}
        <div className="flex flex-col gap-4 sticky top-20 self-start">
          {/* Sprint 4 #66 — Completion checklist */}
          <div className="card overflow-hidden order-0">
            <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}><span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Completion checklist</span></div>
            {(() => {
              if (!mounted) return null
              const items: { label: string; done: boolean }[] = [
                { label: 'Cluster', done: !!cluster },{ label: 'Country', done: !!country },
              ]
              if (!isMultiAct) items.push({ label: 'Activity Type', done: !!activityType })
              items.push({ label: 'COT', done: !!cot }, { label: 'Category', done: category.length > 0 })
              if (!isMultiBrand) items.push({ label: 'Brand', done: !!brand })
              if (!isMulti) items.push({ label: 'Vendor', done: !!vendor })
              items.push({ label: 'Budget (≥1 quarter)', done: fyTotal > 0 || fy2025Total > 0 })
              items.push({ label: 'Description (WHY)', done: !!description })
              if (!isMultiAct) items.push({ label: 'Detail (HOW)', done: !!detail })
              items.push({ label: 'KPI', done: activityType === 'OTHER' || !!kpi })
              if (!isMulti) items.push({ label: 'Cost drill-down', done: !!costDrillDown })
              items.push(
                { label: 'Start date', done: !!startDate },{ label: 'End date', done: isPermanent || !!endDate },
                { label: 'Requestor email', done: !!requestorEmail },
              )
              if (isEvent) { items.push({ label: 'Event type', done: !!eventType }); items.push({ label: 'Event purpose', done: !!eventPurpose }); items.push({ label: 'SAP Event Code', done: !!sapEventCode }) }
              if (!isMulti && DOOR_MANDATORY_TYPES.includes(activityType as ActivityType)) items.push({ label: '# Doors', done: numDoors > 0 })
              if (fyTotal > 100_000) items.push({ label: 'Cost justification (>100K)', done: !!costJustification.trim() })
              // One line per row — the denominator grows as rows are added.
              if (isMulti) {
                items.push({ label: `Rows (min ${MIN_LINES})`, done: lines.length >= MIN_LINES })
                lines.forEach((l, i) => {
                  const c = lineComplete(l, loaType as LoaKind)
                  const axisOk = c.axis, vOk = c.vendor, bOk = c.budget
                  items.push({
                    label: `Row ${i + 1}: ${axisOk ? '✓' : '✗'} ${isMultiBrand ? 'Brand' : 'Type'} ${vOk ? '✓' : '✗'} Vendor ${bOk ? '✓' : '✗'} Budget`,
                    done: axisOk && vOk && bOk,
                  })
                })
              }
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
              <div className="px-3 py-1.5 font-semibold text-xs truncate" style={{ color:'var(--text-primary)', borderBottom:'1px solid var(--border)', background:'var(--bg-surface)' }}>{brand ? `${brand}: ` : ''}{detail||activityLabel(activityType)||'Activity title'}{slidePageCount(previewRows.length || 1) > 1 ? ` (1 / ${slidePageCount(previewRows.length)})` : ''}</div>
              {/* The rows the slide's table will hold. One line each — the full
                  columns are in the Expand modal; this is the shape check. */}
              {previewRows.length > 0 && (
                <div style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' }}>
                  {previewRows.map((r, i) => (
                    <div key={i} className="px-3 py-1 flex justify-between gap-2" style={{ borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>
                      <span className="truncate" style={{ color:'var(--text-secondary)' }}>
                        {i + 1}. {(isMultiBrand ? r.brand : activityLabel(r.activityType)) || `Row ${i + 1}`}
                        {r.vendor ? ` · ${r.vendor}` : ''}
                      </span>
                      <span className="shrink-0" style={{ color:'var(--text-primary)' }}>{formatEuros(rowTotal(r))}</span>
                    </div>
                  ))}
                </div>
              )}
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
              {isMulti ? (
                <>
                  {/* One line per row — this is what lands in the slide's Excel table. */}
                  {[['Cluster',cluster],['Country',country],['Category',categoryLabel],['COT',cot],
                    ...(isMultiBrand ? [['Activity',activityType]] : [['Brand',brand]] as [string,string][]),
                  ].map(([label,val]) => (
                    <div key={label} className="flex justify-between"><span style={{ color:'var(--text-muted)' }}>{label}</span><span className="truncate max-w-[140px] text-right" style={{ color:'var(--text-primary)' }}>{val||'—'}</span></div>
                  ))}
                  <div className="pt-1.5 mt-1.5" style={{ borderTop:'1px solid var(--border)' }}>
                    <div className="mb-1" style={{ color:'var(--text-muted)' }}>
                      {lines.length} {lines.length === 1 ? 'row' : 'rows'}
                    </div>
                    {lines.map((l, i) => {
                      const axis = (isMultiBrand ? l.brand : l.activityType) || `Row ${i + 1}`
                      return (
                        <div key={i} className="flex justify-between py-0.5">
                          <span className="truncate max-w-[130px]" style={{ color:'var(--text-secondary)' }}>{i + 1}. {axis}</span>
                          <span style={{ color:'var(--text-primary)' }}>{formatEuros(lineTotal(l))}</span>
                        </div>
                      )
                    })}
                  </div>
                  <div className="pt-1.5 mt-1.5 space-y-1" style={{ borderTop:'1px solid var(--border)' }}>
                    <div className="flex justify-between"><span className="font-medium" style={{ color:'var(--text-primary)' }}>Grand total</span><span className="font-medium" style={{ color:'var(--green)' }}>{formatEuros(fyTotal)}</span></div>
                    {doorCount>0 && <div className="flex justify-between"><span style={{ color:'var(--text-muted)' }}>Avg/door</span><span className="font-medium" style={{ color:'var(--green)' }}>{formatEuros(avgPerDoor)} ✓ auto</span></div>}
                    {/* Page count comes from the same function the modal uses,
                        which mirrors ppt.py — not a re-typed `> 3`. */}
                    <div className="flex justify-between"><span style={{ color:'var(--text-muted)' }}>Slides</span><span className="font-medium" style={{ color:'var(--text-primary)' }}>{slidePageCount(lines.length) > 1 ? `${slidePageCount(lines.length)} (paginated)` : '1'}</span></div>
                    <div className="flex justify-between"><span style={{ color:'var(--text-muted)' }}>PPT required</span><span className="font-medium" style={{ color: pptRequired ? 'var(--green)' : 'var(--text-muted)' }}>{pptRequired ? 'YES ✓ auto' : 'NO — auto'}</span></div>
                  </div>
                </>
              ) : (
                <>
                  {[['Cluster',cluster],['Country',country],['Activity',activityType],['Category',categoryLabel],['Brand',brand],['COT',cot],['Customer',customer],['Vendor',vendor],['Q4-25',q4_2025?formatEuros(q4_2025):'—'],['Q1-26',q1?formatEuros(q1):'—'],['Q2-26',q2?formatEuros(q2):'—'],['Q3-26',q3?formatEuros(q3):'—'],['Q4-26',q4?formatEuros(q4):'—']].map(([label,val]) => (
                    <div key={label} className="flex justify-between"><span style={{ color:'var(--text-muted)' }}>{label}</span><span className="truncate max-w-[140px] text-right" style={{ color:'var(--text-primary)' }}>{val||'—'}</span></div>
                  ))}
                  <div className="pt-1.5 mt-1.5 space-y-1" style={{ borderTop:'1px solid var(--border)' }}>
                    <div className="flex justify-between"><span style={{ color:'var(--text-muted)' }}>FY-26 total</span><span className="font-medium" style={{ color:'var(--green)' }}>{formatEuros(fyTotal)} ✓ auto</span></div>
                    {numDoors>0 && <div className="flex justify-between"><span style={{ color:'var(--text-muted)' }}>Avg/door</span><span className="font-medium" style={{ color:'var(--green)' }}>{formatEuros(avgPerDoor)} ✓ auto</span></div>}
                    <div className="flex justify-between"><span style={{ color:'var(--text-muted)' }}>PPT required</span><span className="font-medium" style={{ color: pptRequired ? 'var(--green)' : 'var(--text-muted)' }}>{pptRequired ? 'YES ✓ auto' : 'NO — auto'}</span></div>
                  </div>
                </>
              )}
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
        loaType={loaType}
        lines={lines.map(l => ({
          axis:     isMultiBrand ? l.brand : l.activityType,
          customer: l.customer,
          vendor:   l.vendor,
          total:    lineTotal(l),
        }))}
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
