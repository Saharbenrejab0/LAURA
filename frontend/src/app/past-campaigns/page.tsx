'use client';

/**
 * LAURA — Past Campaigns (archive refonte, June 2026)
 *
 * Replaced the card grid with a dense row-based archive that matches the
 * Tracker design language: sharp Essilor rectangles, B&W with selective
 * champagne accents, mono font for IDs/budgets, hover reveals primary action.
 *
 * Architecture:
 *   - Server-side pagination via offset (no client-only slicing)
 *   - Server-side filtering on brand/country/activity/status/sort
 *   - Local search box (existing backend search param)
 *   - Right-side preview sheet on row click (kept from previous version)
 *   - "Use as template" hovers up from the right edge of each row
 */

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import api from '@/lib/api';
import StatusBadge from '@/components/StatusBadge';
import { color, font, motion, radius, space } from '@/styles/tokens';

const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;
type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

interface Template {
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

interface ScopeInfo {
  type: string | null;
  value: string | null;
  is_admin: boolean;
}

type SortKey = 'most_reusable' | 'recently_approved' | 'highest_budget' | 'fy_desc';

// ═════════════════════════════════════════════════════════════════
// Page
// ═════════════════════════════════════════════════════════════════

export default function PastCampaignsPage() {
  const router = useRouter();

  // Data
  const [templates, setTemplates] = useState<Template[]>([]);
  const [total, setTotal] = useState(0);
  const [scope, setScope] = useState<ScopeInfo>({ type: null, value: null, is_admin: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selection (preview sheet)
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [duplicating, setDuplicating] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [brand, setBrand] = useState<string | null>(null);
  const [country, setCountry] = useState<string | null>(null);
  const [activityType, setActivityType] = useState<string | null>(null);
  const [status, setStatus] = useState<'approved' | 'closed' | null>('approved');
  const [sort, setSort] = useState<SortKey>('most_reusable');

  // Pagination
  const [pageSize, setPageSize] = useState<PageSize>(50);
  const [page, setPage] = useState(1);
  const offset = (page - 1) * pageSize;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // Page entry animation
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setEntered(true), 20);
    return () => clearTimeout(t);
  }, []);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [search, brand, country, activityType, status, sort, pageSize]);

  // Fetch
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const p = new URLSearchParams();
    if (search) p.set('search', search);
    if (brand) p.set('brand', brand);
    if (country) p.set('country', country);
    if (activityType) p.set('activity_type', activityType);
    if (status) p.set('status', status);
    p.set('sort', sort);
    p.set('limit', String(pageSize));
    p.set('offset', String(offset));

    api.get(`/templates?${p.toString()}`)
      .then((res) => {
        if (cancelled) return;
        setTemplates(res.data.templates || []);
        setTotal(res.data.total || 0);
        setScope(res.data.viewer_scope || { type: null, value: null, is_admin: false });
        setError(null);
      })
      .catch((e) => {
        if (!cancelled) setError(e?.response?.data?.detail || e?.message || 'Failed to load');
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [search, brand, country, activityType, status, sort, pageSize, offset]);

  // Esc closes preview
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelectedId(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Derived
  const selected = useMemo(
    () => templates.find((t) => t.id === selectedId) || null,
    [templates, selectedId]
  );
  const distinctBrands = useMemo(() => unique(templates.map(t => t.brand)), [templates]);
  const distinctCountries = useMemo(() => unique(templates.map(t => t.country)), [templates]);
  const distinctActivities = useMemo(() => unique(templates.map(t => t.activity_type)), [templates]);

  // Actions
  const useTemplate = async (id: string) => {
    setDuplicating(true);
    try {
      const { data } = await api.post(`/loa/${id}/duplicate`);
      router.push(`/loa/${data.id}`);
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || 'Could not duplicate');
      setDuplicating(false);
    }
  };

  const activeFilters =
    (brand ? 1 : 0) + (country ? 1 : 0) + (activityType ? 1 : 0) +
    (status && status !== 'approved' ? 1 : 0) + (search ? 1 : 0);

  const clearAll = () => {
    setBrand(null); setCountry(null); setActivityType(null);
    setStatus('approved'); setSearch('');
  };

  const startIdx = total === 0 ? 0 : offset + 1;
  const endIdx = Math.min(offset + pageSize, total);

  // ── Render ───────────────────────────────────────────────────

  return (
    <div style={{
      minHeight: '100vh',
      background: color.bg.canvas,
      fontFamily: font.sans,
      color: color.text.primary,
      opacity: entered ? 1 : 0,
      transform: entered ? 'translateY(0)' : 'translateY(6px)',
      transition: `opacity ${motion.duration.base}ms ${motion.easing}, transform ${motion.duration.base}ms ${motion.easing}`,
    }}>
      <main style={{
        maxWidth: 1280, margin: '0 auto',
        padding: `${space[6]}px ${space[6]}px ${space[8]}px`,
      }}>

        {/* ─── Header ─── */}
        <header style={{ marginBottom: space[5] }}>
          <h1 style={{
            margin: 0, fontSize: 26, lineHeight: '32px', fontWeight: 600,
            color: color.text.primary, letterSpacing: '-0.01em',
          }}>Past Campaigns</h1>
          <p style={{ margin: `${space[1]}px 0 0`, fontSize: 13, color: color.text.secondary }}>
            {loading ? 'Loading…' : (
              <>
                <span style={{ fontFamily: font.mono, color: color.text.primary, fontWeight: 500 }}>
                  {total.toLocaleString()}
                </span>
                <span> campaign{total !== 1 ? 's' : ''}</span>
                <span> · </span>
                <span>
                  {scope.is_admin ? 'All clusters' : scope.value || 'Your cluster'}
                </span>
                <span> archive</span>
              </>
            )}
          </p>
        </header>

        {/* ─── Search ─── */}
        <div style={{ marginBottom: space[3] }}>
          <SearchInput value={search} onChange={setSearch} />
        </div>

        {/* ─── Filter chips row ─── */}
        <div style={{
          display: 'flex', gap: space[2], marginBottom: space[5],
          flexWrap: 'wrap', alignItems: 'center',
        }}>
          <SelectChip
            label="Brand" value={brand}
            options={distinctBrands} onChange={setBrand}
          />
          <SelectChip
            label="Country" value={country}
            options={distinctCountries} onChange={setCountry}
          />
          <SelectChip
            label="Activity" value={activityType}
            options={distinctActivities} onChange={setActivityType}
          />
          <SelectChip
            label="Status" value={status}
            options={['approved', 'closed']}
            onChange={(v) => setStatus(v as 'approved' | 'closed' | null)}
            format={(v) => v.charAt(0).toUpperCase() + v.slice(1)}
          />

          <SortSelect value={sort} onChange={setSort} />

          {activeFilters > 0 && (
            <button onClick={clearAll} style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              fontSize: 12, color: color.text.tertiary,
              textDecoration: 'underline', fontFamily: font.sans,
              padding: '4px 8px',
            }}>Clear all ({activeFilters})</button>
          )}
        </div>

        {/* ─── Error ─── */}
        {error && (
          <div style={{
            padding: `${space[3]}px ${space[4]}px`, borderRadius: 2,
            background: 'var(--laura-danger-bg)', color: 'var(--laura-danger)',
            border: '1px solid var(--laura-danger-border)',
            fontSize: 13, marginBottom: space[3],
          }}>{error}</div>
        )}

        {/* ─── Archive table ─── */}
        {!loading && templates.length === 0 ? (
          <EmptyState />
        ) : (
          <div style={{
            background: color.bg.surface,
            border: `1px solid ${color.border.soft}`,
            borderRadius: 0,
            overflow: 'hidden',
            opacity: loading ? 0.6 : 1,
            transition: 'opacity 140ms cubic-bezier(0.2, 0, 0, 1)',
          }}>
            {/* Header row */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '140px minmax(0, 1fr) 200px 110px 130px',
              gap: space[3], padding: `${space[2]}px ${space[4]}px`,
              fontSize: 11, fontWeight: 500,
              letterSpacing: '0.04em', textTransform: 'uppercase',
              color: color.text.tertiary,
              borderBottom: `1px solid ${color.border.soft}`,
              background: color.bg.subtle,
            }}>
              <span>LOA ID</span>
              <span>Title</span>
              <span>Tags</span>
              <span style={{ textAlign: 'right' }}>Budget</span>
              <span style={{ textAlign: 'right' }}>Action</span>
            </div>

            {/* Rows */}
            {templates.map((t) => (
              <ArchiveRow
                key={t.id}
                template={t}
                onSelect={() => setSelectedId(t.id)}
                onUse={() => useTemplate(t.id)}
                disabled={duplicating}
              />
            ))}
          </div>
        )}

        {/* ─── Pagination ─── */}
        {total > 0 && (
          <PaginationBar
            page={page}
            totalPages={totalPages}
            pageSize={pageSize}
            startIdx={startIdx}
            endIdx={endIdx}
            total={total}
            setPage={setPage}
            setPageSize={(s) => { setPageSize(s); setPage(1); }}
          />
        )}
      </main>

      {/* ─── Preview sheet ─── */}
      {selected && (
        <>
          <div onClick={() => setSelectedId(null)} style={{
            position: 'fixed', inset: 0, background: 'rgba(10, 10, 10, 0.32)',
            backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
            zIndex: 200, animation: `fadeIn ${motion.duration.base}ms ${motion.easing}`,
          }} />
          <aside style={{
            position: 'fixed', top: 0, right: 0, bottom: 0,
            width: 'min(440px, calc(100vw - 64px))',
            background: color.bg.surface,
            borderLeft: `1px solid ${color.border.soft}`,
            zIndex: 201, padding: space[6], overflowY: 'auto',
            animation: `slideIn ${motion.duration.base}ms ${motion.easing}`,
          }}>
            <PreviewContent
              template={selected}
              onUse={() => useTemplate(selected.id)}
              onClose={() => setSelectedId(null)}
              disabled={duplicating}
            />
          </aside>
          <style>{`
            @keyframes slideIn { from { transform: translateX(20px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
            @keyframes fadeIn  { from { opacity: 0; } to { opacity: 1; } }
          `}</style>
        </>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════
// ArchiveRow — the dense Tracker-style row
// ═════════════════════════════════════════════════════════════════

function ArchiveRow({ template, onSelect, onUse, disabled }: {
  template: Template;
  onSelect: () => void;
  onUse: () => void;
  disabled: boolean;
}) {
  const [hover, setHover] = useState(false);

  const tags = [template.country, template.brand, template.activity_type].filter(Boolean);

  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'grid',
        gridTemplateColumns: '140px minmax(0, 1fr) 200px 110px 130px',
        gap: space[3],
        padding: `${space[3]}px ${space[4]}px`,
        alignItems: 'center',
        borderBottom: `1px solid ${color.border.soft}`,
        background: hover ? 'var(--laura-bg-warm)' : color.bg.surface,
        cursor: 'pointer',
        transition: `background-color ${motion.duration.quick}ms ${motion.easing}`,
        minHeight: 64,
      }}
    >
      {/* LOA ID */}
      <span style={{
        fontFamily: font.mono, fontSize: 11, fontWeight: 500,
        color: color.text.secondary,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{template.loa_draft_id}</span>

      {/* Title + status */}
      <div style={{ minWidth: 0 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          marginBottom: 3,
        }}>
          <StatusBadge status={template.status} size="sm" />
        </div>
        <p style={{
          margin: 0, fontSize: 14, fontWeight: 500, lineHeight: '20px',
          color: color.text.primary,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{template.title}</p>
      </div>

      {/* Tags column */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center',
        overflow: 'hidden',
      }}>
        {tags.slice(0, 2).map((tag, i) => (
          <span key={i} style={{
            fontSize: 11, padding: '2px 8px', borderRadius: 2,
            background: 'var(--laura-bg-subtle, #FAFAFA)',
            border: `1px solid ${color.border.soft}`,
            color: color.text.secondary,
            whiteSpace: 'nowrap',
            overflow: 'hidden', textOverflow: 'ellipsis',
            maxWidth: 90,
          }}>{tag}</span>
        ))}
        {tags.length > 2 && (
          <span style={{
            fontSize: 11, color: color.text.tertiary,
            fontFamily: font.mono,
          }}>+{tags.length - 2}</span>
        )}
      </div>

      {/* Budget */}
      <span style={{
        fontFamily: font.mono, fontSize: 14, fontWeight: 500,
        color: color.text.primary, textAlign: 'right',
      }}>{formatMoney(template.budget_total)}</span>

      {/* Action (always visible, inverts on row hover) */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={(e) => { e.stopPropagation(); onUse(); }}
          disabled={disabled}
          style={{
            background: hover ? 'var(--laura-action)' : 'transparent',
            color: hover ? 'var(--laura-text-on-primary)' : color.text.secondary,
            border: `1px solid ${hover ? 'var(--laura-action)' : color.border.soft}`,
            borderRadius: 2, padding: '4px 12px',
            fontSize: 11, fontWeight: 500, fontFamily: font.sans,
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.4 : 1,
            transition: 'background-color 120ms cubic-bezier(0.2, 0, 0, 1), color 120ms cubic-bezier(0.2, 0, 0, 1), border-color 120ms cubic-bezier(0.2, 0, 0, 1)',
            whiteSpace: 'nowrap',
            letterSpacing: '0.01em',
          }}>
          Use as template
        </button>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════
// Preview sheet (kept from previous version, refined typography)
// ═════════════════════════════════════════════════════════════════

function PreviewContent({ template, onUse, onClose, disabled }: {
  template: Template; onUse: () => void; onClose: () => void; disabled: boolean;
}) {
  return (
    <div>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        marginBottom: space[4],
      }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{
            margin: 0, fontFamily: font.mono, fontSize: 12, fontWeight: 500,
            color: color.text.secondary,
          }}>{template.loa_draft_id}</p>
          <h2 style={{
            margin: `${space[1]}px 0 ${space[3]}px`,
            fontSize: 20, lineHeight: '26px', fontWeight: 600,
            color: color.text.primary,
          }}>{template.title}</h2>
          <StatusBadge status={template.status} />
        </div>
        <button onClick={onClose} aria-label="Close" style={{
          background: 'transparent', border: 'none', fontSize: 20,
          color: color.text.tertiary, cursor: 'pointer', padding: 0, lineHeight: 1,
        }}>×</button>
      </div>

      <PreviewSection label="Where">
        <PreviewRow label="Country" value={template.country} />
        <PreviewRow label="Cluster" value={template.cluster} />
      </PreviewSection>
      <PreviewSection label="Classification">
        <PreviewRow label="Brand" value={template.brand} />
        <PreviewRow label="Activity" value={template.activity_type} />
      </PreviewSection>
      <PreviewSection label="Financials">
        <PreviewRow label="Budget total" value={formatMoney(template.budget_total)} mono />
        <PreviewRow label="FY 2025" value={template.fy_2025_total ? formatMoney(template.fy_2025_total) : '—'} mono />
        <PreviewRow label="FY 2026" value={template.fy_2026_total ? formatMoney(template.fy_2026_total) : '—'} mono />
      </PreviewSection>

      <button onClick={onUse} disabled={disabled} style={{
        width: '100%', marginTop: space[4],
        background: disabled ? color.border.strong : 'var(--laura-action)',
        color: 'var(--laura-text-on-primary)',
        border: 'none', borderRadius: 2, padding: '12px 16px',
        fontSize: 14, fontWeight: 500, fontFamily: font.sans,
        cursor: disabled ? 'not-allowed' : 'pointer',
        letterSpacing: '0.01em',
      }}>Use as template</button>
    </div>
  );
}

function PreviewSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: space[4] }}>
      <p style={{
        margin: `0 0 ${space[2]}px`, fontSize: 11, letterSpacing: '0.06em',
        textTransform: 'uppercase', fontWeight: 600, color: color.text.tertiary,
      }}>{label}</p>
      <div>{children}</div>
    </div>
  );
}

