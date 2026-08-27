'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  paginateRows, isEventActivity, standardCells, eventCells, totalCells,
  STANDARD_HEADERS, EVENT_HEADERS, STANDARD_WIDTHS, EVENT_WIDTHS,
  type SlideRow, type SlideShared,
} from '@/lib/slideRows'

interface PreviewModalProps {
  isOpen: boolean
  onClose: () => void
  category: string
  country: string
  brand: string
  fyTotal: number
  description: string
  tools: string
  kpi: string
  costDrillDown: string
  numDoors: number
  avgPerDoor: number
  activityType: string
  detail: string
  photos: { index: number; url: string }[]
  /** Per-row values on a multi-brand / multi-activity LOA. Empty on a standard one. */
  rows?: SlideRow[]
  customer?: string
  vendor?: string
  sapEventCode?: string
  eventType?: string
  numCustomers?: number
  startDate?: string
}

function formatEuros(n: number) {
  if (!n) return '€0'
  if (n >= 1_000_000) return `€${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `€${Math.round(n / 1_000)}k`
  return `€${n}`
}

export default function PreviewModal({
  isOpen, onClose,
  category, country, brand, fyTotal,
  description, tools, kpi, costDrillDown,
  numDoors, avgPerDoor, activityType, detail, photos,
  rows = [], customer, vendor, sapEventCode, eventType, numCustomers, startDate,
}: PreviewModalProps) {
  const [page, setPage] = useState(0)

  // ── What the deck will actually contain ──────────────────────────────────
  //
  // Events are single-row on purpose: ppt.py's `_render_events_layout` does
  // `del rows` because the event columns (SAP code, brand split, # customers)
  // are LOA-level. Everything else shows one table row per LOA row, paginated
  // by the same rule the engine uses.
  const isEvent = isEventActivity(activityType)
  const shared: SlideShared = {
    country, activityType, brand, detail, customer, vendor, numDoors,
    sapEventCode, eventType, description, numCustomers, startDate, fyTotal,
  }
  // A standard LOA is its own single row.
  const allRows: SlideRow[] = rows.length > 0 ? rows : [{
    brand, activityType, customer, vendor, detail, numDoors,
    // Quarters are not passed in for a standard LOA — fyTotal already holds the
    // sum, so hand it to the row as a single quarter to keep the maths honest.
    q1: fyTotal,
  }]
  const pages = isEvent ? [allRows.slice(0, 1)] : paginateRows(allRows)
  const totalPages = pages.length
  const pageIndex = Math.min(page, totalPages - 1)
  const pageRows = pages[pageIndex] ?? []
  // The last page is the one that carries the description and the photos —
  // matching `is_last` / `with_content` in ppt.py's generate_loa_slide loop.
  const showContent = pageIndex === totalPages - 1
  const headers = isEvent ? EVENT_HEADERS : STANDARD_HEADERS
  const widths  = isEvent ? EVENT_WIDTHS  : STANDARD_WIDTHS
  const bodyRows = isEvent
    ? [eventCells(shared, formatEuros)]
    : pageRows.map(r => standardCells(r, shared, formatEuros))
  // The engine only prints the TOTAL strip on a real multi-row table.
  const showTotal = !isEvent && allRows.length > 1

  // Reset to page 1 whenever the row count changes under us.
  useEffect(() => { setPage(0) }, [totalPages])

  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') setPage(p => Math.min(p + 1, totalPages - 1))
      if (e.key === 'ArrowLeft')  setPage(p => Math.max(p - 1, 0))
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen, onClose, totalPages])

  // Lock body scroll when modal is open
  useEffect(() => {
    if (!isOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [isOpen])

  if (!isOpen || typeof document === 'undefined') return null

  const slideTitle = brand ? `${brand}: ${activityType}` : activityType

  const modal = (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0,0,0,0.85)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 24px',
        overflowY: 'auto',
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '960px',
          background: 'var(--bg-surface)',
          borderRadius: '16px',
          border: '1px solid var(--border)',
          overflow: 'hidden',
          boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
        }}
      >
        {/* Modal header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 20px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg-surface)',
        }}>
          <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}>
            PPT slide preview — full size
          </p>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', fontSize: '20px', lineHeight: 1,
            padding: '4px 8px', borderRadius: '6px', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
          }}
            aria-label="Close preview"
          >×</button>
        </div>

        {/* Slide container */}
        <div style={{ padding: '20px', background: 'var(--bg-elevated)' }}>
          {/* The actual slide — forced 16:9 via padding trick for bulletproof aspect ratio */}
          <div style={{
            position: 'relative',
            width: '100%',
            paddingBottom: '56.25%', /* 9/16 = 56.25% */
            background: '#ffffff',
            borderRadius: '6px',
            overflow: 'hidden',
            border: '1px solid #ddd',
            fontFamily: 'Arial, sans-serif',
          }}>
            {/* Absolutely positioned inner container fills the 16:9 box */}
            <div style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
            }}>
              {/* Top dark bar */}
              <div style={{
                background: '#0D1B2A',
                padding: '8px 16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexShrink: 0,
              }}>
                <span style={{ color: 'white', fontSize: '12px', fontWeight: 700, letterSpacing: '0.05em' }}>
                  {category?.toUpperCase() || 'CATEGORY'}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: 'white', fontSize: '11px', fontWeight: 600 }}>
                    {country?.toUpperCase() || 'COUNTRY'} · {formatEuros(fyTotal)}
                  </span>
                  <span style={{
                    background: '#C9A84C', color: 'white',
                    fontSize: '9px', fontWeight: 700,
                    padding: '2px 8px', borderRadius: '2px',
                  }}>LOA #</span>
                </div>
              </div>

              {/* Title row */}
              <div style={{
                padding: '8px 16px 6px',
                borderBottom: '1px solid #eee',
                background: '#fff',
                flexShrink: 0,
              }}>
                <p style={{ fontSize: '15px', fontWeight: 700, color: '#0D1B2A', margin: 0, lineHeight: 1.3 }}>
                  {slideTitle}
                  {/* ppt.py `_render_title` appends "(n / total)" only when split. */}
                  {totalPages > 1 && ` (${pageIndex + 1} / ${totalPages})`}
                </p>
              </div>

              {/* Table header + one data row per LOA row */}
              <div style={{ flexShrink: 0 }}>
                <div style={{
                  background: '#F2F2F2',
                  padding: '5px 16px',
                  borderBottom: '1px solid #ddd',
                }}>
                  <div style={{ display: 'grid', gridTemplateColumns: widths, gap: '4px' }}>
                    {headers.map(h => (
                      <span key={h} style={{ color: '#666', fontWeight: 700, fontSize: '7px', letterSpacing: '0.03em' }}>{h}</span>
                    ))}
                  </div>
                  {bodyRows.map((cells, r) => (
                    <div key={r} style={{
                      display: 'grid', gridTemplateColumns: widths, gap: '4px',
                      marginTop: '3px',
                      paddingTop: r > 0 ? '3px' : 0,
                      borderTop: r > 0 ? '1px solid #e2e2e2' : 'none',
                    }}>
                      {cells.map((v, i) => (
                        <span key={i} style={{ color: '#222', fontSize: '8px' }}>{v}</span>
                      ))}
                    </div>
                  ))}
                  {showTotal && (
                    <div style={{
                      display: 'grid', gridTemplateColumns: widths, gap: '4px',
                      marginTop: '3px', paddingTop: '3px', borderTop: '1.5px solid #0D1B2A',
                    }}>
                      {totalCells(pageRows, formatEuros).map((v, i) => (
                        <span key={i} style={{ color: '#0D1B2A', fontSize: '8px', fontWeight: 700 }}>{v}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Main content area — flex:1 fills remaining space.
                  Only the LAST page carries it: a continuation page in the real
                  deck is table rows and nothing else (`with_content=is_last`). */}
              {!showContent ? (
                <div style={{ flex: 1, minHeight: 0, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <p style={{ fontSize: '10px', color: '#bbb', fontStyle: 'italic', textAlign: 'center' }}>
                    Continuation page — rows only.<br />
                    Description, KPI and photos are on page {totalPages}.
                  </p>
                </div>
              ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 240px',
                flex: 1,
                minHeight: 0,
                background: '#fff',
              }}>
                {/* Left — content */}
                <div style={{ padding: '10px 16px', overflowY: 'auto' }}>
                  {description && (
                    <div style={{ marginBottom: '8px' }}>
                      <p style={{ fontSize: '8px', fontWeight: 700, color: '#666', margin: '0 0 2px', textTransform: 'uppercase' }}>Description:</p>
                      <p style={{ fontSize: '9.5px', color: '#222', margin: 0, lineHeight: 1.5 }}>{description}</p>
                    </div>
                  )}
                  {(tools || detail) && (
                    <div style={{ marginBottom: '8px' }}>
                      <p style={{ fontSize: '8px', fontWeight: 700, color: '#666', margin: '0 0 2px', textTransform: 'uppercase' }}>Tools:</p>
                      <p style={{ fontSize: '9.5px', color: '#222', margin: 0, lineHeight: 1.5 }}>{tools || detail}</p>
                    </div>
                  )}
                  {kpi && (
                    <div style={{ marginBottom: '8px' }}>
                      <p style={{ fontSize: '8px', fontWeight: 700, color: '#666', margin: '0 0 2px', textTransform: 'uppercase' }}>KPI:</p>
                      <p style={{ fontSize: '9.5px', color: '#222', margin: 0, lineHeight: 1.5 }}>{kpi}</p>
                    </div>
                  )}
                  {costDrillDown && (
                    <div style={{ marginBottom: '8px' }}>
                      <p style={{ fontSize: '8px', fontWeight: 700, color: '#666', margin: '0 0 2px', textTransform: 'uppercase' }}>Cost drill down:</p>
                      <p style={{ fontSize: '9.5px', color: '#222', margin: 0, lineHeight: 1.5 }}>{costDrillDown}</p>
                    </div>
                  )}
                  {numDoors > 0 && (
                    <p style={{ fontSize: '9.5px', fontWeight: 700, color: '#1A7348', margin: 0 }}>
                      {formatEuros(avgPerDoor)} avg/door · #{numDoors} doors
                    </p>
                  )}
                  {!description && !tools && !kpi && (
                    <p style={{ fontSize: '10px', color: '#aaa', fontStyle: 'italic' }}>Fill section 7 to see content here</p>
                  )}
                </div>

                {/* Right — photos */}
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  borderLeft: '1px solid #eee',
                }}>
                  {[1, 2].map(idx => {
                    const photo = photos.find(p => p.index === idx)
                    return (
                      <div key={idx} style={{
                        flex: 1,
                        borderBottom: idx === 1 ? '1px solid #eee' : 'none',
                        background: '#f5f5f5',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                        minHeight: 0,
                      }}>
                        {photo ? (
                          <img
                            src={photo.url}
                            alt={`Photo ${idx}`}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : (
                          <p style={{ fontSize: '10px', color: '#bbb', textAlign: 'center', fontStyle: 'italic' }}>
                            [ Photo {idx} ]
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
              )}

              {/* Footer — inside the flex column, not absolutely positioned */}
              <div style={{
                background: '#0D1B2A',
                padding: '5px 16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexShrink: 0,
              }}>
                <span style={{ color: 'white', fontSize: '9px', fontWeight: 700 }}>
                  {country?.toUpperCase() || 'FRANCE'}
                </span>
                <span style={{ color: '#aaa', fontSize: '7.5px' }}>Strictly confidential — for internal use only</span>
                <span style={{ color: 'white', fontSize: '9px', fontWeight: 700 }}>EssilorLuxottica</span>
              </div>
            </div>
          </div>
        </div>

        <div style={{
          padding: '10px 20px',
          borderTop: '1px solid var(--border)',
          textAlign: 'center',
          background: 'var(--bg-surface)',
        }}>
          {totalPages > 1 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
              <button
                onClick={() => setPage(p => Math.max(p - 1, 0))}
                disabled={pageIndex === 0}
                style={{
                  background: 'none', border: '1px solid var(--border)', borderRadius: '6px',
                  padding: '3px 10px', fontSize: '11px', color: 'var(--text-primary)',
                  cursor: pageIndex === 0 ? 'not-allowed' : 'pointer',
                  opacity: pageIndex === 0 ? 0.4 : 1,
                }}
              >← Prev</button>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Slide {pageIndex + 1} of {totalPages} · {allRows.length} rows
              </span>
              <button
                onClick={() => setPage(p => Math.min(p + 1, totalPages - 1))}
                disabled={pageIndex === totalPages - 1}
                style={{
                  background: 'none', border: '1px solid var(--border)', borderRadius: '6px',
                  padding: '3px 10px', fontSize: '11px', color: 'var(--text-primary)',
                  cursor: pageIndex === totalPages - 1 ? 'not-allowed' : 'pointer',
                  opacity: pageIndex === totalPages - 1 ? 0.4 : 1,
                }}
              >Next →</button>
            </div>
          ) : (
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>
              Press Esc or click outside to close · Download the real PPT from the detail page
            </p>
          )}
        </div>
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}
