'use client';

/**
 * SubmissionReadiness - segmented status bar  (updated Rock 3+4)
 *
 *   [ N required | N suggestions | N blocking | N complete ]
 */

import { color, font, motion, radius, space } from '@/styles/tokens';

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
  const total = Math.max(1, requiredMissing + suggestionsAvailable + blockingComments + complete);
  const hasBlockers = requiredMissing > 0 || blockingComments > 0;

  return (
    <div style={{
      background: color.bg.surface,
      border: `1px solid ${color.border.soft}`,
      borderRadius: radius.card,
      padding: `${space[3]}px ${space[4]}px`,
      marginBottom: space[5],
    }}>
      <div style={{
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
        marginBottom: space[2],
      }}>
        <span style={{
          fontSize: 12, fontWeight: 500, color: color.text.secondary,
          letterSpacing: '0.04em', textTransform: 'uppercase',
        }}>Submission readiness</span>
        <span style={{
          fontFamily: font.mono, fontSize: 13, fontWeight: 500,
          color: hasBlockers ? color.status.danger : color.status.success,
        }}>
          {hasBlockers
            ? `${requiredMissing + blockingComments} blocker${(requiredMissing + blockingComments) !== 1 ? 's' : ''}`
            : 'Ready to submit'}
        </span>
      </div>

      <div style={{
        display: 'flex', height: 8, borderRadius: 999,
        overflow: 'hidden', background: color.bg.subtle,
        marginBottom: space[3],
      }}>
        <Segment flex={requiredMissing / total} bg={requiredMissing > 0 ? '#E6B0AB' : 'transparent'}
          onClick={onJumpToRequired} title="Jump to required fields" />
        <Segment flex={suggestionsAvailable / total} bg={suggestionsAvailable > 0 ? '#E5CFAE' : 'transparent'}
          onClick={onJumpToSuggestions} title="Jump to Laura suggestions" />
        <Segment flex={blockingComments / total} bg={blockingComments > 0 ? '#D4908A' : 'transparent'}
          title="Blocking comments to resolve" />
        <Segment flex={complete / total} bg={color.status.success} />
      </div>

      <div style={{ display: 'flex', gap: space[4], fontSize: 12, flexWrap: 'wrap' }}>
        <LegendItem dot={requiredMissing > 0 ? color.status.danger : color.text.tertiary}
          count={requiredMissing} label="required"
          onClick={requiredMissing > 0 ? onJumpToRequired : undefined} />
        <LegendItem dot={suggestionsAvailable > 0 ? color.accent.gold : color.text.tertiary}
          count={suggestionsAvailable} label="Laura suggestions"
          onClick={suggestionsAvailable > 0 ? onJumpToSuggestions : undefined} />
        {blockingComments > 0 && (
          <LegendItem dot={color.status.danger}
            count={blockingComments} label="blocking comments" />
        )}
        <LegendItem dot={color.status.success}
          count={complete} label="complete" />
      </div>
    </div>
  );
}

function Segment({ flex, bg, onClick, title }: {
  flex: number; bg: string; onClick?: () => void; title?: string;
}) {
  if (flex <= 0) return null;
  return (
    <div onClick={onClick} title={title} style={{
      flex, background: bg,
      cursor: onClick ? 'pointer' : 'default',
      transition: `flex ${motion.duration.base}ms ${motion.easing}`,
    }} />
  );
}

function LegendItem({ dot, count, label, onClick }: {
  dot: string; count: number; label: string; onClick?: () => void;
}) {
  return (
    <button onClick={onClick} disabled={!onClick} style={{
      background: 'transparent', border: 'none', padding: 0,
      display: 'inline-flex', alignItems: 'center', gap: 6,
      fontSize: 12, fontFamily: font.sans,
      cursor: onClick ? 'pointer' : 'default',
      color: color.text.secondary,
    }}>
      <span style={{
        display: 'inline-block', width: 6, height: 6, borderRadius: 999, background: dot,
      }} />
      <span style={{ fontFamily: font.mono, fontWeight: 500, color: color.text.primary }}>{count}</span>
      <span>{label}</span>
    </button>
  );
}
