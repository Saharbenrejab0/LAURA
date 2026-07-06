'use client';

/**
 * ApprovalPanel — Editorial Finance redesign.
 *
 * VISUALLY condensed 7-step stepper (Draft → EMEA → Brand → Functions →
 * CMO/CFO → Corporate → Approved), but the 3 EMEA rework statuses are
 * absorbed into the previous review step with a sublabel — so the backend
 * still receives the exact 10-status workflow codes.
 *
 * Logic preserved:
 *   - normalizeStatus, isRejected/isApproved/isDraft
 *   - perms.can_validate gate for Approve/Reject
 *   - POST /loa/{id}/approve · /loa/{id}/reject
 */

import { useState } from 'react';
import api from '@/lib/api';
import { Pill, Btn, Overline } from '@/components/ui/atoms';

interface LOAData { id: string; status: string; }
interface Permissions { can_validate: boolean; user_role: string; }
interface Props { loa: LOAData; perms: Permissions; onActionDone: () => void; }

/** Visual stepper — 7 columns condensing 10 backend statuses. */
const STEPS: { key: string; label: string; actor: string; absorbed?: string[] }[] = [
  { key: 'draft',                    label: 'Draft',           actor: 'Requestor' },
  { key: 'emea_review',              label: 'EMEA review',     actor: 'EMEA team' },
  { key: 'global_brand_review',      label: 'Brand review',    actor: 'Global Brands',
    absorbed: ['emea_brand_rework'] },
  { key: 'global_functions_review',  label: 'Functions',       actor: 'Global Functions',
    absorbed: ['emea_functions_rework'] },
  { key: 'cmo_cfo_review',           label: 'CMO / CFO',       actor: 'CMO & CFO',
    absorbed: ['emea_cmo_rework'] },
  { key: 'corporate_review',         label: 'Corporate',       actor: 'Corporate team' },
  { key: 'approved',                 label: 'Approved',        actor: 'Final' },
];

/** Map any real backend status to its visual step index. */
function statusToStepIndex(status: string): number {
  const norm = normalizeStatus(status);
  for (let i = 0; i < STEPS.length; i++) {
    if (STEPS[i].key === norm) return i;
    if (STEPS[i].absorbed?.includes(norm)) return i;
  }
  return -1;
}

function normalizeStatus(s: string): string {
  return (s || '').toLowerCase().replace(/[\s/-]+/g, '_').replace(/_+/g, '_').trim();
}

/** Sublabel shown under a step when we're currently in one of its rework substeps. */
const REWORK_SUBLABELS: Record<string, string> = {
  emea_brand_rework: 'EMEA reworking brand feedback',
  emea_functions_rework: 'EMEA reworking functions feedback',
  emea_cmo_rework: 'EMEA reworking CMO/CFO feedback',
};

