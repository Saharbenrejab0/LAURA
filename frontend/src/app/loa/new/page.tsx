'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createLOA, submitLOA, getAISuggestion } from '@/lib/api'
import type { ActivityType, AISuggestion } from '@/types/loa'
import {
  CLUSTERS, CLUSTER_COUNTRIES, ACTIVITY_TYPES,
  EVENT_TYPES, COT_OPTIONS, CATEGORY_OPTIONS, BRAND_OPTIONS,
  EVENT_ACTIVITY_TYPES, DOOR_ACTIVITY_TYPES,
} from '@/types/loa'

// ---- Small helpers ----
function formatEuros(n: number) {
  if (!n) return '€0'
  if (n >= 1_000_000) return `€${(n / 1_000_000).toFixed(2)}M`
  return `€${n.toLocaleString('en-EU')}`
}

function Field({
  label, required, hint, children,
}: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-slate-600 mt-1">{hint}</p>}
    </div>
  )
}

function CalcField({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <label className="label">{label}</label>
      <div className="input bg-brand-dark text-green-400 font-medium cursor-default">{value}</div>
      {hint && <p className="text-xs text-green-800 mt-1">{hint}</p>}
    </div>
  )
}

// ---- Main form ----
export default function NewLOAPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [loaId, setLoaId] = useState<string | null>(null)

  // Form state
  const [cluster, setCluster] = useState('')
  const [country, setCountry] = useState('')
  const [legalEntity, setLegalEntity] = useState('')
  const [activityType, setActivityType] = useState<ActivityType | ''>('')
  const [eventType, setEventType] = useState('')
  const [cot, setCot] = useState('')
  const [category, setCategory] = useState('')
  const [brand, setBrand] = useState('')
  const [capexOpex, setCapexOpex] = useState('OpEx')
  const [advSelling, setAdvSelling] = useState('ADV')
  const [detail, setDetail] = useState('')
  const [customer, setCustomer] = useState('')
  const [vendor, setVendor] = useState('')
  const [currency, setCurrency] = useState('EUR')
  const [numDoors, setNumDoors] = useState<number>(0)
  const [q1, setQ1] = useState<number>(0)
  const [q2, setQ2] = useState<number>(0)
  const [q3, setQ3] = useState<number>(0)
  const [q4, setQ4] = useState<number>(0)
  const [description, setDescription] = useState('')
  const [tools, setTools] = useState('')
  const [kpi, setKpi] = useState('')
  const [timing, setTiming] = useState('')

  // AI suggestions
  const [suggestion, setSuggestion] = useState<AISuggestion | null>(null)
  const [loadingSuggestion, setLoadingSuggestion] = useState(false)

  // ---- Calculated fields (never editable) ----
  const fyTotal = q1 + q2 + q3 + q4
  const avgPerDoor = numDoors > 0 ? fyTotal / numDoors : 0
  const pptRequired = fyTotal > 50_000
  const isEventType = EVENT_ACTIVITY_TYPES.includes(activityType as ActivityType)
  const hasDoors = DOOR_ACTIVITY_TYPES.includes(activityType as ActivityType)

  // Reset country when cluster changes
  useEffect(() => { setCountry(''); setLegalEntity('') }, [cluster])

  // Auto-save draft when key fields are filled
  useEffect(() => {
    if (cluster && country && activityType && category && brand) {
      autoSave()
    }
  }, [cluster, country, activityType, category, brand])

  async function autoSave() {
    try {
      if (!loaId) {
        const loa = await createLOA({
          cluster, country, legal_entity: legalEntity,
          activity_type: activityType as ActivityType,
          cot, category, brand, capex_opex: capexOpex as any,
          adv_selling: advSelling as any, currency,
          requestor_email: '', // filled from JWT in backend
        })
        setLoaId(loa.id)
      }
    } catch (e) { /* silent auto-save failure is ok */ }
  }

  // Request AI suggestion when enough fields are set
  async function fetchSuggestion() {
    if (!activityType || !category || !brand) return
    setLoadingSuggestion(true)
    try {
      const result = await getAISuggestion({
        activity_type: activityType,
        cluster,
        category,
        brand,
        fy_total: fyTotal,
        num_doors: numDoors,
      })
      setSuggestion(result)
    } finally {
      setLoadingSuggestion(false)
    }
  }

  function applySuggestion(field: 'description' | 'kpi' | 'tools') {
    if (!suggestion) return
    if (field === 'description') setDescription(suggestion.description)
    if (field === 'kpi') setKpi(suggestion.kpi)
    if (field === 'tools') setTools(suggestion.tools)
  }

  async function handleSubmit() {
    setSaving(true)
    try {
      const id = loaId || (await createLOA({
        cluster, country, legal_entity: legalEntity,
        activity_type: activityType as ActivityType,
        cot, category, brand,
        capex_opex: capexOpex as any, adv_selling: advSelling as any,
        currency, num_doors: numDoors,
        q1_2026: q1, q2_2026: q2, q3_2026: q3, q4_2026: q4,
        description, tools, kpi, timing, detail, customer, vendor,
        requestor_email: '',
      })).id

      await submitLOA(id)
      router.push('/')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-brand-dark">
      <header className="border-b border-brand-border px-6 py-4 flex items-center gap-4">
        <button onClick={() => router.push('/')} className="text-slate-400 hover:text-white text-sm">
          ← Back
        </button>
        <span className="text-white font-medium">New LOA</span>
        {pptRequired && (
          <span className="badge bg-green-900 text-green-300 ml-auto">
            PPT slide required (over €50k)
          </span>
        )}
      </header>

      <div className="max-w-7xl mx-auto px-6 py-6 grid grid-cols-[1fr_340px] gap-6">

        {/* LEFT — form */}
        <div className="space-y-6">

          {/* Location */}
          <div className="card p-5">
            <h2 className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-4">
              Location
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Cluster" required>
                <select className="input" value={cluster} onChange={e => setCluster(e.target.value)}>
                  <option value="">Select cluster…</option>
                  {CLUSTERS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Country" required hint="Options filter from cluster">
                <select className="input" value={country} onChange={e => setCountry(e.target.value)} disabled={!cluster}>
                  <option value="">Select country…</option>
                  {(CLUSTER_COUNTRIES[cluster] || []).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Legal entity" hint="List provided by Finance">
                <input className="input" value={legalEntity} onChange={e => setLegalEntity(e.target.value)} placeholder="e.g. Essilor International" />
              </Field>
            </div>
          </div>

          {/* Activity */}
          <div className="card p-5">
            <h2 className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-4">
              Activity
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Type / Planning 2.0" required>
                <select className="input" value={activityType} onChange={e => setActivityType(e.target.value as ActivityType)}>
                  <option value="">Select type…</option>
                  {ACTIVITY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
              {isEventType && (
                <Field label="Event type">
                  <select className="input" value={eventType} onChange={e => setEventType(e.target.value)}>
                    <option value="">Select…</option>
                    {EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </Field>
              )}
              <Field label="COT" required>
                <select className="input" value={cot} onChange={e => setCot(e.target.value)}>
                  <option value="">Select channel…</option>
                  {COT_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </Field>
              <Field label="Category" required>
                <select className="input" value={category} onChange={e => setCategory(e.target.value)}>
                  <option value="">Select…</option>
                  {CATEGORY_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </Field>
              <Field label="Brand" required>
                <select className="input" value={brand} onChange={e => setBrand(e.target.value)}>
                  <option value="">Select…</option>
                  {BRAND_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </Field>
              <Field label="P&L line">
                <div className="flex gap-2">
                  <select className="input" value={capexOpex} onChange={e => setCapexOpex(e.target.value)}>
                    <option value="OpEx">OpEx</option>
                    <option value="CapEx">CapEx</option>
                  </select>
                  <select className="input" value={advSelling} onChange={e => setAdvSelling(e.target.value)}>
                    <option value="ADV">ADV</option>
                    <option value="Selling">Selling</option>
                    <option value="Others">Others</option>
                  </select>
                </div>
              </Field>
            </div>
          </div>

          {/* Investment */}
          <div className="card p-5">
            <h2 className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-4">
              Investment
            </h2>
            <div className="grid grid-cols-3 gap-4">
              {hasDoors && (
                <Field label="# Doors">
                  <input type="number" className="input" value={numDoors || ''} onChange={e => setNumDoors(Number(e.target.value))} placeholder="0" min={0} />
                </Field>
              )}
              <Field label="Vendor">
                <input className="input" value={vendor} onChange={e => setVendor(e.target.value)} placeholder="Vendor name" />
              </Field>
              <Field label="Customer">
                <input className="input" value={customer} onChange={e => setCustomer(e.target.value)} placeholder="Account name" />
              </Field>
              <Field label="Q1-26 (€)">
                <input type="number" className="input" value={q1 || ''} onChange={e => setQ1(Number(e.target.value))} placeholder="0" min={0} />
              </Field>
              <Field label="Q2-26 (€)">
                <input type="number" className="input" value={q2 || ''} onChange={e => setQ2(Number(e.target.value))} placeholder="0" min={0} />
              </Field>
              <Field label="Q3-26 (€)">
                <input type="number" className="input" value={q3 || ''} onChange={e => setQ3(Number(e.target.value))} placeholder="0" min={0} />
              </Field>
              <Field label="Q4-26 (€)">
                <input type="number" className="input" value={q4 || ''} onChange={e => setQ4(Number(e.target.value))} placeholder="0" min={0} />
              </Field>
              <CalcField
                label="FY-26 total"
                value={formatEuros(fyTotal)}
                hint="Auto: sum of quarters"
              />
              {hasDoors && numDoors > 0 && (
                <CalcField
                  label="Avg invest / door"
                  value={formatEuros(avgPerDoor)}
                  hint="Auto: FY total ÷ doors"
                />
              )}
            </div>
          </div>

          {/* PPT content */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                PPT content
              </h2>
              <button
                onClick={fetchSuggestion}
                disabled={!activityType || !category || !brand || loadingSuggestion}
                className="btn-secondary text-xs py-1 px-3"
              >
                {loadingSuggestion ? 'Asking LAURA…' : '✦ Ask LAURA to suggest'}
              </button>
            </div>

            {/* AI suggestion panel */}
            {suggestion?.success && (
              <div className="bg-blue-950 border border-blue-800 rounded-lg p-4 mb-4 space-y-3">
                <p className="text-xs font-medium text-blue-300">LAURA suggests — click to apply</p>
                {(['description', 'kpi', 'tools'] as const).map(field => (
                  suggestion[field] && (
                    <button
                      key={field}
                      onClick={() => applySuggestion(field)}
                      className="w-full text-left bg-blue-900/40 hover:bg-blue-900/70 border border-blue-800 
                                 rounded-lg px-3 py-2 transition-colors"
                    >
                      <p className="text-xs text-blue-400 font-medium uppercase mb-1">{field}</p>
                      <p className="text-xs text-slate-300">{suggestion[field]}</p>
                    </button>
                  )
                ))}
              </div>
            )}

            <div className="space-y-4">
              <Field label="Description" hint="The WHY in 1 sentence (Vanessa rule)">
                <textarea
                  className="input resize-none"
                  rows={2}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="e.g. Maximize Essilor Stellest visibility in-store across key Expert partners"
                />
              </Field>
              <Field label="Tools">
                <textarea className="input resize-none" rows={3} value={tools} onChange={e => setTools(e.target.value)} placeholder="• Window kit&#10;• Instore materials" />
              </Field>
              <Field label="KPI">
                <input className="input" value={kpi} onChange={e => setKpi(e.target.value)} placeholder="+10-15% sell-out increase" />
              </Field>
              <Field label="Timing">
                <input className="input" value={timing} onChange={e => setTiming(e.target.value)} placeholder="H1 2026" />
              </Field>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pb-6">
            <button onClick={handleSubmit} disabled={saving || !cluster || !country || !activityType} className="btn-primary">
              {saving ? 'Submitting…' : 'Submit LOA'}
            </button>
            <button onClick={() => autoSave()} className="btn-secondary">
              Save draft
            </button>
          </div>
        </div>

        {/* RIGHT — live preview */}
        <div className="space-y-4 sticky top-6 self-start">
          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-brand-border flex items-center justify-between">
              <span className="text-sm font-medium text-white">PPT slide preview</span>
              <span className="text-xs text-slate-500">live</span>
            </div>
            {/* Mini slide */}
            <div className="m-3 border border-brand-border rounded overflow-hidden text-[10px]">
              <div className="bg-slate-900 px-3 py-1.5 flex justify-between">
                <span className="text-slate-400">{category || 'Frames / Lenses'}</span>
                <span className="font-semibold text-white">
                  {country || 'COUNTRY'} · {formatEuros(fyTotal)}
                </span>
              </div>
              <div className="px-3 py-1.5 font-semibold text-white border-b border-brand-border text-xs">
                {detail || activityType || 'Activity title'}
              </div>
              <div className="grid grid-cols-2 divide-x divide-brand-border">
                <div className="px-3 py-3 space-y-2">
                  <div>
                    <p className="text-slate-500 font-medium">Description:</p>
                    <p className="text-slate-300">{description || '—'}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 font-medium">Tools:</p>
                    <p className="text-slate-300 whitespace-pre-line">{tools || '—'}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 font-medium">KPI:</p>
                    <p className="text-slate-300">{kpi || '—'}</p>
                  </div>
                  {hasDoors && (
                    <div>
                      <p className="text-green-600 font-medium">
                        Avg/door: {formatEuros(avgPerDoor)} | #{numDoors} doors
                      </p>
                    </div>
                  )}
                </div>
                <div className="bg-brand-dark flex items-center justify-center min-h-[80px]">
                  <p className="text-slate-600 text-center px-2">
                    Photos zone<br />(max 2)
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Excel row preview */}
          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-brand-border">
              <span className="text-sm font-medium text-white">Excel row preview</span>
            </div>
            <div className="px-4 py-3 space-y-1.5 text-xs">
              {[
                ['Cluster', cluster],
                ['Country', country],
                ['Type', activityType],
                ['Category', category],
                ['Brand', brand],
                ['Q1-26', q1 ? formatEuros(q1) : '—'],
                ['Q2-26', q2 ? formatEuros(q2) : '—'],
                ['Q3-26', q3 ? formatEuros(q3) : '—'],
                ['Q4-26', q4 ? formatEuros(q4) : '—'],
              ].map(([label, val]) => (
                <div key={label} className="flex justify-between">
                  <span className="text-slate-500">{label}</span>
                  <span className="text-slate-200">{val || '—'}</span>
                </div>
              ))}
              <div className="border-t border-brand-border pt-1.5 mt-1.5 space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">FY-26 total</span>
                  <span className="text-green-400 font-medium">{formatEuros(fyTotal)} ✓ auto</span>
                </div>
                {hasDoors && numDoors > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Avg/door</span>
                    <span className="text-green-400 font-medium">{formatEuros(avgPerDoor)} ✓ auto</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-500">PPT required</span>
                  <span className={pptRequired ? 'text-green-400 font-medium' : 'text-slate-600'}>
                    {pptRequired ? 'YES ✓ auto' : 'NO — auto'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
