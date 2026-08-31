'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import type { LOA } from '@/types/loa';
import type { ReviewVerdict, ReviewComment } from '@/types/review';
import { primaryCategory } from '@/types/review';
import { fetchVerdicts, fetchComments, submitVerdict, postComment, submitReview } from '@/lib/review-api';
import { parseEuroInput } from '@/lib/euro';
import LOALinesGrid from './LOALinesGrid';
import SummaryPivot from './SummaryPivot';
import RejectReasonModal from './RejectReasonModal';
import CommentPopover from './CommentPopover';
import SubmitReviewModal from './SubmitReviewModal';

const CATEGORY_ORDER = ['Frames', 'Lenses', 'Wearables', 'Audio', 'Instruments', 'All cat.'];
function catRank(c: string) { const i = CATEGORY_ORDER.indexOf(c); return i === -1 ? 999 : i; }

type SheetTab = 'lines' | 'summary';
type StatusFilter = 'all' | 'unreviewed' | 'approved' | 'rejected';

type RejectTarget =
  | { type: 'single'; loa: LOA }
  | { type: 'bulk'; loas: LOA[]; groupLabel: string };

// ── Palette ────────────────────────────────────────────────────────────────
const C = {
  gridLine:  '#D9D5CD',
  headerBg:  '#F4F3F0',
  gold:      '#B08D2F',
  goldLight: '#FBF7ED',
  goldBorder:'#E8D9B8',
  approved:  '#1A7348',
  rejected:  '#8A2E27',
  ink:       '#1a1a1a',
};

// ── Top bar (breadcrumb + cycle name + role badge) ──────────────────────────
function CFOTopBar({ cycleName, onBack }: { cycleName: string; onBack?: () => void }) {
  return (
    <div style={{
      height: 48,
      display: 'flex',
      alignItems: 'center',
      padding: '0 16px',
      gap: 12,
      borderBottom: `1px solid ${C.gridLine}`,
      background: '#fff',
      flexShrink: 0,
    }}>
      {onBack ? (
        <button onClick={onBack} style={{ fontSize: 13, color: '#888', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 5, lineHeight: 1, fontFamily: 'inherit' }}>
          ← Review cycles
        </button>
      ) : (
        <Link href="/" style={{ fontSize: 13, color: '#888', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5, lineHeight: 1 }}>
          ← Tracker
        </Link>
      )}
      <div style={{ width: 1, height: 18, background: C.gridLine }} />
      <span style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>{cycleName}</span>
      <span style={{ padding: '2px 10px', borderRadius: 12, background: '#EEF4FF', color: '#1D4ED8', fontSize: 11, fontWeight: 700, letterSpacing: '0.04em' }}>
        CFO REVIEW
      </span>
    </div>
  );
}

