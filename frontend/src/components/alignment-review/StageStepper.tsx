'use client'
/**
 * StageStepper — where this LOA sits in the real approval chain.
 *
 * The chain comes from buildChain(), which derives it from WORKFLOW_ORDER. There
 * is no stage array in this file: when the backend chain changes, this follows.
 *
 * It used to show four steps — the three local-alignment sub-gates plus a
 * hardcoded "CMO / CFO Review" — which told a reviewer the LOA was finished once
 * CMO and CFO signed. It is not: EMEA reviews three separate times and Corporate
 * Finance validates last. That gap is why this renders all seven gates plus the
 * approved end marker.
 *
 * Fitting eight where four used to go: a sliding window of three carries full
 * labels — the gate just cleared, the gate in progress, and the gate next up.
 * That is the context a reviewer actually needs: where it came from and where it
 * goes. The window moves with the LOA. Every other gate is a compact numbered
 * circle whose full name is a tooltip, and the rail scrolls to keep the active
 * gate in view.
 */
import { useEffect, useRef } from 'react'
import { buildChain, chainStatusLabel, isOffChain } from '@/lib/workflow'
import { ALIGNMENT_STAGES, ALIGNMENT_STAGE_LABELS } from '@/types/review'
import type { AlignmentStage, LOAReviewStageRecord } from '@/types/review'

interface Props {
  stages: Partial<Record<AlignmentStage, LOAReviewStageRecord>>
  currentStage: AlignmentStage | null
  /** Role code of the viewer — marks their own step as "You are here". */
  viewerRole?: string
  /** The viewer's stage, which may be an admin acting on someone else's queue. */
  viewerStage?: AlignmentStage | null
  allApproved: boolean
  commentCount: number
  drawerOpen: boolean
  onToggleDrawer: () => void
  readOnly: boolean
  /** The LOA's real workflow status — what drives the position on the chain. */
  loaStatus: string
}

function shortDate(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' })
}

const GOLD = '#C9A678'
const GREEN = '#1D6B45'

