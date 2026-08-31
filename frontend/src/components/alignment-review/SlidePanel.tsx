'use client'
/**
 * SlidePanel — the bottom half: the real deck slide plus its actions rail.
 *
 * The slide is authored at a fixed 1280 × 720 and scaled with
 * `transform-origin: top left`, inside a wrapper sized to `1280k × 720k`. That
 * combination is what keeps the whole slide on screen: a scaled element still
 * occupies its *unscaled* box for layout, so without the sized wrapper the pane
 * lays out a 720px-tall child, centres it, and clips the top half off.
 *
 * Scale is driven by *width*, not by min(width, height). Letterbox-fitting on
 * height left the slide at ~40% with a dead zone the width of the pane beside
 * it; filling the width is what the design shows. When the resulting height
 * overflows a short pane the stage scrolls vertically instead of shrinking.
 */
import { useState, useRef, useLayoutEffect, useEffect } from 'react'
import type { LOA } from '@/types/loa'
import type { LOAPhotoRecord } from '@/types/review'
import AlignmentSlide, { SLIDE_W, SLIDE_H } from './AlignmentSlide'
import { anchorName, anchorSide, PIN } from './anchors'

const MONO = "'IBM Plex Mono', ui-monospace, monospace"

interface Props {
  loa: LOA
  photos: LOAPhotoRecord[]
  counts: Record<string, number>
  activeAnchor: string | null
  onAnchorSelect: (anchor: string | null) => void
  readOnly: boolean
  /** Null when the LOA has no cycle — "Open slide in deck" then has nowhere to go. */
  onOpenInDeck: (() => void) | null
  onDownloadSlide: () => void
  downloading: boolean
  /** Position in the reviewer's queue, for the mono deck line. */
  queuePosition: string
  /** Lets the pane re-anchor its popover once the slide has been rescaled. */
  onScaleChange?: (scale: number) => void
  /** The rail yields its width to the comment drawer — they are never both open. */
  railOpen: boolean
}

