'use client';

/**
 * DraftSection - one of the 9 sections of the draft page.
 *
 * Header shows: title + X/Y completion in Plex Mono + small SVG arc that
 * fills proportionally + optional "N required" hint.
 * Body slot renders InlineEditFields.
 */

import { color, font, radius, space } from '@/styles/tokens';

interface DraftSectionProps {
  id: string;
  title: string;
  filled: number;
  total: number;
  requiredMissing?: number;
  children: React.ReactNode;
}

export default function DraftSection({
  id, title, filled, total, requiredMissing = 0, children,
}: DraftSectionProps) {
  return (
    <section id={id} style={{
      background: color.bg.surface,
      border: `1px solid ${color.border.soft}`,
      borderRadius: radius.card,
      padding: space[5],
      marginBottom: space[4],
    }}>
      <header style={{
        display: 'flex', alignItems: 'center', gap: space[3],
        marginBottom: space[4],
        paddingBottom: space[3],
        borderBottom: `1px solid ${color.border.soft}`,
      }}>
        <h2 style={{
          margin: 0, fontSize: 15, lineHeight: '22px',
          fontWeight: 600, color: color.text.primary, flex: 1,
        }}>{title}</h2>

        <CompletionMeter filled={filled} total={total} />

        {requiredMissing > 0 && (
          <span style={{
            fontSize: 12, color: color.status.danger,
            fontWeight: 500,
          }}>
            {requiredMissing} required
          </span>
        )}
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: space[3] }}>
        {children}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------- */
/* Completion meter - the mono number + arc                             */
/* -------------------------------------------------------------------- */

function CompletionMeter({ filled, total }: { filled: number; total: number }) {
  const pct = total === 0 ? 0 : filled / total;
  const radius = 9;
  const circumference = 2 * Math.PI * radius;
  const dash = pct * circumference;
  const arcColor = pct >= 1 ? color.status.success
                  : pct >= 0.5 ? color.accent.gold
                  : color.text.tertiary;

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
    }}>
      <span style={{
        fontFamily: font.mono, fontSize: 13, fontWeight: 500,
        color: color.text.primary,
      }}>
        {filled}<span style={{ color: color.text.tertiary }}>/{total}</span>
      </span>
      <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden>
        <circle cx="11" cy="11" r={radius}
          fill="none" stroke={color.border.soft} strokeWidth="2" />
        <circle cx="11" cy="11" r={radius}
          fill="none" stroke={arcColor} strokeWidth="2"
          strokeDasharray={`${dash} ${circumference}`}
          strokeLinecap="round"
          transform="rotate(-90 11 11)" />
      </svg>
    </span>
  );
}
