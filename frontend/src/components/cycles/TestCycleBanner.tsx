'use client'
/**
 * TestCycleBanner — warns that the current cycle is throwaway data, and gives
 * admins the one-click way to remove it before go-live.
 *
 * Deletion is destructive and irreversible, so it takes an explicit typed
 * confirmation. The backend refuses anything not flagged is_test, so the worst
 * a mis-click can do is destroy exercise data.
 */
import { useState } from 'react'
import type { Cycle } from '@/lib/cycles-api'
import { deleteTestCycle } from '@/lib/cycles-api'

const FONT = "Inter, ui-sans-serif, system-ui, sans-serif"
const RED = '#8A2E27'

interface Props {
  cycle: Pick<Cycle, 'id' | 'name' | 'totalLoas'>
  canDelete: boolean
  onDeleted?: () => void
}

export default function TestCycleBanner({ cycle, canDelete, onDeleted }: Props) {
  const [confirming, setConfirming] = useState(false)
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const remove = async () => {
    setBusy(true)
    setError(null)
    try {
      await deleteTestCycle(cycle.id)
      setConfirming(false)
      onDeleted?.()
    } catch (err) {
      const e = err as { response?: { data?: { detail?: string } } }
      setError(e?.response?.data?.detail || 'Could not delete the cycle.')
    }
    setBusy(false)
  }

  return (
    <>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
        padding: '11px 16px', marginBottom: 12,
        borderRadius: 10, border: '1px solid #E9C4BE', borderLeft: `4px solid ${RED}`,
        background: '#FBE9E7', fontFamily: FONT,
      }}>
        <span aria-hidden style={{ fontSize: 14 }}>⚠</span>
        <div style={{ flex: 1, minWidth: 220 }}>
          <strong style={{ fontSize: 13, color: RED, letterSpacing: '.03em' }}>
            TEST CYCLE — will be deleted before go-live
          </strong>
          <div style={{ fontSize: 12, color: '#7A4640', marginTop: 2 }}>
            &ldquo;{cycle.name}&rdquo; holds {cycle.totalLoas} exercise LOA
            {cycle.totalLoas === 1 ? '' : 's'}. Nothing here is a real submission.
          </div>
        </div>
        {canDelete && (
          <button
            onClick={() => { setConfirming(true); setTyped(''); setError(null) }}
            style={{
              fontSize: 12, fontWeight: 600, fontFamily: FONT,
              color: '#fff', background: RED, border: 'none',
              borderRadius: 8, padding: '8px 14px', cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            Delete test cycle
          </button>
        )}
      </div>

      {confirming && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 400,
          background: 'rgba(10,10,10,.42)', backdropFilter: 'blur(2px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT,
        }}>
          <div style={{
            width: 520, background: '#fff', borderRadius: 16,
            boxShadow: '0 24px 64px rgba(10,10,10,.24)', padding: '26px 26px 22px',
            display: 'flex', flexDirection: 'column', gap: 16,
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{
                fontSize: 10, fontWeight: 600, letterSpacing: '.14em',
                textTransform: 'uppercase', color: RED,
              }}>
                Delete test cycle
              </span>
              <span style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-.01em' }}>
                Delete &ldquo;{cycle.name}&rdquo;?
              </span>
              <span style={{ fontSize: 12.5, color: '#5A554F', lineHeight: 1.55 }}>
                This permanently removes the cycle and its <strong>{cycle.totalLoas}</strong> LOAs,
                plus every verdict, comment and photo attached to them.
                Historical and demo data are untouched. This cannot be undone.
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ fontSize: 11.5, fontWeight: 600 }}>
                Type <code style={{ background: '#F2F0EC', padding: '1px 5px', borderRadius: 4 }}>DELETE</code> to confirm
              </span>
              <input
                autoFocus
                value={typed}
                onChange={e => setTyped(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && typed === 'DELETE' && !busy) remove() }}
                style={{
                  border: '1px solid #0A0A0A', borderRadius: 10, padding: '11px 13px',
                  fontSize: 13, fontFamily: FONT, outline: 'none',
                }}
              />
              {error && <span style={{ fontSize: 11.5, color: RED }}>{error}</span>}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                onClick={() => setConfirming(false)}
                disabled={busy}
                style={{
                  fontSize: 12.5, fontWeight: 500, fontFamily: FONT, color: '#5A554F',
                  border: '1px solid #E0DED9', background: '#fff',
                  borderRadius: 8, padding: '10px 18px', cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={remove}
                disabled={typed !== 'DELETE' || busy}
                style={{
                  fontSize: 12.5, fontWeight: 600, fontFamily: FONT,
                  color: '#fff', background: typed === 'DELETE' && !busy ? RED : '#D9C4C1',
                  border: 'none', borderRadius: 8, padding: '10px 20px',
                  cursor: typed === 'DELETE' && !busy ? 'pointer' : 'default',
                }}
              >
                {busy ? 'Deleting…' : 'Delete permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
