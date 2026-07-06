'use client';

/**
 * LAURA — LOA Detail · Editorial Finance redesign (Phase B)
 * ---------------------------------------------------------
 * Container for the LOA detail workspace. Visual layer rebuilt on
 * styles/redesign.css; ALL business logic preserved verbatim:
 *   - GET /loa/{id} + /permissions/loa/{id} + /loa/{src}/loa_draft_id
 *   - POST /loa/{id}/suggest-fills
 *   - GET /loa/{id}/comments/summary
 *   - Inline-edit provenance tracking (manual / laura / source)
 *   - Suggestions map + dismissed set
 *   - Comments rail (per-field + global)
 *   - "Edit details" routes to /loa/new?edit={id}
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

import api from '@/lib/api';

import DraftHeader, { SaveState } from '@/components/draft/DraftHeader';
import DraftSection from '@/components/draft/DraftSection';
import InlineEditField, { LauraSuggestion, Provenance } from '@/components/draft/InlineEditField';
import ApprovalPanel from '@/components/draft/ApprovalPanel';
import SubmissionReadiness from '@/components/draft/SubmissionReadiness';
import CommentsRail from '@/components/comments/CommentsRail';
import { Btn, Overline } from '@/components/ui/atoms';

/* ----- Types (unchanged) ------------------------------------------------ */

interface LOAData {
  id: string;
  loa_draft_id: string;
  status: string;
  requestor_email: string;
  description: string | null;
  detail: string | null;
  kpi: string | null;
  success_criteria?: string | null;
  cluster: string | null;
  country: string | null;
  legal_entity: string | null;
  activity_type: string | null;
  cot: string | null;
  category: string[] | string | null;
  brand: string | null;
  capex_opex: string | null;
  adv_selling: string | null;
  fy_2025_total: number | null;
  fy_2026_total: number | null;
  customer?: string | null;
  vendor?: string | null;
  num_doors?: number | null;
  duplicated_from_id?: string | null;
}

interface Permissions {
  can_edit: boolean;
  can_validate: boolean;
  loa_status: string;
  user_role: string;
}

interface Suggestion {
  field: string;
  value: string | string[];
  source_count: number;
  confidence: 'low' | 'medium' | 'high';
  kind: string;
}

interface CommentSummary {
  total_visible: number;
  total_unresolved: number;
  total_blocking: number;
  by_field: Record<string, number>;
  by_section: Record<string, number>;
}

/* ----- Page ------------------------------------------------------------ */