function PreviewRow({ label, value, mono }: {
  label: string; value: string | null | undefined; mono?: boolean;
}) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: `${space[1]}px 0`, fontSize: 13,
      borderBottom: `1px solid ${color.border.soft}`,
    }}>
      <span style={{ color: color.text.secondary }}>{label}</span>
      <span style={{
        color: color.text.primary,
        fontFamily: mono ? font.mono : font.sans,
        fontWeight: mono ? 500 : 400, textAlign: 'right',
      }}>{value || '—'}</span>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════
// SearchInput (same look as Tracker)
// ═════════════════════════════════════════════════════════════════

function SearchInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      height: 48, background: color.bg.surface,
      border: `1px solid ${focused ? 'var(--laura-action)' : color.border.soft}`,
      borderRadius: 2, padding: '0 16px',
      transition: 'border-color 140ms cubic-bezier(0.2, 0, 0, 1)',
    }}>
      <span style={{ fontSize: 16, color: color.text.tertiary }}>⌕</span>
      <input
        type="text" value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        placeholder="Search title, LOA ID, brand, country, activity…"
        style={{
          flex: 1, border: 'none', outline: 'none', background: 'transparent',
          fontFamily: font.sans, fontSize: 14, color: color.text.primary,
        }}
      />
      {value && (
        <button onClick={() => onChange('')} style={{
          background: 'transparent', border: 'none', cursor: 'pointer',
          fontSize: 12, color: color.text.tertiary, padding: '4px 8px',
        }}>Clear</button>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════
// SelectChip — single-select filter with native select
// ═════════════════════════════════════════════════════════════════

function SelectChip({ label, value, options, onChange, format }: {
  label: string;
  value: string | null;
  options: string[];
  onChange: (v: string | null) => void;
  format?: (v: string) => string;
}) {
  const [hover, setHover] = useState(false);
  const active = value !== null;
  const display = value === null ? 'All' : (format ? format(value) : value);

  const bg = active || hover ? 'var(--laura-action)' : 'transparent';
  const fg = active || hover ? 'var(--laura-text-on-primary)' : color.text.primary;

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        height: 32, padding: '0 14px',
        borderRadius: 2, background: bg, color: fg,
        border: `1px solid var(--laura-action)`,
        fontSize: 12, fontWeight: 500, fontFamily: 'inherit',
        cursor: 'pointer', letterSpacing: '0.01em',
        transition: 'background-color 140ms cubic-bezier(0.2, 0, 0, 1), color 140ms cubic-bezier(0.2, 0, 0, 1)',
        whiteSpace: 'nowrap', pointerEvents: 'none',
      }}>
        {label}: <span style={{ fontWeight: 600 }}>{display}</span>
        <span style={{ marginLeft: 4, fontSize: 9 }}>▾</span>
      </div>
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value || null)}
        style={{
          position: 'absolute', inset: 0,
          opacity: 0, cursor: 'pointer',
          fontSize: 12,
        }}>
        <option value="">All</option>
        {options.map(opt => (
          <option key={opt} value={opt}>{format ? format(opt) : opt}</option>
        ))}
      </select>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════
