'use client';

/**
 * ApprovalPanel — Approval stepper + action buttons.
 *
 * Reject flow (per spec):
 *   EMEA stages (emea_review / emea_post_global_review / emea_final_review):
 *     → modal: mandatory reason + two buttons
 *         "Edit & resolve"     → POST /reject { reason, choice: "edit_myself" }
 *         "Return to marketer" → POST /reject { reason, choice: "return_to_marketer" }
 *
 *   CMO/CFO or Corporate (cmo_cfo_review / corporate_review):
 *     → modal: mandatory reason + one button (routing is automatic on the backend)
 *         POST /reject { reason }   → backend routes to emea_final_review
 *
 * Approve/submit is still confirmation-gated (same "are you sure" pattern).
 */

import { useState } from 'react';
import api from '@/lib/api';
import { Pill, Btn, Overline } from '@/components/ui/atoms';
import { buildChain } from '@/lib/workflow';
import { useMyRole } from '@/hooks/usePermissions';

interface LOAData {
  id: string;
  status: string;
  rejection_reason?: string | null;
  rejected_by_stage?: string | null;
}
interface Permissions { can_validate: boolean; user_role: string; }
interface Props {
  loa: LOAData;
  perms: Permissions;
  onActionDone: () => void;
  reviewerCanSubmit?: boolean;
}

// The stepper's stages come from the chain, not from a list kept here — a
// second copy is how this panel and the split-screen stepper drift apart.
// `draft` is prepended because this panel is the one place an unsubmitted LOA
// is on screen, and its author needs to see where they are starting from.
const STEPS: { key: string; label: string; actor: string }[] = [
  { key: 'draft', label: 'Draft', actor: 'Requestor' },
  ...buildChain('').map(s => ({ key: s.key, label: s.label, actor: s.owner })),
];

function statusToStepIndex(status: string): number {
  for (let i = 0; i < STEPS.length; i++) {
    if (STEPS[i].key === status) return i;
  }
  return -1;
}

// Stages where the reject modal shows two choices (EMEA decides)
const EMEA_STAGES = new Set(['emea_review', 'emea_post_global_review', 'emea_final_review']);

// Stage labels for the rejection banner
const STAGE_LABELS: Record<string, string> = {
  emea_review:             'EMEA review',
  emea_post_global_review: 'EMEA post-global review',
  emea_final_review:       'EMEA final review',
  cmo_cfo_review:          'CMO / CFO review',
  corporate_review:        'Corporate review',
};