// ── Progress bar ────────────────────────────────────────────────────────────
function ProgressBar({ reviewed, total }: { reviewed: number; total: number }) {
  const pct = total > 0 ? Math.round((reviewed / total) * 100) : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
      <div style={{ width: 140, height: 6, borderRadius: 3, background: '#E8E6E0', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', borderRadius: 3, background: pct === 100 ? C.approved : C.gold, transition: 'width 300ms' }} />
      </div>
      <span style={{ fontSize: 12, color: '#666', whiteSpace: 'nowrap' }}>
        <strong style={{ color: C.ink, fontVariantNumeric: 'tabular-nums' }}>{reviewed}</strong>
        {' / '}
        <strong style={{ color: C.ink, fontVariantNumeric: 'tabular-nums' }}>{total}</strong>
        {' reviewed'}
      </span>
    </div>
  );
}

// ── Sheet tabs ──────────────────────────────────────────────────────────────
function SheetTabsBar({ activeTab, onTabChange }: { activeTab: SheetTab; onTabChange: (t: SheetTab) => void }) {
  const tabs: { key: SheetTab; label: string }[] = [
    { key: 'lines', label: 'LOA Lines' },
    { key: 'summary', label: 'Summary' },
  ];
  return (
    <div style={{ display: 'flex', gap: 0, borderTop: `2px solid ${C.gridLine}`, background: C.headerBg, flexShrink: 0 }}>
      {tabs.map(tab => (
        <button
          key={tab.key}
          onClick={() => onTabChange(tab.key)}
          style={{
            height: 34,
            padding: '0 20px',
            border: 'none',
            borderRight: `1px solid ${C.gridLine}`,
            borderTop: activeTab === tab.key ? `2px solid ${C.gold}` : '2px solid transparent',
            background: activeTab === tab.key ? '#fff' : 'transparent',
            color: activeTab === tab.key ? C.ink : '#888',
            fontSize: 12.5,
            fontWeight: activeTab === tab.key ? 700 : 400,
            cursor: 'pointer',
            transition: 'all 120ms',
            letterSpacing: '0.01em',
            marginTop: -2,
          }}
        >
          {tab.label}
        </button>
      ))}
      <div style={{ flex: 1 }} />
    </div>
  );
}

// ── CFO Toolbar ─────────────────────────────────────────────────────────────
interface ToolbarProps {
  reviewed: number;
  total: number;
  filteredCount: number;
  allReviewed: boolean;
  isSubmitted: boolean;
  allExpanded: boolean;
  search: string;
  statusFilter: StatusFilter;
  quarterFilter: string;
  regionFilter: string;
  brandFilter: string;
  activityFilter: string;
  opexFilter: string;
  budgetMin: string;
  budgetMax: string;
  loas: LOA[];
  onSearch: (v: string) => void;
  onStatusFilter: (v: StatusFilter) => void;
  onQuarterFilter: (v: string) => void;
  onRegionFilter: (v: string) => void;
  onBrandFilter: (v: string) => void;
  onActivityFilter: (v: string) => void;
  onOpexFilter: (v: string) => void;
  onBudgetMin: (v: string) => void;
  onBudgetMax: (v: string) => void;
  onToggleExpand: () => void;
  onSubmit: () => void;
}

function CFOToolbar({
  reviewed, total, filteredCount, allReviewed, isSubmitted,
  allExpanded, search, statusFilter, quarterFilter, regionFilter,
  brandFilter, activityFilter, opexFilter, budgetMin, budgetMax,
  loas, onSearch, onStatusFilter, onQuarterFilter, onRegionFilter,
  onBrandFilter, onActivityFilter, onOpexFilter, onBudgetMin, onBudgetMax,
  onToggleExpand, onSubmit,
}: ToolbarProps) {
  const brands    = useMemo(() => [...new Set(loas.map(l => l.brand).filter(Boolean))].sort(), [loas]);
  const regions   = useMemo(() => [...new Set(loas.map(l => l.cluster || l.country).filter(Boolean))].sort(), [loas]);
  const activities= useMemo(() => [...new Set(loas.map(l => l.activity_type).filter(Boolean))].sort(), [loas]);

  const selSx: React.CSSProperties = {
    height: 30,
    padding: '0 8px',
    borderRadius: 6,
    border: `1px solid ${C.gridLine}`,
    background: '#fff',
    fontSize: 12.5,
    color: C.ink,
    cursor: 'pointer',
    outline: 'none',
    fontFamily: 'inherit',
  };

  const inputSx: React.CSSProperties = {
    height: 30,
    padding: '0 10px',
    borderRadius: 6,
    border: `1px solid ${C.gridLine}`,
    background: '#fff',
    fontSize: 12.5,
    outline: 'none',
    fontFamily: 'inherit',
  };

  const isFiltered = !!(search || statusFilter !== 'all' || quarterFilter || regionFilter ||
    brandFilter || activityFilter || opexFilter || budgetMin || budgetMax);

  return (
    <div style={{ padding: '10px 12px', borderBottom: `1px solid ${C.gridLine}`, background: C.headerBg, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', flexShrink: 0 }}>
      {/* Progress */}
      <ProgressBar reviewed={reviewed} total={total} />

      <div style={{ width: 1, height: 24, background: C.gridLine, flexShrink: 0 }} />

      {/* Expand / collapse all */}
      <button
        onClick={onToggleExpand}
        style={{ height: 30, padding: '0 10px', borderRadius: 6, border: `1px solid ${C.gridLine}`, background: '#fff', fontSize: 12, cursor: 'pointer', color: '#555', whiteSpace: 'nowrap' }}
      >
        {allExpanded ? '⊟ Collapse all' : '⊞ Expand all'}
      </button>

      <div style={{ width: 1, height: 24, background: C.gridLine, flexShrink: 0 }} />

      {/* Search (also matches budget when input parses as a number) */}
      <input
        value={search}
        onChange={e => onSearch(e.target.value)}
        placeholder="Search SAP, brand, description, budget…"
        style={{ ...inputSx, width: 240 }}
        onFocus={e => { e.target.style.borderColor = C.gold; }}
        onBlur={e => { e.target.style.borderColor = C.gridLine; }}
      />

      {/* Status filter */}
      <select value={statusFilter} onChange={e => onStatusFilter(e.target.value as StatusFilter)} style={selSx}>
        <option value="all">All statuses</option>
        <option value="unreviewed">Unreviewed</option>
        <option value="approved">Approved</option>
        <option value="rejected">Rejected</option>
      </select>

      {/* Quarter filter */}
      <select value={quarterFilter} onChange={e => onQuarterFilter(e.target.value)} style={selSx}>
        <option value="">All quarters</option>
        <option value="Q1">Q1</option>
        <option value="Q2">Q2</option>
        <option value="Q3">Q3</option>
        <option value="Q4">Q4</option>
      </select>

      {/* Region / Cluster filter */}
      <select value={regionFilter} onChange={e => onRegionFilter(e.target.value)} style={selSx}>
        <option value="">All regions</option>
        {regions.map(r => <option key={r} value={r}>{r}</option>)}
      </select>

      {/* Brand filter */}
      <select value={brandFilter} onChange={e => onBrandFilter(e.target.value)} style={{ ...selSx, maxWidth: 160 }}>
        <option value="">All brands</option>
        {brands.map(b => <option key={b} value={b}>{b}</option>)}
      </select>

      {/* Activity filter */}
      <select value={activityFilter} onChange={e => onActivityFilter(e.target.value)} style={{ ...selSx, maxWidth: 160 }}>
        <option value="">All activities</option>
        {activities.map(a => <option key={a} value={a}>{a}</option>)}
      </select>

      {/* OPEX / CAPEX filter */}
      <select value={opexFilter} onChange={e => onOpexFilter(e.target.value)} style={selSx}>
        <option value="">OPEX + CAPEX</option>
        <option value="OpEx">OPEX only</option>
        <option value="CapEx">CAPEX only</option>
      </select>

      {/* Budget range */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <input
          value={budgetMin}
          onChange={e => onBudgetMin(e.target.value)}
          placeholder="Min €"
          style={{ ...inputSx, width: 90 }}
          onFocus={e => { e.target.style.borderColor = C.gold; }}
          onBlur={e => { e.target.style.borderColor = C.gridLine; }}
        />
        <span style={{ fontSize: 11, color: '#aaa' }}>–</span>
        <input
          value={budgetMax}
          onChange={e => onBudgetMax(e.target.value)}
          placeholder="Max €"
          style={{ ...inputSx, width: 90 }}
          onFocus={e => { e.target.style.borderColor = C.gold; }}
          onBlur={e => { e.target.style.borderColor = C.gridLine; }}
        />
      </div>

      {/* Result count */}
      {isFiltered && (
        <span style={{ fontSize: 12, color: '#888', whiteSpace: 'nowrap' }}>
          Showing {filteredCount} of {total}
        </span>
      )}

      {/* Clear filters */}
      {isFiltered && (
        <button
          onClick={() => {
            onSearch(''); onStatusFilter('all'); onQuarterFilter('');
            onRegionFilter(''); onBrandFilter(''); onActivityFilter('');
            onOpexFilter(''); onBudgetMin(''); onBudgetMax('');
          }}
          style={{ height: 28, padding: '0 10px', borderRadius: 6, border: `1px solid ${C.gridLine}`, background: '#fff', fontSize: 11.5, cursor: 'pointer', color: '#888', whiteSpace: 'nowrap' }}
        >
          ✕ Clear
        </button>
      )}

      <div style={{ flex: 1 }} />

      {/* Submit button */}
      {isSubmitted ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 14px', height: 34, borderRadius: 8, background: '#E8F5EE', border: `1px solid ${C.approved}`, fontSize: 13, fontWeight: 700, color: C.approved }}>
          ✓ Review submitted
        </div>
      ) : (
        <button
          onClick={onSubmit}
          disabled={!allReviewed}
          title={allReviewed ? 'Submit your review' : `${total - reviewed} LOA${total - reviewed !== 1 ? 's' : ''} still need a verdict`}
          style={{
            height: 34,
            padding: '0 18px',
            borderRadius: 8,
            border: 'none',
            background: allReviewed ? C.gold : '#D9D5CD',
            color: allReviewed ? '#fff' : '#aaa',
            fontSize: 13,
            fontWeight: 700,
            cursor: allReviewed ? 'pointer' : 'not-allowed',
            transition: 'background 200ms',
            whiteSpace: 'nowrap',
          }}
        >
          Submit Review
        </button>
      )}
    </div>
  );
}

// ── Main CFO Spreadsheet container ──────────────────────────────────────────
interface Props {
  loas: LOA[];
  cycleId: string | null;
  cycleName: string;
  /** When set, the ← breadcrumb calls this instead of linking to the tracker. */
  onBack?: () => void;
  /**
   * Read-only grid: no approve, no reject, no submit. Used by Historical
   * Campaigns, where the data is an import and there is nothing to decide.
   *
   * It feeds the SAME `isSubmitted` channel the post-submit lock already uses,
   * so every child keeps one idea of "locked" instead of two.
   */
  readOnly?: boolean;
}

export default function CFOSpreadsheet({ loas, cycleId, cycleName, onBack, readOnly = false }: Props) {
  const [activeTab, setActiveTab] = useState<SheetTab>('lines');
  const [verdicts, setVerdicts] = useState<Record<string, ReviewVerdict>>({});
  const [comments, setComments] = useState<ReviewComment[]>([]);
  const [submittedFromApi, setSubmittedFromApi] = useState(false);
  // One locked flag. `readOnly` and "already submitted" mean the same thing to
  // every child, so they resolve here rather than at each call site.
  const isSubmitted = submittedFromApi || readOnly;
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  // Modal / popover state
  const [rejectTarget, setRejectTarget] = useState<RejectTarget | null>(null);
  const [commentLoaId, setCommentLoaId] = useState<string | null>(null);
  // commentAnchor is used only by the Summary-tab floating popover
  const [commentAnchor, setCommentAnchor] = useState<DOMRect | null>(null);
  const [showSubmitModal, setShowSubmitModal] = useState(false);

  // Filter state — shared between both tabs
  const [search, setSearch]               = useState('');
  const [statusFilter, setStatusFilter]   = useState<StatusFilter>('all');
  const [quarterFilter, setQuarterFilter] = useState('');
  const [regionFilter, setRegionFilter]   = useState('');
  const [brandFilter, setBrandFilter]     = useState('');
  const [activityFilter, setActivityFilter] = useState('');
  const [opexFilter, setOpexFilter]       = useState('');
  const [budgetMin, setBudgetMin]         = useState('');
  const [budgetMax, setBudgetMax]         = useState('');

  // Collapse state
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [collapsedFamilies,   setCollapsedFamilies]   = useState<Set<string>>(new Set());
  const [allExpanded, setAllExpanded] = useState(true);

  // ── Load verdicts + comments ──────────────────────────────────────────────
  useEffect(() => {
    if (!cycleId) { setLoading(false); return; }
    Promise.all([fetchVerdicts(cycleId), fetchComments(cycleId)])
      .then(([vRes, cArr]) => {
        const map: Record<string, ReviewVerdict> = {};
        vRes.verdicts.forEach(v => { map[v.loaId] = v; });
        setVerdicts(map);
        setSubmittedFromApi(vRes.isSubmitted);
        setComments(cArr);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [cycleId]);

  // ── Filtered loas — applied to BOTH tabs ─────────────────────────────────
  const filteredLoas = useMemo(() => {
    const budgetMinNum = parseEuroInput(budgetMin);
    const budgetMaxNum = parseEuroInput(budgetMax);

    return loas.filter(loa => {
      // General search — SAP, brand, description, vendor, and budget
      if (search) {
        const q = search.toLowerCase();
        const budgetSearchNum = parseEuroInput(search);
        const budgetMatches = budgetSearchNum > 0 &&
          Math.abs((loa.fy_2026_total || 0) - budgetSearchNum) < 0.5;
        if (!(
          (loa.sap_event_code || '').toLowerCase().includes(q) ||
          (loa.brand || '').toLowerCase().includes(q) ||
          (loa.description || '').toLowerCase().includes(q) ||
          (loa.detail || '').toLowerCase().includes(q) ||
          (loa.vendor || '').toLowerCase().includes(q) ||
          budgetMatches
        )) return false;
      }

      // Status
      if (statusFilter !== 'all') {
        const v = verdicts[loa.id];
        if (statusFilter === 'unreviewed' && v) return false;
        if (statusFilter === 'approved' && v?.decision !== 'approved') return false;
        if (statusFilter === 'rejected' && v?.decision !== 'rejected') return false;
      }

      // Quarter
      if (quarterFilter) {
        const qMap: Record<string, keyof LOA> = {
          Q1: 'q1_2026', Q2: 'q2_2026', Q3: 'q3_2026', Q4: 'q4_2026',
        };
        const field = qMap[quarterFilter];
        if (!(field && (loa[field] as number || 0) > 0)) return false;
      }

      // Region (cluster or country)
      if (regionFilter && (loa.cluster || loa.country) !== regionFilter) return false;

      // Brand
      if (brandFilter && loa.brand !== brandFilter) return false;

      // Activity type
      if (activityFilter && loa.activity_type !== activityFilter) return false;

      // OPEX / CAPEX
      if (opexFilter && loa.capex_opex !== opexFilter) return false;

      // Budget range
      const budget = loa.fy_2026_total || 0;
      if (budgetMinNum > 0 && budget < budgetMinNum) return false;
      if (budgetMaxNum > 0 && budget > budgetMaxNum) return false;

      return true;
    });
  }, [loas, search, statusFilter, quarterFilter, regionFilter, brandFilter,
      activityFilter, opexFilter, budgetMin, budgetMax, verdicts]);

  const reviewedCount = useMemo(() => loas.filter(l => !!verdicts[l.id]).length, [loas, verdicts]);
  const allReviewed   = reviewedCount === loas.length && loas.length > 0;

  // ── Approve ───────────────────────────────────────────────────────────────
  const handleApprove = useCallback(async (loa: LOA) => {
    if (!cycleId || isSubmitted) return;
    const prev = verdicts[loa.id];
    setVerdicts(v => ({
      ...v,
      [loa.id]: {
        id: prev?.id ?? '',
        cycleId: cycleId,
        loaId: loa.id,
        reviewerId: prev?.reviewerId ?? '',
        decision: 'approved',
        createdAt: prev?.createdAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    }));
    try {
      const result = await submitVerdict(cycleId, loa.id, 'approved');
      setVerdicts(v => ({ ...v, [loa.id]: result }));
    } catch {
      setVerdicts(v => {
        const next = { ...v };
        if (prev) next[loa.id] = prev; else delete next[loa.id];
        return next;
      });
    }
  }, [cycleId, isSubmitted, verdicts]);

  // ── Reject (single or bulk) ───────────────────────────────────────────────
  const handleRejectConfirm = useCallback(async (reason: string, loaIds: string[]) => {
    if (!cycleId || isSubmitted) return;
    setRejectTarget(null);

    const prevMap: Record<string, ReviewVerdict | undefined> = {};
    for (const id of loaIds) prevMap[id] = verdicts[id];

    setVerdicts(v => {
      const next = { ...v };
      for (const id of loaIds) {
        next[id] = {
          id: prevMap[id]?.id ?? '',
          cycleId,
          loaId: id,
          reviewerId: prevMap[id]?.reviewerId ?? '',
          decision: 'rejected',
          reason,
          createdAt: prevMap[id]?.createdAt ?? new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      }
      return next;
    });

    try {
      const results = await Promise.allSettled(
        loaIds.map(id => submitVerdict(cycleId, id, 'rejected', reason))
      );
      setVerdicts(v => {
        const next = { ...v };
        results.forEach((r, i) => {
          if (r.status === 'fulfilled') {
            next[loaIds[i]] = r.value;
          } else {
            if (prevMap[loaIds[i]]) next[loaIds[i]] = prevMap[loaIds[i]]!;
            else delete next[loaIds[i]];
          }
        });
        return next;
      });
    } catch {
      setVerdicts(v => {
        const next = { ...v };
        for (const id of loaIds) {
          if (prevMap[id]) next[id] = prevMap[id]!; else delete next[id];
        }
        return next;
      });
    }
  }, [cycleId, isSubmitted, verdicts]);

  // ── Comment ───────────────────────────────────────────────────────────────
  const handleCommentAdded = useCallback((comment: ReviewComment) => {
    setComments(c => [...c, comment]);
  }, []);

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (!cycleId || submitting) return;
    setSubmitting(true);
    try {
      await submitReview(cycleId);
      setSubmittedFromApi(true);
      setShowSubmitModal(false);
    } catch (e) {
      console.error('Submit failed', e);
    } finally {
      setSubmitting(false);
    }
  }, [cycleId, submitting]);

  // ── Expand / collapse all ─────────────────────────────────────────────────
  const toggleExpandAll = useCallback(() => {
    if (allExpanded) {
      const cats = new Set(loas.map(l => primaryCategory(l)));
      const fams = new Set(loas.map(l => `${primaryCategory(l)}::${l.activity_type}`));
      setCollapsedCategories(cats);
      setCollapsedFamilies(fams);
      setAllExpanded(false);
    } else {
      setCollapsedCategories(new Set());
      setCollapsedFamilies(new Set());
      setAllExpanded(true);
    }
  }, [allExpanded, loas]);

  return (
    /* Was `position:fixed; left:68` — pinned to the left rail that no longer
       exists, which also parked it on top of the app chrome. It is a normal
       block now, sized to what TopNav leaves of the viewport. */
    <div className="la-cfo">
      <CFOTopBar cycleName={cycleName} onBack={onBack} />

      <CFOToolbar
        reviewed={reviewedCount}
        total={loas.length}
        filteredCount={filteredLoas.length}
        allReviewed={allReviewed}
        isSubmitted={isSubmitted}
        allExpanded={allExpanded}
        search={search}
        statusFilter={statusFilter}
        quarterFilter={quarterFilter}
        regionFilter={regionFilter}
        brandFilter={brandFilter}
        activityFilter={activityFilter}
        opexFilter={opexFilter}
        budgetMin={budgetMin}
        budgetMax={budgetMax}
        loas={loas}
        onSearch={setSearch}
        onStatusFilter={setStatusFilter}
        onQuarterFilter={setQuarterFilter}
        onRegionFilter={setRegionFilter}
        onBrandFilter={setBrandFilter}
        onActivityFilter={setActivityFilter}
        onOpexFilter={setOpexFilter}
        onBudgetMin={setBudgetMin}
        onBudgetMax={setBudgetMax}
        onToggleExpand={toggleExpandAll}
        onSubmit={() => setShowSubmitModal(true)}
      />

      {/* Grid area */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#aaa', fontSize: 14 }}>
            Loading review data…
          </div>
        ) : activeTab === 'lines' ? (
          <LOALinesGrid
            loas={filteredLoas}
            verdicts={verdicts}
            comments={comments}
            isSubmitted={isSubmitted}
            collapsedCategories={collapsedCategories}
            collapsedFamilies={collapsedFamilies}
            onToggleCategory={cat => {
              setCollapsedCategories(s => {
                const n = new Set(s);
                n.has(cat) ? n.delete(cat) : n.add(cat);
                return n;
              });
            }}
            onToggleFamily={key => {
              setCollapsedFamilies(s => {
                const n = new Set(s);
                n.has(key) ? n.delete(key) : n.add(key);
                return n;
              });
            }}
            onApprove={handleApprove}
            onReject={loa => setRejectTarget({ type: 'single', loa })}
            onComment={loa => setCommentLoaId(loa.id)}
            commentLoaId={commentLoaId}
            cycleId={cycleId}
            onCommentAdded={handleCommentAdded}
            onCloseComments={() => setCommentLoaId(null)}
          />
        ) : (
          /* Summary receives filteredLoas — every number recalculates from the active filter set */
          <SummaryPivot
            loas={filteredLoas}
            verdicts={verdicts}
            comments={comments}
            isSubmitted={isSubmitted}
            onBulkReject={(loasList, groupLabel) => setRejectTarget({ type: 'bulk', loas: loasList, groupLabel })}
            onComment={(loaId, at) => { setCommentAnchor(at); setCommentLoaId(loaId); }}
          />
        )}
      </div>

      {/* Sheet tabs */}
      <SheetTabsBar activeTab={activeTab} onTabChange={t => { setActiveTab(t); setCommentLoaId(null); setCommentAnchor(null); }} />

      {/* Reject modal */}
      {rejectTarget && (
        <RejectReasonModal
          loa={rejectTarget.type === 'single' ? rejectTarget.loa : undefined}
          loas={rejectTarget.type === 'bulk' ? rejectTarget.loas : undefined}
          groupLabel={rejectTarget.type === 'bulk' ? rejectTarget.groupLabel : undefined}
          onConfirm={handleRejectConfirm}
          onCancel={() => setRejectTarget(null)}
        />
      )}

      {/* Comment popover — Summary tab only (Lines tab uses the inline column panel) */}
      {commentLoaId && commentAnchor && cycleId && activeTab === 'summary' && (
        <CommentPopover
          loaId={commentLoaId}
          cycleId={cycleId}
          comments={comments}
          anchor={commentAnchor}
          onCommentAdded={handleCommentAdded}
          onClose={() => { setCommentLoaId(null); setCommentAnchor(null); }}
        />
      )}

      {/* Submit modal */}
      {showSubmitModal && (
        <SubmitReviewModal
          loas={loas}
          verdicts={verdicts}
          onConfirm={handleSubmit}
          onCancel={() => setShowSubmitModal(false)}
          submitting={submitting}
        />
      )}
    </div>
  );
}
