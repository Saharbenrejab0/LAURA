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

import { useEffect, useMemo, useRef, useState, useCallback, Fragment } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';

import api from '@/lib/api';
import { getLOAs, getMyComments, getLOA, listComments, createComment, getMyPermissionsOnLOA, getStoredUser } from '@/lib/api';
import type { MyCommentsSummary, CommentItem } from '@/lib/api';
import { useMyRole } from '@/hooks/usePermissions';
import { createPortal } from 'react-dom';
import { formatCell } from '@/lib/format';
import { EXCEL_COLUMNS, columnWidth } from '@/lib/excelColumns';
import type { LOA } from '@/types/loa';
import { CLUSTERS, STATUS_CONFIG } from '@/types/loa';
import IOSToggle from '@/components/IOSToggle';
import { Pill, Btn, Avatar, initialsOf, Overline } from '@/components/ui/atoms';
import TrackerReviewView from '@/components/TrackerReviewView';
import PastCyclesGrid from '@/components/cycles/PastCyclesGrid';
import TestCycleBanner from '@/components/cycles/TestCycleBanner';
import { fetchCycle } from '@/lib/cycles-api';
import CFOSpreadsheet from '@/components/cfo/CFOSpreadsheet';
import SplitScreenReview from '@/components/alignment-review/SplitScreenReview';
import NightLensPage from '@/components/NightLensPage';
import { newestFirst } from '@/lib/sort';
import { interfaceFor, showsViewToggle } from '@/lib/roles';
import { WORKFLOW_ORDER } from '@/lib/workflow';

/* Editorial Finance palette constants used by the cycle scope tabs + banner
   (mirror the redesign CSS tokens: --gold / cream surface / champagne border). */
/**
 * The tracker's in-page views and cycle scopes.
 *
 * Module-level so the URL parser, the state initialiser and the toggle all
 * validate against one list — a `?view=` value that isn't here falls back to
 * 'deck' instead of rendering nothing.
 */
const VIEWS = ['list', 'board', 'deck', 'excel', 'review', 'alignment'] as const;
type View = typeof VIEWS[number];

const SCOPES = ['current', 'past', 'emergency', 'archive'] as const;
type Scope = typeof SCOPES[number];

const CYCLE_STATUS_LABEL: Record<string, string> = {
  draft: 'DRAFT', open: 'OPEN', under_review: 'IN REVIEW', closed: 'CLOSED',
};

const T_GOLD = '#B08D2F';
const T_CREAM = '#F4F1EA';
const T_CHAMP = '#E8D9B8';

const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;
type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

const REVIEW_STATUSES: string[] = WORKFLOW_ORDER.filter(s => s !== 'draft' && s !== 'approved');

const BOARD_COLUMNS: { key: string; label: string; statuses: string[] }[] = [
  { key: 'draft',      label: 'Draft',      statuses: ['draft'] },
  { key: 'alignment',  label: 'Alignment',  statuses: ['local_alignment'] },
  { key: 'emea',       label: 'EMEA',       statuses: ['emea_review', 'emea_post_global_review', 'emea_final_review'] },
  { key: 'global',     label: 'Global',     statuses: ['global_review'] },
  { key: 'decision',   label: 'CMO / CFO',  statuses: ['cmo_cfo_review'] },
  { key: 'corporate',  label: 'Corporate',  statuses: ['corporate_review'] },
  { key: 'approved',   label: 'Approved',   statuses: ['approved'] },
  { key: 'rejected',   label: 'Rejected',   statuses: ['rejected'] },
];

