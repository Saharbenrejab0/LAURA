'use client';

/**
 * DraftSection — Editorial Finance redesign.
 *
 * Section container used to group InlineEditFields. Renders a header with
 * title + required completion badge, and an expandable body.
 *
 * All original props preserved (id, title, requiredComplete, requiredTotal).
 * The `id` attribute is applied to the outer element so the "Jump to" logic
 * in the page can scroll to it.
 */

import { useState } from 'react';

interface DraftSectionProps {
  id: string;
  title: string;
  requiredComplete: number;
  requiredTotal: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

export default function DraftSection({
  id, title, requiredComplete, requiredTotal, children, defaultOpen = true,
}: DraftSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const allRequiredDone = requiredComplete === requiredTotal;
  const hasRequired = requiredTotal > 0;

  return (
    <section
      id={id}
      className="la-card"
      style={{ marginBottom: 14, overflow: 'hidden' }}
    >
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%',
          display: 'flex', alignItems: 'center', gap: 14,
          padding: '16px 22px',
          background: 'transparent', border: 'none', cursor: 'pointer',
          textAlign: 'left', fontFamily: 'var(--font-sans)',
        }}
      >
        <span style={{
          fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600,
          color: 'var(--text-primary)', flex: 1,
        }}>
          {title}
        </span>

        {hasRequired && (
          <span style={{
            fontSize: 11.5, fontFamily: 'var(--font-mono)', fontWeight: 600,
            padding: '3px 10px', borderRadius: 99,
            background: allRequiredDone ? 'var(--st-approved-bg)' : 'var(--st-wait-bg)',
            color: allRequiredDone ? 'var(--st-approved-fg)' : 'var(--st-wait-fg)',
          }}>
            {requiredComplete}/{requiredTotal} required
          </span>
        )}

        <span style={{
          fontSize: 12, color: 'var(--text-tertiary)',
          transform: open ? 'rotate(180deg)' : 'none',
          transition: 'transform .18s ease',
          display: 'inline-block', width: 16, textAlign: 'center',
        }}>▾</span>
      </button>

      {open && (
        <div style={{
          padding: '0 22px 18px',
          borderTop: '1px solid var(--border)',
        }}>
          {children}
        </div>
      )}
    </section>
  );
}
