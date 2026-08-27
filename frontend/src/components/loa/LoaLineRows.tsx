'use client'

/**
 * LAURA — per-brand / per-activity rows.
 *
 * The section a multi-brand or multi-activity LOA adds below the standard form.
 * Each row becomes one `loa_line` on the backend, one row in the Excel table on
 * the slide, and one row in the CFO spreadsheet.
 *
 * The axis field is a brand (multi_brand) or an activity type (multi_activity);
 * every other field is the same in both modes.
 */

import { useState } from 'react'

export interface LoaLine {
  brand: string
  activityType: string
  customer: string
  vendor: string
  detail: string
  numDoors: number
  q4_2025: number
  q1_2026: number
  q2_2026: number
  q3_2026: number
  q4_2026: number
  costDrillDown: string
}

export type LoaKind = 'multi_brand' | 'multi_activity'

export const MIN_LINES = 2
export const MAX_LINES = 12

export function emptyLine(): LoaLine {
  return {
    brand: '', activityType: '', customer: '', vendor: '', detail: '',
    numDoors: 0, q4_2025: 0, q1_2026: 0, q2_2026: 0, q3_2026: 0, q4_2026: 0,
    costDrillDown: '',
  }
}

export function lineTotal(l: LoaLine): number {
  return (l.q1_2026 || 0) + (l.q2_2026 || 0) + (l.q3_2026 || 0) + (l.q4_2026 || 0)
}

export function linesTotal(lines: LoaLine[]): number {
  return lines.reduce((s, l) => s + lineTotal(l), 0)
}

/** A row is complete when its axis, vendor and at least one quarter are filled. */
export function lineComplete(l: LoaLine, kind: LoaKind) {
  const axis = kind === 'multi_brand' ? l.brand : l.activityType
  return {
    axis:   !!axis,
    vendor: !!l.vendor,
    budget: lineTotal(l) > 0 || (l.q4_2025 || 0) > 0,
  }
}

function fmtEuro(n: number) {
  if (!n) return '€0'
  return '€' + Math.round(n).toLocaleString('en-GB').replace(/,/g, '.')
}

/** K€ input — mirrors the KEurosInput pattern used by the form's budget section. */
function KEuros({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const shown = value ? value / 1000 : ''
  return (
    <div style={{ position: 'relative' }}>
      <input
        type="number" className="input" min={0} step="0.1" placeholder="0"
        style={{ paddingRight: 26, fontSize: 13 }}
        value={shown}
        onChange={e => {
          const v = e.target.value
          onChange(v === '' ? 0 : Math.round(Number(v) * 1000))
        }}
      />
      <span style={{
        position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)',
        color: 'var(--text-muted)', fontSize: 12, pointerEvents: 'none',
      }}>k</span>
    </div>
  )
}

