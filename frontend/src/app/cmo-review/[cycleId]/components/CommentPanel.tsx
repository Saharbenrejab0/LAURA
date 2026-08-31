'use client'
/**
 * CommentPanel — right slide-out panel, built to docs/cmo-review-design.html.
 * White 352px column: thread for the current slide, then a composer whose
 * output is visible to the LOA owner.
 */
import { useState, useRef, useEffect } from 'react'
import type { ReviewComment } from '@/types/review'

const FONT = "Inter, ui-sans-serif, system-ui, sans-serif"

interface Props {
  slideId: string
  slideNumber: number
  slideTitle: string
  comments: ReviewComment[]
  isSubmitted: boolean
  onAddComment: (slideId: string, text: string) => Promise<void>
  onClose: () => void
}

export default function CommentPanel({
  slideId, slideNumber, slideTitle, comments, isSubmitted, onAddComment, onClose,
}: Props) {
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const textRef = useRef<HTMLTextAreaElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    textRef.current?.focus()
  }, [])

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [comments.length])

  const handleSubmit = async () => {
    const text = draft.trim()
    if (!text || saving) return
    setSaving(true)
    try {
      await onAddComment(slideId, text)
      setDraft('')
    } finally {
      setSaving(false)
    }
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSubmit()
    }
    if (e.key === 'Escape') onClose()
  }

  return (
    <div style={{
      width: 352,
      flexShrink: 0,
      background: '#fff',
      borderLeft: '1px solid #EAEAEA',
      display: 'flex',
      flexDirection: 'column',
      boxShadow: '-18px 0 40px rgba(10,10,10,.06)',
      fontFamily: FONT,
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 18px 12px',
        borderBottom: '1px solid #F0EFEC',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 10,
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
          <span style={{ fontSize: 13.5, fontWeight: 600, color: '#0A0A0A' }}>Comments</span>
          <span style={{
            fontSize: 11,
            color: '#9B9690',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            Slide {slideNumber} · {slideTitle}
          </span>
        </div>
        <button
          onClick={onClose}
          aria-label="Close comments"
          style={{
            fontSize: 14,
            color: '#9B9690',
            cursor: 'pointer',
            lineHeight: 1,
            background: 'none',
            border: 'none',
            padding: 0,
            flexShrink: 0,
          }}
        >
          ✕
        </button>
      </div>

      {/* Thread */}
      <div
        ref={listRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '14px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        {comments.length === 0 && (
          <div style={{ fontSize: 12, color: '#B3AEA7', textAlign: 'center', paddingTop: 24, lineHeight: 1.6 }}>
            No comments on this slide yet.
            {!isSubmitted && <><br />Add the first one below.</>}
          </div>
        )}
        {comments.map(comment => (
          <CommentItem key={comment.id} comment={comment} />
        ))}
      </div>

      {/* Composer */}
      {!isSubmitted && (
        <div style={{
          padding: '12px 18px 16px',
          borderTop: '1px solid #F0EFEC',
          display: 'flex',
          flexDirection: 'column',
          gap: 9,
          flexShrink: 0,
        }}>
          <textarea
            ref={textRef}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Add a comment for the owner…"
            style={{
              border: '1px solid #E0DED9',
              borderRadius: 10,
              padding: '10px 12px',
              minHeight: 64,
              fontSize: 12,
              color: '#2A2A2A',
              fontFamily: FONT,
              resize: 'none',
              outline: 'none',
              lineHeight: 1.55,
              boxSizing: 'border-box',
              width: '100%',
              background: '#fff',
            }}
          />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 10.5, color: '#B3AEA7' }}>Visible to the LOA owner</span>
            <button
              onClick={handleSubmit}
              disabled={!draft.trim() || saving}
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: draft.trim() ? '#fff' : '#B3AEA7',
                background: draft.trim() ? '#0A0A0A' : '#F0EFEC',
                borderRadius: 8,
                border: 'none',
                padding: '8px 16px',
                cursor: draft.trim() && !saving ? 'pointer' : 'default',
                fontFamily: FONT,
              }}
            >
              {saving ? 'Posting…' : 'Post'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function CommentItem({ comment }: { comment: ReviewComment }) {
  const initials = comment.authorName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase()

  const time = new Date(comment.createdAt).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{
          width: 22,
          height: 22,
          borderRadius: 99,
          background: '#0A0A0A',
          color: '#fff',
          fontSize: 9,
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>{initials}</span>
        <span style={{ fontSize: 11.5, fontWeight: 600, color: '#0A0A0A' }}>{comment.authorName}</span>
        <span style={{ fontSize: 10.5, color: '#B3AEA7' }}>{time}</span>
      </div>
      <div style={{
        background: '#FAFAFA',
        border: '1px solid #F0EFEC',
        borderRadius: 10,
        padding: '9px 11px',
      }}>
        <p style={{ fontSize: 12, lineHeight: 1.55, color: '#2A2A2A', margin: 0, wordBreak: 'break-word' }}>
          {comment.text}
        </p>
      </div>
    </div>
  )
}
