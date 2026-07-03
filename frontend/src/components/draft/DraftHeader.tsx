'use client';

/**
 * DraftHeader - top of the LOA detail page.
 *   - LOA ID (Plex Mono) + status badge + origin badge
 *   - Title (the campaign description headline)
 *   - Autosave indicator (right side)
 *   - Submit button (when editable + not yet submitted)
 *
 * Origin badge behavior:
 *   draft / rejected -> "Duplicated from"
 *   under review     -> "Based on"
 *   approved         -> hidden (the artifact is its own thing)
 */

import StatusBadge from '@/components/StatusBadge';
import OriginBadge from '@/components/OriginBadge';
import { color, font, space, type } from '@/styles/tokens';

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

interface DraftHeaderProps {
  loaDraftId: string;
  title: string;
  status: string;
  duplicatedFromId?: string | null;
  duplicatedFromDraftId?: string | null;
  saveState: SaveState;
  lastSavedAt?: Date | null;
  editable: boolean;
  onSubmit?: () => void;
}

export default function DraftHeader({
  loaDraftId, title, status, duplicatedFromId, duplicatedFromDraftId,
  saveState, lastSavedAt, editable, onSubmit,
}: DraftHeaderProps) {
  return (
    <header style={{ marginBottom: space[6] }}>
      {/* Top row: id chips + autosave + submit */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: space[3],
        marginBottom: space[3], flexWrap: 'wrap',
      }}>
        <span style={{
          fontFamily: font.mono, fontSize: 13, fontWeight: 500,
          color: color.text.primary,
        }}>{loaDraftId}</span>

        <StatusBadge status={status} />

        {duplicatedFromDraftId && (
          <OriginBadge sourceId={duplicatedFromDraftId} status={status} />
        )}

        <div style={{ flex: 1 }} />

        <AutosaveIndicator saveState={saveState} lastSavedAt={lastSavedAt} />

        {editable && status === 'draft' && onSubmit && (
          <button onClick={onSubmit} style={{
            background: color.action.primary, color: color.text.onPrimary,
            border: 'none', borderRadius: 10, height: 36,
            padding: '0 16px', fontFamily: font.sans,
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>Submit LOA</button>
        )}
      </div>

      {/* Title */}
      <h1 style={{
        margin: 0,
        fontSize: type.h1.size, lineHeight: `${type.h1.line}px`,
        fontWeight: type.h1.weight, color: color.text.primary,
      }}>{title || 'Untitled LOA'}</h1>

      {!editable && (
        <p style={{
          margin: `${space[2]}px 0 0`,
          fontSize: 12, color: color.text.tertiary, fontStyle: 'italic',
        }}>
          Read-only at this step. Editing resumes if returned for revisions.
        </p>
      )}
    </header>
  );
}

/* -------------------------------------------------------------------- */
/* Autosave                                                             */
/* -------------------------------------------------------------------- */

function AutosaveIndicator({ saveState, lastSavedAt }: {
  saveState: SaveState; lastSavedAt?: Date | null;
}) {
  const { dot, label } = (() => {
    if (saveState === 'saving') return { dot: color.text.tertiary, label: 'Saving…' };
    if (saveState === 'error')  return { dot: color.status.danger,  label: "Couldn't save" };
    if (saveState === 'saved' && lastSavedAt) {
      return { dot: color.status.success, label: `Saved ${formatRelative(lastSavedAt)}` };
    }
    return { dot: 'transparent', label: '' };
  })();

  if (!label) return null;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      fontSize: 12, color: saveState === 'error' ? color.status.danger : color.text.secondary,
      fontFamily: font.sans,
    }}>
      <span style={{
        display: 'inline-block', width: 6, height: 6, borderRadius: 999,
        background: dot, animation: saveState === 'saving' ? 'laura-pulse 900ms ease-in-out infinite' : 'none',
      }} />
      {label}
      <style>{`@keyframes laura-pulse { 0%,100% { opacity:1 } 50% { opacity:0.3 } }`}</style>
    </span>
  );
}

function formatRelative(d: Date): string {
  const diffMs = Date.now() - d.getTime();
  const s = Math.round(diffMs / 1000);
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