// SortSelect
// ═════════════════════════════════════════════════════════════════

function SortSelect({ value, onChange }: {
  value: SortKey; onChange: (v: SortKey) => void;
}) {
  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        height: 32, padding: '0 14px',
        borderRadius: 2, background: 'transparent', color: color.text.primary,
        border: `1px solid ${color.border.strong}`,
        fontSize: 12, fontWeight: 500, fontFamily: 'inherit',
        cursor: 'pointer', whiteSpace: 'nowrap',
        pointerEvents: 'none', letterSpacing: '0.01em',
      }}>
        Sort: <span style={{ fontWeight: 600 }}>{labelForSort(value)}</span>
        <span style={{ marginLeft: 4, fontSize: 9 }}>▾</span>
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as SortKey)}
        style={{
          position: 'absolute', inset: 0,
          opacity: 0, cursor: 'pointer', fontSize: 12,
        }}>
        <option value="most_reusable">Most reusable</option>
        <option value="recently_approved">Recently approved</option>
        <option value="highest_budget">Highest budget</option>
        <option value="fy_desc">Most recent</option>
      </select>
    </div>
  );
}

function labelForSort(k: SortKey): string {
  return {
    most_reusable: 'Most reusable',
    recently_approved: 'Recently approved',
    highest_budget: 'Highest budget',
    fy_desc: 'Most recent',
  }[k];
}

