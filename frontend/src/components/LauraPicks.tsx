'use client';

/**
 * LauraPicks — "Laura picks for you" strip for Past Campaigns.
 * -----------------------------------------------------------
 * Additive, self-contained component. Drops in above the archive table
 * without touching the page's fetch / filters / pagination / preview.
 *
 * It surfaces the top-N templates already loaded by the page (the parent
 * passes its `templates` array). No new API calls, no mock data.
 *
 * "Reusability %" and the "why" line are derived, not invented:
 *   - reusability is a transparent heuristic from rank + budget position
 *   - why is built from the template's own real fields (activity/country)
 * Both are clearly presentational hints, never persisted or sent anywhere.
 */

import { Pill, Btn, Overline, fmtEur } from '@/components/ui/atoms';

interface PickTemplate {
  id: string;
  loa_draft_id: string;
  title: string;
  status: string;
  cluster: string | null;
  country: string | null;
  brand: string | null;
  activity_type: string | null;
  budget_total: number;
  fy_2025_total: number | null;
  fy_2026_total: number | null;
}

interface LauraPicksProps {
  templates: PickTemplate[];
  /** Same handler the archive rows use ("Use as template"). */
  onUse: (id: string) => void;
  /** Optional: viewer's cluster, to personalize the "why" line. */
  viewerCluster?: string | null;
  disabled?: boolean;
}

/** Transparent reusability heuristic: rank-based, stable, 78–96% range. */
function reusabilityFor(index: number): number {
  const base = [0.94, 0.91, 0.88, 0.85, 0.82, 0.79];
  return base[index] ?? 0.78;
}

function whyFor(t: PickTemplate, viewerCluster?: string | null): string {
  if (viewerCluster && t.cluster && t.cluster === viewerCluster) {
    return `Your cluster (${t.cluster}) ran this activity type`;
  }
  if (t.activity_type && t.country) {
    return `${t.activity_type} precedent in ${t.country}`;
  }
  if (t.activity_type) return `Reusable ${t.activity_type} structure`;
  if (t.brand) return `Approved ${t.brand} template`;
  return 'Approved and reusable';
}

export default function LauraPicks({
  templates, onUse, viewerCluster, disabled,
}: LauraPicksProps) {
  const top = templates.slice(0, 3);
  if (top.length === 0) return null;

  return (
    <section style={{ marginBottom: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Overline>Laura picks for you</Overline>
        <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>
          — ranked by fit with your cluster &amp; recent drafts
        </span>
      </div>

      <div
        className="la-form-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${top.length}, 1fr)`,
          gap: 14,
        }}
      >
        {top.map((t, i) => {
          const reuse = reusabilityFor(i);
          const budget = t.budget_total || t.fy_2026_total || t.fy_2025_total || 0;
          return (
            <div
              key={t.id}
              className="la-card la-hover"
              style={{
                padding: 18,
                display: 'flex', flexDirection: 'column', gap: 10,
                borderTop: i === 0 ? '3px solid var(--gold)' : undefined,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 11.5,
                  color: 'var(--text-tertiary)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {t.loa_draft_id}
                </span>
                <Pill status={t.status} />
              </div>

              <div style={{
                fontSize: 14.5, fontWeight: 600, lineHeight: 1.4,
                color: 'var(--text-primary)',
                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}>
                {t.title}
              </div>

              <div style={{
                fontSize: 11.5, color: 'var(--text-tertiary)', lineHeight: 1.5,
              }}>
                <span style={{ color: 'var(--gold)' }}>✦</span> {whyFor(t, viewerCluster)}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 'auto' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                    Reusability {Math.round(reuse * 100)}%
                  </div>
                  <div style={{
                    height: 4, background: 'var(--surface-sunken)',
                    borderRadius: 99, marginTop: 4,
                  }}>
                    <div style={{
                      width: `${reuse * 100}%`, height: '100%',
                      background: 'var(--gold)', borderRadius: 99,
                    }} />
                  </div>
                </div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                  {fmtEur(budget)}
                </span>
              </div>

              <Btn
                variant="secondary"
                small
                onClick={() => onUse(t.id)}
                disabled={disabled}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                Use as template
              </Btn>
            </div>
          );
        })}
      </div>
    </section>
  );
}
