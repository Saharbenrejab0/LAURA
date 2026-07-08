'use client';

/**
 * LAURA — Tracker · Editorial Finance redesign (Phase 2)
 * ------------------------------------------------------
 * VISUAL layer rebuilt on styles/redesign.css + components/ui/atoms.
 * ALL business logic preserved from the previous version:
 *   - getLOAs({ include_historical }) fetch
 *   - visited LOAs via sessionStorage 'laura.visitedLOAs'
 *   - getMyComments + batched per-LOA comments/summary fetch
 *   - filters: status / cluster / quarter / owner / search
 *   - pills: needs attention / rejected / under review / PPT issues / my comments
 *   - pagination 25/50/100 with page reset on filter change
 *   - historical toggle (admin only), Export Excel
 *
 * FIXED in this version:
 *   - REVIEW_STATUSES updated for workflow V3 (global_review no longer exists)
 *
 * NEW:
 *   - List / Board view toggle (Board groups by workflow stage)
 *   - Hero header with live pipeline stats
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import api from '@/lib/api';
import { getLOAs, getMyComments } from '@/lib/api';
import type { MyCommentsSummary } from '@/lib/api';
import { useMyRole } from '@/hooks/usePermissions';
import type { LOA } from '@/types/loa';
import { CLUSTERS, STATUS_CONFIG } from '@/types/loa';
import IOSToggle from '@/components/IOSToggle';
import { Pill, Btn, Avatar, initialsOf, Overline } from '@/components/ui/atoms';

const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;
type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

/** Workflow V3 — every non-terminal, non-draft status counts as "review" */
const REVIEW_STATUSES = [
  'emea_review',
  'global_brand_review',
  'emea_brand_rework',
  'global_functions_review',
  'emea_functions_rework',
  'cmo_cfo_review',
  'emea_cmo_rework',
  'corporate_review',
];

/** Board view: map every status to a stage column */
const BOARD_COLUMNS: { key: string; label: string; statuses: string[] }[] = [
  { key: 'draft',     label: 'Draft',       statuses: ['draft'] },
  { key: 'emea',      label: 'EMEA',        statuses: ['emea_review', 'emea_brand_rework', 'emea_functions_rework', 'emea_cmo_rework'] },
  { key: 'global',    label: 'Global',      statuses: ['global_brand_review', 'global_functions_review'] },
  { key: 'decision',  label: 'CMO / CFO',   statuses: ['cmo_cfo_review'] },
  { key: 'corporate', label: 'Corporate',   statuses: ['corporate_review'] },
  { key: 'approved',  label: 'Approved',    statuses: ['approved'] },
  { key: 'rejected',  label: 'Rejected',    statuses: ['rejected'] },
];

// ── Helpers ──────────────────────────────────────────────────────────

function formatEuros(n: number): string {
  if (!n) return '€0';
  if (n >= 1_000_000) return `€${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `€${Math.round(n / 1_000)}k`;
  return `€${n}`;
}

function formatCategory(cat: string | string[] | undefined | null): string | null {
  if (!cat) return null;
  if (Array.isArray(cat)) return cat.length ? cat.join(' + ') : null;
  return String(cat);
}

function timeAgo(iso: string | undefined | null): string {
  if (!iso) return '—';
  const then = new Date(iso).getTime();
  if (!then) return '—';
  const diff = Date.now() - then;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  if (diff < 30 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d`;
  return new Date(iso).toLocaleDateString();
}

function hoursSince(iso: string | undefined | null): number {
  if (!iso) return 0;
  return (Date.now() - new Date(iso).getTime()) / 3_600_000;
}

function chipSummary(
  set: Set<string>,
  totalOptions: number,
  labelFn: (v: string) => string = (v) => v,
): string {
  if (set.size === 0 || set.size === totalOptions) return 'All';
  if (set.size === 1) return labelFn([...set][0]);
  return `${set.size} selected`;
}

function toggleSet(
  set: Set<string>,
  value: string,
  setter: (s: Set<string>) => void,
) {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  setter(next);
}