// ═════════════════════════════════════════════════════════════════
// PaginationBar — identical pattern to Tracker
// ═════════════════════════════════════════════════════════════════

function PaginationBar({
  page, totalPages, pageSize, startIdx, endIdx, total, setPage, setPageSize,
}: {
  page: number;
  totalPages: number;
  pageSize: PageSize;
  startIdx: number;
  endIdx: number;
  total: number;
  setPage: (p: number) => void;
  setPageSize: (s: PageSize) => void;
}) {
  const windowSize = 5;
  let start = Math.max(1, page - Math.floor(windowSize / 2));
  let end = Math.min(totalPages, start + windowSize - 1);
  if (end - start < windowSize - 1) start = Math.max(1, end - windowSize + 1);
  const pages: number[] = [];
  for (let i = start; i <= end; i++) pages.push(i);

  return (
    <div style={{
      marginTop: space[5], paddingTop: space[4],
      borderTop: `1px solid ${color.border.soft}`,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      flexWrap: 'wrap', gap: space[3],
    }}>
      <div style={{ fontSize: 12, color: color.text.secondary }}>
        Showing{' '}
        <span style={{ fontFamily: font.mono, color: color.text.primary, fontWeight: 500 }}>
          {startIdx.toLocaleString()}–{endIdx.toLocaleString()}
        </span>
        {' of '}
        <span style={{ fontFamily: font.mono, color: color.text.primary, fontWeight: 500 }}>
          {total.toLocaleString()}
        </span>
      </div>

      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <PageBtn label="‹‹" onClick={() => setPage(1)} disabled={page === 1} title="First" />
          <PageBtn label="‹" onClick={() => setPage(page - 1)} disabled={page === 1} title="Previous" />

          {start > 1 && (
            <>
              <PageBtn label="1" onClick={() => setPage(1)} />
              {start > 2 && <Ellipsis />}
            </>
          )}

          {pages.map(p => (
            <PageBtn key={p} label={String(p)} onClick={() => setPage(p)} active={p === page} />
          ))}

          {end < totalPages && (
            <>
              {end < totalPages - 1 && <Ellipsis />}
              <PageBtn label={String(totalPages)} onClick={() => setPage(totalPages)} />
            </>
          )}

          <PageBtn label="›" onClick={() => setPage(page + 1)} disabled={page === totalPages} title="Next" />
          <PageBtn label="››" onClick={() => setPage(totalPages)} disabled={page === totalPages} title="Last" />
        </div>
      )}

      <PageSizeSelector value={pageSize} onChange={setPageSize} />
    </div>
  );
}

