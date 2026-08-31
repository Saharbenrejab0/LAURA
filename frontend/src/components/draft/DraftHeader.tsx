'use client';

/**
 * DraftHeader — Editorial Finance redesign.
 *
 * Kept as a standalone atom used by app/loa/[id]/page.tsx. Renders:
 *   - Overline "LOA <draft_id>"
 *   - Big Cormorant title (the description headline)
 *   - Status pill + optional "duplicated from" chip
 *   - Autosave indicator (right side)
 *   - Optional Submit button (visible only when draft + editable)
 *
 * All original props preserved.
 */

import { Pill, Overline } from '@/components/ui/atoms';

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
  loaDraftId, title, status, duplicatedFromDraftId,
  saveState, lastSavedAt, editable, onSubmit,
}: DraftHeaderProps) {
  return (
    <div>
      {/* Overline: LOA id + status pill */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
        marginBottom: 8,
      }}>
        <Overline style={{
          fontFamily: 'var(--font-mono)', fontSize: 11.5,
          color: 'var(--text-secondary)', letterSpacing: '.06em',
        }}>
          {loaDraftId}
        </Overline>
        <Pill status={status} />
        {duplicatedFromDraftId && (
          <span style={{
            fontSize: 11, color: 'var(--text-tertiary)',
            display: 'inline-flex', alignItems: 'center', gap: 4,
          }}>
            <span style={{ opacity: 0.6 }}>↳</span>
            <span style={{ fontFamily: 'var(--font-mono)' }}>
              {status === 'draft' || status === 'rejected' ? 'from ' : 'based on '}
              {duplicatedFromDraftId}
            </span>
          </span>
        )}
        <div style={{ flex: 1 }} />
        <AutosaveIndicator saveState={saveState} lastSavedAt={lastSavedAt} />
      </div>

      {/* Title */}
      <h1 style={{
        margin: 0,
        fontFamily: 'var(--font-display)',
        fontSize: 34, fontWeight: 600,
        lineHeight: 1.15, letterSpacing: '-0.01em',
        color: 'var(--text-primary)',
      }}>
        {title}
      </h1>

      {editable && status === 'draft' && onSubmit && (
        <button
          onClick={onSubmit}
          style={{
            marginTop: 16,
            height: 38, padding: '0 20px', borderRadius: 8,
            background: 'var(--ink)', color: 'var(--ink-text)',
            border: 'none', cursor: 'pointer',
            fontSize: 13.5, fontWeight: 600,
            fontFamily: 'var(--font-sans)',
          }}
        >
          Submit for review
        </button>
      )}
    </div>
  );
}

function AutosaveIndicator({ saveState, lastSavedAt }: { saveState: SaveState; lastSavedAt?: Date | null }) {
  if (saveState === 'idle' && !lastSavedAt) return null;

  const dotStyle = (bg: string): React.CSSProperties => ({
    display: 'inline-block', width: 6, height: 6, borderRadius: 999,
    background: bg, marginRight: 6, flexShrink: 0,
  });

  if (saveState === 'saving') {
    return (
      <span style={indicatorStyle('var(--text-tertiary)')}>
        <span style={dotStyle('var(--text-tertiary)')} /> Saving…
      </span>
    );
  }
  if (saveState === 'error') {
    return (
      <span style={indicatorStyle('var(--st-rejected-fg)')}>
        <span style={dotStyle('var(--st-rejected-fg)')} /> Save failed
      </span>
    );
  }
  return (
    <span style={indicatorStyle('var(--st-approved-fg)')}>
      <span style={dotStyle('var(--st-approved-fg)')} />
      Saved {lastSavedAt ? relativeTime(lastSavedAt) : ''}
    </span>
  );
}

function indicatorStyle(color: string): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center',
    fontSize: 11.5, color,
    fontFamily: 'var(--font-sans)',
    whiteSpace: 'nowrap',
  };
}

function relativeTime(d: Date): string {
  const diff = Date.now() - d.getTime();
  if (diff < 5_000) return 'just now';
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}