/** Terminal statuses — an LOA here has left the active pipeline. */
const TERMINAL_STATUSES = new Set(['approved', 'rejected', 'archived']);

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
  const { role, loading: roleLoading } = useMyRole();

  // Role-locked review modes — CMO and CFO see only their review view.
  // Primary: role_code set by startup migration on backend restart.
  // Fallback: email pattern for demo accounts before the migration has run
  //           (regional-cmo@laura-demo.local, regional-cfo@laura-demo.local).
  const _roleCode  = role?.role_code ?? '';
  const _userEmail = role?.email?.toLowerCase() ?? '';
  // Email fallback fires whenever role_code is not already a recognized review code
  // (covers demo accounts that have role_code: "approver" or null before migration).
  const iface = interfaceFor(_roleCode, role?.can_override_lock === true);
  const _notReviewCode = _roleCode !== 'regional_cmo' && _roleCode !== 'regional_cfo';
  const isCMO = _roleCode === 'regional_cmo' || (_notReviewCode && _userEmail.includes('-cmo@'));
  const isCFO = _roleCode === 'regional_cfo' || (_notReviewCode && _userEmail.includes('-cfo@'));
  const isAlignmentRole = (
    _roleCode === 'local_alignment' ||
    _roleCode === 'global_function_review' ||
    _roleCode === 'global_brand_review'
  );
  // role_code for marketers is cluster-specific: france_marketer, italy_marketer, etc.
  const isMarketerRole = _roleCode.endsWith('_marketer');
  // can_override_lock is the canonical "admin" flag on every Role row
  const isAdmin = role?.can_override_lock === true;
  const isReviewOnlyRole = isCMO || isCFO || isAlignmentRole || isMarketerRole;
  /**
   * Roles that never touch the tracker list, so the page-level getLOAs() and the
   * per-LOA comment-summary batch are pure waste for them.
   *
   * The CFO is deliberately NOT in this set: CFOSpreadsheet is fed from the
   * page-level `loas`, unlike the CMO deck and the alignment review, which each
   * load their own data.
   */
  const skipsTrackerFetch = isCMO || isAlignmentRole || isMarketerRole;

  // ── Cycle scope tabs ──────────────────────────────────────────
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [scope, setScope] = useState<Scope>((searchParams?.get('scope') as Scope) || 'current');
  const [activeCycle, setActiveCycle] = useState<{id:string;name:string;code:string|null;status:string;startDate:string;endDate:string;daysRemaining:number|null}|null>(null);
  // Test-cycle flag comes from /cycles/{id}, not the legacy cycle context.
  const [activeCycleMeta, setActiveCycleMeta] = useState<{isTest:boolean;totalLoas:number}|null>(null);
  const [pastCycles, setPastCycles] = useState<{id:string;name:string;loaCount:number}[]>([]);
  const [pastCycleId, setPastCycleId] = useState<string>(() => searchParams?.get('cycle') || '');
  // Task 2 — emergency authorization for the logged-in marketer.
  const [canCreateEmergency, setCanCreateEmergency] = useState(false);
  const [emergencyCycle, setEmergencyCycle] = useState<{id:string;name:string;code:string|null;reason:string|null;endDate:string}|null>(null);

  /**
   * In-page state lives in the URL so Back and Forward restore it.
   *
   * These used `history.replaceState`, which overwrites the current entry and
   * therefore creates NO history — that is why Back from anywhere in the tracker
   * skipped straight past every view the user had opened. `router.push` gives
   * each change a real entry; `scroll: false` keeps the viewport still.
   */
  const setParam = useCallback((patch: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === '') params.delete(k);
      else params.set(k, v);
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [router, pathname, searchParams]);

  const changeScope = useCallback((s: Scope) => {
    setScope(s);
    // Off-cycle scopes (past / emergency / archive) are list-oriented: the
    // deck and sheet lenses only apply to the open cycle. Written into the SAME
    // URL update rather than corrected afterwards by an effect — an effect that
    // set view without touching the URL left the address bar claiming ?view=deck
    // while a list was on screen, and the URL mirror reverted it on the next
    // navigation.
    const nextView: View | null = s !== 'current' ? 'list' : null;
    if (nextView) setView(nextView);
    // Leaving a scope also abandons the cycle that was open inside it.
    setParam({ scope: s, cycle: null, ...(nextView ? { view: nextView } : {}) });
  }, [setParam]);

  const changePastCycle = useCallback((id: string) => {
    setPastCycleId(id);
    setParam({ cycle: id || null });
  }, [setParam]);

  const changeView = useCallback((v: View) => {
    setView(v);
    setParam({ view: v });
  }, [setParam]);

  // Fetch cycle context (auth-only endpoint → works for every role).
  useEffect(() => {
    api.get('/admin/cycle/current').then((r: any) => {
      const d = r.data || {};
      const active = Array.isArray(d.active) ? d.active : [];
      const normal = active.find((c: any) => c.cycle_type === 'normal');
      if (normal) {
        const end = new Date(normal.end_date);
        const diff = Math.ceil((end.getTime() - Date.now()) / 86_400_000);
        setActiveCycle({ id: normal.id, name: normal.name, code: normal.code ?? null, status: normal.status ?? 'open', startDate: normal.start_date, endDate: normal.end_date, daysRemaining: diff > 0 ? diff : 0 });
      }
      setPastCycles(Array.isArray(d.past) ? d.past.map((c: any) => ({ id: c.id, name: c.name, loaCount: c.loa_count || 0 })) : []);
      setCanCreateEmergency(!!d.can_create_emergency);
      setEmergencyCycle(d.emergency_cycle ? { id: d.emergency_cycle.id, name: d.emergency_cycle.name, code: d.emergency_cycle.code ?? null, reason: d.emergency_cycle.reason ?? null, endDate: d.emergency_cycle.end_date } : null);
    }).catch(() => {});
  }, []);


  const [loas, setLOAs] = useState<LOA[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(25);
  const [showHistorical, setShowHistorical] = useState(false);
  const [visitedIds, setVisitedIds] = useState<Set<string>>(new Set());
  const [entered, setEntered] = useState(false);
  const [view, setView] = useState<View>(() => {
    const v = searchParams?.get('view');
    return VIEWS.includes(v as View) ? (v as View) : 'deck';
  });
  // CMO / CFO see the Night Lens welcome page before entering their review.
  const [folderOpen, setFolderOpen] = useState(true);
  // The cycle a CMO/CFO selected for review from the Night Lens page.
  // Can be the open cycle or a closed (read-only) cycle.
  const [nlCycle, setNlCycle] = useState<{ id: string; name: string; isOpen: boolean } | null>(null);
  // LOAs for a closed cycle selected from Night Lens (CFO needs them as a prop).
  const [nlCycleLoas, setNlCycleLoas] = useState<LOA[]>([]);

  // Which lens you review the cycle through — drives the default view (design 2a).
  const [reviewMode, setReviewMode] = useState<'cmo' | 'cfo' | 'marketer'>(() => {
    const v = searchParams?.get('view');
    return v === 'excel' ? 'cfo' : v === 'list' ? 'marketer' : 'cmo';
  });

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

  /**
   * Back / Forward inside the same route changes the query string without
   * remounting, so the URL is the source of truth and state follows it. Without
   * this the address bar and the screen disagree after a Back.
   */
  useEffect(() => {
    const v = searchParams?.get('view');
    setView(VIEWS.includes(v as View) ? (v as View) : 'deck');
    const sc = searchParams?.get('scope') as Scope | null;
    setScope(sc && SCOPES.includes(sc) ? sc : 'current');
    setPastCycleId(searchParams?.get('cycle') || '');
  }, [searchParams]);

  // Off-cycle scopes (past / emergency / archive) are list-oriented — the
  // deck/excel review lenses only apply to the current open cycle.
  // (The off-cycle view reset lives in changeScope, so the URL and the screen
  // agree. A deep link that names an off-cycle scope is normalised here once.)
  useEffect(() => {
    if (scope !== 'current' && view !== 'list') setParam({ view: 'list' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]);

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

  // Load LOAs — skip for review-only roles (CMO/CFO/alignment/marketer use their own
  // data path and never see the tracker list; fetching all LOAs for them is pure waste
  // and triggers the expensive per-LOA comment-summary batch below).
  useEffect(() => {
    if (roleLoading || skipsTrackerFetch) return;
    setLoading(true);
    getLOAs({ include_historical: showHistorical })
      .then(setLOAs)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [showHistorical, roleLoading, skipsTrackerFetch]);

  // Reset pagination on filter change
  useEffect(() => { setPage(1); }, [
    search, statusFilters, clusterFilters, quarterFilter, ownerFilters,
    needsAttention, pptIssuesOnly, showMyCommentsOnly, showHistorical, pageSize,
    scope, pastCycleId,
  ]);

  useEffect(() => {
    if (roleLoading || skipsTrackerFetch) return;
    getMyComments().then(setMyComments).catch(() => {});
  }, [roleLoading, skipsTrackerFetch]);

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

    // Cycle scope gate (tabs above the list)
    if (scope === 'emergency') {
      if (!l.is_emergency) return false;
    } else if (scope === 'archive') {
      if (l.status !== 'archived') return false;
    } else if (scope === 'past') {
      if (!pastCycleId || l.cycle_id !== pastCycleId) return false;
    } else { // current — real, active LOAs; historical live in Past Campaigns / Past cycles
      if (l.is_emergency) return false;              // emergency has its own tab
      if (l.status === 'archived') return false;
      if (!showHistorical && (l as any).is_demo === false) return false;  // hide the ETL import
    }

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
       myCommentsByLoa, summaryByLoa,
       scope, pastCycleId, activeCycle, showHistorical]);

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

  // Deck view: which LOAs need the room's attention, and their weight.
  const flaggedIds = useMemo(
    () => new Set(filtered.filter(l => l && l.id && isNeedsAttention(l)).map(l => l.id)),
    [filtered, summaryByLoa],
  );
  const flaggedBudget = useMemo(
    () => filtered.filter(l => flaggedIds.has(l.id)).reduce((s, l) => s + (l.fy_2026_total || 0), 0),
    [filtered, flaggedIds],
  );

  // All current-cycle LOAs (no status/cluster/search filters) — used by the review slideshow.
  useEffect(() => {
    if (!activeCycle?.id) { setActiveCycleMeta(null); return; }
    let alive = true;
    fetchCycle(activeCycle.id)
      .then(c => { if (alive) setActiveCycleMeta({ isTest: c.isTest, totalLoas: c.totalLoas }); })
      .catch(() => { if (alive) setActiveCycleMeta(null); });
    return () => { alive = false; };
  }, [activeCycle?.id]);

  // When a CFO selects a closed cycle from Night Lens, fetch that cycle's LOAs.
  useEffect(() => {
    if (!isCFO || !nlCycle || nlCycle.isOpen) { setNlCycleLoas([]); return; }
    let alive = true;
    api.get(`/cycles/${nlCycle.id}/loas`)
      .then((r: any) => { if (alive) setNlCycleLoas(Array.isArray(r.data) ? r.data : []); })
      .catch(() => { if (alive) setNlCycleLoas([]); });
    return () => { alive = false; };
  }, [isCFO, nlCycle?.id, nlCycle?.isOpen]);

  // The CFO reviews one cycle, exactly like the CMO deck does — so this must be
  // scoped to the open cycle, not to every LOA the tracker has ever loaded.
  const cycleLoas = useMemo(
    () => loas.filter(l =>
      !l.is_emergency
      && l.status !== 'archived'
      && (!activeCycle?.id || l.cycle_id === activeCycle.id)
    ),
    [loas, activeCycle?.id],
  );

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

  // Role is still fetching — return nothing so CMO/CFO don't see a flash of
  // the tracker chrome before the full-screen overlay mounts.
  if (roleLoading) return null;

  return (
    <div className="la-page la-fade" style={{
      opacity: entered ? 1 : 0,
      transform: entered ? 'none' : 'translateY(6px)',
      transition: 'opacity 200ms cubic-bezier(0.2,0,0,1), transform 200ms cubic-bezier(0.2,0,0,1)',
      fontFamily: 'var(--font-sans)',
    }}>

      {/* Scope tabs, hero, stats, filters — hidden for review-only roles (CMO/CFO
          see only their full-screen overlay; the DOM elements are unnecessary). */}
      {!isReviewOnlyRole && (<>
      {/* ─── Scope tabs + cycle banner ────────────────────── */}
      <div style={{ marginBottom: 20 }}>
        {/* Segmented control */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', height: 44, boxSizing: 'border-box', background: T_CREAM, border: `1px solid ${T_CHAMP}`, borderRadius: 10, padding: 4, gap: 4 }}>
            {([
              { key: 'current', label: 'Current Cycle' },
              { key: 'past', label: 'Past Cycles' },
              { key: 'emergency', label: 'Emergency LOAs', badge: loas.filter(l => l.is_emergency).length },
              ...(canSeeHistorical ? [{ key: 'archive', label: 'Archive' }] : []),
            ] as {key:string;label:string;badge?:number}[]).map(tab => (
              <button key={tab.key} onClick={() => changeScope(tab.key as Scope)}
                style={{ height: 36, padding: '0 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6,
                  background: scope === tab.key ? 'var(--ink)' : 'transparent',
                  color: scope === tab.key ? T_CREAM : 'var(--text-primary)',
                  transition: 'all 150ms' }}>
                {tab.label}
                {tab.badge != null && tab.badge > 0 && (
                  <span style={{ minWidth: 20, height: 20, borderRadius: 10, background: 'var(--danger)', color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px' }}>{tab.badge}</span>
                )}
              </button>
            ))}
          </div>
          {scope === 'current' && isAdmin && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)' }}>Review as</span>
              <div style={{ display: 'inline-flex', background: 'var(--surface-sunken)', borderRadius: 8, padding: 3 }}>
                {(['cmo', 'cfo', 'marketer'] as const).map((m) => {
                  const label = m === 'cmo' ? 'CMO' : m === 'cfo' ? 'CFO' : 'Marketer';
                  const targetView: 'review' | 'excel' | 'list' = m === 'cmo' ? 'review' : m === 'cfo' ? 'excel' : 'list';
                  return (
                    <button key={m} className="la-seg"
                      /* changeView, not setView: the URL is the source of truth
                         now, and the [searchParams] mirror effect would revert a
                         bare setState on the next URL change. */
                      onClick={() => { setReviewMode(m); changeView(targetView); }}
                      style={{
                        background: reviewMode === m ? 'var(--surface)' : 'transparent',
                        color: reviewMode === m ? 'var(--text-primary)' : 'var(--text-tertiary)',
                        borderRadius: 6, padding: '5px 13px', fontSize: 12, fontWeight: reviewMode === m ? 600 : 500,
                        boxShadow: reviewMode === m ? 'var(--shadow-sm)' : 'none',
                      }}>
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Emergency marketer window (Task 2) — only for authorized emails */}
        {canCreateEmergency && emergencyCycle && scope !== 'past' && scope !== 'archive' && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', padding: '12px 16px', borderRadius: 10, border: '1px solid var(--danger-border)', borderLeft: '3px solid var(--danger)', background: 'var(--danger-soft)', marginBottom: 12 }}>
            <div>
              <strong style={{ color: 'var(--danger)', fontSize: 13.5 }}>Emergency window open</strong>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                You can create an Emergency LOA until{' '}
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', fontWeight: 600 }}>
                  {new Date(emergencyCycle.endDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>.
              </div>
            </div>
            <Link href={`/loa/new?emergency=1&cycle=${encodeURIComponent(emergencyCycle.id)}`}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 34, padding: '0 14px', borderRadius: 8, border: '1px solid var(--danger)', color: 'var(--danger)', background: 'transparent', fontSize: 12.5, fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap' }}>
              + New Emergency LOA
            </Link>
          </div>
        )}

        {/* Throwaway-data warning — shown before anything else about the cycle */}
        {scope === 'current' && activeCycle && activeCycleMeta?.isTest && (
          <TestCycleBanner
            cycle={{ id: activeCycle.id, name: activeCycle.name, totalLoas: activeCycleMeta.totalLoas }}
            canDelete={role?.can_override_lock === true}
            onDeleted={() => window.location.reload()}
          />
        )}

        {/* Cycle banner */}
        {scope === 'current' && activeCycle && (
          <div style={{ padding: '12px 16px', borderRadius: 10, border: `1px solid ${T_CHAMP}`, borderLeft: `4px solid ${T_GOLD}`, background: '#fbf7ed', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
                {activeCycle.name}
                {activeCycle.code && (
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, fontWeight: 500, color: 'var(--text-tertiary)', marginLeft: 8 }}>
                    {activeCycle.code}
                  </span>
                )}
              </span>
              <span style={{ padding: '2px 10px', borderRadius: 12, background: activeCycle.status === 'open' ? T_GOLD : '#8a8272', color: T_CREAM, fontSize: 11, fontWeight: 700, letterSpacing: '.04em' }}>
                {CYCLE_STATUS_LABEL[activeCycle.status] ?? activeCycle.status.toUpperCase()}
              </span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
              {activeCycle.status === 'open' && activeCycle.daysRemaining != null && (
                <span style={{ background: activeCycle.daysRemaining <= 1 ? 'var(--danger-soft)' : 'rgba(176,141,47,.12)', color: activeCycle.daysRemaining <= 1 ? 'var(--danger)' : T_GOLD, padding: '1px 8px', borderRadius: 10, fontWeight: 700, marginRight: 8 }}>
                  {activeCycle.daysRemaining === 0 ? 'Closes today' : `${activeCycle.daysRemaining}d remaining`}
                </span>
              )}
              {new Date(activeCycle.startDate).toLocaleDateString('en-GB', { day:'numeric', month:'short' })} — {new Date(activeCycle.endDate).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })}
            </div>
            {activeCycle.status !== 'open' && (
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>
                Submissions are closed — LOAs already in the chain continue to move.
              </div>
            )}
          </div>
        )}

        {scope === 'current' && !activeCycle && !loading && (
          <div style={{ padding: '12px 16px', borderRadius: 10, border: `1px solid ${T_CHAMP}`, background: '#fafaf8', color: 'var(--text-secondary)', fontSize: 13, marginBottom: 12 }}>
            <strong style={{ color: 'var(--text-primary)' }}>No cycle open</strong> — Standard LOA submission is currently closed. In-flight LOAs remain visible below.
          </div>
        )}

        {scope === 'emergency' && (
          <div style={{ padding: '12px 16px', borderRadius: 10, border: '1px solid var(--danger-border)', borderLeft: '4px solid var(--danger)', background: 'var(--danger-soft)', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <strong style={{ color: 'var(--danger)', fontSize: 14 }}>Emergency LOAs</strong>
              {emergencyCycle && (
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)' }}>
                  {emergencyCycle.code || emergencyCycle.name}
                </span>
              )}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
              High-priority requests submitted outside the standard cycle process.
            </div>
            {/* An emergency cycle is confidential, and the person looking at it
                should know that is why the list is short — not that it is broken. */}
            {emergencyCycle ? (
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>
                {emergencyCycle.reason && (
                  <div style={{ marginBottom: 4 }}>
                    <span style={{ color: 'var(--text-tertiary)' }}>Reason: </span>{emergencyCycle.reason}
                  </div>
                )}
                Visible only to the people named on this cycle. {canCreateEmergency
                  ? 'You are one of them.'
                  : 'You are seeing it because you are an admin.'}
              </div>
            ) : (
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>
                No emergency window is open. Anything listed below is from a past one.
              </div>
            )}
          </div>
        )}

        {scope === 'past' && (
          <div style={{ padding: '12px 16px', borderRadius: 10, border: `1px solid ${T_CHAMP}`, borderLeft: '4px solid #8a8272', background: 'var(--surface-subtle)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13 }}>🔒</span>
            <div style={{ flex: 1, minWidth: 180 }}>
              <strong style={{ fontSize: 13, color: 'var(--text-primary)' }}>Past cycles — read-only</strong>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>Open a closed cycle to browse its review deck. Nothing can be modified.</div>
            </div>
          </div>
        )}

        {scope === 'archive' && (
          <div style={{ padding: '12px 16px', borderRadius: 10, border: `1px solid ${T_CHAMP}`, borderLeft: '4px solid #8a8272', background: 'var(--surface-subtle)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 13 }}>🔒</span>
            <div style={{ flex: 1 }}>
              <strong style={{ fontSize: 13, color: 'var(--text-primary)' }}>Archive — read-only</strong>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>Archived LOAs, retained for reference.</div>
            </div>
          </div>
        )}
      </div>

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
            {showsViewToggle(iface) && <ViewToggle view={view} setView={changeView} />}
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

      {/* ─── Under review (read-only status) ─── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 8, height: 34, padding: '0 14px',
          borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)',
          fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)',
        }}>
          Under review
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-primary)' }}>{counts.review}</span>
        </span>
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
      </>)}

      {/* ─── Content: deck hierarchy · list · board · review ─── */}
      {/* Only admin and the unnamed "tracker" roles reach this component now.
          CMO, CFO, EMEA and Corporate land on /cycles; marketers and alignment
          reviewers get RoleLOAList at /loas. Their branches used to live here
          behind `folderOpen` / `nlCycle` state — that state is what made Back
          unwind straight to the auth page, so it is gone and each of those
          screens is a real route. */}
      {scope === 'past' ? (
        pastCycleId ? (
          <TrackerReviewView
            cycleId={pastCycleId}
            cycleName={pastCycles.find(c => c.id === pastCycleId)?.name || 'Past cycle'}
            onBack={() => changePastCycle('')}
            backLabel="Past cycles"
          />
        ) : (
          <PastCyclesGrid onOpen={(c) => changePastCycle(c.id)} />
        )
      ) : view === 'review' ? (
        <TrackerReviewView
          cycleId={activeCycle?.id || null}
          cycleName={activeCycle?.name || 'Review'}
        />
      ) : view === 'excel' ? (
        <CFOSpreadsheet
          loas={cycleLoas}
          cycleId={activeCycle?.id || null}
          cycleName={activeCycle?.name || 'Review'}
        />
      ) : view === 'alignment' ? (
        <SplitScreenReview
          cycleId={activeCycle?.id || null}
          roleCode={_roleCode}
          userEmail={_userEmail}
          userName={getStoredUser()?.full_name || undefined}
          isAdmin={isAdmin}
        />
      ) : !loading && filtered.length === 0 ? (
        <EmptyState hasFilters={activeFilters > 0} onClear={clearAll} scope={scope} />
      ) : view === 'deck' ? (
        <DeckView
          loas={filtered}
          flaggedIds={flaggedIds}
          visitedIds={visitedIds}
          markVisited={markVisited}
          summaryByLoa={summaryByLoa}
          flaggedCount={counts.needsAttn}
          flaggedBudget={flaggedBudget}
          totalCount={filtered.length}
          onPresentFlagged={() => { setNeedsAttention(true); setPage(1); }}
          role={role}
        />
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
  const title = (loa as any).display_title || loa.detail || loa.description || loa.activity_type || '—';
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
        // Emergency rows get a danger rail; others reserve the space (no reflow).
        borderLeft: loa.is_emergency ? '3px solid var(--danger)' : '3px solid transparent',
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
          {loa.is_emergency && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', padding: '2px 7px', borderRadius: 5,
              background: 'var(--danger-soft)', color: 'var(--danger)', border: '1px solid var(--danger-border)',
              fontSize: 9.5, fontWeight: 700, letterSpacing: '.06em', fontFamily: 'var(--font-sans)',
            }}>EMERGENCY</span>
          )}
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
  view: View;
  setView: (v: View) => void;
}) {
  const seg = (active: boolean): React.CSSProperties => ({
    background: active ? 'var(--surface)' : 'transparent',
    color: active ? 'var(--text-primary)' : 'var(--text-tertiary)',
    borderRadius: 6, padding: '4px 12px',
    fontSize: 12, fontWeight: active ? 600 : 500,
    boxShadow: active ? 'var(--shadow-sm)' : 'none',
  });
  return (
    <div style={{
      display: 'inline-flex',
      background: 'var(--surface-sunken)',
      borderRadius: 8, padding: 3,
    }}>
      {(['list', 'board', 'deck', 'excel', 'review'] as const).map(v => (
        <button key={v} className="la-seg" onClick={() => setView(v)} style={seg(view === v)}>
          {v === 'list' ? '☰ List' : v === 'board' ? '▦ Board' : v === 'deck' ? '❖ Deck' : v === 'excel' ? '▥ Excel' : '▷ Review'}
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

function EmptyState({ hasFilters, onClear, scope }: { hasFilters: boolean; onClear: () => void; scope: string }) {
  const title = hasFilters ? 'No LOAs match these filters'
    : scope === 'past' ? 'Pick a past cycle'
    : scope === 'emergency' ? 'No emergency LOAs'
    : scope === 'archive' ? 'Nothing archived'
    : 'No active LOAs here';
  const body = hasFilters ? 'Try broadening your search or clearing some filters.'
    : scope === 'past' ? 'Choose a closed cycle from the dropdown above to review its LOAs.'
    : scope === 'emergency' ? 'Nothing has been submitted through an emergency window.'
    : scope === 'archive' ? 'Archived LOAs will appear here.'
    : 'Imported / historical LOAs live in Past Campaigns — the tracker only shows active LOAs. Start one with “+ New LOA”.';
  return (
    <div className="la-card" style={{ padding: '64px 24px', textAlign: 'center' }}>
      <div style={{
        fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 600,
        color: 'var(--text-primary)', marginBottom: 8,
      }}>{title}</div>
      <p style={{ margin: '0 auto', maxWidth: 460, fontSize: 13.5, color: 'var(--text-tertiary)', lineHeight: 1.55 }}>{body}</p>
      <div style={{ marginTop: 18, display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
        {hasFilters && <Btn variant="secondary" small onClick={onClear}>Clear all filters</Btn>}
        {!hasFilters && scope === 'current' && (
          <Link href="/past-campaigns" className="la-link" style={{ fontSize: 12.5 }}>Browse Past Campaigns →</Link>
        )}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════
// Deck view (design 2a) — the cycle as a deck hierarchy on live LOAs
// ═════════════════════════════════════════════════════════════════════

type DeckAct = { name: string; loas: LOA[]; amount: number; flagged: number; clusters: number };
type DeckCat = { name: string; loas: LOA[]; amount: number; flagged: number; clusters: number; activities: DeckAct[] };

function buildDeckTree(loas: LOA[], flaggedIds: Set<string>): DeckCat[] {
  const sum = (ls: LOA[]) => ls.reduce((s, l) => s + (l.fy_2026_total || 0), 0);
  const flags = (ls: LOA[]) => ls.filter(l => flaggedIds.has(l.id)).length;
  const clus = (ls: LOA[]) => new Set(ls.map(l => l.cluster).filter(Boolean)).size;

  const catMap = new Map<string, LOA[]>();
  loas.forEach(l => {
    const cat = (formatCategory(l.category) || '').trim() || 'Uncategorised';
    if (!catMap.has(cat)) catMap.set(cat, []);
    catMap.get(cat)!.push(l);
  });

  const cats: DeckCat[] = Array.from(catMap.entries()).map(([cat, ls]) => {
    const actMap = new Map<string, LOA[]>();
    ls.forEach(l => {
      const a = (l.activity_type || '').trim() || 'Other activity';
      if (!actMap.has(a)) actMap.set(a, []);
      actMap.get(a)!.push(l);
    });
    const activities: DeckAct[] = Array.from(actMap.entries())
      .map(([name, als]) => ({ name, loas: als, amount: sum(als), flagged: flags(als), clusters: clus(als) }))
      .sort((a, b) => b.amount - a.amount);
    return { name: cat, loas: ls, amount: sum(ls), flagged: flags(ls), clusters: clus(ls), activities };
  });
  return cats.sort((a, b) => b.amount - a.amount);
}

const DECK_GRID = 'minmax(0,1fr) 96px 60px 120px 68px 128px';

function DeckView({
  loas, flaggedIds, visitedIds, markVisited, summaryByLoa,
  flaggedCount, flaggedBudget, totalCount, onPresentFlagged, role,
}: {
  loas: LOA[];
  flaggedIds: Set<string>;
  visitedIds: Set<string>;
  markVisited: (id: string) => void;
  summaryByLoa: Map<string, LoaCommentSummary>;
  flaggedCount: number;
  flaggedBudget: number;
  totalCount: number;
  onPresentFlagged: () => void;
  role: any;
}) {
  const router = useRouter();
  const tree = useMemo(() => buildDeckTree(loas, flaggedIds), [loas, flaggedIds]);
  const [closedCats, setClosedCats] = useState<Set<string>>(new Set());
  const [openActs, setOpenActs] = useState<Set<string>>(new Set());

  const allActKeys = useMemo(
    () => tree.flatMap(c => c.activities.map(a => `${c.name}›${a.name}`)),
    [tree],
  );
  const fullyOpen = closedCats.size === 0 && allActKeys.length > 0 && allActKeys.every(k => openActs.has(k));
  const expandAll = () => { setClosedCats(new Set()); setOpenActs(new Set(allActKeys)); };
  const collapseAll = () => { setClosedCats(new Set(tree.map(c => c.name))); setOpenActs(new Set()); };

  const toggleCat = (name: string) => setClosedCats(prev => {
    const next = new Set(prev); next.has(name) ? next.delete(name) : next.add(name); return next;
  });
  const toggleAct = (key: string) => setOpenActs(prev => {
    const next = new Set(prev); next.has(key) ? next.delete(key) : next.add(key); return next;
  });

  const cell = (v: React.ReactNode, align: 'left' | 'right' | 'center' = 'left', mono = false): React.CSSProperties => ({
    textAlign: align,
    fontFamily: mono ? 'var(--font-mono)' : undefined,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  });

  const flagCell = (n: number) => n > 0 ? (
    <span style={{
      fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
      color: 'var(--st-rework-fg, #B08D2F)',
    }}>⚑ {n}</span>
  ) : <span style={{ color: 'var(--text-tertiary)' }}>—</span>;

  const reconciled = Math.max(0, totalCount - flaggedCount);
  const scopeNote = role?.role_scope_type === 'all' || !role?.role_scope_type
    ? 'You see every cluster and function.'
    : role?.role_scope_type === 'cluster'
      ? `You see ${(role?.role_scope_value || []).join(', ') || 'your cluster'}.`
      : role?.role_scope_type === 'brand'
        ? `Scoped to brands: ${(role?.role_scope_value || []).join(', ')}.`
        : role?.role_scope_type === 'function'
          ? `Scoped to functions: ${(role?.role_scope_value || []).join(', ')}.`
          : 'You see the slides you author or review.';

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 316px', gap: 16, alignItems: 'start' }}>
      {/* ── deck hierarchy card ── */}
      <div className="la-card" style={{ overflow: 'hidden', padding: 0, minWidth: 0 }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 16px', borderBottom: '1px solid var(--border)',
        }}>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 600, color: 'var(--text-primary)' }}>
              Deck hierarchy
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 1 }}>
              {totalCount} LOAs · grouped by category → activity
            </div>
          </div>
          <button className="la-link" style={{ fontSize: 12 }} onClick={fullyOpen ? collapseAll : expandAll}>
            {fullyOpen ? 'Collapse all' : 'Expand all'}
          </button>
        </div>

        {/* column header */}
        <div className="la-thead" style={{ display: 'grid', gridTemplateColumns: DECK_GRID, gap: 12 }}>
          <span>Section</span>
          <span>Cluster</span>
          <span style={{ textAlign: 'right' }}>LOAs</span>
          <span style={{ textAlign: 'right' }}>FY26</span>
          <span style={{ textAlign: 'center' }}>Flags</span>
          <span>Status</span>
        </div>

        {tree.map(cat => {
          const catOpen = !closedCats.has(cat.name);
          return (
            <div key={cat.name}>
              {/* category row */}
              <button
                onClick={() => toggleCat(cat.name)}
                style={{
                  width: '100%', display: 'grid', gridTemplateColumns: DECK_GRID, gap: 12,
                  alignItems: 'center', textAlign: 'left', border: 'none', cursor: 'pointer',
                  padding: '11px 16px', background: 'var(--surface-sunken)',
                  borderTop: '1px solid var(--border)', fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, letterSpacing: '.02em', textTransform: 'uppercase' }}>
                  <span style={{ fontSize: 9, color: 'var(--text-tertiary)', width: 10 }}>{catOpen ? '▾' : '▸'}</span>
                  <span style={cell(cat.name)}>{cat.name}</span>
                </span>
                <span style={{ ...cell(null), fontWeight: 500, color: 'var(--text-tertiary)', fontSize: 11.5 }}>{cat.clusters} cl.</span>
                <span style={cell(null, 'right', true)}>{cat.loas.length}</span>
                <span style={cell(null, 'right', true)}>{formatEuros(cat.amount)}</span>
                <span style={{ textAlign: 'center' }}>{flagCell(cat.flagged)}</span>
                <span />
              </button>

              {catOpen && cat.activities.map(act => {
                const key = `${cat.name}›${act.name}`;
                const actOpen = openActs.has(key);
                return (
                  <div key={key}>
                    {/* activity row */}
                    <button
                      onClick={() => toggleAct(key)}
                      style={{
                        width: '100%', display: 'grid', gridTemplateColumns: DECK_GRID, gap: 12,
                        alignItems: 'center', textAlign: 'left', border: 'none', cursor: 'pointer',
                        padding: '9px 16px', background: 'var(--surface)',
                        borderTop: '1px solid var(--border)', fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)',
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, paddingLeft: 18 }}>
                        <span style={{ fontSize: 9, color: 'var(--text-tertiary)', width: 10 }}>{actOpen ? '▾' : '▸'}</span>
                        <span style={cell(act.name)}>{act.name}</span>
                      </span>
                      <span style={{ ...cell(null), fontWeight: 500, color: 'var(--text-tertiary)', fontSize: 11.5 }}>{act.clusters} cl.</span>
                      <span style={cell(null, 'right', true)}>{act.loas.length}</span>
                      <span style={cell(null, 'right', true)}>{formatEuros(act.amount)}</span>
                      <span style={{ textAlign: 'center' }}>{flagCell(act.flagged)}</span>
                      <span />
                    </button>

                    {actOpen && act.loas.map(l => {
                      const title = (l as any).display_title || l.detail || l.description || l.activity_type || l.loa_number || '—';
                      const unresolved = summaryByLoa.get(l.id)?.total_unresolved || 0;
                      return (
                        <button
                          key={l.id}
                          onClick={() => { markVisited(l.id); router.push(`/loa/${l.id}`); }}
                          className="la-deckrow"
                          style={{
                            width: '100%', display: 'grid', gridTemplateColumns: DECK_GRID, gap: 12,
                            alignItems: 'center', textAlign: 'left', border: 'none', cursor: 'pointer',
                            padding: '9px 16px', background: 'var(--surface)',
                            borderTop: '1px solid var(--border)', fontSize: 12.5, color: 'var(--text-primary)',
                          }}
                        >
                          <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, paddingLeft: 40 }}>
                            {!visitedIds.has(l.id) && <span style={{ width: 5, height: 5, borderRadius: 999, background: 'var(--gold)', flex: 'none' }} />}
                            <span style={cell(title)}>{title}</span>
                            {unresolved > 0 && <span style={{ fontSize: 11, color: 'var(--text-tertiary)', flex: 'none' }}>💬 {unresolved}</span>}
                          </span>
                          <span style={{ ...cell(null), color: 'var(--text-tertiary)', fontSize: 11.5 }}>{l.cluster || '—'}</span>
                          <span style={{ ...cell(null, 'right', true), color: 'var(--text-tertiary)' }}>1</span>
                          <span style={cell(null, 'right', true)}>{formatEuros(l.fy_2026_total || 0)}</span>
                          <span style={{ textAlign: 'center' }}>{flaggedIds.has(l.id) ? <span style={{ color: 'var(--st-rework-fg, #B08D2F)' }}>⚑</span> : <span style={{ color: 'var(--text-tertiary)' }}>·</span>}</span>
                          <span style={{ overflow: 'hidden' }}><Pill status={l.status} /></span>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          );
        })}

        {/* footer totals */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px', borderTop: '1px solid var(--border)', background: 'var(--surface-sunken)',
          fontSize: 12, color: 'var(--text-secondary)',
        }}>
          <span>{tree.length} categories · {totalCount} LOAs</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-primary)' }}>
            {formatEuros(tree.reduce((s, c) => s + c.amount, 0))}
          </span>
        </div>
      </div>

      {/* ── right rail ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, position: 'sticky', top: 72 }}>
        <div className="la-card" style={{ padding: 16 }}>
          <Overline>Laura&rsquo;s read</Overline>
          <p style={{ margin: '10px 0 0', fontSize: 13, lineHeight: 1.5, color: 'var(--text-secondary)' }}>
            {flaggedCount > 0 ? (
              <>
                <strong style={{ color: 'var(--text-primary)' }}>{flaggedCount} LOAs</strong> need the room —{' '}
                <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{formatEuros(flaggedBudget)}</strong>.
                The other <strong style={{ color: 'var(--text-primary)' }}>{reconciled}</strong> reconcile and can move as one block.
              </>
            ) : (
              <>Nothing flagged. All <strong style={{ color: 'var(--text-primary)' }}>{totalCount}</strong> reconcile against plan — you can move the cycle as one block.</>
            )}
          </p>
          {flaggedCount > 0 && (
            <div style={{ marginTop: 14 }}>
              <Btn variant="primary" small onClick={onPresentFlagged}>Present flagged first</Btn>
            </div>
          )}
        </div>

        <div className="la-card" style={{ padding: 16 }}>
          <Overline>Reconciliation</Overline>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 10 }}>
            {[
              'Family totals = sum of their LOAs',
              'Category totals = sum of families',
              'Cycle total = sum of categories',
            ].map((t, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, fontSize: 12.5, color: 'var(--text-secondary)' }}>
                <span style={{ color: 'var(--gold)', flex: 'none' }}>✓</span>
                <span>{t}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="la-card" style={{ padding: 16 }}>
          <Overline>Who sees what</Overline>
          <p style={{ margin: '10px 0 0', fontSize: 12.5, lineHeight: 1.5, color: 'var(--text-secondary)' }}>
            {scopeNote} Reviewers act on the slides in their scope; the deck totals always reflect the full cycle.
          </p>
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════
// Excel view (design 2c) — the cycle as one spreadsheet, on live LOAs.
// This is the CFO's validation surface: no separate page, just a view.
// ═════════════════════════════════════════════════════════════════════

function ExcelView({ loas, flaggedIds, totalBudget, totalCount, markVisited }: {
  loas: LOA[];
  flaggedIds: Set<string>;
  totalBudget: number;
  totalCount: number;
  markVisited: (id: string) => void;
}) {
  const cats = useMemo(() => buildDeckTree(loas, flaggedIds), [loas, flaggedIds]);
  const [selectedLoaId, setSelectedLoaId] = useState<string | null>(null);
  const q = (l: LOA, k: string) => Number((l as any)[k] || 0);
  const num = (v: number) => (v ? Math.round(v).toLocaleString('fr-FR') : '—');
  const top = [...cats].sort((a, b) => b.amount - a.amount).slice(0, 2);

  // Column sums for the money quarter / FY total columns (session footer).
  const SUM_FIELDS = ['q4_2025', 'q1_2026', 'q2_2026', 'q3_2026', 'q4_2026', 'fy_2026_total'];
  const colSums: Record<string, number> = {};
  SUM_FIELDS.forEach(f => { colSums[f] = loas.reduce((s, l) => s + q(l, f), 0); });

  const totalCols = EXCEL_COLUMNS.length + 1; // + sticky Review column
  const isNumericFmt = (fmt: string) => fmt === 'money' || fmt === 'int' || fmt === 'percent';

  const thStyle: React.CSSProperties = { padding: '9px 10px', textAlign: 'left', font: '700 9.5px var(--font-sans)', letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--text-tertiary)', background: 'var(--surface-sunken)', borderBottom: '1px solid var(--border-strong)', whiteSpace: 'nowrap' };
  const tdStyle: React.CSSProperties = { padding: '7px 10px', font: '400 11.5px var(--font-sans)', borderTop: '1px solid var(--border)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };

  return (
    <>
    <div className="la-card" style={{ overflow: 'hidden', padding: 0 }}>
      {/* meta strip */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface-sunken)' }}>
        <span style={{ font: '600 12.5px var(--font-sans)', color: 'var(--text-primary)' }}>Cycle spreadsheet</span>
        <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>All LOA columns · grouped by category · the CFO validation view</span>
        <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--text-secondary)' }}>{totalCount} LOAs · {formatEuros(totalBudget)}</span>
      </div>

      {/* scrollable full-column spreadsheet — every field from the LOA form */}
      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <table style={{ borderCollapse: 'separate', borderSpacing: 0, width: '100%' }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, position: 'sticky', left: 0, zIndex: 3, minWidth: 96, boxShadow: '2px 0 4px -2px rgba(0,0,0,0.12)' }}>Review</th>
              {EXCEL_COLUMNS.map(c => (
                <th key={c.header} style={{ ...thStyle, minWidth: columnWidth(c.header), textAlign: isNumericFmt(c.fmt) ? 'right' : 'left' }}>{c.header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cats.map(cat => {
              const rows = newestFirst(cat.loas);
              return (
                <Fragment key={cat.name}>
                  {/* category group divider */}
                  <tr>
                    <td colSpan={totalCols} style={{ padding: '8px 12px', background: 'var(--surface-sunken)', borderTop: '1px solid var(--border)', font: '700 11.5px var(--font-sans)', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '.02em', position: 'sticky', left: 0 }}>
                      {cat.name} <span style={{ color: 'var(--text-tertiary)', fontWeight: 500 }}>· {cat.loas.length} · {formatEuros(cat.amount)}</span>
                    </td>
                  </tr>
                  {rows.map(l => (
                    <tr
                      key={l.id}
                      className="la-deckrow"
                      onClick={() => { markVisited(l.id); setSelectedLoaId(l.id); }}
                      style={{ cursor: 'pointer', background: 'var(--surface)' }}
                    >
                      <td style={{ ...tdStyle, position: 'sticky', left: 0, zIndex: 1, background: 'var(--surface)', boxShadow: '2px 0 4px -2px rgba(0,0,0,0.12)', textAlign: 'center', padding: '6px 8px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 6, border: '1px solid var(--gold)', color: 'var(--gold)', fontSize: 10.5, fontWeight: 700, whiteSpace: 'nowrap' }}>
                          {flaggedIds.has(l.id) ? '⚑' : '💬'} Review
                        </span>
                      </td>
                      {EXCEL_COLUMNS.map(c => {
                        const numeric = isNumericFmt(c.fmt);
                        const isFY = c.field === 'fy_2026_total';
                        return (
                          <td
                            key={c.header}
                            title={String((l as any)[c.field] ?? '')}
                            style={{
                              ...tdStyle,
                              maxWidth: columnWidth(c.header),
                              textAlign: numeric ? 'right' : 'left',
                              fontFamily: numeric ? 'var(--font-mono)' : undefined,
                              fontWeight: isFY ? 600 : 400,
                              color: c.backendOnly ? 'var(--text-tertiary)' : isFY ? 'var(--text-primary)' : 'var(--text-secondary)',
                            }}
                          >
                            {formatCell((l as any)[c.field], c.fmt)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </Fragment>
              );
            })}

            {/* session total */}
            <tr style={{ background: 'var(--ink)' }}>
              <td style={{ position: 'sticky', left: 0, zIndex: 1, background: 'var(--ink)', padding: '10px', font: '600 11px var(--font-sans)', color: 'var(--ink-text)', whiteSpace: 'nowrap' }}>Session total</td>
              {EXCEL_COLUMNS.map(c => (
                <td key={c.header} style={{ padding: '10px', font: '600 11px var(--font-mono)', textAlign: 'right', whiteSpace: 'nowrap', color: c.field === 'fy_2026_total' ? 'var(--gold)' : 'var(--ink-text)' }}>
                  {colSums[c.field] != null ? num(colSums[c.field]) : ''}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {/* summary dock */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 24, alignItems: 'center', padding: '16px 22px', background: 'var(--ink)', borderTop: '2px solid rgba(176,141,47,.5)', color: 'var(--ink-text)' }}>
        <div>
          <div style={{ font: '600 10px var(--font-sans)', letterSpacing: '.1em', textTransform: 'uppercase', opacity: 0.55 }}>Total cycle budget</div>
          <div style={{ font: '600 26px var(--font-sans)', marginTop: 3 }}>{formatEuros(totalBudget)}</div>
          <div style={{ fontSize: 12, opacity: 0.55 }}>{totalCount} LOAs</div>
        </div>
        {top.map(cat => {
          const pct = totalBudget > 0 ? Math.round((cat.amount / totalBudget) * 100) : 0;
          return (
            <div key={cat.name}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1, height: 9, borderRadius: 5, background: 'rgba(244,241,234,.14)' }}><div style={{ width: `${pct}%`, height: '100%', borderRadius: 5, background: 'var(--gold)' }} /></div>
                <span style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{cat.name} {pct}%</span>
              </div>
              <div style={{ fontSize: 11, opacity: 0.45, marginTop: 5 }}>{formatEuros(cat.amount)}</div>
            </div>
          );
        })}
      </div>
    </div>

    {selectedLoaId !== null && (
      <LoaReviewDrawer loaId={selectedLoaId} onClose={() => setSelectedLoaId(null)} />
    )}
    </>
  );
}

// ─── LoaReviewDrawer ──────────────────────────────────────────────────────────
// Right-side drawer that opens from the Excel view when a row is clicked.
// Reuses the same comment + approval APIs as the individual LOA detail page —
// no logic is duplicated.

function LoaReviewDrawer({ loaId, onClose }: { loaId: string; onClose: () => void }) {
  const [loa, setLoa] = useState<LOA | null>(null);
  const [perms, setPerms] = useState<any>(null);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [tab, setTab] = useState<'open' | 'resolved'>('open');
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);
  const [busy, setBusy] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [approving, setApproving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const myEmail = (getStoredUser()?.email || '').toLowerCase();

  const fetchAll = useCallback(async () => {
    setBusy(true);
    try {
      const [loaData, permsData, commentsData] = await Promise.all([
        getLOA(loaId),
        getMyPermissionsOnLOA(loaId).catch(() => null),
        listComments(loaId).catch(() => [] as CommentItem[]),
      ]);
      setLoa(loaData);
      setPerms(permsData);
      const list = Array.isArray(commentsData) ? commentsData : ((commentsData as any)?.comments ?? []);
      setComments(list);
    } catch { /* silently keep existing state */ }
    finally { setBusy(false); }
  }, [loaId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const open = comments.filter(c => !c.resolved);
  const resolved = comments.filter(c => c.resolved);

  // Reviewer must comment before they can approve.
  const hasMyComment = comments.some(c => (c.author_email || '').toLowerCase() === myEmail);
  const status = loa?.status || '';
  const isTerminal = status === 'approved' || status === 'rejected';
  const canValidate = !!perms?.can_validate;
  const canAct = canValidate && !isTerminal && status !== 'draft';

  async function submitComment() {
    if (!draft.trim()) return;
    setPosting(true);
    try {
      await createComment(loaId, 'general', draft.trim());
      setDraft('');
      fetchAll();
    } finally { setPosting(false); }
  }

  async function handleResolve(commentId: string) {
    try { await api.patch(`/comments/${commentId}/resolve`); fetchAll(); } catch {}
  }

  // Reuses the workflow's canonical approve endpoint (same as ApprovalPanel).
  async function confirmApprove() {
    setApproving(true); setActionError(null);
    try {
      await api.post(`/loa/${loaId}/approve`);
      setConfirmOpen(false);
      await fetchAll();
    } catch (e: any) {
      setActionError(e?.response?.data?.detail || e?.message || 'Approve failed');
    } finally { setApproving(false); }
  }

  const title = loa
    ? ((loa as any).display_title || loa.detail || loa.description || loa.activity_type || '—')
    : '…';

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 350, display: 'flex', justifyContent: 'flex-end' }}>
      {/* backdrop — click to close */}
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.22)' }} />

      {/* drawer panel */}
      <div style={{
        position: 'relative', zIndex: 1,
        width: 420, maxWidth: '92vw', height: '100%',
        background: 'var(--surface)', borderLeft: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column',
        boxShadow: '-6px 0 32px rgba(0,0,0,0.12)',
      }}>
        {/* ── header ── */}
        <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--border)', background: 'var(--surface-sunken)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              {busy && !loa ? (
                <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Loading…</div>
              ) : loa ? (
                <>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {[loa.country, loa.brand, loa.loa_number || loa.loa_draft_id].filter(Boolean).join(' · ')}
                  </div>
                  <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <Pill status={loa.status} />
                    <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', fontWeight: 600 }}>{formatEuros(loa.fy_2026_total || 0)}</span>
                    <a href={`/loa/${loa.id}`} style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--gold)', textDecoration: 'none', fontWeight: 600 }}>View full detail →</a>
                  </div>
                </>
              ) : null}
            </div>
            <button onClick={onClose} title="Close (Esc)"
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--text-tertiary)', lineHeight: 1, padding: '0 2px', flexShrink: 0 }}>×</button>
          </div>
        </div>

        {/* ── comments rail ── */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ display: 'flex', gap: 14, padding: '10px 18px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            {(['open', 'resolved'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, paddingBottom: 5, fontFamily: 'var(--font-sans)', color: tab === t ? 'var(--text-primary)' : 'var(--text-tertiary)', borderBottom: tab === t ? '2px solid var(--gold)' : '2px solid transparent', fontWeight: tab === t ? 600 : 400 }}>
                {t === 'open' ? `Open (${open.length})` : `Resolved (${resolved.length})`}
              </button>
            ))}
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 18px' }}>
            {busy && comments.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center', padding: '24px 0' }}>Loading comments…</div>
            ) : (tab === 'open' ? open : resolved).length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center', padding: '24px 0' }}>
                {tab === 'open' ? 'No open comments' : 'Nothing resolved yet'}
              </div>
            ) : (
              (tab === 'open' ? open : resolved).map((c, i) => (
                <div key={c.id} style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5, flexWrap: 'wrap' }}>
                    {tab === 'open' && (
                      <span style={{ width: 18, height: 18, borderRadius: '50%', background: 'var(--gold)', color: '#fff', fontSize: 9.5, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontFamily: 'var(--font-mono)' }}>{i + 1}</span>
                    )}
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{c.author_name}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>· {c.author_role}</span>
                    {c.field_key && (
                      <span style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: 0.3, background: 'var(--surface-sunken)', color: 'var(--text-tertiary)', padding: '1px 6px', borderRadius: 4 }}>{c.field_key.replace(/_/g, ' ')}</span>
                    )}
                    <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
                      {new Date(c.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{c.content}</div>
                  {tab === 'open' && perms?.can_validate && (
                    <button onClick={() => handleResolve(c.id)}
                      style={{ marginTop: 6, background: 'none', border: 'none', color: 'var(--gold)', fontSize: 11, cursor: 'pointer', padding: 0, fontFamily: 'var(--font-sans)' }}>
                      Mark resolved
                    </button>
                  )}
                </div>
              ))
            )}
          </div>

          {/* ── comment composer ── */}
          {perms?.can_comment && (
            <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border)', background: 'var(--surface-sunken)', flexShrink: 0 }}>
              <textarea
                value={draft} onChange={e => setDraft(e.target.value)}
                placeholder="Add a comment…" rows={2}
                style={{ width: '100%', background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 8, padding: '8px 10px', fontSize: 12.5, color: 'var(--text-primary)', resize: 'none', fontFamily: 'var(--font-sans)', boxSizing: 'border-box' }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
                <Btn variant="primary" small onClick={submitComment} disabled={posting || !draft.trim()}>
                  {posting ? 'Posting…' : 'Comment'}
                </Btn>
              </div>
            </div>
          )}
        </div>

        {/* ── approval action — POST /loa/{id}/approve (the workflow endpoint) ── */}
        {loa && (
          <div style={{ padding: '14px 18px', borderTop: '2px solid var(--border-strong)', background: 'var(--surface)', flexShrink: 0 }}>
            {isTerminal ? (
              <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>
                This LOA is <strong style={{ color: 'var(--text-secondary)' }}>{status}</strong> — no further action.
              </div>
            ) : !canAct ? (
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
                You can&rsquo;t approve at this step.
              </div>
            ) : (
              <>
                <Btn variant="primary" onClick={() => { setActionError(null); setConfirmOpen(true); }} disabled={!hasMyComment || approving}>
                  Approve this LOA
                </Btn>
                {!hasMyComment && (
                  <div style={{ marginTop: 8, fontSize: 11.5, color: 'var(--st-rework-fg, #B08D2F)' }}>
                    Add a comment before approving.
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* confirmation — "are you sure you want to submit your comments?" */}
      {confirmOpen && (
        <div
          onClick={() => { if (!approving) setConfirmOpen(false); }}
          style={{ position: 'absolute', inset: 0, zIndex: 5, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
        >
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 14, padding: '26px 30px', maxWidth: 420, width: '100%', boxShadow: 'var(--shadow-lg)' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>Submit your review?</div>
            <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.55, marginBottom: 6 }}>
              Are you sure you want to submit your work?
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-tertiary)', lineHeight: 1.55 }}>
              This marks your review of <strong style={{ color: 'var(--text-secondary)' }}>{title}</strong> complete. It moves forward only once every required reviewer at this stage has submitted.
            </div>
            {actionError && (
              <div style={{ marginTop: 12, padding: '8px 10px', background: 'var(--st-rejected-bg)', color: 'var(--st-rejected-fg)', borderRadius: 8, fontSize: 12 }}>{actionError}</div>
            )}
            <div style={{ marginTop: 22, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <Btn variant="secondary" small onClick={() => setConfirmOpen(false)} disabled={approving}>Cancel</Btn>
              <Btn variant="primary" small onClick={confirmApprove} disabled={approving}>
                {approving ? 'Submitting…' : 'Confirm & Submit'}
              </Btn>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}