export default function SlidePanel({
  loa, photos, counts, activeAnchor, onAnchorSelect,
  readOnly, onOpenInDeck, onDownloadSlide, downloading,
  queuePosition, onScaleChange, railOpen,
}: Props) {
  const stageRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0)

  // Fill the pane's width. Height only caps the scale when there is room to
  // spare — a short pane scrolls rather than shrinking the slide to a stamp.
  useLayoutEffect(() => {
    const el = stageRef.current
    if (!el) return
    function fit() {
      const node = stageRef.current
      if (!node) return
      const w = node.clientWidth
      if (w <= 0) return
      const k = w / SLIDE_W
      setScale(prev => (Math.abs(k - prev) > 0.002 ? k : prev))
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [railOpen])

  useEffect(() => { onScaleChange?.(scale) }, [scale, onScaleChange])

  // Anchors that carry at least one comment — the rail's "Pinned on this slide".
  const pinned = Object.keys(counts).filter(a => anchorSide(a) === 'slide' && counts[a] > 0)

  const hint = readOnly
    ? 'Auto-generated from your submission'
    : 'Click a section or photo to comment on it'

  return (
    <section className="la-ssr-slide">
      {/* Sub-header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '11px 22px 8px', flexShrink: 0, gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, minWidth: 0 }}>
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '.13em',
            textTransform: 'uppercase', color: 'var(--text-primary)', whiteSpace: 'nowrap',
          }}>
            Generated slide · 1280 × 720
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {hint}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <span style={{ fontFamily: MONO, fontSize: 10, color: 'var(--text-tertiary)' }}>
            {queuePosition}{scale > 0 ? ` · ${Math.round(scale * 100)}%` : ''}
          </span>
        </div>
      </div>

      <div
        onClick={() => onAnchorSelect(null)}
        style={{
          flex: 1, minHeight: 0, display: 'flex', gap: 20,
          padding: '0 22px 16px',
        }}
      >
        {/* Stage — measured, then the slide is scaled into it */}
        <div
          ref={stageRef}
          style={{
            flex: 1, minWidth: 0, minHeight: 0,
            display: 'flex', alignItems: 'flex-start',
            overflowY: 'auto', overflowX: 'hidden',
            // Reserve the gutter so clientWidth does not change when the bar
            // appears — otherwise the width-driven fit oscillates.
            scrollbarGutter: 'stable',
          }}
        >
            <div style={{
              width: Math.round(SLIDE_W * scale),
              height: Math.round(SLIDE_H * scale),
              flexShrink: 0,
              visibility: scale > 0 ? 'visible' : 'hidden',
            }}>
              <div style={{
                width: SLIDE_W, height: SLIDE_H,
                transform: `scale(${scale})`,
                transformOrigin: 'top left',
                border: '1px solid var(--border-strong)',
                boxShadow: '0 16px 40px rgba(10,10,10,.16)',
              }}>
                <AlignmentSlide
                  loa={loa}
                  photos={photos}
                  counts={counts}
                  activeAnchor={activeAnchor}
                  onAnchorClick={(anchor) => onAnchorSelect(anchor === activeAnchor ? null : anchor)}
                />
              </div>
            </div>
          </div>

        {/* Actions rail — hidden while the comment drawer holds the same space */}
        {railOpen && (
          <aside
            onClick={e => e.stopPropagation()}
            style={{ width: 236, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12 }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={railHeading}>Pinned on this slide</span>
              {pinned.length === 0 ? (
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.55 }}>
                  {readOnly
                    ? 'No reviewer has pinned anything on this slide yet.'
                    : 'Nothing pinned yet — click a section or photo to start a thread.'}
                </span>
              ) : pinned.map(a => {
                const on = activeAnchor === a
                return (
                  <button
                    key={a}
                    onClick={() => onAnchorSelect(on ? null : a)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                      background: on ? 'var(--surface)' : 'rgba(255,255,255,.6)',
                      border: `1px solid ${on ? 'var(--text-primary)' : 'var(--border-strong)'}`,
                      borderRadius: 8, padding: '8px 10px', cursor: 'pointer', textAlign: 'left',
                    }}
                  >
                    <span style={{ fontSize: 11.5, fontWeight: on ? 600 : 500, color: 'var(--text-primary)' }}>
                      {anchorName(a)}
                    </span>
                    <span style={{
                      fontFamily: MONO, fontSize: 9, minWidth: 15, height: 15, borderRadius: 99,
                      background: PIN.bg, border: `1px solid ${PIN.bd}`, color: PIN.fg,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      {counts[a]}
                    </span>
                  </button>
                )
              })}
            </div>

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 11, display: 'flex', flexDirection: 'column', gap: 7 }}>
              <span style={railHeading}>Slide source</span>
              <span style={{ fontSize: 11, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
                Generated from the submitted row — layout, table strip and photos are
                fixed. Reviewers comment; only the owner can change content.
              </span>
            </div>

            <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 7 }}>
              <button
                onClick={() => onOpenInDeck?.()}
                disabled={!onOpenInDeck}
                title={onOpenInDeck ? 'Open this slide in the CMO deck' : 'This LOA is not attached to a review cycle'}
                style={{ ...railBtn, opacity: onOpenInDeck ? 1 : 0.45, cursor: onOpenInDeck ? 'pointer' : 'default' }}
              >
                Open slide in deck ›
              </button>
              <button
                onClick={onDownloadSlide}
                disabled={downloading}
                style={{ ...railBtn, opacity: downloading ? 0.6 : 1 }}
              >
                {downloading ? 'Preparing…' : 'Download slide PDF'}
              </button>
            </div>
          </aside>
        )}
      </div>
    </section>
  )
}

const railHeading: React.CSSProperties = {
  fontSize: 9.5, fontWeight: 700, letterSpacing: '.12em',
  textTransform: 'uppercase', color: 'var(--text-tertiary)',
}

const railBtn: React.CSSProperties = {
  fontSize: 11.5, fontWeight: 500, color: 'var(--text-secondary)',
  background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 8,
  padding: '8px 11px', textAlign: 'center', cursor: 'pointer',
}