function PageBtn({ label, onClick, disabled, active, title }: {
  label: string; onClick: () => void; disabled?: boolean; active?: boolean; title?: string;
}) {
  const [hover, setHover] = useState(false);
  const bg = active ? 'var(--laura-action)'
    : hover && !disabled ? 'var(--laura-action)' : 'transparent';
  const fg = active || (hover && !disabled) ? 'var(--laura-text-on-primary)' : color.text.secondary;
  const borderColor = active || (hover && !disabled) ? 'var(--laura-action)' : color.border.soft;

  return (
    <button onClick={onClick} disabled={disabled} title={title}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        background: bg, color: fg,
        border: `1px solid ${borderColor}`,
        borderRadius: 2, padding: '4px 10px',
        fontSize: 12, fontFamily: font.mono, fontWeight: active ? 600 : 500,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1, minWidth: 30, height: 28,
        transition: 'background-color 120ms cubic-bezier(0.2, 0, 0, 1), color 120ms cubic-bezier(0.2, 0, 0, 1), border-color 120ms cubic-bezier(0.2, 0, 0, 1)',
      }}>{label}</button>
  );
}

function Ellipsis() {
  return (
    <span style={{
      fontSize: 12, color: color.text.tertiary, fontFamily: font.mono,
      padding: '0 4px', userSelect: 'none',
    }}>…</span>
  );
}