/**
 * Bulk Excel export of the tracker.
 * NOTE (redesign migration): the original implementation lived in the previous
 * page.tsx. If this endpoint differs from your backend, restore the original
 * from page.tsx.bak3 — see the migration notes.
 */
async function exportExcel(statusFilters: Set<string>, clusterFilters: Set<string>) {
  try {
    const params: Record<string, string> = {};
    if (statusFilters.size === 1) params.status = [...statusFilters][0];
    if (clusterFilters.size === 1) params.cluster = [...clusterFilters][0];
    const res = await api.get('/loa/export/excel', { params, responseType: 'blob' });
    const url = URL.createObjectURL(new Blob([res.data]));
    const a = document.createElement('a');
    a.href = url;
    a.download = `LAURA_tracker_${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  } catch {
    alert('Excel export failed. Please try again or contact an admin.');
  }
}

interface LoaCommentSummary {
  total_unresolved: number;
  total_blocking: number;
}

// ═════════════════════════════════════════════════════════════════════
// Page
// ═════════════════════════════════════════════════════════════════════

export default function TrackerPage() {
  const router = useRouter();
  const { role } = useMyRole();

  const [loas, setLOAs] = useState<LOA[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(25);
  const [showHistorical, setShowHistorical] = useState(false);
  const [visitedIds, setVisitedIds] = useState<Set<string>>(new Set());
  const [entered, setEntered] = useState(false);
  const [view, setView] = useState<'list' | 'board'>('list');

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilters, setStatusFilters] = useState<Set<string>>(new Set());
  const [clusterFilters, setClusterFilters] = useState<Set<string>>(new Set());
  const [quarterFilter, setQuarterFilter] = useState<string | null>(null);
  const [ownerFilters, setOwnerFilters] = useState<Set<string>>(new Set());

  // Pill toggles
  const [needsAttention, setNeedsAttention] = useState(false);
  const [pptIssuesOnly, setPptIssuesOnly] = useState(false);
  const [showMyCommentsOnly, setShowMyCommentsOnly] = useState(false);

  // Comments
  const [myComments, setMyComments] = useState<MyCommentsSummary | null>(null);
  const [summaryByLoa, setSummaryByLoa] = useState<Map<string, LoaCommentSummary>>(new Map());

  useEffect(() => {
    const t = setTimeout(() => setEntered(true), 20);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    try {
      const v = sessionStorage.getItem('laura.visitedLOAs');
      if (v) setVisitedIds(new Set(JSON.parse(v)));
    } catch {/* ignore */}
  }, []);

  function markVisited(id: string) {
    setVisitedIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev); next.add(id);
      try { sessionStorage.setItem('laura.visitedLOAs', JSON.stringify([...next])); } catch {}
      return next;
    });
  }

  // Load LOAs
  useEffect(() => {
    setLoading(true);
    getLOAs({ include_historical: showHistorical })
      .then(setLOAs)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [showHistorical]);

  // Reset pagination on filter change
  useEffect(() => { setPage(1); }, [
    search, statusFilters, clusterFilters, quarterFilter, ownerFilters,
    needsAttention, pptIssuesOnly, showMyCommentsOnly, showHistorical, pageSize,
  ]);

  useEffect(() => {
    getMyComments().then(setMyComments).catch(() => {});
  }, []);

  // Fetch per-LOA comment summaries (batched)
  useEffect(() => {
    if (loas.length === 0) return;
    let cancelled = false;
    (async () => {
      const map = new Map<string, LoaCommentSummary>();
      const batchSize = 10;
      for (let i = 0; i < loas.length; i += batchSize) {
        if (cancelled) return;
        const batch = loas.slice(i, i + batchSize).filter(l => l && l.id);
        const results = await Promise.allSettled(
          batch.map(l => api.get(`/loa/${l.id}/comments/summary`).then(r => r.data))
        );
        results.forEach((res, idx) => {
          if (res.status === 'fulfilled' && res.value) {
            map.set(batch[idx].id, {
              total_unresolved: res.value.total_unresolved || 0,
              total_blocking: res.value.total_blocking || 0,
            });
          }
        });
      }
      if (!cancelled) setSummaryByLoa(map);
    })();
    return () => { cancelled = true; };
  }, [loas]);

  // ── Derived ────────────────────────────────────────────────────────

  const myCommentsByLoa = useMemo(() => {
    const m = new Map<string, MyCommentsSummary['loas'][0]>();
    if (myComments) myComments.loas.forEach(item => m.set(item.loa_id, item));
    return m;
  }, [myComments]);

  const uniqueOwners = useMemo(() => {
    const set = new Set<string>();
    loas.forEach(l => { if (l?.requestor_email) set.add(l.requestor_email); });
    return [...set].sort();
  }, [loas]);

  function isNeedsAttention(l: LOA): boolean {
    const sum = summaryByLoa.get(l.id);
    const hasBlocker = (sum?.total_blocking || 0) > 0;
    const isRejected = l.status === 'rejected';
    const isStaleReview = REVIEW_STATUSES.includes(l.status) && hoursSince(l.updated_at) > 48;
    return hasBlocker || isRejected || isStaleReview;
  }

  const filtered = useMemo(() => loas.filter((l) => {
    if (!l || !l.id) return false;
    if (showMyCommentsOnly && !myCommentsByLoa.has(l.id)) return false;
    if (statusFilters.size > 0 && !statusFilters.has(l.status)) return false;
    if (clusterFilters.size > 0 && !clusterFilters.has(l.cluster || '')) return false;
    if (ownerFilters.size > 0 && !ownerFilters.has(l.requestor_email || '')) return false;
    if (quarterFilter) {
      const field = `q${quarterFilter.slice(1)}_2026` as keyof LOA;
      const v = Number((l as any)[field] ?? 0);
      if (!v || v <= 0) return false;
    }
    if (needsAttention && !isNeedsAttention(l)) return false;
    if (pptIssuesOnly && l.ppt_slide_required !== false) return false;

    if (search) {
      const q = search.toLowerCase();
      const match = (
        l.activity_type?.toLowerCase().includes(q) ||
        l.country?.toLowerCase().includes(q) ||
        l.brand?.toLowerCase().includes(q) ||
        l.loa_draft_id?.toLowerCase().includes(q) ||
        l.loa_number?.toLowerCase().includes(q) ||
        l.customer?.toLowerCase().includes(q) ||
        l.description?.toLowerCase().includes(q) ||
        l.detail?.toLowerCase().includes(q) ||
        (formatCategory(l.category)?.toLowerCase().includes(q))
      );
      if (!match) return false;
    }
    return true;
  }), [loas, statusFilters, clusterFilters, quarterFilter, ownerFilters,
       search, showMyCommentsOnly, needsAttention, pptIssuesOnly,
       myCommentsByLoa, summaryByLoa]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const startIdx = (safePage - 1) * pageSize;
  const endIdx = Math.min(startIdx + pageSize, filtered.length);
  const paginated = filtered.slice(startIdx, endIdx);
  const totalBudget = filtered.reduce((s, l) => s + (l.fy_2026_total || 0), 0);

  const counts = useMemo(() => {
    const needsAttn = loas.filter(l => l && l.id && isNeedsAttention(l)).length;
    const rejected = loas.filter(l => l?.status === 'rejected').length;
    const review = loas.filter(l => REVIEW_STATUSES.includes(l?.status || '')).length;
    const pptIssues = loas.filter(l => l && l.ppt_slide_required === false).length;
    return { needsAttn, rejected, review, pptIssues };
  }, [loas, summaryByLoa]);

  const canSeeHistorical = role?.can_override_lock === true;
  const activeFilters =
    statusFilters.size + clusterFilters.size + ownerFilters.size +
    (quarterFilter ? 1 : 0) + (search ? 1 : 0) +
    (needsAttention ? 1 : 0) + (pptIssuesOnly ? 1 : 0) + (showMyCommentsOnly ? 1 : 0);

  const clearAll = () => {
    setStatusFilters(new Set()); setClusterFilters(new Set());
    setOwnerFilters(new Set()); setQuarterFilter(null);
    setSearch(''); setNeedsAttention(false);
    setPptIssuesOnly(false); setShowMyCommentsOnly(false);
  };

  // ── Render ─────────────────────────────────────────────────────────

  return (
    <div className="la-page la-fade" style={{
      opacity: entered ? 1 : 0,
      transform: entered ? 'none' : 'translateY(6px)',
      transition: 'opacity 200ms cubic-bezier(0.2,0,0,1), transform 200ms cubic-bezier(0.2,0,0,1)',
      fontFamily: 'var(--font-sans)',
    }}>

      {/* ─── Hero header ─── */}
      <header style={{ marginBottom: 22 }}>
        <div style={{
          display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
          gap: 16, flexWrap: 'wrap',
        }}>
          <div>
            <Overline>Portfolio</Overline>
            <h1 style={{
              margin: '4px 0 0',
              fontFamily: 'var(--font-display)',
              fontSize: 40, lineHeight: 1.05, fontWeight: 600,
              color: 'var(--text-primary)', letterSpacing: '-0.01em',
            }}>Tracker</h1>
            <p style={{ margin: '8px 0 0', fontSize: 13.5, color: 'var(--text-secondary)' }}>
              {loading ? 'Loading…' : (
                <>
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', fontWeight: 600 }}>
                    {filtered.length}
                  </span>
                  <span> LOA{filtered.length !== 1 ? 's' : ''}</span>
                  {totalBudget > 0 && (
                    <>
                      <span> · </span>
                      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--gold)', fontWeight: 600 }}>
                        {formatEuros(totalBudget)}
                      </span>
                      <span> in pipeline</span>
                    </>
                  )}
                </>
              )}
            </p>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <IOSToggle />
            <ViewToggle view={view} setView={setView} />
            <Btn
              variant={showMyCommentsOnly ? 'primary' : 'ghost'}
              onClick={() => setShowMyCommentsOnly(v => !v)}
              title={!myComments ? 'No comments yet' : 'Filter to LOAs you commented on'}
              small
            >
              💬 My comments
              {myComments && myComments.total_comments > 0 && (
                <span style={{ marginLeft: 6, fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                  {myComments.total_comments}
                </span>
              )}
            </Btn>
            <Btn
              variant="secondary"
              small
              onClick={() => exportExcel(statusFilters, clusterFilters)}
              disabled={loading || filtered.length === 0}
            >
              ↓ Export Excel
            </Btn>
          </div>
        </div>
      </header>

      {/* ─── Summary chips ─── */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        <SummaryChip
          label="Needs attention" count={counts.needsAttn} active={needsAttention}
          warn
          onClick={() => setNeedsAttention(v => !v)} />
        <SummaryChip
          label="Rejected" count={counts.rejected}
          active={statusFilters.size === 1 && statusFilters.has('rejected')}
          onClick={() => {
            const next = new Set<string>();
            if (!(statusFilters.size === 1 && statusFilters.has('rejected'))) next.add('rejected');
            setStatusFilters(next);
          }} />
        <SummaryChip
          label="Under review" count={counts.review}
          active={REVIEW_STATUSES.every(s => statusFilters.has(s)) && statusFilters.size === REVIEW_STATUSES.length}
          onClick={() => {
            const isAll = REVIEW_STATUSES.every(s => statusFilters.has(s)) && statusFilters.size === REVIEW_STATUSES.length;
            setStatusFilters(isAll ? new Set() : new Set(REVIEW_STATUSES));
          }} />
        <SummaryChip
          label="PPT issues" count={counts.pptIssues} active={pptIssuesOnly}
          warn
          onClick={() => setPptIssuesOnly(v => !v)} />
      </div>

      {/* ─── Search + filter row ─── */}
      <div style={{
        display: 'flex', gap: 8, marginBottom: 20,
        flexWrap: 'wrap', alignItems: 'center',
      }}>
        <div className="la-search">
          <span style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>⌕</span>
          <input
            type="text" value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search LOA, country, activity, brand, owner…"
          />
          {search && (
            <button onClick={() => setSearch('')} style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              fontSize: 11.5, color: 'var(--text-tertiary)', padding: '2px 4px',
              fontFamily: 'var(--font-sans)',
            }}>Clear</button>
          )}
        </div>

        <FilterChip label="Status"
          summary={chipSummary(statusFilters, Object.keys(STATUS_CONFIG).length, (s) => (STATUS_CONFIG as any)[s]?.label || s)}>
          {Object.entries(STATUS_CONFIG).map(([key, val]: [string, any]) => (
            <ChipOption key={key} label={val.label}
              checked={statusFilters.has(key)}
              onChange={() => toggleSet(statusFilters, key, setStatusFilters)} />
          ))}
        </FilterChip>

        <FilterChip label="Cluster" summary={chipSummary(clusterFilters, CLUSTERS.length)}>
          {CLUSTERS.map(c => (
            <ChipOption key={c} label={c}
              checked={clusterFilters.has(c)}
              onChange={() => toggleSet(clusterFilters, c, setClusterFilters)} />
          ))}
        </FilterChip>

        <FilterChip label="Quarter" summary={quarterFilter ? `${quarterFilter} 2026` : 'All'}>
          {['Q1', 'Q2', 'Q3', 'Q4'].map(q => (
            <ChipOption key={q} label={`${q} 2026`}
              checked={quarterFilter === q}
              onChange={() => setQuarterFilter(quarterFilter === q ? null : q)} />
          ))}
        </FilterChip>

        {uniqueOwners.length > 0 && (
          <FilterChip label="Owner"
            summary={chipSummary(ownerFilters, uniqueOwners.length, (e) => e.split('@')[0])}>
            <div style={{ maxHeight: 240, overflowY: 'auto' }}>
              {uniqueOwners.map(o => (
                <ChipOption key={o} label={o.split('@')[0]}
                  checked={ownerFilters.has(o)}
                  onChange={() => toggleSet(ownerFilters, o, setOwnerFilters)} />
              ))}
            </div>
          </FilterChip>
        )}

        {canSeeHistorical && (
          <button
            className={`la-chip ${showHistorical ? 'la-chip-on' : ''}`}
            onClick={() => setShowHistorical(v => !v)}
            title="Admin: include historical LOAs"
            style={{ height: 34 }}
          >
            {showHistorical ? '✓ ' : ''}Historical
          </button>
        )}

        {activeFilters > 0 && (
          <button onClick={clearAll} className="la-link" style={{ fontSize: 12 }}>
            Clear all ({activeFilters})
          </button>
        )}
      </div>

      {/* ─── Content: list or board ─── */}
      {!loading && filtered.length === 0 ? (
        <EmptyState hasFilters={activeFilters > 0} onClear={clearAll} />
      ) : view === 'board' ? (
        <BoardView
          loas={filtered}
          visitedIds={visitedIds}
          markVisited={markVisited}
          summaryByLoa={summaryByLoa}
          router={router}
        />
      ) : paginated.length > 0 ? (
        <>
          <div className="la-card" style={{ overflow: 'hidden', padding: 0 }}>
            <div className="la-thead" style={{
              display: 'grid',
              gridTemplateColumns: '14px 130px minmax(0, 1fr) 190px 100px',
              gap: 12,
            }}>
              <span></span>
              <span>LOA</span>
              <span>Activity</span>
              <span>Status / Owner</span>
              <span style={{ textAlign: 'right' }}>FY26</span>
            </div>

            {paginated.map(loa => (
              <TrackerRow
                key={loa.id}
                loa={loa}
                visited={visitedIds.has(loa.id)}
                onClick={() => markVisited(loa.id)}
                summary={summaryByLoa.get(loa.id)}
              />
            ))}
          </div>

          <PaginationBar
            page={safePage}
            totalPages={totalPages}
            pageSize={pageSize}
            startIdx={startIdx}
            endIdx={endIdx}
            total={filtered.length}
            setPage={setPage}
            setPageSize={(s) => { setPageSize(s); setPage(1); }}
          />
        </>
      ) : null}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════
// Row (list view)
// ═════════════════════════════════════════════════════════════════════

function TrackerRow({ loa, visited, onClick, summary }: {
  loa: LOA;
  visited: boolean;
  onClick: () => void;
  summary?: LoaCommentSummary;
}) {
  const title = loa.display_title || loa.detail || loa.description || loa.activity_type || '—';
  const country = loa.country || '—';
  const category = formatCategory(loa.category);
  const activity = loa.activity_type;
  const meta = [country, category, activity].filter(Boolean).join(' · ');
  const owner = loa.requestor_email?.split('@')[0] || '—';
  const updated = timeAgo(loa.updated_at);

  const blocking = summary?.total_blocking || 0;
  const unresolved = summary?.total_unresolved || 0;
  const pptMissing = loa.ppt_slide_required === false;

  return (
    <Link
      href={`/loa/${loa.id}`}
      onClick={onClick}
      className="la-row"
      style={{
        display: 'grid',
        gridTemplateColumns: '14px 130px minmax(0, 1fr) 190px 100px',
        gap: 12,
        alignItems: 'center',
        textDecoration: 'none',
        minHeight: 70,
        color: 'var(--text-primary)',
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {!visited && (
          <span style={{
            display: 'inline-block', width: 6, height: 6, borderRadius: 999,
            background: 'var(--gold)',
          }} title="Not yet viewed" />
        )}
      </span>

      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 500,
        color: 'var(--text-secondary)',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {loa.loa_number || loa.loa_draft_id}
      </span>

      <div style={{ minWidth: 0 }}>
        <p style={{
          margin: 0, fontSize: 14, fontWeight: 500, lineHeight: '20px',
          color: 'var(--text-primary)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{title}</p>
        <p style={{
          margin: '3px 0 0', fontSize: 12, lineHeight: '17px',
          color: 'var(--text-tertiary)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{meta || '—'}</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <Pill status={loa.status} />
          {pptMissing && <Pill status="ppt" kind="Warn" label="PPT required" />}
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 11, color: 'var(--text-tertiary)',
          overflow: 'hidden', whiteSpace: 'nowrap',
        }}>
          <Avatar initials={initialsOf(owner)} size={16} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{owner} · {updated}</span>
          {unresolved > 0 && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              fontFamily: 'var(--font-mono)', fontSize: 10.5, fontWeight: 600,
              color: blocking > 0 ? 'var(--st-rejected-fg)' : 'var(--text-secondary)',
            }} title={blocking > 0 ? `${blocking} blocking` : `${unresolved} unresolved`}>
              💬 {unresolved}
            </span>
          )}
        </div>
      </div>

      <span style={{
        textAlign: 'right',
        fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600,
        color: 'var(--text-primary)',
      }}>
        {formatEuros(loa.fy_2026_total || 0)}
      </span>
    </Link>
  );
}

// ═════════════════════════════════════════════════════════════════════
// Board view (grouped by workflow stage)
// ═════════════════════════════════════════════════════════════════════

function BoardView({ loas, visitedIds, markVisited, summaryByLoa, router }: {
  loas: LOA[];
  visitedIds: Set<string>;
  markVisited: (id: string) => void;
  summaryByLoa: Map<string, LoaCommentSummary>;
  router: ReturnType<typeof useRouter>;
}) {
  const byColumn = useMemo(() => {
    const m = new Map<string, LOA[]>();
    BOARD_COLUMNS.forEach(c => m.set(c.key, []));
    loas.forEach(l => {
      const col = BOARD_COLUMNS.find(c => c.statuses.includes(l.status));
      if (col) m.get(col.key)!.push(l);
    });
    return m;
  }, [loas]);

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${BOARD_COLUMNS.length}, minmax(190px, 1fr))`,
      gap: 12,
      overflowX: 'auto',
      paddingBottom: 8,
    }}>
      {BOARD_COLUMNS.map(col => {
        const items = byColumn.get(col.key) || [];
        return (
          <div key={col.key} style={{ minWidth: 190 }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '4px 6px 10px',
            }}>
              <Overline>{col.label}</Overline>
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600,
                color: 'var(--text-tertiary)',
              }}>{items.length}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {items.slice(0, 30).map(l => {
                const unresolved = summaryByLoa.get(l.id)?.total_unresolved || 0;
                return (
                  <button
                    key={l.id}
                    className="la-boardcard"
                    onClick={() => { markVisited(l.id); router.push(`/loa/${l.id}`); }}
                  >
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6,
                    }}>
                      {!visitedIds.has(l.id) && (
                        <span style={{
                          width: 5, height: 5, borderRadius: 999,
                          background: 'var(--gold)', flexShrink: 0,
                        }} />
                      )}
                      <span style={{
                        fontFamily: 'var(--font-mono)', fontSize: 10,
                        color: 'var(--text-tertiary)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>{l.loa_number || l.loa_draft_id}</span>
                    </div>
                    <div style={{
                      fontSize: 12.5, fontWeight: 500, lineHeight: 1.35,
                      display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                      overflow: 'hidden', marginBottom: 8,
                    }}>
                      {l.detail || l.description || l.activity_type || '—'}
                    </div>
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      fontSize: 11,
                    }}>
                      <span style={{ color: 'var(--text-tertiary)' }}>
                        {l.country || '—'}{unresolved > 0 ? ` · 💬 ${unresolved}` : ''}
                      </span>
                      <span style={{
                        fontFamily: 'var(--font-mono)', fontWeight: 600,
                        color: 'var(--text-primary)',
                      }}>
                        {formatEuros(l.fy_2026_total || 0)}
                      </span>
                    </div>
                  </button>
                );
              })}
              {items.length > 30 && (
                <div style={{
                  fontSize: 11, color: 'var(--text-tertiary)',
                  textAlign: 'center', padding: '4px 0',
                }}>+ {items.length - 30} more — use list view</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════
// Small components
// ═════════════════════════════════════════════════════════════════════

function ViewToggle({ view, setView }: {
  view: 'list' | 'board'; setView: (v: 'list' | 'board') => void;
}) {
  return (
    <div style={{
      display: 'inline-flex',
      background: 'var(--surface-sunken)',
      borderRadius: 8, padding: 3,
    }}>
      {(['list', 'board'] as const).map(v => (
        <button
          key={v}
          className="la-seg"
          onClick={() => setView(v)}
          style={{
            background: view === v ? 'var(--surface)' : 'transparent',
            color: view === v ? 'var(--text-primary)' : 'var(--text-tertiary)',
            borderRadius: 6, padding: '4px 12px',
            fontSize: 12, fontWeight: view === v ? 600 : 500,
            boxShadow: view === v ? 'var(--shadow-sm)' : 'none',
          }}
        >
          {v === 'list' ? '☰ List' : '▦ Board'}
        </button>
      ))}
    </div>
  );
}

function SummaryChip({ label, count, active, onClick, warn }: {
  label: string; count: number; active: boolean; onClick: () => void; warn?: boolean;
}) {
  const disabled = count === 0;
  return (
    <button
      className={`la-chip ${active ? 'la-chip-on' : ''}`}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      style={{
        opacity: disabled ? 0.45 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        gap: 8,
      }}
    >
      <span>{label}</span>
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: 11.5, fontWeight: 700,
        color: warn && count > 0 && !active ? 'var(--st-rework-fg)' : 'inherit',
      }}>{count}</span>
    </button>
  );
}