export default function ApprovalPanel({ loa, perms, onActionDone, reviewerCanSubmit = false }: Props) {
  const { role } = useMyRole();
  const [busy, setBusy]               = useState<null | 'approve' | 'reject'>(null);
  const [error, setError]             = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Reject modal state
  const [rejectOpen, setRejectOpen]   = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const status      = loa.status;
  const currentIndex = statusToStepIndex(status);
  const isRejected  = status === 'rejected';
  const isReturned  = status === 'returned';
  const isApproved  = status === 'approved';
  const isDraft     = status === 'draft';
  const canAct      = (perms.can_validate || reviewerCanSubmit) && !isRejected && !isReturned && !isApproved && !isDraft;
  /**
   * Who picks what happens after a rejection, rather than having it routed for
   * them: the EMEA stages, and the super-admins (Thibault, Vanessa, Sandrine).
   * `can_override_lock` is the super-admin flag on the role — the same one the
   * backend checks, so the two buttons appear exactly when the API accepts them.
   */
  const isAdminActor = role?.can_override_lock === true;
  const offersChoice = isAdminActor || EMEA_STAGES.has(status);

  const openRejectModal = () => { setRejectReason(''); setError(null); setRejectOpen(true); };
  const closeRejectModal = () => { if (busy === null) setRejectOpen(false); };

  const doApprove = async () => {
    setConfirmOpen(false);
    setBusy('approve'); setError(null);
    try {
      await api.post(`/loa/${loa.id}/approve`);
      onActionDone();
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || 'Submit failed');
    } finally { setBusy(null); }
  };

  const doReject = async (choice?: 'edit_myself' | 'return_to_marketer') => {
    if (!rejectReason.trim()) { setError('Please enter a reason.'); return; }
    setBusy('reject'); setError(null);
    try {
      await api.post(`/loa/${loa.id}/reject`, {
        reason: rejectReason.trim(),
        ...(choice ? { choice } : {}),
      });
      setRejectOpen(false);
      onActionDone();
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || 'Reject failed');
    } finally { setBusy(null); }
  };

  const currentStep  = currentIndex >= 0 ? STEPS[currentIndex] : null;
  const awaitingLabel = isApproved
    ? 'Approved'
    : isDraft
      ? 'Requestor is preparing'
      : (isRejected || isReturned)
        ? isReturned ? 'Returned — marketer must revise and resubmit' : 'Rejected — awaiting rework'
        : `Awaiting ${currentStep?.actor || 'reviewer'}`;

  // Banner text when a LOA arrives at emea_final_review as a result of CMO/CFO or Corporate rejection
  const rejectedByStageLabel = loa.rejected_by_stage ? STAGE_LABELS[loa.rejected_by_stage] : null;

  return (
    <section className="la-card" style={{ padding: '20px 22px', overflow: 'hidden' }}>
      {/* Top row */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        gap: 16, flexWrap: 'wrap', marginBottom: 18,
      }}>
        <div style={{ minWidth: 0 }}>
          <Overline style={{ marginBottom: 6 }}>Approval workflow</Overline>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <Pill status={loa.status} />
            <span style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>· {awaitingLabel}</span>
          </div>
        </div>

        {canAct && (
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <Btn variant="danger" small onClick={openRejectModal} disabled={busy !== null}>
              {busy === 'reject' ? 'Rejecting…' : 'Request changes'}
            </Btn>
            <Btn
              variant="primary" small
              onClick={() => { setError(null); setConfirmOpen(true); }}
              disabled={busy !== null}
            >
              {busy === 'approve' ? 'Submitting…' : 'Submit review'}
            </Btn>
          </div>
        )}

        {!canAct && !isApproved && !isDraft && !isRejected && !isReturned && (
          <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)', fontStyle: 'italic', paddingTop: 4 }}>
            You can't act at this step
          </span>
        )}
      </div>

      {error && !rejectOpen && (
        <div style={{
          marginBottom: 14, padding: '10px 12px',
          background: 'var(--st-rejected-bg)', color: 'var(--st-rejected-fg)',
          borderRadius: 8, fontSize: 12.5,
        }}>{error}</div>
      )}

      {/* Stepper */}
      <div style={{ display: 'flex', alignItems: 'flex-start', position: 'relative' }}>
        {STEPS.map((step, i) => {
          const isDone    = !isRejected && !isReturned && (i < currentIndex || isApproved);
          const isCurrent = !isRejected && !isReturned && !isApproved && i === currentIndex;
          const dotBg     = isDone || isCurrent ? 'var(--ink)' : 'var(--surface)';
          const dotFg     = isDone || isCurrent ? 'var(--ink-text)' : 'var(--text-tertiary)';
          const dotBorder = isDone || isCurrent ? 'var(--ink)' : 'var(--border-strong)';
          const lineBg    = isDone ? 'var(--ink)' : 'var(--border)';

          return (
            <div key={step.key} style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', position: 'relative', minWidth: 0,
            }}>
              {i > 0 && (
                <div style={{
                  position: 'absolute', top: 11, left: '-50%', right: '50%',
                  height: 2, background: lineBg, transition: 'background .3s ease',
                }} />
              )}
              <div style={{
                width: 22, height: 22, borderRadius: 999,
                background: dotBg, border: `2px solid ${dotBorder}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontWeight: 700, color: dotFg,
                position: 'relative', zIndex: 1,
                boxShadow: isCurrent ? '0 0 0 4px var(--gold-soft)' : 'none',
                transition: 'all .3s ease',
              }}>
                {isDone ? '✓' : ''}
              </div>
              <div style={{
                marginTop: 8, fontSize: 11, fontWeight: isCurrent ? 700 : 500,
                color: isCurrent ? 'var(--text-primary)' : isDone ? 'var(--text-secondary)' : 'var(--text-tertiary)',
                textAlign: 'center', letterSpacing: '.02em', lineHeight: 1.3, padding: '0 4px',
              }}>
                {step.label}
              </div>
              {isCurrent && (
                <div style={{ marginTop: 2, fontSize: 9.5, color: 'var(--gold)', fontFamily: 'var(--font-mono)', letterSpacing: '.05em' }}>
                  NOW
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Rejection / return banner */}
      {(isRejected || isReturned) && (
        <div style={{
          marginTop: 14, padding: '10px 14px',
          background: 'var(--st-rejected-bg)', color: 'var(--st-rejected-fg)',
          borderRadius: 8, fontSize: 12.5, fontWeight: 500,
        }}>
          {isReturned
            ? 'This LOA was returned by EMEA. Please address the feedback and resubmit.'
            : 'This LOA was rejected. Author must address feedback and resubmit.'}
          {loa.rejection_reason && (
            <div style={{ marginTop: 6, fontWeight: 400, fontStyle: 'italic', fontSize: 12 }}>
              "{loa.rejection_reason}"
            </div>
          )}
        </div>
      )}

      {/* Banner when LOA is at emea_final_review due to a CMO/CFO/Corporate rejection */}
      {status === 'emea_final_review' && rejectedByStageLabel && loa.rejection_reason && (
        <div style={{
          marginTop: 14, padding: '10px 14px',
          background: 'var(--st-rejected-bg)', color: 'var(--st-rejected-fg)',
          borderRadius: 8, fontSize: 12.5,
        }}>
          <strong>Rejected from {rejectedByStageLabel}:</strong>{' '}
          <span style={{ fontStyle: 'italic' }}>{loa.rejection_reason}</span>
        </div>
      )}

      {/* Approve confirmation modal */}
      {confirmOpen && (
        <div
          onClick={() => { if (busy === null) setConfirmOpen(false); }}
          style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
        >
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 14, padding: '26px 30px', maxWidth: 440, width: '100%', boxShadow: 'var(--shadow-lg)' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>Submit your review?</div>
            <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.55, marginBottom: 6 }}>
              Are you sure you want to submit your work?
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-tertiary)', lineHeight: 1.55 }}>
              The LOA moves forward only once every required reviewer at this stage has submitted.
            </div>
            {error && (
              <div style={{ marginTop: 12, padding: '8px 10px', background: 'var(--st-rejected-bg)', color: 'var(--st-rejected-fg)', borderRadius: 8, fontSize: 12 }}>{error}</div>
            )}
            <div style={{ marginTop: 22, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <Btn variant="secondary" small onClick={() => setConfirmOpen(false)} disabled={busy !== null}>Cancel</Btn>
              <Btn variant="primary" small onClick={doApprove} disabled={busy !== null}>
                {busy === 'approve' ? 'Submitting…' : 'Confirm & Submit'}
              </Btn>
            </div>
          </div>
        </div>
      )}

      {/* Reject modal */}
      {rejectOpen && (
        <div
          onClick={closeRejectModal}
          style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
        >
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 14, padding: '26px 30px', maxWidth: 480, width: '100%', boxShadow: 'var(--shadow-lg)' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
              Request changes
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.5 }}>
              {offersChoice
                ? 'Provide a reason, then choose whether to edit the LOA yourself or send it back to the local marketer.'
                : 'Provide a reason. The LOA will be sent back to EMEA for review.'}
            </div>

            <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, marginBottom: 6, color: 'var(--text-primary)' }}>
              Reason <span style={{ color: 'var(--st-rejected-fg)' }}>*</span>
            </label>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="What needs to be changed or corrected?"
              rows={4}
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '10px 12px', borderRadius: 8,
                border: '1.5px solid var(--border-strong)',
                background: 'var(--surface-raised)', color: 'var(--text-primary)',
                fontSize: 13, lineHeight: 1.55, resize: 'vertical',
                outline: 'none',
              }}
            />

            {error && (
              <div style={{ marginTop: 10, padding: '8px 10px', background: 'var(--st-rejected-bg)', color: 'var(--st-rejected-fg)', borderRadius: 8, fontSize: 12 }}>{error}</div>
            )}

            <div style={{ marginTop: 20, display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <Btn variant="secondary" small onClick={closeRejectModal} disabled={busy !== null}>
                Cancel
              </Btn>

              {offersChoice ? (
                <>
                  <Btn
                    variant="primary" small
                    onClick={() => doReject('edit_myself')}
                    disabled={busy !== null || !rejectReason.trim()}
                  >
                    {busy === 'reject' ? 'Saving…' : 'Edit & resolve'}
                  </Btn>
                  <Btn
                    variant="danger" small
                    onClick={() => doReject('return_to_marketer')}
                    disabled={busy !== null || !rejectReason.trim()}
                  >
                    {busy === 'reject' ? 'Sending…' : 'Send back to local marketer'}
                  </Btn>
                </>
              ) : (
                <Btn
                  variant="danger" small
                  onClick={() => doReject()}
                  disabled={busy !== null || !rejectReason.trim()}
                >
                  {busy === 'reject' ? 'Submitting…' : 'Submit rejection'}
                </Btn>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
