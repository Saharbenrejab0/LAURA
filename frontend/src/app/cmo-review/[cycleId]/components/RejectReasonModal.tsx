'use client'
/**
 * RejectReasonModal — mandatory reason before finalising a rejection.
 * Built to docs/cmo-review-design.html: red eyebrow, the LOA named in the
 * question, a one-line context strip, and the audit-trail note under the field.
 */
import { useState, useRef, useEffect } from 'react'
import type { LOA } from '@/types/loa'
import { formatEuro, loaCaption } from '@/types/review'

const FONT = "Inter, ui-sans-serif, system-ui, sans-serif"
const RED = '#8A2E27'

interface Props {
  loaId: string
  loa: LOA
  onConfirm: (loaId: string, reason: string) => Promise<void>
  onCancel: () => void
}

export default function RejectReasonModal({ loaId, loa, onConfirm, onCancel }: Props) {
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const textRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    textRef.current?.focus()
  }, [])

  const handleSubmit = async () => {
    const text = reason.trim()
    if (!text) { setError('A reason is required to reject.'); return }
    setSaving(true)
    try {
      await onConfirm(loaId, text)
    } finally {
      setSaving(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onCancel()
  }

  const title = loaCaption(loa)
  const context = [
    loa.loa_number || loa.loa_draft_id,
    loa.country,
    formatEuro(loa.fy_2026_total || 0),
    loa.requestor_email,
  ].filter(Boolean).join(' · ')

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(10,10,10,.42)',
        backdropFilter: 'blur(2px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 200,
        fontFamily: FONT,
      }}
      onClick={e => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div
        style={{
          width: 520,
          background: '#fff',
          borderRadius: 16,
          boxShadow: '0 24px 64px rgba(10,10,10,.24)',
          padding: '26px 26px 22px',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.14em', textTransform: 'uppercase', color: RED }}>
            Reject LOA
          </span>
          <span style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-.01em', color: '#0A0A0A' }}>
            Reject “{title}”?
          </span>
          <span style={{ fontSize: 12.5, color: '#5A554F', lineHeight: 1.55 }}>
            {context}
          </span>
        </div>

        {/* Reason */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label htmlFor="reject-reason" style={{ fontSize: 11.5, fontWeight: 600, color: '#0A0A0A' }}>
            Reason for rejection <span style={{ color: RED }}>*</span>
          </label>
          <textarea
            id="reject-reason"
            ref={textRef}
            value={reason}
            onChange={e => { setReason(e.target.value); setError('') }}
            placeholder="Explain why this LOA is being rejected…"
            style={{
              border: `1px solid ${error ? RED : '#0A0A0A'}`,
              borderRadius: 10,
              padding: '11px 13px',
              height: 104,
              background: '#fff',
              fontSize: 12.5,
              color: '#2A2A2A',
              lineHeight: 1.55,
              fontFamily: FONT,
              resize: 'none',
              outline: 'none',
              boxSizing: 'border-box',
              width: '100%',
            }}
          />
          <span style={{ fontSize: 11, color: error ? RED : '#9B9690' }}>
            {error || 'This reason is sent to the LOA owner and recorded in the audit trail.'}
          </span>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 2 }}>
          <button
            onClick={onCancel}
            style={{
              fontSize: 12.5,
              fontWeight: 500,
              color: '#5A554F',
              border: '1px solid #E0DED9',
              background: '#fff',
              borderRadius: 8,
              padding: '10px 18px',
              cursor: 'pointer',
              fontFamily: FONT,
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !reason.trim()}
            style={{
              fontSize: 12.5,
              fontWeight: 600,
              color: '#fff',
              background: reason.trim() ? RED : '#D6BFBD',
              border: 'none',
              borderRadius: 8,
              padding: '10px 20px',
              cursor: reason.trim() && !saving ? 'pointer' : 'default',
              fontFamily: FONT,
              transition: 'background 150ms',
            }}
          >
            {saving ? 'Rejecting…' : 'Confirm rejection'}
          </button>
        </div>
      </div>
    </div>
  )
}
