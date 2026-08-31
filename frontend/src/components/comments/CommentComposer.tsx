'use client';

/**
 * CommentComposer — write a new comment.
 *
 * Props tell it what anchor to use (LOA-level or field-level).
 * Severity selector: Note / Suggestion / Blocking.
 * Visibility label shows who will see the comment.
 * Plain text for MVP (content_format = 'plain_text').
 */

import { useState } from 'react';
import api from '@/lib/api';
import { color, font, radius, space } from '@/styles/tokens';

interface CommentComposerProps {
  loaId: string;
  anchorType: 'loa' | 'field';
  fieldKey?: string | null;
  onCreated: () => void;
}

export default function CommentComposer({
  loaId, anchorType, fieldKey, onCreated,
}: CommentComposerProps) {
  const [content, setContent] = useState('');
  const [severity, setSeverity] = useState<'note' | 'suggestion' | 'blocking'>('note');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSend = content.trim().length > 0;

  const send = async () => {
    if (!canSend) return;
    setSending(true); setError(null);
    try {
      await api.post(`/loa/${loaId}/comments`, {
        content: content.trim(),
        anchor_type: anchorType,
        field_key: anchorType === 'field' ? fieldKey : undefined,
        severity,
      });
      setContent('');
      setSeverity('note');
      onCreated();
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || 'Failed to post comment');
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      send();
    }
  };

  const label = anchorType === 'field' && fieldKey
    ? `Comment on ${fieldKey.replace(/_/g, ' ')}`
    : 'Comment on this LOA';

  return (
    <div style={{
      borderTop: `1px solid ${color.border.soft}`,
      paddingTop: space[3],
    }}>
      <p style={{
        margin: `0 0 ${space[2]}px`, fontSize: 11, fontWeight: 500,
        color: color.text.tertiary, textTransform: 'uppercase',
        letterSpacing: '0.04em',
      }}>{label}</p>

      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Write a comment…"
        rows={3}
        disabled={sending}
        style={{
          width: '100%',
          borderWidth: '1px', borderStyle: 'solid', borderColor: color.border.soft,
          borderRadius: radius.field,
          background: color.bg.canvas,
          padding: '8px 10px',
          fontFamily: font.sans, fontSize: 13, lineHeight: '20px',
          color: color.text.primary,
          resize: 'vertical', minHeight: 60,
          outline: 'none',
        }}
      />

      {/* Severity selector + send */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: space[2],
        marginTop: space[2], flexWrap: 'wrap',
      }}>
        <SeverityToggle value={severity} onChange={setSeverity} />
        <div style={{ flex: 1 }} />
        <span style={{
          fontSize: 10, color: color.text.tertiary,
        }}>⌘+Enter to send</span>
        <button
          onClick={send}
          disabled={!canSend || sending}
          style={{
            background: canSend && !sending ? color.action.primary : color.border.strong,
            color: color.text.onPrimary,
            border: 'none', borderRadius: 8,
            padding: '6px 14px', fontSize: 12, fontWeight: 600,
            fontFamily: font.sans,
            cursor: canSend && !sending ? 'pointer' : 'not-allowed',
          }}
        >
          {sending ? 'Sending…' : 'Comment'}
        </button>
      </div>

      {error && (
        <p style={{
          margin: `${space[1]}px 0 0`, fontSize: 11,
          color: color.status.danger,
        }}>{error}</p>
      )}
    </div>
  );
}

function SeverityToggle({ value, onChange }: {
  value: string; onChange: (v: 'note' | 'suggestion' | 'blocking') => void;
}) {
  const options: { key: 'note' | 'suggestion' | 'blocking'; label: string; color: string }[] = [
    { key: 'note', label: 'Note', color: color.text.secondary },
    { key: 'suggestion', label: 'Suggestion', color: '#7A5522' },
    { key: 'blocking', label: 'Blocking', color: '#A33A32' },
  ];

  return (
    <div style={{
      display: 'inline-flex', borderRadius: 8, overflow: 'hidden',
      border: `1px solid ${color.border.soft}`,
    }}>
      {options.map((o) => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          style={{
            background: value === o.key ? color.bg.subtle : 'transparent',
            color: value === o.key ? o.color : color.text.tertiary,
            border: 'none',
            padding: '3px 10px', fontSize: 11, fontWeight: value === o.key ? 600 : 400,
            fontFamily: font.sans, cursor: 'pointer',
            borderRight: o.key !== 'blocking' ? `1px solid ${color.border.soft}` : 'none',
          }}
        >{o.label}</button>
      ))}
    </div>
  );
}
