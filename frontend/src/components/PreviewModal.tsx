'use client'

import { useEffect } from 'react'

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
}: PreviewModalProps) {
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const slideTitle = brand ? `${brand}: ${activityType}` : activityType

  // Use a portal-like approach without position:fixed
  // Render as a full-page overlay that's part of the document flow
  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        minHeight: '100vh',
        zIndex: 9999,
        background: 'rgba(0,0,0,0.85)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '60px',
        paddingBottom: '60px',
        paddingLeft: '24px',
        paddingRight: '24px',
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '860px',
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
            padding: '0 4px', borderRadius: '6px', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
          }}>×</button>
        </div>

        {/* Slide container */}
        <div style={{ padding: '20px', background: 'var(--bg-elevated)' }}>
          {/* The actual slide — white background always */}
          <div style={{
            background: '#ffffff',
            borderRadius: '6px',
            overflow: 'hidden',
            border: '1px solid #ddd',
            aspectRatio: '16/9',
            position: 'relative',
            fontFamily: 'Arial, sans-serif',
          }}>
            {/* Top dark bar */}
            <div style={{
              background: '#0D1B2A',
              padding: '7px 14px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <span style={{ color: 'white', fontSize: '11px', fontWeight: 700, letterSpacing: '0.05em' }}>
                {category?.toUpperCase() || 'CATEGORY'}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: 'white', fontSize: '10px', fontWeight: 600 }}>
                  {country?.toUpperCase() || 'COUNTRY'} · {formatEuros(fyTotal)}
                </span>
                <span style={{
                  background: '#C9A84C', color: 'white',
                  fontSize: '8px', fontWeight: 700,
                  padding: '2px 7px', borderRadius: '2px',
                }}>LOA #</span>
              </div>
            </div>

            {/* Title row */}
            <div style={{
              padding: '6px 14px 4px',
              borderBottom: '1px solid #eee',
              background: '#fff',
            }}>
              <p style={{ fontSize: '13px', fontWeight: 700, color: '#0D1B2A', margin: 0, lineHeight: 1.3 }}>
                {slideTitle}
              </p>
            </div>

            {/* Table header */}
            <div style={{
              background: '#F2F2F2',
              padding: '4px 14px',
              borderBottom: '1px solid #ddd',
            }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1.2fr 1.1fr 1.3fr 2.5fr 0.6fr 0.8fr 1.2fr 0.75fr 1.5fr',
                gap: '4px',
              }}>
                {['SAP CODE','EVENT TYPE','BRANDS','DESCRIPTION','# CUST','AVG/CUST','VENDOR','BUDGET','DATE'].map(h => (
                  <span key={h} style={{ color: '#666', fontWeight: 700, fontSize: '6.5px', letterSpacing: '0.03em' }}>{h}</span>
                ))}
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1.2fr 1.1fr 1.3fr 2.5fr 0.6fr 0.8fr 1.2fr 0.75fr 1.5fr',
                gap: '4px',
                marginTop: '3px',
              }}>
                {['TBC', activityType?.slice(0,12) || '—', brand?.slice(0,10) || '—', (description?.slice(0,50) + (description?.length > 50 ? '…' : '')) || '—', '—', '—', '—', formatEuros(fyTotal), '—'].map((v, i) => (
                  <span key={i} style={{ color: '#222', fontSize: '7.5px' }}>{v}</span>
                ))}
              </div>
            </div>

            {/* Main content area */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 240px',
              height: 'calc(100% - 120px)',
              background: '#fff',
            }}>
              {/* Left — content */}
              <div style={{ padding: '8px 14px', overflowY: 'auto' }}>
                {description && (
                  <div style={{ marginBottom: '7px' }}>
                    <p style={{ fontSize: '7.5px', fontWeight: 700, color: '#666', margin: '0 0 2px', textTransform: 'uppercase' }}>Description:</p>
                    <p style={{ fontSize: '8.5px', color: '#222', margin: 0, lineHeight: 1.5 }}>{description}</p>
                  </div>
                )}
                {(tools || detail) && (
                  <div style={{ marginBottom: '7px' }}>
                    <p style={{ fontSize: '7.5px', fontWeight: 700, color: '#666', margin: '0 0 2px', textTransform: 'uppercase' }}>Tools:</p>
                    <p style={{ fontSize: '8.5px', color: '#222', margin: 0, lineHeight: 1.5 }}>{tools || detail}</p>
                  </div>
                )}
                {kpi && (
                  <div style={{ marginBottom: '7px' }}>
                    <p style={{ fontSize: '7.5px', fontWeight: 700, color: '#666', margin: '0 0 2px', textTransform: 'uppercase' }}>KPI:</p>
                    <p style={{ fontSize: '8.5px', color: '#222', margin: 0, lineHeight: 1.5 }}>{kpi}</p>
                  </div>
                )}
                {costDrillDown && (
                  <div style={{ marginBottom: '7px' }}>
                    <p style={{ fontSize: '7.5px', fontWeight: 700, color: '#666', margin: '0 0 2px', textTransform: 'uppercase' }}>Cost drill down:</p>
                    <p style={{ fontSize: '8.5px', color: '#222', margin: 0, lineHeight: 1.5 }}>{costDrillDown}</p>
                  </div>
                )}
                {numDoors > 0 && (
                  <p style={{ fontSize: '8.5px', fontWeight: 700, color: '#1A7348', margin: 0 }}>
                    {formatEuros(avgPerDoor)} avg/door · #{numDoors} doors
                  </p>
                )}
                {!description && !tools && !kpi && (
                  <p style={{ fontSize: '9px', color: '#aaa', fontStyle: 'italic' }}>Fill section 7 to see content here</p>
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
                    }}>
                      {photo ? (
                        <img
                          src={photo.url}
                          alt={`Photo ${idx}`}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        <p style={{ fontSize: '9px', color: '#bbb', textAlign: 'center', fontStyle: 'italic' }}>
                          [ Photo {idx} ]
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Footer */}
            <div style={{
              background: '#0D1B2A',
              padding: '4px 14px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
            }}>
              <span style={{ color: 'white', fontSize: '8px', fontWeight: 700 }}>FRANCE</span>
              <span style={{ color: '#aaa', fontSize: '7px' }}>Strictly confidential — for internal use only</span>
              <span style={{ color: 'white', fontSize: '8px', fontWeight: 700 }}>EssilorLuxottica</span>
            </div>
          </div>
        </div>

        <div style={{
          padding: '10px 20px',
          borderTop: '1px solid var(--border)',
          textAlign: 'center',
          background: 'var(--bg-surface)',
        }}>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>
            Press Esc or click outside to close · Download the real PPT from the detail page
          </p>
        </div>
      </div>
    </div>
  )
}
