'use client';

/**
 * LAURA — CreationChooser · Editorial Finance redesign.
 * -----------------------------------------------------
 * Modal opened from "+ New LOA". Visual layer rebuilt on redesign.css.
 * ALL logic preserved verbatim:
 *   - POST /templates/search  { brief, limit }
 *   - POST /loa/{id}/duplicate
 *   - start blank → /loa/new
 *   - browse → /past-campaigns
 *   - initialStep sync (chooser | ask-laura)
 */

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import api from '@/lib/api';
import { Pill, Btn, Overline } from '@/components/ui/atoms';

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
  initialStep?: 'chooser' | 'ask-laura';
}

type Step = 'chooser' | 'ask-laura';

export default function CreationChooser({
  open, onClose, initialStep = 'chooser',
}: CreationChooserProps) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(initialStep);
  const [brief, setBrief] = useState('');
  const [matches, setMatches] = useState<TemplateMatch[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) setStep(initialStep);
  }, [open, initialStep]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

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

  return (
    <div className="la-dim" onClick={close}>
      <div
        className="la-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog" aria-modal="true"
        style={{ maxWidth: step === 'ask-laura' ? 720 : 640 }}
      >
        {step === 'chooser' ? (
          <ChooserStep
            brief={brief}
            onBrief={setBrief}
            onGenerate={() => { setStep('ask-laura'); search(); }}
            onBlank={startBlank}
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

/* ─────────────────────── Chooser step ─────────────────────── */

function ChooserStep({
  brief, onBrief, onGenerate, onBlank, onBrowse, onClose,
}: {
  brief: string;
  onBrief: (s: string) => void;
  onGenerate: () => void;
  onBlank: () => void;
  onBrowse: () => void;
  onClose: () => void;
}) {
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
        <div>
          <h1 style={{
            margin: 0, fontFamily: 'var(--font-display)',
            fontSize: 30, fontWeight: 600, color: 'var(--text-primary)',
          }}>Start a new LOA</h1>
          <p style={{ margin: '6px 0 0', fontSize: 13.5, color: 'var(--text-secondary)' }}>
            Describe it to Laura — or start from scratch, or from a past campaign.
          </p>
        </div>
        <button className="la-x" onClick={onClose} aria-label="Close">✕</button>
      </div>

      {/* Ask Laura — recommended box */}
      <div className="la-briefbox">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <span style={{ fontSize: 15, color: 'var(--gold)' }}>✦</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Ask Laura</span>
          <span style={{
            fontSize: 9.5, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase',
            padding: '2px 8px', borderRadius: 99,
            background: 'var(--gold-soft)', color: 'var(--gold)',
          }}>★ Recommended</span>
        </div>

        <textarea
          value={brief}
          onChange={(e) => onBrief(e.target.value)}
          maxLength={700}
          rows={2}
          placeholder="e.g. Ray-Ban in-store activation in France, ~€80k, Q3 — permanent displays in 15 doors…"
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && brief.trim()) onGenerate();
          }}
          className="la-input"
          style={{
            height: 'auto', padding: '10px 12px', resize: 'vertical',
            fontSize: 13.5, lineHeight: 1.5,
          }}
        />

        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginTop: 12,
        }}>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
            Laura finds the closest approved precedent and seeds your draft.
          </span>
          <Btn variant="primary" small onClick={onGenerate} disabled={!brief.trim()}>
            ✦ Generate draft
          </Btn>
        </div>
      </div>

      {/* Secondary options */}
      <div style={{
        marginTop: 22, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16,
      }} className="la-modal-grid">
        <SecondaryOption
          title="Start blank"
          body="Empty draft, every field manual. Best for new concepts or sensitive budgets."
          cta="Start blank →"
          onClick={onBlank}
        />
        <SecondaryOption
          title="Browse past campaigns"
          body="Use a historical LOA from your cluster as a template."
          cta="Open explorer →"
          onClick={onBrowse}
        />
      </div>

      <footer style={{
        marginTop: 22, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        fontSize: 12, color: 'var(--text-tertiary)',
      }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ opacity: 0.6 }}>♡</span>
          Historical LOAs may contain legacy values. Laura sanitizes fields before creating your draft.
        </span>
        <button onClick={onClose} className="la-link">Cancel</button>
      </footer>
    </>
  );
}

