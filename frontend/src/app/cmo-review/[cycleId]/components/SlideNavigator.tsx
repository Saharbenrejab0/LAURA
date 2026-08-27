'use client'
/**
 * SlideNavigator — the dark 264px deck outline.
 *
 * Progress counts LOA detail slides only; the counter under the stage counts
 * every slide. Sections are the categories, with activity families as
 * sub-headings; the title slide opens the deck in its own group.
 */
import { useState, useCallback } from 'react'
import type {
  Slide, ReviewVerdict, ReviewComment,
  SectionDividerData, LOADetailData, CategoryOverviewData, TitleSlideData,
} from '@/types/review'
import { formatCompact, primaryCategory, DIVIDER_STYLES } from '@/types/review'
import { photoSrc } from './PhotoUploader'

const FONT = "Inter, ui-sans-serif, system-ui, sans-serif"
const MONO = "'IBM Plex Mono', ui-monospace, SFMono-Regular, monospace"
const GOLD = '#C9A678'

// ── Nav model ────────────────────────────────────────────────────────────────

type NavRow =
  | { kind: 'family'; label: string; count: number }
  | { kind: 'slide'; index: number }

interface NavSection {
  id: string
  label: string
  loaCount: number
  rows: NavRow[]
}

function buildNav(slides: Slide[]): NavSection[] {
  const sections: NavSection[] = []

  const currentSection = (): NavSection => {
    if (!sections.length) {
      sections.push({ id: '__opening__', label: 'Deck opening', loaCount: 0, rows: [] })
    }
    return sections[sections.length - 1]
  }

  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i]

    if (slide.type === 'section_divider') {
      const data = slide.data as SectionDividerData
      if (data.kind === 'category') {
        sections.push({
          id: slide.sectionId || slide.id,
          label: data.label,
          loaCount: 0,
          rows: [{ kind: 'slide', index: i }],
        })
      } else {
        const section = currentSection()
        section.rows.push({ kind: 'family', label: data.label, count: data.loaCount })
        section.rows.push({ kind: 'slide', index: i })
      }
      continue
    }

    if (slide.type === 'loa_detail') {
      const section = currentSection()
      section.loaCount += 1
      section.rows.push({ kind: 'slide', index: i })
      continue
    }

    // title_slide and category_overview attach to the current section
    currentSection().rows.push({ kind: 'slide', index: i })
  }

  return sections
}

// ── Component ────────────────────────────────────────────────────────────────

interface Props {
  slides: Slide[]
  verdicts: Record<string, ReviewVerdict>
  comments: Record<string, ReviewComment[]>
  currentIndex: number
  reviewableCount: number
  decidedCount: number
  onNavigate: (index: number) => void
}

