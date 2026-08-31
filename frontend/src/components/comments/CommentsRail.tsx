'use client';

/**
 * CommentsRail — the slide-in panel from the right.
 *
 * Opens as an overlay (backdrop + panel). Shows comments grouped by:
 *   1. Current step, unresolved
 *   2. Open from previous steps
 *   3. Resolved
 *
 * When focused on a specific field, shows only that field's comments.
 * When opened globally, shows all.
 *
 * Includes CommentComposer at the bottom.
 */

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import CommentCard from './CommentCard';
import CommentComposer from './CommentComposer';
import { color, font, motion, radius, space } from '@/styles/tokens';

interface CommentsRailProps {
  loaId: string;
  loaStatus: string;
  /** If set, filter to this field only. Null = show all. */
  fieldKey: string | null;
  onClose: () => void;
}

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

export default function CommentsRail({
  loaId, loaStatus, fieldKey, onClose,
}: CommentsRailProps) {
  const [comments, setComments] = useState<CommentData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchComments = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (fieldKey) params.set('field_key', fieldKey);
      const { data } = await api.get(`/loa/${loaId}/comments?${params.toString()}`);
      setComments(data.comments || []);
    } catch { setComments([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchComments(); }, [loaId, fieldKey]);

  // Esc closes
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Group comments
  const currentUnresolved = comments.filter(c => !c.resolved && c.written_at_status === loaStatus);
  const previousUnresolved = comments.filter(c => !c.resolved && c.written_at_status !== loaStatus);
  const resolved = comments.filter(c => c.resolved);

  const fieldLabel = fieldKey
    ? fieldKey.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    : 'All comments';

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(22,20,18,0.24)',
          backdropFilter: 'blur(2px)',
          zIndex: 300,
          animation: `railFadeIn ${motion.duration.base}ms ${motion.easing}`,
        }}
      />

      {/* Rail */}
      <aside style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 'min(380px, calc(100vw - 48px))',
        background: color.bg.surface,
        borderLeft: `1px solid ${color.border.soft}`,
        zIndex: 301,
        display: 'flex', flexDirection: 'column',
        animation: `railSlideIn ${motion.duration.base}ms ${motion.easing}`,
      }}>
        {/* Header */}
        <div style={{
          padding: `${space[4]}px ${space[4]}px ${space[3]}px`,
          borderBottom: `1px solid ${color.border.soft}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <p style={{
              margin: 0, fontSize: 14, fontWeight: 600, color: color.text.primary,
            }}>{fieldLabel}</p>
            <p style={{
              margin: `2px 0 0`, fontSize: 12, color: color.text.tertiary,
            }}>
              {loading ? 'Loading…' : `${comments.length} comment${comments.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          <button onClick={onClose} style={{
            background: 'transparent', border: 'none',
            fontSize: 18, color: color.text.tertiary,
            cursor: 'pointer', padding: 4, lineHeight: 1,
          }}>×</button>
        </div>

        {/* Comments body - scrollable */}
        <div style={{
          flex: 1, overflowY: 'auto', padding: space[4],
          display: 'flex', flexDirection: 'column', gap: space[3],
        }}>
          {loading ? (
            <p style={{ fontSize: 13, color: color.text.tertiary, textAlign: 'center',
              padding: space[6] }}>Loading comments…</p>
          ) : comments.length === 0 ? (
            <p style={{ fontSize: 13, color: color.text.tertiary, textAlign: 'center',
              padding: space[6], fontStyle: 'italic' }}>
              No comments yet.{fieldKey ? ` Be the first to comment on ${fieldLabel}.` : ''}
            </p>
          ) : (
            <>
              {currentUnresolved.length > 0 && (
                <CommentGroup
                  label={`Current step · ${humanStatus(loaStatus)}`}
                  comments={currentUnresolved}
                  onUpdated={fetchComments}
                />
              )}
              {previousUnresolved.length > 0 && (
                <CommentGroup
                  label="Open from previous steps"
                  comments={previousUnresolved}
                  onUpdated={fetchComments}
                  muted
                />
              )}
              {resolved.length > 0 && (
                <CollapsibleGroup
                  label={`Resolved (${resolved.length})`}
                  comments={resolved}
                  onUpdated={fetchComments}
                />
              )}
            </>
          )}
        </div>

        {/* Composer - fixed at bottom */}
        <div style={{ padding: space[4] }}>
          <CommentComposer
            loaId={loaId}
            anchorType={fieldKey ? 'field' : 'loa'}
            fieldKey={fieldKey}
            onCreated={fetchComments}
          />
        </div>
      </aside>

      <style>{`
        @keyframes railSlideIn {
          from { transform: translateX(16px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes railFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </>
  );
}

/* ── Sub-components ─────────────────────────────────────────────── */

function CommentGroup({ label, comments, onUpdated, muted }: {
  label: string; comments: CommentData[]; onUpdated: () => void; muted?: boolean;
}) {
  return (
    <div>
      <p style={{
        margin: `0 0 ${space[2]}px`, fontSize: 11, fontWeight: 500,
        color: muted ? color.text.tertiary : color.text.secondary,
        textTransform: 'uppercase', letterSpacing: '0.04em',
      }}>{label}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: space[2] }}>
        {comments.map(c => (
          <CommentCard key={c.id} comment={c} onUpdated={onUpdated} />
        ))}
      </div>
    </div>
  );
}

function CollapsibleGroup({ label, comments, onUpdated }: {
  label: string; comments: CommentData[]; onUpdated: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button onClick={() => setOpen(!open)} style={{
        background: 'transparent', border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 6,
        padding: `${space[1]}px 0`, width: '100%',
      }}>
        <span style={{
          fontSize: 11, fontWeight: 500, color: color.text.tertiary,
          textTransform: 'uppercase', letterSpacing: '0.04em',
        }}>{label}</span>
        <span style={{ fontSize: 10, color: color.text.tertiary }}>
          {open ? '▾' : '▸'}
        </span>
      </button>
      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: space[2], marginTop: space[1] }}>
          {comments.map(c => (
            <CommentCard key={c.id} comment={c} onUpdated={onUpdated} />
          ))}
        </div>
      )}
    </div>
  );
}

function humanStatus(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
