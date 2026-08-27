'use client'
/**
 * CommentPopover — the thread on one anchor, floated next to it.
 *
 * Rendered by whichever panel owns the active anchor; positioning comes from
 * useAnchorPopover, which also decides whether the caret points up or down.
 */
import { useState, useRef, useEffect } from 'react'
import type { ReviewComment } from '@/types/review'
import { anchorName, anchorLabel } from './anchors'
import { POPOVER_WIDTH, type PopoverPos } from './useAnchorPopover'

const MONO = "'IBM Plex Mono', ui-monospace, monospace"

const caretBase: React.CSSProperties = {
  position: 'absolute', width: 9, height: 9, background: 'var(--surface)',
  borderLeft: '1px solid var(--border)', borderTop: '1px solid var(--border)',
}

/** The caret is a rotated square; which two borders show depends on the side. */
function caretPlacement(pos: PopoverPos): React.CSSProperties {
  switch (pos.side) {
    case 'below': return { left: pos.caret, top: -5, transform: 'rotate(45deg)' }
    case 'above': return { left: pos.caret, top: 'calc(100% - 5px)', transform: 'rotate(225deg)' }
    case 'right': return { top: pos.caret, left: -5, transform: 'rotate(315deg)' }
    case 'left':  return { top: pos.caret, left: 'calc(100% - 5px)', transform: 'rotate(135deg)' }
  }
}

interface Props {
  anchor: string
  comments: ReviewComment[]
  pos: PopoverPos
  onPost: (text: string, anchor: string) => Promise<void>
  readOnly?: boolean
  onClose: () => void
}

function initials(name?: string): string {
  const parts = (name || '?').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function whenLabel(iso: string): string {
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return ''
  const mins = Math.round((Date.now() - t) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`
  const days = Math.round(hrs / 24)
  if (days < 8) return `${days} day${days === 1 ? '' : 's'} ago`
  return new Date(iso).toLocaleDateString()
}

export default function CommentPopover({
  anchor, comments, pos, onPost, readOnly = false, onClose,
}: Props) {
  const [text, setText] = useState('')
  const [posting, setPosting] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { if (!readOnly) textareaRef.current?.focus() }, [readOnly, anchor])

  async function handlePost() {
    if (!text.trim()) return
    setPosting(true)
    try {
      await onPost(text.trim(), anchor)
      setText('')
    } finally {
      setPosting(false)
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { e.stopPropagation(); onClose() }
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handlePost()
  }

  return (
    <div
      onClick={e => e.stopPropagation()}
      style={{
        position: 'absolute', left: pos.left, top: pos.top, width: POPOVER_WIDTH, zIndex: 60,
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
        boxShadow: '0 18px 44px rgba(10,10,10,.22)',
        display: 'flex', flexDirection: 'column',
      }}
    >
      {/* Caret — sits on whichever edge faces the anchor */}
      <span style={{ ...caretBase, ...caretPlacement(pos) }} />

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 12px', borderBottom: '1px solid var(--surface-sunken)', position: 'relative',
      }}>
        <span style={{
          fontSize: 10, fontWeight: 700, letterSpacing: '.09em',
          textTransform: 'uppercase', color: '#8A6A3F',
        }}>
          {anchorLabel(anchor)}
          {comments.length > 0 && ` · ${comments.length} comment${comments.length === 1 ? '' : 's'}`}
        </span>
        <button
          onClick={onClose}
          aria-label="Close thread"
          style={{ background: 'none', border: 'none', fontSize: 12, color: 'var(--text-tertiary)', cursor: 'pointer', padding: 2 }}
        >
          ✕
        </button>
      </div>

      {/* Thread */}
      <div style={{
        padding: '11px 12px', display: 'flex', flexDirection: 'column', gap: 12,
        maxHeight: 240, overflowY: 'auto',
      }}>
        {comments.length === 0 && (
          <p style={{ fontSize: 11.5, color: 'var(--text-faint)', margin: 0, lineHeight: 1.5 }}>
            No comments on {anchorName(anchor).toLowerCase()} yet.
          </p>
        )}
        {comments.map(c => (
          <div key={c.id} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
              <span style={{
                width: 20, height: 20, borderRadius: 99, background: 'var(--text-primary)', color: 'var(--surface)',
                fontSize: 8.5, fontWeight: 600,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                {initials(c.authorName)}
              </span>
              <span style={{ fontSize: 11, fontWeight: 600 }}>{c.authorName}</span>
              <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>{whenLabel(c.createdAt)}</span>
            </div>
            <p style={{ fontSize: 11.5, lineHeight: 1.5, color: 'var(--text-primary)', margin: 0, whiteSpace: 'pre-wrap' }}>
              {c.text}
            </p>
          </div>
        ))}
      </div>

      {/* Compose */}
      {!readOnly && (
        <div style={{ padding: '10px 12px', borderTop: '1px solid var(--surface-sunken)' }}>
          <textarea
            ref={textareaRef}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={handleKey}
            placeholder={`Add a comment on ${anchorName(anchor).toLowerCase()}…`}
            rows={2}
            style={{
              width: '100%', boxSizing: 'border-box', resize: 'none',
              border: '1px solid var(--border)', borderRadius: 8,
              padding: '7px 9px', fontSize: 11, fontFamily: 'inherit',
              outline: 'none', marginBottom: 8, color: 'var(--text-primary)',
            }}
          />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ fontFamily: MONO, fontSize: 9, color: 'var(--text-faint)' }}>⌘↵ to post</span>
            <button
              onClick={handlePost}
              disabled={posting || !text.trim()}
              style={{
                fontSize: 11, fontWeight: 600, color: 'var(--surface)',
                background: 'var(--text-primary)', border: 'none', borderRadius: 8,
                padding: '7px 12px', cursor: posting || !text.trim() ? 'default' : 'pointer',
                opacity: posting || !text.trim() ? 0.45 : 1,
              }}
            >
              {posting ? 'Posting…' : 'Post'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
