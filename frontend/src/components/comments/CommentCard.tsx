'use client';

/**
 * CommentCard — one comment in the rail.
 *
 * Shows: author name · role · severity badge · written_at_status
 * Content in plain text.
 * Actions: Resolve / Reopen / Edit / Delete (based on can_* flags from API)
 */

import { useState } from 'react';
import api from '@/lib/api';
import { color, font, radius, space } from '@/styles/tokens';

interface CommentData {
  id: string;
  anchor_type: string;
  field_key: string | null;
  section: string | null;
  author_name: string;
  author_role: string;
  content: string;
  severity: string;
  written_at_status: string;
  resolved: boolean;
  resolved_by: string | null;
  created_at: string;
  edited_at: string | null;
  can_resolve: boolean;
  can_reopen: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

interface CommentCardProps {
  comment: CommentData;
  onUpdated: () => void;
}

export default function CommentCard({ comment, onUpdated }: CommentCardProps) {
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(comment.content);

  const isBlocking = comment.severity === 'blocking';
  const isSuggestion = comment.severity === 'suggestion';

  const doAction = async (action: 'resolve' | 'reopen' | 'delete') => {
    setBusy(true);
    try {
      if (action === 'delete') {
        await api.delete(`/comments/${comment.id}`);
      } else {
        await api.post(`/comments/${comment.id}/${action}`);
      }
      onUpdated();
    } catch { /* silent */ }
    finally { setBusy(false); }
  };

  const doEdit = async () => {
    setBusy(true);
    try {
      await api.patch(`/comments/${comment.id}`, { content: editText });
      setEditing(false);
      onUpdated();
    } catch { /* silent */ }
    finally { setBusy(false); }
  };

  const statusLabel = comment.written_at_status
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());

  const timeLabel = formatTime(comment.created_at);

  return (
    <div style={{
      borderWidth: '1px', borderStyle: 'solid',
      borderColor: isBlocking ? '#E6C1BD' : color.border.soft,
      borderRadius: radius.card,
      background: isBlocking ? '#FFF8F7' : color.bg.surface,
      padding: space[3],
      opacity: comment.resolved ? 0.65 : 1,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        marginBottom: space[2], flexWrap: 'wrap',
      }}>
        <span style={{
          fontSize: 13, fontWeight: 600, color: color.text.primary,
        }}>{comment.author_name}</span>
        <span style={{
          fontSize: 11, color: color.text.tertiary,
        }}>· {comment.author_role}</span>
        <SeverityPill severity={comment.severity} />
        {comment.resolved && (
          <span style={{
            fontSize: 10, padding: '0 6px', borderRadius: 999,
            background: '#EAF1EE', color: color.status.success,
            fontWeight: 500, height: 16, lineHeight: '16px',
          }}>Resolved</span>
        )}
      </div>

      {/* Status + time */}
      <div style={{
        fontSize: 11, color: color.text.tertiary,
        marginBottom: space[2],
      }}>
        {statusLabel} · {timeLabel}
        {comment.edited_at && <span> · edited</span>}
      </div>

      {/* Content */}
      {editing ? (
        <div style={{ marginBottom: space[2] }}>
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            rows={3}
            style={{
              width: '100%', border: `1px solid ${color.border.strong}`,
              borderRadius: 8, padding: 8, fontFamily: font.sans,
              fontSize: 13, color: color.text.primary, resize: 'vertical',
              background: color.bg.surface,
            }}
          />
          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
            <ActionBtn label="Save" onClick={doEdit} disabled={busy} primary />
            <ActionBtn label="Cancel" onClick={() => { setEditing(false); setEditText(comment.content); }} />
          </div>
        </div>
      ) : (
        <p style={{
          margin: `0 0 ${space[2]}px`, fontSize: 13, lineHeight: '20px',
          color: color.text.primary, whiteSpace: 'pre-wrap',
          textDecoration: comment.resolved ? 'line-through' : 'none',
        }}>{comment.content}</p>
      )}

      {/* Actions */}
      {!editing && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {comment.can_resolve && !comment.resolved && (
            <ActionBtn label="Resolve" onClick={() => doAction('resolve')} disabled={busy} />
          )}
          {comment.can_reopen && comment.resolved && (
            <ActionBtn label="Reopen" onClick={() => doAction('reopen')} disabled={busy} />
          )}
          {comment.can_edit && !comment.resolved && (
            <ActionBtn label="Edit" onClick={() => setEditing(true)} />
          )}
          {comment.can_delete && (
            <ActionBtn label="Delete" onClick={() => doAction('delete')} disabled={busy} danger />
          )}
        </div>
      )}
    </div>
  );
}

function SeverityPill({ severity }: { severity: string }) {
  if (severity === 'note') return null;
  const s = severity === 'blocking'
    ? { bg: '#FFF1EF', border: '#E6C1BD', text: '#A33A32', label: 'Blocking' }
    : { bg: '#F7EFE2', border: '#E5CFAE', text: '#7A5522', label: 'Suggestion' };
  return (
    <span style={{
      fontSize: 10, padding: '0 6px', borderRadius: 999,
      background: s.bg, border: `1px solid ${s.border}`,
      color: s.text, fontWeight: 500, height: 16, lineHeight: '16px',
    }}>{s.label}</span>
  );
}

function ActionBtn({ label, onClick, disabled, primary, danger }: {
  label: string; onClick: () => void; disabled?: boolean; primary?: boolean; danger?: boolean;
}) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      background: primary ? color.action.primary : 'transparent',
      color: primary ? color.text.onPrimary : danger ? color.status.danger : color.text.secondary,
      border: primary ? 'none' : `1px solid ${danger ? color.status.danger : color.border.soft}`,
      borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 500,
      fontFamily: font.sans, cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.5 : 1,
    }}>{label}</button>
  );
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const mins = Math.round(diffMs / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  } catch { return iso; }
}
