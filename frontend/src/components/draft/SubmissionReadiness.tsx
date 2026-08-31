'use client';

/**
 * SubmissionReadiness — Editorial Finance redesign.
 *
 * Replaces the previous segmented horizontal bar with a Ring visualization
 * (completion %) alongside 4 stat chips (Required / Suggestions / Blocking /
 * Complete). Clicks preserved (jump to required + jump to suggestions).
 */

import { Ring, Overline } from '@/components/ui/atoms';

interface SubmissionReadinessProps {
  requiredMissing: number;
  suggestionsAvailable: number;
  complete: number;
  blockingComments?: number;
  onJumpToRequired?: () => void;
  onJumpToSuggestions?: () => void;
}

export default function SubmissionReadiness({
  requiredMissing, suggestionsAvailable, complete,
  blockingComments = 0,
  onJumpToRequired, onJumpToSuggestions,
}: SubmissionReadinessProps) {
  const totalFields = requiredMissing + complete;
  const pct = totalFields > 0 ? complete / totalFields : 0;
  const hasBlockers = requiredMissing > 0 || blockingComments > 0;

  return (
    <section className="la-card" style={{
      padding: '18px 22px', marginBottom: 22,
      display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap',
    }}>
      <Ring pct={pct} size={54} />

      <div style={{ flex: 1, minWidth: 200 }}>
        <Overline style={{ marginBottom: 4 }}>Submission readiness</Overline>
        <div style={{
          fontSize: 14, fontWeight: 600,
          color: hasBlockers ? 'var(--st-rejected-fg)' : 'var(--st-approved-fg)',
        }}>
          {hasBlockers
            ? `${requiredMissing + blockingComments} blocker${(requiredMissing + blockingComments) !== 1 ? 's' : ''}`
            : pct >= 1
              ? 'Ready to submit'
              : 'In progress'}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
        <Stat
          count={requiredMissing}
          label="required"
          tone={requiredMissing > 0 ? 'danger' : 'neutral'}
          onClick={requiredMissing > 0 ? onJumpToRequired : undefined}
        />
        <Stat
          count={suggestionsAvailable}
          label="Laura suggestions"
          tone={suggestionsAvailable > 0 ? 'accent' : 'neutral'}
          onClick={suggestionsAvailable > 0 ? onJumpToSuggestions : undefined}
        />
        {blockingComments > 0 && (
          <Stat count={blockingComments} label="blocking" tone="danger" />
        )}
        <Stat count={complete} label="complete" tone="neutral" />
      </div>
    </section>
  );
}

function Stat({
  count, label, tone, onClick,
}: {
  count: number;
  label: string;
  tone: 'danger' | 'accent' | 'neutral';
  onClick?: () => void;
}) {
  const color =
    tone === 'danger' ? 'var(--st-rejected-fg)' :
    tone === 'accent' ? 'var(--gold)' :
    'var(--text-secondary)';
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'baseline', gap: 6,
        background: 'transparent', border: 'none',
        cursor: onClick ? 'pointer' : 'default',
        padding: 0, fontFamily: 'var(--font-sans)',
        textAlign: 'left',
      }}
    >
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 700,
        color,
      }}>{count}</span>
      <span style={{
        fontSize: 12, color: 'var(--text-tertiary)',
        textDecoration: onClick ? 'underline dotted' : 'none',
        textUnderlineOffset: 3, textDecorationColor: 'var(--border-strong)',
      }}>{label}</span>
    </Tag>
  );
}