function Searchable({ value, onChange, options, placeholder }: {
  value: string; onChange: (v: string) => void; options: string[]; placeholder: string
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const filtered = options.filter(o => o.toLowerCase().includes(q.toLowerCase()))
  return (
    <div style={{ position: 'relative' }}>
      <div
        className="input"
        style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}
        onClick={() => setOpen(o => !o)}
      >
        <span style={{ color: value ? 'var(--text-primary)' : 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {value || placeholder}
        </span>
        <span style={{ color: 'var(--text-muted)', fontSize: 10, flex: 'none', marginLeft: 6 }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => { setOpen(false); setQ('') }} />
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
            background: 'var(--bg-surface)', border: '1px solid var(--border-strong)',
            borderRadius: '0 0 10px 10px', boxShadow: 'var(--shadow-md)',
            maxHeight: 220, overflow: 'hidden', display: 'flex', flexDirection: 'column',
          }}>
            <input
              autoFocus className="input" placeholder="Search…" value={q}
              style={{ borderRadius: 0, borderBottom: '1px solid var(--border)', flexShrink: 0 }}
              onChange={e => setQ(e.target.value)}
              onClick={e => e.stopPropagation()}
            />
            <div style={{ overflowY: 'auto' }}>
              {filtered.length === 0 && (
                <div style={{ padding: '10px 12px', fontSize: 13, color: 'var(--text-muted)' }}>No results</div>
              )}
              {filtered.map(o => (
                <div
                  key={o} className="select-option"
                  style={{ background: o === value ? 'var(--bg-elevated)' : undefined, fontWeight: o === value ? 500 : undefined }}
                  onClick={() => { onChange(o); setOpen(false); setQ('') }}
                >{o}</div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

interface Props {
  kind: LoaKind
  lines: LoaLine[]
  onChange: (lines: LoaLine[]) => void
  brandOptions: string[]
  activityOptions: string[]
  /** Axis values already used on other rows are hidden from a row's dropdown. */
  error?: string
}

export default function LoaLineRows({
  kind, lines, onChange, brandOptions, activityOptions, error,
}: Props) {
  const [confirmRemove, setConfirmRemove] = useState<number | null>(null)
  const [openDrill, setOpenDrill] = useState<Set<number>>(new Set())

  const isBrand = kind === 'multi_brand'
  const axisLabel = isBrand ? 'Brand' : 'Activity Type'
  const total = linesTotal(lines)

  function patch(i: number, p: Partial<LoaLine>) {
    onChange(lines.map((l, idx) => (idx === i ? { ...l, ...p } : l)))
  }

  function add() {
    if (lines.length >= MAX_LINES) return
    onChange([...lines, emptyLine()])
  }

  function remove(i: number) {
    onChange(lines.filter((_, idx) => idx !== i))
    setConfirmRemove(null)
  }

  function requestRemove(i: number) {
    const l = lines[i]
    const hasData = !!(l.brand || l.activityType || l.customer || l.vendor || l.detail
      || l.costDrillDown || lineTotal(l) > 0 || l.numDoors)
    if (hasData) setConfirmRemove(i)
    else remove(i)
  }

  function move(i: number, dir: -1 | 1) {
    const j = i + dir
    if (j < 0 || j >= lines.length) return
    const next = [...lines]
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }

  function toggleDrill(i: number) {
    setOpenDrill(prev => {
      const n = new Set(prev)
      if (n.has(i)) n.delete(i); else n.add(i)
      return n
    })
  }

  /** Options for row i, minus axis values taken by other rows. */
  function optionsFor(i: number) {
    const all = isBrand ? brandOptions : activityOptions
    const taken = new Set(
      lines.map((l, idx) => (idx === i ? null : (isBrand ? l.brand : l.activityType)))
        .filter(Boolean) as string[]
    )
    const mine = isBrand ? lines[i].brand : lines[i].activityType
    return all.filter(o => !taken.has(o) || o === mine)
  }

  return (
    <div id="sec-rows" style={{ scrollMarginTop: 76 }}>
      <div className="card p-5">
        {/* Header */}
        <div
          className="flex items-center gap-2.5 mb-5"
          style={{ borderBottom: '1px solid var(--border)', paddingBottom: 12 }}
        >
          <div
            className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
            style={{ background: 'var(--accent)', color: 'var(--accent-text)' }}
          >≡</div>
          <h2
            className="text-xs font-semibold uppercase tracking-widest"
            style={{ color: 'var(--text-muted)', flex: 1 }}
          >
            {isBrand ? 'Per-brand rows' : 'Per-activity rows'}
          </h2>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            {lines.length} {lines.length === 1 ? 'row' : 'rows'} · {fmtEuro(total)} requested
          </span>
        </div>

        {error && (
          <p className="text-xs mb-3" style={{ color: 'var(--red-text)' }}>{error}</p>
        )}

        {/* Rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {lines.map((l, i) => {
            const done = lineComplete(l, kind)
            const rowTotal = lineTotal(l)
            const drillOpen = openDrill.has(i)
            const axisName = (isBrand ? l.brand : l.activityType) || `Row ${i + 1}`
            return (
              <div
                key={i}
                style={{
                  position: 'relative', padding: 16, borderRadius: 12,
                  background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                }}
              >
                {/* Row header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <div
                    className="flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{
                      width: 20, height: 20, borderRadius: 99,
                      background: 'var(--accent)', color: 'var(--accent-text)',
                    }}
                  >{i + 1}</div>
                  <span style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text-primary)', flex: 1 }}>
                    {axisName}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    {fmtEuro(rowTotal)}
                  </span>
                  <button
                    type="button" onClick={() => move(i, -1)} disabled={i === 0}
                    title="Move up" aria-label="Move row up"
                    style={{
                      background: 'none', border: 'none', cursor: i === 0 ? 'not-allowed' : 'pointer',
                      color: 'var(--text-muted)', fontSize: 11, opacity: i === 0 ? 0.35 : 1, padding: 2,
                    }}
                  >▲</button>
                  <button
                    type="button" onClick={() => move(i, 1)} disabled={i === lines.length - 1}
                    title="Move down" aria-label="Move row down"
                    style={{
                      background: 'none', border: 'none',
                      cursor: i === lines.length - 1 ? 'not-allowed' : 'pointer',
                      color: 'var(--text-muted)', fontSize: 11,
                      opacity: i === lines.length - 1 ? 0.35 : 1, padding: 2,
                    }}
                  >▼</button>
                  <button
                    type="button" onClick={() => requestRemove(i)}
                    title="Remove row" aria-label="Remove row"
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--text-muted)', fontSize: 13, padding: 2,
                    }}
                  >✕</button>
                </div>

                {/* Axis + who */}
                <div className="grid grid-cols-4 gap-3">
                  <div>
                    <label className="label">
                      {axisLabel}<span className="ml-0.5" style={{ color: 'var(--red)' }}>*</span>
                    </label>
                    <Searchable
                      value={isBrand ? l.brand : l.activityType}
                      onChange={v => patch(i, isBrand ? { brand: v } : { activityType: v })}
                      options={optionsFor(i)}
                      placeholder={isBrand ? 'Search brand…' : 'Select type…'}
                    />
                  </div>
                  <div>
                    <label className="label">Customer</label>
                    <input
                      className="input" style={{ fontSize: 13 }} value={l.customer}
                      onChange={e => patch(i, { customer: e.target.value })}
                      placeholder="e.g. Krys"
                    />
                  </div>
                  <div>
                    <label className="label">
                      Vendor<span className="ml-0.5" style={{ color: 'var(--red)' }}>*</span>
                    </label>
                    <input
                      className="input" style={{ fontSize: 13 }} value={l.vendor}
                      onChange={e => patch(i, { vendor: e.target.value })}
                      placeholder="e.g. Altavia"
                    />
                  </div>
                  <div>
                    <label className="label">{isBrand ? '# Doors' : 'Detail'}</label>
                    {isBrand ? (
                      <input
                        type="number" min={0} className="input" style={{ fontSize: 13 }}
                        value={l.numDoors || ''} placeholder="0"
                        onChange={e => patch(i, { numDoors: Number(e.target.value) })}
                      />
                    ) : (
                      <input
                        className="input" style={{ fontSize: 13 }} value={l.detail}
                        onChange={e => patch(i, { detail: e.target.value })}
                        placeholder="e.g. National launch event"
                      />
                    )}
                  </div>
                </div>

                {/* Doors / avg-per-door for multi-brand; doors for multi-activity */}
                <div className="grid grid-cols-4 gap-3" style={{ marginTop: 10 }}>
                  {isBrand ? (
                    <>
                      <div>
                        <label className="label">Avg / Door</label>
                        <div
                          className="input cursor-default"
                          style={{ background: 'var(--bg-surface)', color: 'var(--green)', fontSize: 13 }}
                        >
                          {l.numDoors > 0 ? fmtEuro(rowTotal / l.numDoors) : '—'}
                        </div>
                      </div>
                      <div style={{ gridColumn: 'span 3' }}>
                        <label className="label">Detail</label>
                        <input
                          className="input" style={{ fontSize: 13 }} value={l.detail}
                          onChange={e => patch(i, { detail: e.target.value })}
                          placeholder="e.g. Window kit + counter display"
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <label className="label"># Doors</label>
                        <input
                          type="number" min={0} className="input" style={{ fontSize: 13 }}
                          value={l.numDoors || ''} placeholder="0"
                          onChange={e => patch(i, { numDoors: Number(e.target.value) })}
                        />
                      </div>
                      <div>
                        <label className="label">Avg / Door</label>
                        <div
                          className="input cursor-default"
                          style={{ background: 'var(--bg-surface)', color: 'var(--green)', fontSize: 13 }}
                        >
                          {l.numDoors > 0 ? fmtEuro(rowTotal / l.numDoors) : '—'}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Budget */}
                <div
                  style={{
                    marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)',
                    display: 'flex', alignItems: 'flex-end', gap: 10,
                  }}
                >
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, flex: 1 }}>
                    {([
                      ['Q1 2026', 'q1_2026'],
                      ['Q2 2026', 'q2_2026'],
                      ['Q3 2026', 'q3_2026'],
                      ['Q4 2026', 'q4_2026'],
                    ] as const).map(([label, key]) => (
                      <div key={key}>
                        <label className="label">{label}</label>
                        <KEuros value={l[key]} onChange={v => patch(i, { [key]: v } as Partial<LoaLine>)} />
                      </div>
                    ))}
                  </div>
                  <div style={{ minWidth: 120, textAlign: 'right', paddingBottom: 8 }}>
                    <div style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      → Row total
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--green)' }}>
                      {fmtEuro(rowTotal)}
                    </div>
                  </div>
                </div>

                {/* Cost drill-down */}
                <div style={{ marginTop: 10 }}>
                  <button
                    type="button" onClick={() => toggleDrill(i)}
                    style={{
                      background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                      fontSize: 11.5, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 6,
                    }}
                  >
                    <span style={{ fontSize: 9 }}>{drillOpen ? '▲' : '▼'}</span>
                    Cost drill-down for {axisName}
                    {l.costDrillDown && !drillOpen && (
                      <span style={{ color: 'var(--text-muted)' }}>· filled</span>
                    )}
                  </button>
                  {drillOpen && (
                    <textarea
                      className="input" rows={3} style={{ marginTop: 8, fontSize: 13, resize: 'vertical' }}
                      value={l.costDrillDown}
                      onChange={e => patch(i, { costDrillDown: e.target.value })}
                      placeholder={`How the ${fmtEuro(rowTotal)} for ${axisName} breaks down…`}
                    />
                  )}
                </div>

                {/* Per-row completeness */}
                <div style={{ marginTop: 10, display: 'flex', gap: 12, fontSize: 11 }}>
                  {([[axisLabel, done.axis], ['Vendor', done.vendor], ['Budget', done.budget]] as const).map(
                    ([label, ok]) => (
                      <span key={label} style={{ color: ok ? 'var(--green)' : 'var(--text-muted)' }}>
                        {ok ? '✓' : '✗'} {label}
                      </span>
                    )
                  )}
                </div>

                {/* Remove confirmation */}
                {confirmRemove === i && (
                  <div
                    style={{
                      position: 'absolute', inset: 0, borderRadius: 12,
                      background: 'color-mix(in srgb, var(--bg-surface) 92%, transparent)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                      padding: 16, zIndex: 5, textAlign: 'center', flexDirection: 'column',
                    }}
                  >
                    <p style={{ fontSize: 13, color: 'var(--text-primary)', margin: 0 }}>
                      Remove row {i + 1}{axisName !== `Row ${i + 1}` ? ` — ${axisName}` : ''}?
                      This row has data.
                    </p>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="button" className="btn-secondary text-sm" onClick={() => setConfirmRemove(null)}>
                        Keep it
                      </button>
                      <button type="button" className="btn-primary text-sm" onClick={() => remove(i)}>
                        Remove
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Add */}
        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            type="button" onClick={add} disabled={lines.length >= MAX_LINES}
            style={{
              background: 'none', border: 'none', padding: 0,
              cursor: lines.length >= MAX_LINES ? 'not-allowed' : 'pointer',
              fontSize: 13, fontWeight: 500, color: 'var(--accent)',
              opacity: lines.length >= MAX_LINES ? 0.45 : 1,
            }}
          >
            + Add {isBrand ? 'brand' : 'activity type'}
          </button>
          <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
            Minimum {MIN_LINES}, maximum {MAX_LINES}. Use the arrows to reorder.
          </span>
        </div>
      </div>
    </div>
  )
}