export default function ApprovalPanel({ loa, perms, onActionDone }: Props) {
  const [busy, setBusy] = useState<null | 'approve' | 'reject'>(null);
  const [error, setError] = useState<string | null>(null);

  const currentStatus = normalizeStatus(loa.status);
  const currentIndex = statusToStepIndex(currentStatus);
  const isRejected = currentStatus === 'rejected';
  const isApproved = currentStatus === 'approved';
  const isDraft = currentStatus === 'draft';
  const isReworkSub = currentStatus in REWORK_SUBLABELS;
  const canAct = perms.can_validate && !isRejected && !isApproved && !isDraft;

  const performAction = async (action: 'approve' | 'reject') => {
    setBusy(action); setError(null);
    try {
      await api.post(`/loa/${loa.id}/${action}`);
      onActionDone();
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || `${action} failed`);
    } finally {
      setBusy(null);
    }
  };

  const currentStep = currentIndex >= 0 ? STEPS[currentIndex] : null;
  const awaitingLabel = isApproved
    ? 'Final'
    : isDraft
      ? `${currentStep?.actor || 'Requestor'} is preparing`
      : isRejected
        ? 'Rejected — awaiting rework'
        : `Awaiting ${currentStep?.actor || 'reviewer'}`;

  return (
    <section className="la-card" style={{ padding: '20px 22px', overflow: 'hidden' }}>
      {/* ── Top row: overline + current pill + actions ── */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        gap: 16, flexWrap: 'wrap', marginBottom: 18,
      }}>
        <div style={{ minWidth: 0 }}>
          <Overline style={{ marginBottom: 6 }}>Approval workflow</Overline>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <Pill status={loa.status} />
            <span style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>
              · {awaitingLabel}
            </span>
          </div>
          {isReworkSub && (
            <div style={{
              marginTop: 6, fontSize: 11.5, color: 'var(--st-rework-fg)',
              fontStyle: 'italic',
            }}>
              {REWORK_SUBLABELS[currentStatus]}
            </div>
          )}
        </div>

        {canAct && (
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <Btn
              variant="danger" small
              onClick={() => performAction('reject')}
              disabled={busy !== null}
            >
              {busy === 'reject' ? 'Rejecting…' : 'Request changes'}
            </Btn>
            <Btn
              variant="primary" small
              onClick={() => performAction('approve')}
              disabled={busy !== null}
            >
              {busy === 'approve' ? 'Approving…' : 'Approve'}
            </Btn>
          </div>
        )}

        {!canAct && !isApproved && !isDraft && !isRejected && (
          <span style={{
            fontSize: 11.5, color: 'var(--text-tertiary)', fontStyle: 'italic',
            paddingTop: 4,
          }}>
            You can't act at this step
          </span>
        )}
      </div>

      {error && (
        <div style={{
          marginBottom: 14, padding: '10px 12px',
          background: 'var(--st-rejected-bg)', color: 'var(--st-rejected-fg)',
          borderRadius: 8, fontSize: 12.5,
        }}>{error}</div>
      )}

      {/* ── Stepper ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', position: 'relative' }}>
        {STEPS.map((step, i) => {
          const isDone = !isRejected && (i < currentIndex || isApproved);
          const isCurrent = !isRejected && !isApproved && i === currentIndex;
          const dotBg = isDone ? 'var(--ink)' : isCurrent ? 'var(--ink)' : 'var(--surface)';
          const dotFg = isDone || isCurrent ? 'var(--ink-text)' : 'var(--text-tertiary)';
          const dotBorder = isDone || isCurrent ? 'var(--ink)' : 'var(--border-strong)';
          const lineBg = isDone ? 'var(--ink)' : 'var(--border)';

          return (
            <div key={step.key} style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', position: 'relative', minWidth: 0,
            }}>
              {i > 0 && (
                <div style={{
                  position: 'absolute', top: 11, left: '-50%', right: '50%',
                  height: 2, background: lineBg,
                  transition: 'background .3s ease',
                }} />
              )}
              <div style={{
                width: 22, height: 22, borderRadius: 999,
                background: dotBg,
                border: `2px solid ${dotBorder}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontWeight: 700, color: dotFg,
                position: 'relative', zIndex: 1,
                boxShadow: isCurrent ? '0 0 0 4px var(--gold-soft)' : 'none',
                transition: 'all .3s ease',
              }}>
                {isDone ? '✓' : isCurrent ? '' : ''}
              </div>
              <div style={{
                marginTop: 8,
                fontSize: 11, fontWeight: isCurrent ? 700 : 500,
                color: isCurrent ? 'var(--text-primary)' : isDone ? 'var(--text-secondary)' : 'var(--text-tertiary)',
                textAlign: 'center', letterSpacing: '.02em',
                lineHeight: 1.3,
                padding: '0 4px',
              }}>
                {step.label}
              </div>
              {isCurrent && (
                <div style={{
                  marginTop: 2, fontSize: 9.5, color: 'var(--gold)',
                  fontFamily: 'var(--font-mono)', letterSpacing: '.05em',
                }}>NOW</div>
              )}
            </div>
          );
        })}
      </div>

      {isRejected && (
        <div style={{
          marginTop: 14, padding: '10px 14px',
          background: 'var(--st-rejected-bg)', color: 'var(--st-rejected-fg)',
          borderRadius: 8, fontSize: 12.5, fontWeight: 500,
        }}>
          This LOA was rejected. Author must address feedback and resubmit.
        </div>
      )}
    </section>
  );
}