export default function StageStepper({
  stages, currentStage, viewerStage, allApproved,
  commentCount, drawerOpen, onToggleDrawer, readOnly, loaStatus,
}: Props) {
  const chain = buildChain(loaStatus)
  const offChain = isOffChain(loaStatus)
  // Anchor for the n-1 / n / n+1 label window. -1 when the LOA is off-chain.
  const activeIdx = offChain ? -1 : chain.findIndex(s => s.current)
  const railRef = useRef<HTMLDivElement>(null)
  const activeRef = useRef<HTMLDivElement>(null)

  // Keep the active gate visible as the LOA advances — with eight gates the
  // later ones sit off-screen on a laptop.
  useEffect(() => {
    const el = activeRef.current
    if (!el || !railRef.current) return
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }, [loaStatus])

  /**
   * Who signed off, for the gates that record it. Only local_alignment keeps
   * per-approver rows, so only it can show a name — inventing a record for the
   * others would read as data that does not exist.
   */
  const alignmentRecord = (): string | undefined => {
    const done = ALIGNMENT_STAGES.map(s => stages[s]).filter(r => r?.status === 'approved')
    if (done.length === 0) return undefined
    if (done.length < ALIGNMENT_STAGES.length) return `${done.length}/${ALIGNMENT_STAGES.length} approved`
    const last = done[done.length - 1]
    return [last?.approvedByName, shortDate(last?.approvedAt)].filter(Boolean).join(' · ') || 'approved'
  }

  const statusLine = chainStatusLabel(loaStatus)
  const hereNote = offChain
    ? statusLine
    : readOnly
      ? statusLine
      : viewerStage && viewerStage === currentStage
        ? `${statusLine} · you are here`
        : statusLine

  return (
    <div style={{
      minHeight: 48, flexShrink: 0, background: 'var(--surface)',
      borderBottom: '1px solid var(--border)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '5px 22px', gap: 14,
    }}>
      <div
        ref={railRef}
        style={{ display: 'flex', alignItems: 'center', gap: 3, minWidth: 0, overflowX: 'auto', scrollbarWidth: 'thin' }}
      >
        {chain.map((st, i) => {
          // A returned or rejected LOA has left the chain: nothing is current,
          // and every gate reads as pending because it starts over.
          const done = !offChain && st.done
          const current = !offChain && st.current
          // The n-1 / n / n+1 window. Neighbours are labelled but muted, so the
          // active gate still reads as the one you are on.
          const neighbour = activeIdx >= 0 && Math.abs(i - activeIdx) === 1
          const showLabel = current || neighbour
          const record = st.key === 'local_alignment' && !current ? alignmentRecord() : undefined
          const tip = `${st.index ? `${st.index}. ` : ''}${st.label}${
            done ? ' — complete' : current ? ' — in progress' : st.terminal ? '' : ' — pending'}`

          return (
            <div
              key={st.key}
              ref={current ? activeRef : undefined}
              style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}
            >
              <span
                title={tip}
                aria-label={tip}
                aria-current={current ? 'step' : undefined}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: current ? '#FAF5EA' : done ? '#F4F7F4' : 'transparent',
                  border: `1px solid ${current ? '#E8D9B8' : done ? '#DCE6DC' : 'transparent'}`,
                  borderRadius: 99,
                  padding: showLabel ? '4px 11px 4px 5px' : '4px 5px',
                }}
              >
                <span style={{
                  width: 18, height: 18, borderRadius: 99, flexShrink: 0,
                  background: done ? GREEN : current ? GOLD : 'var(--surface)',
                  border: `1px solid ${done ? GREEN : current ? GOLD : 'var(--border)'}`,
                  color: done || current ? 'var(--surface)' : 'var(--text-faint)',
                  fontSize: st.terminal && !done ? 9 : 8.5, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {done ? '✓' : st.terminal ? '✓' : st.index}
                </span>

                {/* Labelled window: the gate just cleared, the one in progress,
                    and the one next up. Everything else relies on the tooltip. */}
                {showLabel && (
                  <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.25 }}>
                    <span style={{
                      fontSize: current ? 11 : 10.5,
                      fontWeight: current ? 600 : 500,
                      color: current
                        ? 'var(--text-primary)'
                        : done ? 'var(--text-secondary)' : 'var(--text-tertiary)',
                      letterSpacing: '.01em', whiteSpace: 'nowrap',
                    }}>
                      {st.label}
                    </span>
                    {record && (
                      <span style={{ fontSize: 9, color: '#7C9A87', whiteSpace: 'nowrap' }}>
                        {record}
                      </span>
                    )}
                  </span>
                )}
                {!showLabel && record && (
                  <span style={{ fontSize: 9, color: '#7C9A87', whiteSpace: 'nowrap', paddingRight: 4 }}>
                    {record}
                  </span>
                )}
              </span>

              {i < chain.length - 1 && (
                <span style={{
                  width: 10, height: 1, flexShrink: 0,
                  background: done ? '#DCE6DC' : 'var(--border)',
                }} />
              )}
            </div>
          )
        })}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <span style={{
          fontSize: 11, whiteSpace: 'nowrap',
          fontWeight: offChain ? 600 : 400,
          color: offChain ? 'var(--danger)' : 'var(--text-tertiary)',
          background: offChain ? 'var(--danger-soft)' : 'transparent',
          border: offChain ? '1px solid var(--danger-border)' : '1px solid transparent',
          borderRadius: 7, padding: offChain ? '4px 9px' : '4px 0',
        }}>
          {offChain ? '⚠ ' : ''}{allApproved && !offChain ? statusLine : hereNote}
        </span>
        <button
          onClick={onToggleDrawer}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            fontSize: 11.5, fontWeight: 500, color: 'var(--text-secondary)',
            border: `1px solid ${drawerOpen ? 'var(--text-primary)' : 'var(--border)'}`,
            background: drawerOpen ? 'var(--surface-sunken)' : 'var(--surface)',
            borderRadius: 8, padding: '7px 12px', cursor: 'pointer', whiteSpace: 'nowrap',
          }}
        >
          💬 All comments
          {commentCount > 0 && (
            <span style={{
              fontFamily: "'IBM Plex Mono', ui-monospace, monospace",
              fontSize: 10.5, color: '#8A6A3F',
              background: '#FAF5EA', border: '1px solid #C9A678',
              borderRadius: 99, padding: '1px 6px',
            }}>
              {commentCount}
            </span>
          )}
        </button>
      </div>
    </div>
  )
}