export default function SlideNavigator({
  slides, verdicts, comments, currentIndex,
  reviewableCount, decidedCount, onNavigate,
}: Props) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const toggleSection = useCallback((id: string) => {
    setCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }, [])

  const sections = buildNav(slides)
  const progressPct = reviewableCount > 0
    ? Math.round((decidedCount / reviewableCount) * 100)
    : 0
  const left = Math.max(0, reviewableCount - decidedCount)

  return (
    <aside style={{
      width: 264, flexShrink: 0,
      background: '#121212', borderRight: '1px solid #000',
      // minHeight:0 is what lets the slide list below actually scroll. Without
      // it a flex item refuses to shrink under its content, so the rail grew to
      // fit every thumbnail and pushed the page instead of scrolling itself.
      display: 'flex', flexDirection: 'column', minHeight: 0, fontFamily: FONT,
    }}>
      {/* Progress */}
      <div style={{
        padding: '18px 18px 16px', borderBottom: '1px solid #1F1F1F',
        display: 'flex', flexDirection: 'column', gap: 10, flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <span style={{
            fontSize: 11, fontWeight: 600, letterSpacing: '.14em',
            textTransform: 'uppercase', color: 'var(--text-secondary)',
          }}>
            Review progress
          </span>
          <span style={{ fontFamily: MONO, fontSize: 11, color: GOLD, fontVariantNumeric: 'tabular-nums' }}>
            {decidedCount} / {reviewableCount}
          </span>
        </div>
        <div style={{ height: 3, background: '#242424', borderRadius: 99, overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${progressPct}%`, background: GOLD, borderRadius: 99,
            transition: 'width 200ms cubic-bezier(0.2,0,0,1)',
          }} />
        </div>
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
          {decidedCount} of {reviewableCount} LOAs reviewed · {left} left
        </span>
      </div>

      {/* Outline */}
      <div style={{
        flex: 1, minHeight: 0, overflowY: 'auto', padding: '10px 12px 20px',
        display: 'flex', flexDirection: 'column', gap: 2,
      }}>
        {sections.map(section => {
          const isOpen = !collapsed.has(section.id)
          return (
            <div key={section.id}>
              <div
                onClick={() => toggleSection(section.id)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 6px 6px', cursor: 'pointer', userSelect: 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                  <span style={{
                    color: 'var(--text-secondary)', fontSize: 9, display: 'inline-block',
                    transform: isOpen ? 'none' : 'rotate(-90deg)', transition: 'transform 120ms',
                  }}>▾</span>
                  <span style={{
                    fontSize: 10.5, fontWeight: 700, letterSpacing: '.13em', color: 'var(--surface-sunken)',
                    textTransform: 'uppercase',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {section.label}
                  </span>
                </div>
                {section.loaCount > 0 && (
                  <span style={{ fontFamily: MONO, fontSize: 10, color: 'var(--text-secondary)', flexShrink: 0 }}>
                    {section.loaCount}
                  </span>
                )}
              </div>

              {isOpen && section.rows.map((row, ri) => {
                if (row.kind === 'family') {
                  return (
                    <div
                      key={`fam-${section.id}-${ri}`}
                      style={{
                        padding: '7px 6px 4px 20px', fontSize: 10, fontWeight: 600,
                        letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text-tertiary)',
                      }}
                    >
                      {row.label}{row.count > 0 ? ` (${row.count})` : ''}
                    </div>
                  )
                }

                const s = slides[row.index]
                return (
                  <SlideRow
                    key={s.id}
                    slide={s}
                    n={row.index + 1}
                    active={row.index === currentIndex}
                    verdict={s.loaId ? verdicts[s.loaId] : undefined}
                    commentCount={(comments[s.id] || []).length}
                    onClick={() => onNavigate(row.index)}
                  />
                )
              })}
            </div>
          )
        })}
      </div>

      {/* Keyboard hints */}
      <div style={{
        padding: '10px 18px 14px', borderTop: '1px solid #1F1F1F',
        display: 'flex', flexWrap: 'wrap', gap: '4px 10px', flexShrink: 0,
      }}>
        <Key k="A" label="approve" />
        <Key k="R" label="reject" />
        <Key k="C" label="comment" />
        <Key k="F" label="full screen" />
      </div>
    </aside>
  )
}

function Key({ k, label }: { k: string; label: string }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: 'var(--text-secondary)' }}>
      <span style={{
        fontFamily: MONO, border: '1px solid #2A2A2A', borderRadius: 3,
        padding: '1px 5px', fontSize: 9, color: 'var(--text-tertiary)', lineHeight: 1.5,
      }}>{k}</span>
      {label}
    </span>
  )
}

// ── Slide row + thumbnail ────────────────────────────────────────────────────

function SlideRow({ slide, n, active, verdict, commentCount, onClick }: {
  slide: Slide; n: number; active: boolean
  verdict?: ReviewVerdict; commentCount: number; onClick: () => void
}) {
  const approved = verdict?.decision === 'approved'
  const rejected = verdict?.decision === 'rejected'

  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', gap: 9, alignItems: 'center',
        padding: '4px 4px 4px 14px', borderRadius: 6,
        background: active ? '#1F1B14' : 'transparent',
        cursor: 'pointer', transition: 'background 120ms',
      }}
    >
      <span style={{
        fontFamily: MONO, fontSize: 9.5, color: 'var(--text-secondary)',
        width: 16, textAlign: 'right', flexShrink: 0, fontVariantNumeric: 'tabular-nums',
      }}>{n}</span>

      <div style={{
        position: 'relative', width: 120, height: 68, borderRadius: 3,
        background: 'var(--surface-raised)',
        border: active ? `2px solid ${GOLD}` : '1px solid #2A2A2A',
        overflow: 'hidden', flexShrink: 0, boxShadow: '0 1px 3px rgba(0,0,0,.5)',
      }}>
        <ThumbBody slide={slide} />
        {(approved || rejected) && (
          <div style={{ position: 'absolute', top: 14, right: 3 }}>
            <span style={{
              fontSize: 7, lineHeight: 1, padding: '2px 3px', borderRadius: 99,
              background: approved ? 'var(--text-primary)' : '#8A2E27', color: 'var(--surface)', fontWeight: 700,
            }}>{approved ? '✓' : '✕'}</span>
          </div>
        )}
        {commentCount > 0 && (
          <div style={{
            position: 'absolute', bottom: 3, right: 3,
            background: GOLD, borderRadius: 99, padding: '1px 4px',
          }}>
            <span style={{ fontSize: 7, fontWeight: 700, color: '#1A1408' }}>{commentCount}</span>
          </div>
        )}
      </div>

      <span style={{
        fontSize: 10.5, lineHeight: 1.3,
        color: active ? 'var(--surface)' : 'var(--text-tertiary)',
        fontWeight: active ? 600 : 400,
        overflow: 'hidden', textOverflow: 'ellipsis',
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
      }}>{slide.navTitle}</span>
    </div>
  )
}

function ThumbBody({ slide }: { slide: Slide }) {
  if (slide.type === 'title_slide') {
    const data = slide.data as TitleSlideData
    return (
      <div style={{
        position: 'absolute', inset: 0,
        background: data.backgroundPhotoUrl
          ? `linear-gradient(90deg,rgba(10,10,10,.62),rgba(10,10,10,.15)), url(${photoSrc(data.backgroundPhotoUrl)}) center/cover`
          : 'var(--text-secondary)',
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: 6,
      }}>
        <div style={{ height: 5, width: '70%', background: 'rgba(255,255,255,.85)', borderRadius: 1 }} />
        <div style={{ height: 3, width: '44%', background: 'rgba(255,255,255,.45)', borderRadius: 1, marginTop: 3 }} />
      </div>
    )
  }

  if (slide.type === 'section_divider') {
    const data = slide.data as SectionDividerData
    const p = DIVIDER_STYLES[data.style] || DIVIDER_STYLES.black
    return (
      <div style={{
        position: 'absolute', inset: 0, background: p.bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 6px',
      }}>
        <span style={{
          color: p.fg, fontSize: 8, fontWeight: 700, letterSpacing: '.14em',
          textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          maxWidth: '100%',
        }}>
          {data.label.toUpperCase()}
        </span>
      </div>
    )
  }

  if (slide.type === 'category_overview') {
    return (
      <div style={{
        position: 'absolute', inset: 0, padding: 5,
        display: 'flex', flexDirection: 'column', gap: 3,
      }}>
        <div style={{ height: 3, width: '66%', background: 'var(--text-primary)' }} />
        <div style={{ display: 'flex', gap: 2, height: 13 }}>
          <div style={{ flex: 1.6, border: '1px solid #999', background: 'var(--surface)' }} />
          <div style={{ flex: 1, background: '#111' }} />
          <div style={{ flex: 1, background: '#111' }} />
          <div style={{ flex: 1, background: '#111' }} />
        </div>
        <div style={{ display: 'flex', gap: 2, flex: 1 }}>
          <div style={{ flex: 1, background: '#111' }} />
          <div style={{ flex: 1, background: '#111' }} />
          <div style={{ flex: 1, background: '#111' }} />
          <div style={{ flex: 1, background: '#111' }} />
        </div>
      </div>
    )
  }

  // loa_detail
  const { loa } = slide.data as LOADetailData
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div style={{ height: 11, background: '#2C3E5D', display: 'flex', justifyContent: 'space-between' }}>
        <span style={{
          color: 'var(--surface)', fontSize: 5, fontWeight: 700, padding: '3px 5px', letterSpacing: '.04em',
          overflow: 'hidden', whiteSpace: 'nowrap',
        }}>
          {primaryCategory(loa).toUpperCase()}
        </span>
        <span style={{
          background: '#A6C4E0', color: '#0D1B2A', fontSize: 5, fontWeight: 700,
          padding: '3px 4px', flexShrink: 0,
        }}>
          {formatCompact(loa.fy_2026_total || 0)}
        </span>
      </div>
      <div style={{ padding: '4px 5px', display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        <div style={{ height: 4, width: '72%', background: 'var(--text-primary)', borderRadius: 1 }} />
        <div style={{ height: 3, background: '#111', borderRadius: 1 }} />
        <div style={{ display: 'flex', gap: 3, marginTop: 1 }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ height: 2, background: 'var(--border-strong)' }} />
            <div style={{ height: 2, background: 'var(--border-strong)' }} />
            <div style={{ height: 2, width: '80%', background: 'var(--border-strong)' }} />
            <div style={{ height: 2, background: 'var(--border-strong)' }} />
          </div>
          <div style={{ width: 34, background: 'var(--border)', borderRadius: 1 }} />
        </div>
      </div>
    </div>
  )
}