function SecondaryOption({ title, body, cta, onClick }: {
  title: string; body: string; cta: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="la-option"
      style={{
        flexDirection: 'column', alignItems: 'flex-start',
        padding: '16px 18px', gap: 8, textAlign: 'left',
      }}
    >
      <span style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--text-primary)' }}>{title}</span>
      <span style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{body}</span>
      <span style={{ marginTop: 4, fontSize: 12.5, fontWeight: 600, color: 'var(--gold)' }}>{cta}</span>
    </button>
  );
}

/* ─────────────────────── Ask Laura step (results) ─────────────────────── */

function AskLauraStep({
  brief, onBrief, onSearch, onBack, matches, busy, error, onUse,
}: {
  brief: string; onBrief: (s: string) => void; onSearch: () => void; onBack: () => void;
  matches: TemplateMatch[] | null; busy: boolean; error: string | null;
  onUse: (id: string) => void;
}) {
  return (
    <>
      <div style={{ marginBottom: 18 }}>
        <button onClick={onBack} className="la-link" style={{ marginBottom: 10, fontSize: 12.5 }}>
          ← Back
        </button>
        <h1 style={{
          margin: 0, fontFamily: 'var(--font-display)',
          fontSize: 26, fontWeight: 600, color: 'var(--text-primary)',
        }}>Ask Laura</h1>
        <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
          Laura searches approved LOAs available to your cluster.
        </p>
      </div>

      <div style={{
        border: '1px solid var(--border)', borderRadius: 12,
        padding: 12, background: 'var(--surface)',
      }}>
        <textarea
          value={brief}
          onChange={(e) => onBrief(e.target.value)}
          maxLength={700}
          rows={2}
          placeholder="Describe the campaign…"
          className="la-input"
          style={{ height: 'auto', padding: '8px 10px', resize: 'vertical', fontSize: 13.5, lineHeight: 1.5, border: 'none' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)' }}>
            {brief.length} / 700
          </span>
          <Btn variant="primary" small onClick={onSearch} disabled={busy || !brief.trim()}>
            {busy ? 'Searching…' : 'Find similar campaigns'}
          </Btn>
        </div>
      </div>

      {error && (
        <div style={{
          marginTop: 16, padding: '10px 12px', borderRadius: 8,
          background: 'var(--st-rejected-bg)', color: 'var(--st-rejected-fg)', fontSize: 12.5,
        }}>{error}</div>
      )}

      {matches && (
        <div style={{ marginTop: 20 }}>
          <Overline style={{ marginBottom: 12 }}>
            {matches.length > 0
              ? `${matches.length} precedent${matches.length === 1 ? '' : 's'} found`
              : 'No strong precedent in your cluster'}
          </Overline>
          {matches.length === 0 ? (
            <div style={{
              padding: 18, border: '1px solid var(--border)', borderRadius: 10,
              background: 'var(--surface-sunken)', color: 'var(--text-secondary)', fontSize: 13,
            }}>Try broader wording, or start blank.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
    match.match_score >= 90 ? 'var(--st-approved-fg)'
    : match.match_score >= 75 ? 'var(--gold)'
    : 'var(--st-wait-fg)';

  const meta = [
    match.country, match.brand, match.activity_type,
    formatMoney(match.budget_total), titleCase(match.status),
  ].filter(Boolean).join(' · ');

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '58px 1fr auto', gap: 14,
      padding: 14, border: '1px solid var(--border)',
      borderRadius: 10, background: 'var(--surface)', alignItems: 'center',
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 700,
          color: scoreColor, lineHeight: 1,
        }}>{match.match_score}</div>
        <div style={{
          fontSize: 9, letterSpacing: '.08em', textTransform: 'uppercase',
          color: 'var(--text-tertiary)', marginTop: 3,
        }}>Match</div>
      </div>
      <div style={{ minWidth: 0 }}>
        <p style={{
          margin: 0, fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{match.title}</p>
        <p style={{ margin: '3px 0 8px', fontSize: 11.5, color: 'var(--text-secondary)' }}>{meta}</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {match.matched_on.map((tag) => (
            <span key={tag} style={{
              fontSize: 10, padding: '2px 8px', borderRadius: 99,
              background: 'var(--gold-soft)', color: 'var(--gold)', textTransform: 'capitalize',
            }}>{tag}</span>
          ))}
        </div>
      </div>
      <Btn variant="primary" small onClick={onUse} disabled={disabled}>Use as template</Btn>
    </div>
  );
}

function formatMoney(n: number): string {
  if (!n) return '—';
  if (n >= 1_000_000) return `€${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `€${Math.round(n / 1_000)}k`;
  return `€${n}`;
}
function titleCase(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
