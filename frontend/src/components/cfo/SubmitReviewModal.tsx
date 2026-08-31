'use client';
import { useEffect } from 'react';
import type { LOA } from '@/types/loa';
import type { ReviewVerdict } from '@/types/review';
import { formatEuro } from '@/types/review';

interface Props {
  loas: LOA[];
  verdicts: Record<string, ReviewVerdict>;
  onConfirm: () => void;
  onCancel: () => void;
  submitting?: boolean;
}

export default function SubmitReviewModal({ loas, verdicts, onConfirm, onCancel, submitting }: Props) {
  const approved = loas.filter(l => verdicts[l.id]?.decision === 'approved');
  const rejected = loas.filter(l => verdicts[l.id]?.decision === 'rejected');

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
      onClick={e => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div style={{ background: '#fff', borderRadius: 12, padding: '28px 28px 24px', width: 520, maxWidth: '95vw', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
        <h2 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 700, color: '#1a1a1a' }}>Submit Review</h2>
        <p style={{ margin: '0 0 20px', fontSize: 13.5, color: '#666' }}>
          You've reviewed all {loas.length} LOAs.
        </p>

        {/* Summary counts */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
          <div style={{ flex: 1, borderRadius: 8, background: '#F0FAF4', border: '1px solid #C3E6CF', padding: '14px 16px' }}>
            <div style={{ fontSize: 26, fontWeight: 700, color: '#1A7348', fontVariantNumeric: 'tabular-nums' }}>{approved.length}</div>
            <div style={{ fontSize: 12.5, color: '#1A7348', marginTop: 2 }}>Approved</div>
          </div>
          <div style={{ flex: 1, borderRadius: 8, background: '#FDF2F0', border: '1px solid #F0C4BE', padding: '14px 16px' }}>
            <div style={{ fontSize: 26, fontWeight: 700, color: '#8A2E27', fontVariantNumeric: 'tabular-nums' }}>{rejected.length}</div>
            <div style={{ fontSize: 12.5, color: '#8A2E27', marginTop: 2 }}>Rejected</div>
          </div>
        </div>

        {/* Rejected LOA list */}
        {rejected.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#8A2E27', letterSpacing: '0.06em', marginBottom: 8 }}>
              REJECTIONS ({rejected.length})
            </div>
            <div style={{ maxHeight: 200, overflow: 'auto', borderRadius: 8, border: '1px solid #F0C4BE' }}>
              {rejected.map(loa => {
                const verdict = verdicts[loa.id];
                return (
                  <div key={loa.id} style={{ padding: '9px 12px', borderBottom: '1px solid #FAE8E6', fontSize: 13 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <span style={{ fontWeight: 600, color: '#1a1a1a', flex: 1 }}>{loa.detail || loa.activity_type || '—'}</span>
                      <span style={{ color: '#8A2E27', fontVariantNumeric: 'tabular-nums', fontSize: 12, flexShrink: 0 }}>
                        {formatEuro(loa.fy_2026_total)}
                      </span>
                    </div>
                    {verdict?.reason && (
                      <div style={{ marginTop: 3, fontSize: 12, color: '#666', fontStyle: 'italic' }}>"{verdict.reason}"</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Warning */}
        <div style={{ padding: '10px 14px', borderRadius: 8, background: '#FBF7ED', border: '1px solid #E8D9B8', marginBottom: 22, fontSize: 13, color: '#8A6A00', lineHeight: 1.5 }}>
          This is a final action. You won't be able to change verdicts after submission.
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            disabled={submitting}
            style={{ height: 38, padding: '0 20px', borderRadius: 8, border: '1.5px solid #D9D5CD', background: 'transparent', fontSize: 14, fontWeight: 600, cursor: 'pointer', color: '#444' }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={submitting}
            style={{ height: 38, padding: '0 24px', borderRadius: 8, border: 'none', background: submitting ? '#888' : '#1a1a1a', color: '#fff', fontSize: 14, fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer', transition: 'background 150ms' }}
          >
            {submitting ? 'Submitting…' : 'Submit Review'}
          </button>
        </div>
      </div>
    </div>
  );
}