export default function DraftPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const loaId = params?.id as string;

  const [loa, setLoa] = useState<LOAData | null>(null);
  const [perms, setPerms] = useState<Permissions | null>(null);
  const [duplicatedFromDraftId, setDuplicatedFromDraftId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Record<string, Suggestion>>({});
  const [provenance, setProvenance] = useState<Record<string, Provenance>>({});
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [commentSummary, setCommentSummary] = useState<CommentSummary | null>(null);
  const [railOpen, setRailOpen] = useState(false);
  const [railFieldKey, setRailFieldKey] = useState<string | null>(null);

  const openRailForField = (fieldKey: string) => {
    setRailFieldKey(fieldKey);
    setRailOpen(true);
  };
  const openRailGlobal = () => {
    setRailFieldKey(null);
    setRailOpen(true);
  };
  const closeRail = () => {
    setRailOpen(false);
  };

  const fetchCommentSummary = useCallback(async () => {
    try {
      const { data } = await api.get(`/loa/${loaId}/comments/summary`);
      setCommentSummary(data);
    } catch { /* non-blocking */ }
  }, [loaId]);

  /* Load LOA + permissions + suggestions + comment summary */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [loaRes, permRes] = await Promise.all([
          api.get(`/loa/${loaId}`),
          api.get(`/permissions/loa/${loaId}`),
        ]);
        if (cancelled) return;
        setLoa(loaRes.data);
        setPerms(permRes.data);

        if (loaRes.data.duplicated_from_id) {
          try {
            const src = await api.get(`/loa/${loaRes.data.duplicated_from_id}`);
            if (!cancelled) setDuplicatedFromDraftId(src.data.loa_draft_id);
          } catch { /* source may be restricted */ }
        }

        const initialProv: Record<string, Provenance> = {};
        Object.entries(loaRes.data).forEach(([k, v]) => {
          if (v != null && v !== '' && (!Array.isArray(v) || v.length > 0)) {
            initialProv[k] = loaRes.data.duplicated_from_id ? 'source' : 'manual';
          }
        });
        setProvenance(initialProv);

        if (permRes.data.can_edit && loaRes.data.status === 'draft') {
          api.post(`/loa/${loaId}/suggest-fills`).then((res) => {
            if (cancelled) return;
            const map: Record<string, Suggestion> = {};
            for (const s of res.data.suggestions || []) { map[s.field] = s; }
            setSuggestions(map);
          }).catch(() => {});
        }

        if (!cancelled) fetchCommentSummary();
      } catch (e: any) {
        if (!cancelled) setError(e?.response?.data?.detail || e?.message || 'Failed to load LOA');
      }
    })();
    return () => { cancelled = true; };
  }, [loaId, fetchCommentSummary]);

  useEffect(() => {
    if (!railOpen) fetchCommentSummary();
  }, [railOpen, fetchCommentSummary]);

  const onFieldSaved = useCallback((field: string) => (newValue: any, source: 'manual' | 'laura_accepted' | 'laura_edited') => {
    setLoa((prev) => prev ? { ...prev, [field]: newValue } : prev);
    setProvenance((prev) => ({ ...prev, [field]: source }));
    setSuggestions((prev) => { const next = { ...prev }; delete next[field]; return next; });
    setSaveState('saved');
    setLastSavedAt(new Date());
  }, []);

  const dismissSuggestion = (field: string) => {
    setDismissed((prev) => { const n = new Set(prev); n.add(field); return n; });
    setSuggestions((prev) => { const next = { ...prev }; delete next[field]; return next; });
  };

  const [, force] = useState(0);
  useEffect(() => {
    if (saveState !== 'saved') return;
    const t = setInterval(() => force((n) => n + 1), 10_000);
    return () => clearInterval(t);
  }, [saveState]);

  if (error) return <PageError error={error} onBack={() => router.push('/')} />;
  if (!loa || !perms) return <PageLoading />;

  const editable = perms.can_edit;
  const lockReason = editable ? undefined : `Read-only at this step (${humanStatus(perms.loa_status)})`;

  const sectionDefs = buildSectionDefinitions(loa);
  const counts = sectionDefs.reduce((acc, sec) => {
    sec.fields.forEach((f) => {
      const val = (loa as any)[f.field];
      if (!isEmpty(val)) acc.complete++;
      else if (f.required) acc.required++;
      else acc.optional++;
    });
    return acc;
  }, { complete: 0, required: 0, optional: 0 });

  const availableSuggestions = Object.keys(suggestions).filter(k => !dismissed.has(k)).length;
  const totalComments = commentSummary?.total_unresolved || 0;
  const totalBlocking = commentSummary?.total_blocking || 0;
  const fieldCommentCounts = commentSummary?.by_field || {};

  const jumpTo = (selector: string) => {
    const el = document.querySelector(selector);
    if (el) (el as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const openEditForm = () => {
    router.push(`/loa/new?edit=${loa.id}`);
  };

  const title = loa.description || loa.detail || 'Untitled LOA';

  return (
    <div style={{
      background: 'var(--canvas)', minHeight: '100vh',
      fontFamily: 'var(--font-sans)', color: 'var(--text-primary)',
    }}>
      <div className="la-page la-fade" style={{ maxWidth: 1180 }}>

        {/* ── Back link ── */}
        <button
          onClick={() => router.push('/')}
          className="la-link"
          style={{ marginBottom: 18, fontSize: 13 }}
        >
          ← Back to tracker
        </button>

        {/* ── Header row: id/status/title + actions ── */}
        <header style={{ marginBottom: 28 }}>
          <div style={{
            display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
            gap: 24, flexWrap: 'wrap', marginBottom: 8,
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <DraftHeader
                loaDraftId={loa.loa_draft_id}
                title={title}
                status={loa.status}
                duplicatedFromId={loa.duplicated_from_id}
                duplicatedFromDraftId={duplicatedFromDraftId}
                saveState={saveState}
                lastSavedAt={lastSavedAt}
                editable={editable}
                onSubmit={undefined}
              />
            </div>

            <div style={{
              display: 'flex', gap: 8, flexWrap: 'wrap', flexShrink: 0,
              paddingTop: 4,
            }}>
              {editable && (
                <Btn variant="secondary" small onClick={openEditForm}>
                  ✎ Edit details
                </Btn>
              )}
              <Btn
                variant={totalBlocking > 0 ? 'danger' : 'secondary'}
                small
                onClick={openRailGlobal}
              >
                💬 Comments
                {totalComments > 0 && (
                  <span style={{
                    marginLeft: 6, fontFamily: 'var(--font-mono)',
                    fontWeight: 700, fontSize: 11.5,
                  }}>{totalComments}</span>
                )}
                {totalBlocking > 0 && (
                  <span style={{
                    marginLeft: 6, padding: '1px 7px', borderRadius: 99,
                    background: 'var(--st-rejected-fg)', color: '#fff',
                    fontSize: 10, fontWeight: 700, fontFamily: 'var(--font-mono)',
                  }}>{totalBlocking}</span>
                )}
              </Btn>
            </div>
          </div>
        </header>

        {/* ── Approval workflow ── */}
        <div style={{ marginBottom: 22 }}>
          <ApprovalPanel
            loa={{ id: loa.id, status: loa.status }}
            perms={perms}
            onActionDone={() => router.refresh()}
          />
        </div>

        {/* ── Submission readiness ── */}
        <SubmissionReadiness
          requiredMissing={counts.required}
          suggestionsAvailable={availableSuggestions}
          complete={counts.complete}
          blockingComments={totalBlocking}
          onJumpToRequired={() => jumpTo('[data-required-missing="true"]')}
          onJumpToSuggestions={() => jumpTo('[data-has-suggestion="true"]')}
        />

        {/* ── Sections ── */}
        {sectionDefs.map((sec) => (
          <DraftSection key={sec.id} id={sec.id} title={sec.title}
            requiredComplete={
              sec.fields.filter(f => f.required && !isEmpty((loa as any)[f.field])).length
            }
            requiredTotal={sec.fields.filter(f => f.required).length}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {sec.fields.map((f) => {
                const hasSuggestion = !!suggestions[f.field] && !dismissed.has(f.field);
                const missing = f.required && isEmpty((loa as any)[f.field]);
                return (
                  <div
                    key={f.field}
                    data-required-missing={missing ? 'true' : undefined}
                    data-has-suggestion={hasSuggestion ? 'true' : undefined}
                  >
                    <InlineEditField
                      loaId={loa.id}
                      field={f.field}
                      label={f.label}
                      value={(loa as any)[f.field]}
                      required={f.required}
                      editable={editable}
                      lockReason={lockReason}
                      variant={f.variant}
                      options={f.options}
                      provenance={provenance[f.field] || 'none'}
                      suggestion={suggestions[f.field] as unknown as LauraSuggestion | undefined}
                      onSaved={(newValue, source) => {
                        onFieldSaved(f.field)(newValue, source);
                      }}
                      onDismissSuggestion={() => dismissSuggestion(f.field)}
                    />
                  </div>
                );
              })}
            </div>
          </DraftSection>
        ))}

        <div style={{ height: 40 }} />
      </div>

      {/* ── Comments rail ── */}
      {railOpen && (
        <CommentsRail
          loaId={loa.id}
          loaStatus={loa.status}
          fieldKey={railFieldKey}
          onClose={closeRail}
        />
      )}
    </div>
  );
}

/* ----- Section / field definitions (unchanged) ------------------------- */

interface FieldDef {
  field: string; label: string; required?: boolean;
  variant?: 'text' | 'textarea' | 'number'; options?: string[];
}
interface SectionDef { id: string; title: string; fields: FieldDef[]; }

function buildSectionDefinitions(loa: LOAData): SectionDef[] {
  return [
    { id: 'overview', title: 'Overview', fields: [
        { field: 'description', label: 'Description (WHY)', required: true, variant: 'textarea' },
        { field: 'detail', label: 'Detail / Tools (HOW)', required: true, variant: 'textarea' },
    ]},
    { id: 'geography', title: 'Geography', fields: [
        { field: 'cluster', label: 'Cluster', required: true },
        { field: 'country', label: 'Country', required: true },
        { field: 'legal_entity', label: 'Legal entity' },
    ]},
    { id: 'classification', title: 'Classification', fields: [
        { field: 'activity_type', label: 'Activity type', required: true },
        { field: 'brand', label: 'Brand', required: true },
        { field: 'category', label: 'Category' },
        { field: 'cot', label: 'Channel of trade (COT)' },
    ]},
    { id: 'financials', title: 'Financials', fields: [
        { field: 'capex_opex', label: 'CapEx / OpEx', options: ['CapEx', 'OpEx'] },
        { field: 'adv_selling', label: 'ADV / Selling', options: ['ADV', 'Selling'] },
        { field: 'fy_2025_total', label: 'FY 2025 total (€)', variant: 'number' },
        { field: 'fy_2026_total', label: 'FY 2026 total (€)', variant: 'number', required: true },
    ]},
    { id: 'customer', title: 'Customer & vendor', fields: [
        { field: 'customer', label: 'Customer' },
        { field: 'vendor', label: 'Vendor' },
        { field: 'num_doors', label: '# Doors', variant: 'number' },
    ]},
    { id: 'kpis', title: 'KPIs & success criteria', fields: [
        { field: 'kpi', label: 'KPI', required: true, variant: 'textarea' },
        { field: 'success_criteria', label: 'Success criteria', variant: 'textarea' },
    ]},
  ];
}

function isEmpty(v: any): boolean {
  if (v == null) return true;
  if (typeof v === 'string' && !v.trim()) return true;
  if (Array.isArray(v) && v.length === 0) return true;
  return false;
}

function humanStatus(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function PageLoading() {
  return (
    <div style={{
      minHeight: '100vh', background: 'var(--canvas)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'var(--font-sans)', color: 'var(--text-tertiary)', fontSize: 13,
    }}>Loading…</div>
  );
}

function PageError({ error, onBack }: { error: string; onBack: () => void }) {
  return (
    <div style={{
      minHeight: '100vh', background: 'var(--canvas)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexDirection: 'column', gap: 14, fontFamily: 'var(--font-sans)',
    }}>
      <Overline>Something went wrong</Overline>
      <p style={{ color: 'var(--st-rejected-fg)', fontSize: 13, margin: 0, fontFamily: 'var(--font-mono)' }}>{error}</p>
      <Btn variant="secondary" onClick={onBack}>← Back to tracker</Btn>
    </div>
  );
}