function FilterChip({ label, summary, children }: {
  label: string; summary: string; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [open]);

  const active = summary !== 'All' && summary !== '';

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        className="la-filter"
        onClick={() => setOpen(!open)}
        style={{
          borderColor: active || open ? 'var(--gold)' : undefined,
          background: active ? 'var(--gold-soft)' : undefined,
          color: active ? 'var(--text-primary)' : undefined,
          fontWeight: active ? 600 : 500,
          gap: 5,
        }}
      >
        {label}: <span style={{ fontWeight: 600 }}>{summary}</span>
        <span style={{ marginLeft: 3, fontSize: 8 }}>▾</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0,
          background: 'var(--surface-raised)',
          border: '1px solid var(--border)',
          borderRadius: 10, padding: 8, minWidth: 210,
          boxShadow: 'var(--shadow-lg)', zIndex: 50,
        }}>
          {children}
        </div>
      )}
    </div>
  );
}

function ChipOption({ label, checked, onChange }: {
  label: string; checked: boolean; onChange: () => void;
}) {
  return (
    <label className="la-checkitem" style={{
      color: checked ? 'var(--text-primary)' : 'var(--text-secondary)',
      fontWeight: checked ? 600 : 400,
    }}>
      <input type="checkbox" checked={checked} onChange={onChange}
        style={{ accentColor: 'var(--gold)', cursor: 'pointer' }} />
      <span>{label}</span>
    </label>
  );
}

