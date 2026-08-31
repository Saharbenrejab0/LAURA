'use client'

import { useEffect, useState } from 'react'
import { createComment, listComments, resolveComment } from '@/lib/api'
import type { CommentItem } from '@/lib/api'
import { useToast } from '@/components/Toast'

interface CommentPanelProps {
  loaId: string
  section: string
  sectionLabel: string          // human-friendly title shown in the header
  canComment: boolean           // true if current user has comment rights at current step
  canResolve: boolean           // true if current user can mark as resolved
  onClose: () => void
  onCountChange?: (section: string, total: number, unresolved: number) => void
}

const STATUS_LABEL: Record<string, string> = {
  emea_review: 'EMEA review',
  global_review: 'Global review',
  cmo_cfo_review: 'CMO / CFO review',
  global_functions_review: 'Global functions',
  corporate_review: 'Corporate review',
  draft: 'Draft',
  approved: 'Approved',
  rejected: 'Rejected',
}

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime()
  if (!then) return ''
  const diff = Date.now() - then
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  if (diff < 30 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

export default function CommentPanel({
  loaId,
  section,
  sectionLabel,
  canComment,
  canResolve,
  onClose,
  onCountChange,
}: CommentPanelProps) {
  const { success, error: toastError } = useToast()

  const [comments, setComments] = useState<CommentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [posting, setPosting] = useState(false)
  const [resolvingId, setResolvingId] = useState<string | null>(null)

  // Load comments for this section
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    listComments(loaId, section)
      .then(data => {
        if (cancelled) return
        setComments(data)
        const unresolved = data.filter(c => !c.resolved).length
        onCountChange?.(section, data.length, unresolved)
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [loaId, section])

  async function handlePost() {
    if (!text.trim()) return
    setPosting(true)
    try {
      const created = await createComment(loaId, section, text.trim())
      const next = [...comments, created]
      setComments(next)
      setText('')
      success('Comment posted \u2713')
      onCountChange?.(section, next.length, next.filter(c => !c.resolved).length)
    } catch (e: any) {
      const detail = e.response?.data?.detail
      toastError(typeof detail === 'string' ? detail : 'Failed to post comment')
    } finally {
      setPosting(false)
    }
  }

  async function handleResolve(commentId: string) {
    setResolvingId(commentId)
    try {
      const updated = await resolveComment(commentId)
      const next = comments.map(c => c.id === commentId ? updated : c)
      setComments(next)
      onCountChange?.(section, next.length, next.filter(c => !c.resolved).length)
    } catch {
      toastError('Failed to resolve')
    } finally {
      setResolvingId(null)
    }
  }

  return (
    <div className="card overflow-hidden flex flex-col" style={{ maxHeight: 'calc(100vh - 120px)' }}>

      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
        <div>
          <p className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Comments on</p>
          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{sectionLabel}</p>
        </div>
        <button onClick={onClose} className="btn-ghost text-sm px-2" aria-label="Close comments">{'\u2715'}</button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {loading ? (
          <p className="text-xs text-center py-6" style={{ color: 'var(--text-muted)' }}>Loading\u2026</p>
        ) : comments.length === 0 ? (
          <p className="text-xs text-center py-6" style={{ color: 'var(--text-muted)' }}>
            No comments yet on this section.
          </p>
        ) : (
          <div className="space-y-3">
            {comments.map(c => (
              <div key={c.id} className="rounded-lg p-3" style={{
                background: c.resolved ? 'var(--bg-elevated)' : 'var(--bg-surface)',
                border: `1px solid ${c.resolved ? 'var(--border-soft, var(--border))' : 'var(--border)'}`,
                opacity: c.resolved ? 0.65 : 1,
              }}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                      {c.author_name}
                    </p>
                    <p className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>
                      {c.author_role} {'\u00B7'} {STATUS_LABEL[c.written_at_status] || c.written_at_status} {'\u00B7'} {timeAgo(c.created_at)}
                    </p>
                  </div>
                  {c.resolved && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0" style={{
                      background: 'var(--green-bg)', color: 'var(--green-text)', border: '1px solid var(--green-border)',
                    }}>resolved</span>
                  )}
                </div>
                <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--text-primary)', lineHeight: 1.45 }}>
                  {c.content}
                </p>
                {!c.resolved && canResolve && (
                  <button
                    onClick={() => handleResolve(c.id)}
                    disabled={resolvingId === c.id}
                    className="text-xs mt-2"
                    style={{ color: 'var(--green-text)', textDecoration: 'underline', textUnderlineOffset: '3px' }}
                  >
                    {resolvingId === c.id ? 'Resolving\u2026' : 'Mark as resolved'}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Composer */}
      {canComment ? (
        <div className="px-4 py-3" style={{ borderTop: '1px solid var(--border)' }}>
          <textarea
            className="input resize-none w-full"
            rows={3}
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder={`Add a comment on ${sectionLabel.toLowerCase()}\u2026`}
            disabled={posting}
          />
          <div className="flex justify-end mt-2">
            <button
              onClick={handlePost}
              disabled={posting || !text.trim()}
              className="btn-primary text-xs px-3 py-1.5"
            >
              {posting ? 'Posting\u2026' : 'Post comment'}
            </button>
          </div>
        </div>
      ) : (
        <div className="px-4 py-3" style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
          <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
            You can read but not comment at this step.
          </p>
        </div>
      )}
    </div>
  )
}