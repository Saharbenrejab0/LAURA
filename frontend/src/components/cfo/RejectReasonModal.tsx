'use client';
import { useRef, useEffect, useState } from 'react';
import type { LOA } from '@/types/loa';
import { formatEuro } from '@/types/review';

interface Props {
  loa?: LOA;
  loas?: LOA[];
  groupLabel?: string;
  onConfirm: (reason: string, loaIds: string[]) => void;
  onCancel: () => void;
}

export default function RejectReasonModal({ loa, loas, groupLabel, onConfirm, onCancel }: Props) {
  const [reason, setReason] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => {
    const src = loas ?? (loa ? [loa] : []);
    return new Set(src.map(l => l.id));
  });
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const isBulk = !!loas && loas.length > 1;
  const targetLabel = isBulk
    ? `${selectedIds.size} LOA${selectedIds.size !== 1 ? 's' : ''} in ${groupLabel ?? 'this group'}`
    : (loa?.detail || loa?.activity_type || 'this LOA');

  const toggleId = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const canConfirm = reason.trim().length > 0 && selectedIds.size > 0;

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
      onClick={e => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div style={{ background: '#fff', borderRadius: 12, padding: '28px 28px 24px', width: 500, maxWidth: '95vw', maxHeight: '85vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column', gap: 0 }}>
        <h2 style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 700, color: '#1a1a1a', lineHeight: 1.3 }}>
          Reject {targetLabel}?
        </h2>

        {!isBulk && loa && (
          <p style={{ margin: '0 0 20px', fontSize: 13, color: '#666', lineHeight: 1.4 }}>
            {loa.brand} · {formatEuro(loa.fy_2026_total)} · {loa.sap_event_code || '—'}
          </p>
        )}

        {isBulk && loas && loas.length > 0 && (
          <div style={{ margin: '8px 0 20px', maxHeight: 180, overflow: 'auto', borderRadius: 8, border: '1px solid #E8E6E0' }}>
            {loas.map(l => (
              <label
                key={l.id}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 12px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid #F4F3F0', lineHeight: 1.3 }}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(l.id)}
                  onChange={() => toggleId(l.id)}
                  style={{ width: 14, height: 14, flexShrink: 0, accentColor: '#8A2E27' }}
                />
                <span style={{ flex: 1, color: '#333' }}>{l.detail || l.activity_type || '—'}</span>
                <span style={{ color: '#999', fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{formatEuro(l.fy_2026_total)}</span>
              </label>
            ))}
          </div>
        )}

        <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: '#1a1a1a' }}>
          Reason for rejection *
        </label>
        <textarea
          ref={textareaRef}
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="Explain why these LOAs are being rejected…"
          rows={4}
          style={{ width: '100%', boxSizing: 'border-box', borderRadius: 8, border: '1.5px solid #D9D5CD', padding: '10px 12px', fontSize: 14, resize: 'vertical', outline: 'none', fontFamily: 'inherit', lineHeight: 1.5, transition: 'border-color 150ms' }}
          onFocus={e => { e.target.style.borderColor = '#B08D2F'; }}
          onBlur={e => { e.target.style.borderColor = '#D9D5CD'; }}
        />
        <p style={{ margin: '6px 0 24px', fontSize: 11.5, color: '#999' }}>
          This reason is sent to the LOA owner and recorded in the audit trail.
        </p>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{ height: 36, padding: '0 18px', borderRadius: 8, border: '1.5px solid #D9D5CD', background: 'transparent', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', color: '#444' }}
          >
            Cancel
          </button>
          <button
            onClick={() => canConfirm && onConfirm(reason.trim(), [...selectedIds])}
            disabled={!canConfirm}
            style={{ height: 36, padding: '0 20px', borderRadius: 8, border: 'none', background: canConfirm ? '#8A2E27' : '#D9D5CD', color: canConfirm ? '#fff' : '#999', fontSize: 13.5, fontWeight: 600, cursor: canConfirm ? 'pointer' : 'not-allowed', transition: 'background 150ms' }}
          >
            Confirm Rejection
          </button>
        </div>
      </div>
    </div>
  );
}