function PageSizeSelector({ value, onChange }: {
  value: PageSize; onChange: (v: PageSize) => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: color.text.secondary }}>
      <span>Per page:</span>
      <div style={{ display: 'inline-flex', border: `1px solid ${color.border.soft}`, borderRadius: 2 }}>
        {PAGE_SIZE_OPTIONS.map((opt, i) => (
          <button key={opt} onClick={() => onChange(opt)} style={{
            background: value === opt ? 'var(--laura-action)' : 'transparent',
            color: value === opt ? 'var(--laura-text-on-primary)' : color.text.secondary,
            border: 'none',
            borderLeft: i > 0 ? `1px solid ${color.border.soft}` : 'none',
            padding: '4px 10px',
            fontSize: 12, fontFamily: font.mono, fontWeight: value === opt ? 600 : 500,
            cursor: 'pointer',
            transition: 'background-color 120ms cubic-bezier(0.2, 0, 0, 1)',
            minWidth: 36, height: 28,
          }}>{opt}</button>
        ))}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════
// EmptyState + helpers
// ═════════════════════════════════════════════════════════════════

function EmptyState() {
  return (
    <div style={{
      textAlign: 'center', padding: `${space[8]}px ${space[4]}px`,
      borderRadius: 0,
      border: `1px dashed ${color.border.soft}`,
      background: color.bg.surface,
      color: color.text.tertiary, fontSize: 13,
    }}>
      <p style={{ margin: 0 }}>No campaigns match your filters. Try clearing some, or broadening the search.</p>
    </div>
  );
}

function unique<T>(arr: (T | null | undefined)[]): T[] {
  const seen = new Set<T>();
  const out: T[] = [];
  for (const v of arr) {
    if (v == null) continue;
    if (!seen.has(v)) { seen.add(v); out.push(v); }
  }
  return out.sort() as T[];
}

function formatMoney(n: number | null | undefined): string {
  if (!n) return '—';
  if (n >= 1_000_000) return `€${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `€${Math.round(n / 1_000)}k`;
  return `€${n}`;
}