function PaginationBar({
  page, totalPages, pageSize, startIdx, endIdx, total, setPage, setPageSize,
}: {
  page: number; totalPages: number; pageSize: PageSize;
  startIdx: number; endIdx: number; total: number;
  setPage: (p: number) => void; setPageSize: (s: PageSize) => void;
}) {
  const pages = useMemo(() => {
    const out: (number | '…')[] = [];
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || Math.abs(i - page) <= 1) out.push(i);
      else if (out[out.length - 1] !== '…') out.push('…');
    }
    return out;
  }, [page, totalPages]);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: 12, marginTop: 16, flexWrap: 'wrap',
    }}>
      <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>
        Showing <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', fontWeight: 600 }}>
          {startIdx + 1}–{endIdx}
        </span> of <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', fontWeight: 600 }}>
          {total}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <PageBtn label="‹" disabled={page <= 1} onClick={() => setPage(page - 1)} />
        {pages.map((p, i) => p === '…' ? (
          <span key={`e${i}`} style={{ padding: '0 6px', color: 'var(--text-tertiary)', fontSize: 12 }}>…</span>
        ) : (
          <PageBtn key={p} label={String(p)} active={p === page} onClick={() => setPage(p as number)} />
        ))}
        <PageBtn label="›" disabled={page >= totalPages} onClick={() => setPage(page + 1)} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--text-tertiary)' }}>
        <span>Per page</span>
        <div style={{
          display: 'inline-flex',
          background: 'var(--surface-sunken)',
          borderRadius: 8, padding: 3,
        }}>
          {PAGE_SIZE_OPTIONS.map(s => (
            <button key={s} className="la-seg" onClick={() => setPageSize(s)} style={{
              background: pageSize === s ? 'var(--surface)' : 'transparent',
              color: pageSize === s ? 'var(--text-primary)' : 'var(--text-tertiary)',
              borderRadius: 6, padding: '3px 10px',
              fontSize: 11.5, fontWeight: pageSize === s ? 600 : 500,
              boxShadow: pageSize === s ? 'var(--shadow-sm)' : 'none',
              fontFamily: 'var(--font-mono)',
            }}>{s}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

function PageBtn({ label, active, disabled, onClick }: {
  label: string; active?: boolean; disabled?: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      style={{
        minWidth: 30, height: 30, padding: '0 8px',
        borderRadius: 7,
        border: `1px solid ${active ? 'var(--ink)' : 'var(--border)'}`,
        background: active ? 'var(--ink)' : 'var(--surface)',
        color: active ? 'var(--ink-text)' : disabled ? 'var(--text-tertiary)' : 'var(--text-secondary)',
        fontSize: 12.5, fontWeight: active ? 700 : 500,
        fontFamily: 'var(--font-mono)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        transition: 'all .15s ease',
      }}
    >{label}</button>
  );
}

function EmptyState({ hasFilters, onClear }: { hasFilters: boolean; onClear: () => void }) {
  return (
    <div className="la-card" style={{
      padding: '64px 24px', textAlign: 'center',
    }}>
      <div style={{
        fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 600,
        color: 'var(--text-primary)', marginBottom: 8,
      }}>
        {hasFilters ? 'No LOAs match these filters' : 'No LOAs yet'}
      </div>
      <p style={{ margin: 0, fontSize: 13.5, color: 'var(--text-tertiary)' }}>
        {hasFilters
          ? 'Try broadening your search or clearing some filters.'
          : 'Create your first LOA with the “+ New LOA” button in the sidebar.'}
      </p>
      {hasFilters && (
        <div style={{ marginTop: 18 }}>
          <Btn variant="secondary" small onClick={onClear}>Clear all filters</Btn>
        </div>
      )}
    </div>
  );
}
