'use client'

import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

/* ═══════════════════════════════════════════════════════════════════════
   ReviewBeforeSubmit — Sprint 4 #28
   ═══════════════════════════════════════════════════════════════════════
   Full-screen modal that shows every LOA field before the user confirms
   submission. Missing / invalid fields are flagged visually so the user
   can go back and fix them without a rejection cycle.

   Props mirror the form state — no internal fetch, no side-effects.
   The parent controls open/close via `open` and calls `onConfirm` to
   actually run handleSubmit.
   ═══════════════════════════════════════════════════════════════════════ */

interface ReviewProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  saving: boolean
  cluster: string
  country: string
  legalEntity: string
  activityType: string
  eventType: string
  eventPurpose: string
  sapEventCode: string
  cot: string
  category: string[]
  brand: string
  capexOpex: string
  advSelling: string
  currency: string
  q4_2025: number
  q1: number
  q2: number
  q3: number
  q4: number
  fyTotal: number
  avgPerDoor: number
  pptRequired: boolean
  customer: string
  vendor: string
  numCustomers: number
  numDoors: number
  description: string
  detail: string
  tools: string
  kpi: string
  timing: string
  costDrillDown: string
  startDate: string
  endDate: string
  isPermanent: boolean
  costSplitLenses: number | ''
  costSplitFrames: number | ''
  forecastedLenses: number
  forecastedFrames: number
  forecastedInstruments: number
  requestorEmail: string
  financeEmail: string
  photos: { index: number; url: string }[]
  errors: Record<string, string>
}

/* ── Helpers ────────────────────────────────────────────────────────── */

