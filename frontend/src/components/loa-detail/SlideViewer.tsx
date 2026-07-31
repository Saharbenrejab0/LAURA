'use client'

import { useCallback, useEffect, useState } from 'react'
import { color } from '@/styles/tokens'
import type { LOASlide } from '@/types/loa'
import { createComment, listComments, resolveComment, type CommentItem } from '@/lib/api'
import { Icon, ic } from './shared'

const SECTION = 'ppt' as const

export function SlideViewer({
  loaId,
  slide,
  canComment,
  canResolve,
  onDownload,
}: {
  loaId: string
  slide?: LOASlide
  canComment: boolean
  canResolve: boolean
  onDownload?: () => void
}) {
  const [comments, setComments] = useState<CommentItem[]>([])
  const [tab, setTab] = useState<'open' | 'resolved'>('open')
  const [draft, setDraft] = useState('')
  const [posting, setPosting] = useState(false)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const data = await listComments(loaId, SECTION)
      setComments(data)
    } finally {
      setLoading(false)
    }
  }, [loaId])

  useEffect(() => {
    refresh()
  }, [refresh])

  const openComments = comments.filter((c) => !c.resolved)
  const resolvedComments = comments.filter((c) => c.resolved)
  const visible = tab === 'open' ? openComments : resolvedComments

  async function submitComment() {
    if (!draft.trim()) return
    setPosting(true)
    try {
      await createComment(loaId, SECTION, draft.trim())
      setDraft('')
      await refresh()
    } finally {
      setPosting(false)
    }
  }

  async function handleResolve(id: string) {
    await resolveComment(id)
    await refresh()
  }

  if (!slide) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: color.text.tertiary, background: color.bg.surface, borderRadius: 10, border: `1px solid ${color.border.soft}` }}>
        No PPT slide generated yet for this LOA.
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', background: color.bg.surface, borderRadius: 10, border: `1px solid ${color.border.soft}`, overflow: 'hidden', minHeight: 420 }}>
      {/* Center: slide preview + download */}
      <div style={{ flex: 1, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={onDownload}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: `1px solid ${color.border.soft}`, borderRadius: 8, padding: '6px 12px', cursor: 'pointer' }}
          >
            <Icon d={ic.extLink} size={14} color={color.text.secondary} />
            <span style={{ fontSize: 12, color: color.text.secondary }}>Download PPT</span>
          </button>
        </div>

        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: '100%', maxWidth: 600, background: '#f5f0e8', borderRadius: 6, aspectRatio: '16/10', padding: '28px 32px', boxShadow: '0 4px 24px rgba(0,0,0,0.4)' }}>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: 14, fontWeight: 700, letterSpacing: 2, color: '#1a1a1a' }}>
              {slide.brand}
              {slide.sub_brand && (
                <div style={{ fontSize: 9, fontWeight: 400, letterSpacing: 1.5, color: '#555' }}>{slide.sub_brand}</div>
              )}
            </div>
            <div style={{ marginTop: 14 }}>
              {slide.headline.split('\n').map((line, i) => (
                <div key={i} style={{ fontSize: 19, fontWeight: 800, color: '#1a1a1a', lineHeight: 1.25 }}>
                  {line}
                </div>
              ))}
            </div>
            <div style={{ marginTop: 12, fontSize: 10, color: '#444', lineHeight: 1.5 }}>
              {slide.description.split('\n').map((l, i) => (
                <div key={i}>{l}</div>
              ))}
            </div>
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#1a1a1a', marginBottom: 4 }}>KPI:</div>
              {slide.kpis.map((k, i) => (
                <div key={i} style={{ fontSize: 9, color: '#333', lineHeight: 1.6 }}>
                  • {k}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Right: comments, backed by the real Sprint 5 API */}
      <div style={{ width: 280, borderLeft: `1px solid ${color.border.soft}`, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderBottom: `1px solid ${color.border.soft}` }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: color.text.primary }}>Comments</span>
          {comments.length > 0 && (
            <span style={{ width: 20, height: 20, borderRadius: 10, background: color.accent.gold, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: color.text.onPrimary }}>
              {comments.length}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', borderBottom: `1px solid ${color.border.soft}` }}>
          {([
            { k: 'open' as const, l: `Open (${openComments.length})` },
            { k: 'resolved' as const, l: `Resolved (${resolvedComments.length})` },
          ]).map((t) => (
            <button
              key={t.k}
              onClick={() => setTab(t.k)}
              style={{
                flex: 1, padding: '10px 0', textAlign: 'center', fontSize: 12, fontWeight: 600,
                cursor: 'pointer', background: 'transparent', border: 'none',
                color: tab === t.k ? color.text.primary : color.text.tertiary,
                borderBottom: tab === t.k ? `2px solid ${color.accent.gold}` : '2px solid transparent',
              }}
            >
              {t.l}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: 14 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 30, color: color.text.tertiary, fontSize: 12 }}>Loading…</div>
          ) : visible.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px 10px', color: color.text.tertiary, fontSize: 12 }}>
              {tab === 'open' ? 'No open comments' : 'Nothing resolved yet'}
            </div>
          ) : (
            visible.map((c) => (
              <div key={c.id} style={{ marginBottom: 16, paddingBottom: 16, borderBottom: `1px solid ${color.border.soft}` }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: color.text.primary }}>{c.author_name}</span>
                  <span style={{ fontSize: 11, color: color.text.tertiary }}>– {c.author_role}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 11, color: color.text.tertiary }}>
                    {new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: color.text.secondary, lineHeight: 1.55, marginTop: 6 }}>{c.content}</div>
                {tab === 'open' && canResolve && (
                  <button
                    onClick={() => handleResolve(c.id)}
                    style={{ marginTop: 8, fontSize: 12, color: color.accent.gold, cursor: 'pointer', fontWeight: 600, background: 'transparent', border: 'none', padding: 0 }}
                  >
                    Mark resolved
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        {canComment && (
          <div style={{ padding: 12, borderTop: `1px solid ${color.border.soft}`, display: 'flex', gap: 8 }}>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitComment()}
              placeholder="Add a comment…"
              style={{ flex: 1, background: color.bg.canvas, border: `1px solid ${color.border.soft}`, borderRadius: 6, padding: '6px 10px', fontSize: 12, color: color.text.primary }}
            />
            <button
              onClick={submitComment}
              disabled={posting || !draft.trim()}
              style={{ background: color.accent.gold, border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: posting || !draft.trim() ? 0.5 : 1 }}
            >
              Post
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
