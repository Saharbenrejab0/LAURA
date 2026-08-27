'use client'
/**
 * ExcelRowPanel — the top half: the submitted LOA as one spreadsheet row.
 *
 * It reads as a row, not a card grid: a single flex line on a hairline grey
 * ground, sized to its content and scrolled horizontally when it overflows.
 * Every cell is a comment anchor.
 */
import type { LOA } from '@/types/loa'
import { formatEuro, formatAmount } from '@/types/review'
import { PIN, ACTIVE_RING } from './anchors'
import { activityLabel } from '@/types/loa'

const MONO = "'IBM Plex Mono', ui-monospace, monospace"

interface Props {
  loa: LOA
  counts: Record<string, number>
  activeAnchor: string | null
  onAnchorSelect: (anchor: string | null) => void
  readOnly: boolean
  /** e.g. "session Q3-26 · row 12" */
  rowLabel: string
}

interface Cell {
  anchor: string
  label: string
  value: string
  /** Fixed cell width, px — the row scrolls rather than reflows. */
  w: number
  mono?: boolean
  strong?: boolean
}

function txt(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === '') return '—'
  return String(v)
}

function euro(v: number | null | undefined): string {
  return v === null || v === undefined ? '—' : formatEuro(v)
}

export default function ExcelRowPanel({
  loa, counts, activeAnchor, onAnchorSelect, readOnly, rowLabel,
}: Props) {
  const cells: Cell[] = [
    { anchor: 'field:sap_event_code',          label: 'SAP event code',    value: txt(loa.sap_event_code), w: 132, mono: true },
    { anchor: 'field:cluster',                 label: 'Cluster',           value: txt(loa.cluster), w: 96 },
    { anchor: 'field:country',                 label: 'Country',           value: txt(loa.country), w: 96 },
    { anchor: 'field:legal_entity',            label: 'Legal entity',      value: txt(loa.legal_entity), w: 150 },
    { anchor: 'field:category',                label: 'Category',          value: txt((loa.category || []).join(', ')), w: 118 },
    { anchor: 'field:activity_type',           label: 'Activity type',     value: txt(activityLabel(loa.activity_type)), w: 150 },
    { anchor: 'field:brand',                   label: 'Brand',             value: txt(loa.brand), w: 124 },
    { anchor: 'field:description',             label: 'Description',       value: txt(loa.description), w: 200 },
    { anchor: 'field:detail',                  label: 'Detail (HOW)',      value: txt(loa.detail), w: 200 },
    // The slide clamps these three to two lines; the row is where they read in full.
    { anchor: 'field:tools',                   label: 'Tools',             value: txt(loa.tools), w: 200 },
    { anchor: 'field:kpi',                     label: 'KPI',               value: txt(loa.kpi), w: 200 },
    { anchor: 'field:cost_drill_down',         label: 'Cost drill down',   value: txt(loa.cost_drill_down), w: 200 },
    { anchor: 'field:customer',                label: 'Customer',          value: txt(loa.customer), w: 150 },
    { anchor: 'field:vendor',                  label: 'Vendor',            value: txt(loa.vendor), w: 140 },
    { anchor: 'field:num_doors',               label: '# Doors',           value: loa.num_doors ? formatAmount(loa.num_doors) : '—', w: 80, mono: true },
    { anchor: 'field:num_customers',           label: '# PAX',             value: loa.num_customers ? formatAmount(loa.num_customers) : '—', w: 78, mono: true },
    { anchor: 'field:avg_investment_per_door', label: 'Avg inv / door',    value: euro(loa.avg_investment_per_door), w: 118, mono: true, strong: true },
    { anchor: 'field:fy_2026_total',           label: 'Total budget (€)',  value: euro(loa.fy_2026_total), w: 130, mono: true, strong: true },
    { anchor: 'field:capex_opex',              label: 'OPEX / CAPEX',      value: txt(loa.capex_opex), w: 108 },
    { anchor: 'field:adv_selling',             label: 'ADV / Selling',     value: txt(loa.adv_selling), w: 108 },
    { anchor: 'field:cot',                     label: 'Participant scope', value: txt(loa.cot), w: 150 },
    { anchor: 'field:timing',                  label: 'Quarter',           value: txt(loa.timing), w: 100 },
    { anchor: 'field:q4_2025',                 label: 'Q4 2025',           value: euro(loa.q4_2025), w: 104, mono: true },
    { anchor: 'field:q1_2026',                 label: 'Q1 2026',           value: euro(loa.q1_2026), w: 104, mono: true },
    { anchor: 'field:q2_2026',                 label: 'Q2 2026',           value: euro(loa.q2_2026), w: 104, mono: true },
    { anchor: 'field:q3_2026',                 label: 'Q3 2026',           value: euro(loa.q3_2026), w: 104, mono: true },
    { anchor: 'field:q4_2026',                 label: 'Q4 2026',           value: euro(loa.q4_2026), w: 104, mono: true },
  ]

  const hint = readOnly
    ? `As submitted${loa.submitted_at ? ` on ${new Date(loa.submitted_at).toLocaleDateString()}` : ''}`
    : 'Click any field to comment on it'

  return (
    <section className="la-ssr-excel">
      {/* Sub-header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '13px 22px 9px', flexShrink: 0, gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, minWidth: 0 }}>
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '.13em',
            textTransform: 'uppercase', color: 'var(--text-primary)', whiteSpace: 'nowrap',
          }}>
            Submitted data · Excel row
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {hint}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <span style={{ fontFamily: MONO, fontSize: 10, color: 'var(--text-faint)' }}>{rowLabel}</span>
          <span style={{ fontSize: 10, color: 'var(--text-dimmer)', whiteSpace: 'nowrap' }}>
            scroll for more →
          </span>
        </div>
      </div>

      <div style={{ flexShrink: 0 }}>
        <div className="excel-row-scroll" style={{ overflowX: 'auto', overflowY: 'hidden', padding: '0 22px 6px' }}>
            <div style={{
              display: 'flex', gap: 1, background: 'var(--border)',
              border: '1px solid var(--border-strong)', borderRadius: 10, padding: 1,
              width: 'max-content', minWidth: '100%',
            }}>
              {cells.map((c, i) => {
                const count = counts[c.anchor] || 0
                const on = activeAnchor === c.anchor
                const first = i === 0
                const last = i === cells.length - 1
                return (
                  <button
                    key={c.anchor}
                    data-anchor={c.anchor}
                    onClick={e => {
                      e.stopPropagation()
                      onAnchorSelect(on ? null : c.anchor)
                    }}
                    title={c.value.length > 60 ? c.value : readOnly ? c.value : `Comment on ${c.label.toLowerCase()}`}
                    style={{
                      width: c.w, flexShrink: 0,
                      background: on ? 'var(--surface-raised)' : 'var(--surface)',
                      boxShadow: on ? ACTIVE_RING : 'none',
                      border: 'none',
                      borderRadius: first ? '9px 0 0 9px' : last ? '0 9px 9px 0' : 0,
                      display: 'flex', flexDirection: 'column', gap: 5,
                      padding: '10px 11px 11px', cursor: 'pointer',
                      textAlign: 'left', fontFamily: 'inherit',
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                      <span style={{
                        fontSize: 8.5, fontWeight: 700, letterSpacing: '.09em',
                        textTransform: 'uppercase', color: 'var(--text-tertiary)', lineHeight: 1.3,
                      }}>
                        {c.label}
                      </span>
                      <span style={{
                        fontFamily: MONO, fontSize: 9, fontWeight: 500,
                        minWidth: 15, height: 15, borderRadius: 99,
                        background: count > 0 ? PIN.bg : 'transparent',
                        border: `1px solid ${count > 0 ? PIN.bd : 'transparent'}`,
                        color: count > 0 ? PIN.fg : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        {count > 0 ? count : ''}
                      </span>
                    </span>
                    <span style={{
                      fontSize: c.mono ? 12.5 : 12,
                      fontWeight: c.strong ? 600 : 500,
                      fontFamily: c.mono ? MONO : 'inherit',
                      color: c.value === '—' ? 'var(--text-dimmer)' : 'var(--text-primary)',
                      lineHeight: 1.35,
                      display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}>
                      {c.value}
                    </span>
                  </button>
                )
              })}
            </div>
        </div>
      </div>

    </section>
  )
}