function fmtEur(n: number): string {
  if (!n) return '—'
  if (n >= 1_000_000) return `€${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `€${Math.round(n / 1_000)}k`
  return `€${n.toLocaleString()}`
}

function pct(v: number | ''): string {
  if (v === '' || v === null || v === undefined) return '—'
  return `${Math.round(Number(v) * 100)}%`
}

/* ── Sub-components ─────────────────────────────────────────────────── */

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 style={{
      fontFamily: "'Cormorant Garamond', Georgia, serif",
      fontSize: '18px',
      fontWeight: 600,
      color: 'var(--text-primary)',
      marginBottom: '12px',
      paddingBottom: '8px',
      borderBottom: '1px solid var(--border)',
    }}>
      {children}
    </h3>
  )
}

function Field({ label, value, error, wide }: {
  label: string
  value: React.ReactNode
  error?: string
  wide?: boolean
}) {
  const isEmpty = !value || value === '—' || value === ''
  const hasError = !!error

  return (
    <div style={{
      gridColumn: wide ? '1 / -1' : undefined,
      padding: '10px 14px',
      borderRadius: '8px',
      backgroundColor: hasError
        ? 'rgba(220, 38, 38, 0.04)'
        : isEmpty
          ? 'rgba(180, 160, 130, 0.04)'
          : 'rgba(34, 120, 80, 0.03)',
      border: `1px solid ${hasError ? 'rgba(220, 38, 38, 0.2)' : 'var(--border)'}`,
      transition: 'all 0.15s ease',
    }}>
      <div style={{
        fontSize: '11px',
        fontWeight: 500,
        textTransform: 'uppercase' as const,
        letterSpacing: '0.04em',
        color: hasError ? '#dc2626' : 'var(--text-muted)',
        marginBottom: '4px',
        fontFamily: "'DM Sans', sans-serif",
      }}>
        {label}
        {hasError && (
          <span style={{ marginLeft: '8px', fontSize: '10px', fontWeight: 600 }}>
            — {error}
          </span>
        )}
      </div>
      <div style={{
        fontSize: '14px',
        color: isEmpty ? 'var(--text-muted)' : 'var(--text-primary)',
        fontFamily: "'DM Sans', sans-serif",
        fontStyle: isEmpty ? 'italic' : 'normal',
        lineHeight: 1.5,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}>
        {isEmpty ? 'Not provided' : value}
      </div>
    </div>
  )
}

function PhotoPreview({ photos }: { photos: { index: number; url: string }[] }) {
  if (photos.length === 0) {
    return (
      <div style={{
        padding: '24px',
        textAlign: 'center',
        color: 'var(--text-muted)',
        fontSize: '13px',
        fontStyle: 'italic',
        border: '1px dashed var(--border)',
        borderRadius: '8px',
      }}>
        No photos uploaded — slides look incomplete without at least one photo
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
      {photos.map((p) => (
        <div key={p.index} style={{
          width: '140px',
          height: '100px',
          borderRadius: '8px',
          overflow: 'hidden',
          border: '1px solid var(--border)',
        }}>
          <img
            src={p.url}
            alt={`Photo ${p.index + 1}`}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>
      ))}
    </div>
  )
}

/* ── Main component ─────────────────────────────────────────────────── */

export default function ReviewBeforeSubmit(props: ReviewProps) {
  const {
    open, onClose, onConfirm, saving, errors,
    cluster, country, legalEntity, activityType, eventType, eventPurpose,
    sapEventCode, cot, category, brand, capexOpex, advSelling, currency,
    q4_2025, q1, q2, q3, q4, fyTotal, avgPerDoor, pptRequired,
    customer, vendor, numCustomers, numDoors,
    description, detail, tools, kpi, timing, costDrillDown,
    startDate, endDate, isPermanent,
    costSplitLenses, costSplitFrames,
    forecastedLenses, forecastedFrames, forecastedInstruments,
    requestorEmail, financeEmail, photos,
  } = props

  const scrollRef = useRef<HTMLDivElement>(null)

  // Scroll to top when opening
  useEffect(() => {
    if (open) scrollRef.current?.scrollTo(0, 0)
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  const errorCount = Object.keys(errors).length
  const isEvent = ['Events', 'Medical Affairs'].includes(activityType)
  const categoryLabel = category.length > 0 ? category.join(' + ') : ''

  const quarters = [
    { label: 'Q4-25', value: q4_2025 },
    { label: 'Q1-26', value: q1 },
    { label: 'Q2-26', value: q2 },
    { label: 'Q3-26', value: q3 },
    { label: 'Q4-26', value: q4 },
  ]

  return createPortal(
    <div onClick={onClose} style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      backgroundColor: 'rgba(0, 0, 0, 0.3)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      overscrollBehavior: 'contain',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%',
        maxWidth: '820px',
        maxHeight: 'calc(100vh - 48px)',
        backgroundColor: 'var(--bg-primary, #ffffff)',
        borderRadius: '16px',
        boxShadow: '0 24px 48px rgba(0,0,0,0.12), 0 8px 16px rgba(0,0,0,0.06)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>

        {/* ── Header ──────────────────────────────────────────────── */}
        <div style={{
          padding: '24px 28px 20px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h2 style={{
                fontFamily: "'Cormorant Garamond', Georgia, serif",
                fontSize: '24px',
                fontWeight: 600,
                color: 'var(--text-primary)',
                margin: 0,
              }}>
                Review before submitting
              </h2>
              <p style={{
                fontSize: '13px',
                color: 'var(--text-muted)',
                marginTop: '4px',
                fontFamily: "'DM Sans', sans-serif",
              }}>
                {errorCount > 0
                  ? `${errorCount} field${errorCount > 1 ? 's' : ''} need${errorCount === 1 ? 's' : ''} attention before this LOA can be submitted.`
                  : 'Everything looks good. Review the details below and confirm.'}
              </p>
            </div>
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px 8px',
                fontSize: '20px',
                color: 'var(--text-muted)',
                borderRadius: '6px',
                lineHeight: 1,
              }}
              aria-label="Close review"
            >
              ✕
            </button>
          </div>

          {errorCount > 0 && (
            <div style={{
              marginTop: '14px',
              padding: '10px 14px',
              borderRadius: '8px',
              backgroundColor: 'rgba(220, 38, 38, 0.06)',
              border: '1px solid rgba(220, 38, 38, 0.15)',
              fontSize: '13px',
              color: '#b91c1c',
              fontFamily: "'DM Sans', sans-serif",
            }}>
              Close this review, fix the highlighted fields, and try again.
            </div>
          )}
        </div>

        {/* ── Scrollable body ─────────────────────────────────────── */}
        <div
          ref={scrollRef}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '24px 28px 28px',
          }}
        >
          {/* 1 · Identity */}
          <SectionTitle>Identity</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '28px' }}>
            <Field label="Cluster" value={cluster} error={errors.cluster} />
            <Field label="Country" value={country} error={errors.country} />
            <Field label="Legal entity" value={legalEntity} />
            <Field label="Activity type" value={activityType} error={errors.activityType} />
            <Field label="Category" value={categoryLabel} error={errors.category} />
            <Field label="Brand" value={brand} error={errors.brand} />
            <Field label="COT" value={cot} error={errors.cot} />
            <Field label="CapEx / OpEx" value={capexOpex} />
            <Field label="ADV / Selling" value={advSelling} />
            {isEvent && (
              <>
                <Field label="Event type" value={eventType} error={errors.eventType} />
                <Field label="Event purpose" value={eventPurpose} error={errors.eventPurpose} />
                <Field label="SAP Event Code" value={sapEventCode} error={errors.sapEventCode} />
              </>
            )}
          </div>

          {/* 2 · Stakeholders & targeting */}
          <SectionTitle>Stakeholders & targeting</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '28px' }}>
            <Field label="Customer" value={customer} />
            <Field label="Vendor" value={vendor} error={errors.vendor} />
            <Field label="Currency" value={currency} />
            <Field label="# Doors" value={numDoors > 0 ? numDoors.toLocaleString() : ''} error={errors.numDoors} />
            {isEvent && (
              <Field label="# Customers" value={numCustomers > 0 ? numCustomers.toLocaleString() : ''} />
            )}
            <Field label="Requestor" value={requestorEmail} error={errors.requestorEmail} />
            <Field label="Finance validator" value={financeEmail} />
          </div>

          {/* 3 · Budget */}
          <SectionTitle>Budget</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px', marginBottom: '12px' }}>
            {quarters.map(q => (
              <div key={q.label} style={{
                textAlign: 'center',
                padding: '10px 8px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                backgroundColor: q.value > 0 ? 'rgba(34, 120, 80, 0.03)' : 'transparent',
              }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', fontFamily: "'DM Sans', sans-serif" }}>
                  {q.label}
                </div>
                <div style={{ fontSize: '15px', fontWeight: 600, color: q.value > 0 ? 'var(--text-primary)' : 'var(--text-muted)', fontFamily: "'DM Sans', sans-serif" }}>
                  {q.value > 0 ? fmtEur(q.value) : '—'}
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '28px' }}>
            <div style={{ padding: '12px 14px', borderRadius: '8px', backgroundColor: 'rgba(34, 120, 80, 0.05)', border: '1px solid rgba(34, 120, 80, 0.15)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>FY-26 Total</div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>{fmtEur(fyTotal)}</div>
            </div>
            {avgPerDoor > 0 && (
              <div style={{ padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Avg / door</div>
                <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)' }}>{fmtEur(avgPerDoor)}</div>
              </div>
            )}
            <div style={{ padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>PPT slide</div>
              <div style={{ fontSize: '15px', fontWeight: 600, color: pptRequired ? '#16a34a' : 'var(--text-muted)' }}>
                {pptRequired ? 'Required (over €50k)' : 'Not required'}
              </div>
            </div>
            {(costSplitLenses !== '' || costSplitFrames !== '') && (
              <>
                <Field label="Cost split — Lenses" value={pct(costSplitLenses)} error={errors.costSplit} />
                <Field label="Cost split — Frames" value={pct(costSplitFrames)} />
              </>
            )}
            {forecastedLenses > 0 && <Field label="Forecast lenses sales" value={fmtEur(forecastedLenses)} />}
            {forecastedFrames > 0 && <Field label="Forecast frames sales" value={fmtEur(forecastedFrames)} />}
            {forecastedInstruments > 0 && <Field label="Forecast instruments sales" value={fmtEur(forecastedInstruments)} />}
          </div>

          {/* 4 · Content */}
          <SectionTitle>Slide content</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px', marginBottom: '28px' }}>
            <Field label="Description (WHY)" value={description} error={errors.description} wide />
            <Field label="Detail / Tools (HOW)" value={detail} error={errors.detail} wide />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
              <Field label="KPI" value={kpi} error={errors.kpi} />
              <Field label="Cost drill-down" value={costDrillDown} error={errors.costDrillDown} />
              <Field label="Tools / Materials" value={tools} />
              <Field label="Timing" value={timing || (
                isPermanent
                  ? `${startDate || '—'} → Permanent (31/12/2026)`
                  : `${startDate || '—'} → ${endDate || '—'}`
              )} />
            </div>
            <Field
              label="Start → End"
              value={isPermanent ? `${startDate || '—'} → Permanent` : `${startDate || '—'} → ${endDate || '—'}`}
              error={errors.startDate || errors.endDate}
            />
          </div>

          {/* 5 · Photos */}
          <SectionTitle>Photos</SectionTitle>
          <div style={{ marginBottom: '16px' }}>
            <PhotoPreview photos={photos} />
          </div>
        </div>

        {/* ── Footer (sticky) ─────────────────────────────────────── */}
        <div style={{
          padding: '18px 28px',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0,
          backgroundColor: 'var(--bg-primary, #ffffff)',
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              fontSize: '14px',
              fontFamily: "'DM Sans', sans-serif",
              fontWeight: 500,
              color: 'var(--text-muted)',
              backgroundColor: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            ← Back to editing
          </button>

          <button
            onClick={onConfirm}
            disabled={saving || errorCount > 0}
            style={{
              padding: '10px 28px',
              fontSize: '14px',
              fontFamily: "'DM Sans', sans-serif",
              fontWeight: 600,
              color: '#ffffff',
              backgroundColor: errorCount > 0 ? '#9ca3af' : '#2C3E5D',
              border: 'none',
              borderRadius: '8px',
              cursor: errorCount > 0 ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.7 : 1,
              transition: 'all 0.15s ease',
            }}
          >
            {saving ? 'Submitting…' : errorCount > 0 ? `Fix ${errorCount} issue${errorCount > 1 ? 's' : ''} first` : 'Confirm & submit'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
