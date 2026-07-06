'use client';

/**
 * LAURA - CreationChooser
 *
 * Modal opened from "+ New LOA" or from the sidebar's "Ask Laura" item.
 * Three paths: Start blank, Ask Laura (precedent search), Browse past.
 */

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import api from '@/lib/api';
import { color, font, type, space, radius, motion } from '@/styles/tokens';

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

interface TemplateMatch {
  id: string;
  loa_draft_id: string;
  title: string;
  status: string;
  country: string | null;
  brand: string | null;
  activity_type: string | null;
  budget_total: number;
  match_score: number;
  matched_on: string[];
}

interface CreationChooserProps {
  open: boolean;
  onClose: () => void;
  /** Lets the sidebar open the modal directly on the Ask Laura step. */
  initialStep?: 'chooser' | 'ask-laura';
}

type Step = 'chooser' | 'ask-laura';

/* ------------------------------------------------------------------ */
/* Component                                                          */
/* ------------------------------------------------------------------ */

export default function CreationChooser({
  open, onClose, initialStep = 'chooser',
}: CreationChooserProps) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(initialStep);
  const [brief, setBrief] = useState('');
  const [matches, setMatches] = useState<TemplateMatch[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* Sync external initialStep when the modal opens. */
  useEffect(() => {
    if (open) setStep(initialStep);
  }, [open, initialStep]);

  if (!open) return null;

  const close = () => {
    setStep(initialStep);
    setBrief('');
    setMatches(null);
    setError(null);
    onClose();
  };

  const startBlank = () => { close(); router.push('/loa/new'); };
  const browse     = () => { close(); router.push('/past-campaigns'); };

  const search = async () => {
    if (!brief.trim()) return;
    setBusy(true); setError(null);
    try {
      const { data } = await api.post('/templates/search', { brief, limit: 5 });
      setMatches(data.templates || []);
    } catch (e: any) {
      const msg = e?.response?.data?.detail || e?.message || 'Search failed';
      setError(typeof msg === 'string' ? msg : 'Search failed');
    } finally {
      setBusy(false);
    }
  };

  const useTemplate = async (templateId: string) => {
    setBusy(true); setError(null);
    try {
      const { data } = await api.post(`/loa/${templateId}/duplicate`);
      close();
      router.push(`/loa/${data.id}`);
    } catch (e: any) {
      const msg = e?.response?.data?.detail || e?.message || 'Could not create draft';
      setError(typeof msg === 'string' ? msg : 'Could not create draft');
      setBusy(false);
    }
  };

  const overlay: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(22, 20, 18, 0.36)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingTop: 80,
    zIndex: 1000,
    fontFamily: font.sans,
  };

  const sheet: React.CSSProperties = {
    width: 'min(880px, calc(100vw - 32px))',
    background: color.bg.surface,
    borderRadius: radius.card,
    border: `1px solid ${color.border.soft}`,
    padding: `${space[8]}px ${space[8]}px ${space[6]}px`,
    maxHeight: 'calc(100vh - 120px)',
    overflowY: 'auto',
  };

  return (
    <div style={overlay} onClick={close}>
      <div style={sheet} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        {step === 'chooser' ? (
          <ChooserStep
            onBlank={startBlank}
            onAsk={() => setStep('ask-laura')}
            onBrowse={browse}
            onClose={close}
          />
        ) : (
          <AskLauraStep
            brief={brief}
            onBrief={setBrief}
            onSearch={search}
            onBack={() => { setStep('chooser'); setMatches(null); setError(null); }}
            matches={matches}
            busy={busy}
            error={error}
            onUse={useTemplate}
          />
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* ChooserStep                                                        */
/* ------------------------------------------------------------------ */

function ChooserStep({ onBlank, onAsk, onBrowse, onClose }: {
  onBlank: () => void; onAsk: () => void; onBrowse: () => void; onClose: () => void;
}) {
  return (
    <>
      <header style={{ marginBottom: space[6] }}>
        <h1 style={{
          fontSize: type.display.size, lineHeight: `${type.display.line}px`,
          fontWeight: type.display.weight, color: color.text.primary, margin: 0,
        }}>New LOA</h1>
        <p style={{
          fontSize: type.body.size, lineHeight: `${type.body.line}px`,
          color: color.text.secondary, margin: `${space[2]}px 0 0`,
        }}>
          Create a marketing investment request from scratch, with Laura, or from a past campaign in your cluster.
        </p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: space[3] }}>
        <PathCard glyph="+" title="Start blank"
          body="Begin with an empty draft and fill every field manually."
          bestFor="New concepts, sensitive budgets, or requests without precedent."
          cta="Start blank" onClick={onBlank} />
        <PathCard glyph="✦" title="Ask Laura"
          body="Describe the activity. Laura finds the closest approved precedent and seeds the draft."
          bestFor="Campaigns similar to prior activations."
          cta="Describe brief" recommended onClick={onAsk} />
        <PathCard glyph="▦" title="Browse past campaigns"
          body="Search historical LOAs from your cluster and use one as a template."
          bestFor="Inspiration, benchmarking, and local reuse."
          cta="Open explorer" onClick={onBrowse} />
      </div>

      <footer style={{
        marginTop: space[6], display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        fontSize: type.small.size, color: color.text.tertiary,
      }}>
        <span>Historical LOAs may contain legacy values. Laura sanitizes fields before creating your draft.</span>
        <button onClick={onClose} style={textButtonStyle}>Cancel</button>
      </footer>
    </>
  );
}

function PathCard({ glyph, title, body, bestFor, cta, recommended, onClick }: {
  glyph: string; title: string; body: string; bestFor: string; cta: string;
  recommended?: boolean; onClick: () => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <div onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        position: 'relative',
        background: recommended ? color.bg.tint : color.bg.surface,
        border: `1px solid ${recommended ? color.border.strong : color.border.soft}`,
        borderRadius: radius.card,
        padding: `${space[5]}px ${space[5]}px ${space[4]}px`,
        cursor: 'pointer',
        transform: hover ? 'translateY(-2px)' : 'translateY(0)',
        transition: `transform ${motion.duration.quick}ms ${motion.easing}`,
      }}>
      {recommended && (
        <span style={{
          position: 'absolute', top: space[3], right: space[3],
          fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase',
          padding: '2px 8px', borderRadius: radius.pill,
          background: color.action.primary, color: color.text.onPrimary,
        }}>Recommended</span>
      )}
      <div style={{ fontSize: 26, lineHeight: 1, color: color.action.primary, marginBottom: space[3] }}>{glyph}</div>
      <h2 style={{
        fontSize: type.h2.size, lineHeight: `${type.h2.line}px`,
        fontWeight: type.h2.weight, color: color.text.primary, margin: 0,
      }}>{title}</h2>
      <p style={{
        fontSize: type.body.size, lineHeight: `${type.body.line}px`,
        color: color.text.secondary, margin: `${space[2]}px 0 ${space[4]}px`,
      }}>{body}</p>
      <p style={{ fontSize: type.small.size, color: color.text.tertiary, margin: 0 }}>
        <span style={{ fontWeight: type.bodyStrong.weight, color: color.text.secondary }}>Best for </span>
        {bestFor}
      </p>
      <div style={{
        marginTop: space[5], display: 'flex', alignItems: 'center', gap: space[2],
        fontSize: type.body.size, fontWeight: type.bodyStrong.weight, color: color.action.primary,
      }}>{cta} <span aria-hidden>→</span></div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* AskLauraStep                                                       */
/* ------------------------------------------------------------------ */

function AskLauraStep({
  brief, onBrief, onSearch, onBack, matches, busy, error, onUse,
}: {
  brief: string; onBrief: (s: string) => void; onSearch: () => void; onBack: () => void;
  matches: TemplateMatch[] | null; busy: boolean; error: string | null;
  onUse: (id: string) => void;
}) {
  return (
    <>
      <header style={{ marginBottom: space[5] }}>
        <button onClick={onBack} style={{ ...textButtonStyle, marginBottom: space[2], padding: 0 }}>
          ← Back
        </button>
        <h1 style={{
          fontSize: type.h1.size, lineHeight: `${type.h1.line}px`,
          fontWeight: type.h1.weight, color: color.text.primary, margin: 0,
        }}>Ask Laura</h1>
        <p style={{
          fontSize: type.body.size, color: color.text.secondary, margin: `${space[2]}px 0 0`,
        }}>Describe the campaign. Laura searches approved LOAs available to your cluster.</p>
      </header>

      <div style={{
        border: `1px solid ${color.border.soft}`, borderRadius: radius.field,
        padding: space[3], background: color.bg.surface,
      }}>
        <textarea value={brief} onChange={(e) => onBrief(e.target.value)} maxLength={700}
          placeholder="Example: Ray-Ban summer retail visibility for sunglass specialists in Italy, including POS materials, window displays, and staff incentives."
          rows={3}
          style={{
            width: '100%', border: 'none', outline: 'none', resize: 'vertical',
            fontFamily: font.sans, fontSize: type.body.size, lineHeight: `${type.body.line}px`,
            color: color.text.primary, background: 'transparent',
          }} />
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: space[2],
        }}>
          <span style={{
            fontFamily: font.mono, fontSize: type.monoSmall.size, color: color.text.tertiary,
          }}>{brief.length} / 700</span>
          <button onClick={onSearch} disabled={busy || !brief.trim()} style={primaryButtonStyle(busy || !brief.trim())}>
            {busy ? 'Searching...' : 'Find similar campaigns'}
          </button>
        </div>
      </div>

      {error && (
        <div style={{
          marginTop: space[4], padding: space[3], borderRadius: radius.field,
          background: color.status.dangerBg, color: color.status.danger, fontSize: type.small.size,
        }}>{error}</div>
      )}

      {matches && (
        <div style={{ marginTop: space[5] }}>
          <p style={{
            fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase',
            fontWeight: type.bodyStrong.weight, color: color.text.tertiary,
            margin: `0 0 ${space[3]}px`,
          }}>
            {matches.length > 0
              ? `${matches.length} precedent${matches.length === 1 ? '' : 's'} found`
              : 'No strong precedent in your cluster'}
          </p>
          {matches.length === 0 ? (
            <div style={{
              padding: space[5], border: `1px solid ${color.border.soft}`, borderRadius: radius.field,
              background: color.bg.subtle, color: color.text.secondary, fontSize: type.body.size,
            }}>Try broader wording, or start blank.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: space[2] }}>
              {matches.map((m) => (
                <MatchCard key={m.id} match={m} onUse={() => onUse(m.id)} disabled={busy} />
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}

function MatchCard({ match, onUse, disabled }: { match: TemplateMatch; onUse: () => void; disabled: boolean }) {
  const scoreColor =
    match.match_score >= 90 ? color.status.success
    : match.match_score >= 75 ? color.accent.gold
    : color.status.warning;

  const meta = [
    match.country, match.brand, match.activity_type,
    `FY ${new Date().getFullYear()}`,
    formatMoney(match.budget_total), titleCase(match.status),
  ].filter(Boolean).join(' · ');

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '64px 1fr auto', gap: space[4],
      padding: space[4], border: `1px solid ${color.border.soft}`,
      borderRadius: radius.field, background: color.bg.surface, alignItems: 'center',
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          fontFamily: font.mono, fontSize: type.monoMatch.size,
          lineHeight: `${type.monoMatch.line}px`, fontWeight: type.monoMatch.weight,
          color: scoreColor,
        }}>{match.match_score}</div>
        <div style={{
          fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase',
          color: color.text.tertiary, marginTop: 2,
        }}>Match</div>
      </div>
      <div style={{ minWidth: 0 }}>
        <p style={{
          margin: 0, fontSize: type.bodyStrong.size, fontWeight: type.bodyStrong.weight,
          color: color.text.primary,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{match.title}</p>
        <p style={{
          margin: `${space[1]}px 0 ${space[2]}px`,
          fontSize: type.small.size, color: color.text.secondary,
        }}>{meta}</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {match.matched_on.map((tag) => (
            <span key={tag} style={{
              fontSize: 10, padding: '2px 8px', borderRadius: radius.pill,
              background: color.bg.tint, color: color.action.primary, textTransform: 'capitalize',
            }}>{tag}</span>
          ))}
        </div>
      </div>
      <button onClick={onUse} disabled={disabled} style={primaryButtonStyle(disabled)}>Use as template</button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Shared button styles + formatters                                  */
/* ------------------------------------------------------------------ */

function primaryButtonStyle(disabled: boolean): React.CSSProperties {
  return {
    background: disabled ? color.border.strong : color.action.primary,
    color: color.text.onPrimary, border: 'none', borderRadius: radius.field,
    padding: '10px 16px', fontSize: type.body.size, fontWeight: type.bodyStrong.weight,
    fontFamily: font.sans, cursor: disabled ? 'not-allowed' : 'pointer',
  };
}

const textButtonStyle: React.CSSProperties = {
  background: 'transparent', border: 'none', color: color.text.secondary,
  fontSize: type.small.size, fontFamily: font.sans, cursor: 'pointer',
};

function formatMoney(n: number): string {
  if (!n) return '—';
  if (n >= 1_000_000) return `€${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `€${Math.round(n / 1_000)}k`;
  return `€${n}`;
}
function titleCase(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

