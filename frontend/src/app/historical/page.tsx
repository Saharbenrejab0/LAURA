'use client'
/**
 * Historical Campaigns — the client's pre-LAURA records, as a grid.
 *
 * These rows came out of the client's own spreadsheets (~2.6k of them). They
 * belong to no cycle and were never reviewed here, so presenting them as a deck
 * misrepresented what they are: a deck implies one slide per decision, and there
 * are no decisions on this data. It is a spreadsheet, so it reads as one.
 *
 * Built on the CFO spreadsheet components — the same grid, frozen headers,
 * filters and category/activity grouping the CFO uses — in read-only mode
 * (`readOnly`, which feeds CFOSpreadsheet's existing post-submit lock, and
 * `cycleId={null}`, which means there is no cycle to record a verdict against).
 *
 * The deck view is removed, not hidden. If PPT decks are added to the database
 * later, a deck view can be added ALONGSIDE this grid — hence the batch selector
 * and the provenance banner staying view-agnostic. That is not built now.
 *
 * Distinct from Past Cycles (closed *live* review periods) and from Past
 * Campaigns (the template picker used when creating a new LOA).
 */
import { useEffect, useState } from 'react'
import type { ImportBatch, HistoricalRow } from '@/lib/historical-api'
import {
  fetchImportBatches, fetchHistoricalGrid, downloadHistoricalExcel,
} from '@/lib/historical-api'
import { formatBudget } from '@/lib/euro'
import CFOSpreadsheet from '@/components/cfo/CFOSpreadsheet'

export default function HistoricalPage() {
  const [batches, setBatches] = useState<ImportBatch[]>([])
  const [batchId, setBatchId] = useState<string>('')      // '' = all
  const [rows, setRows] = useState<HistoricalRow[]>([])
  const [totalBudget, setTotalBudget] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchImportBatches().then(setBatches).catch(() => setBatches([]))
  }, [])

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError(null)

    fetchHistoricalGrid(batchId || undefined)
      .then(d => {
        if (!alive) return
        setRows(d.rows)
        setTotalBudget(d.totalBudget)
      })
      .catch(err => {
        if (alive) setError(err?.response?.data?.detail || 'Could not load historical data.')
      })
      .finally(() => { if (alive) setLoading(false) })

    return () => { alive = false }
  }, [batchId])

  const activeBatch = batches.find(b => b.id === batchId)
  const label = activeBatch?.label || 'All historical data'

  return (
    <div className="la-hist">
      <header className="la-hist-head">
        <div>
          <p className="la-hist-over">Archive</p>
          <h1 className="la-hist-title">Historical Campaigns</h1>
          <p className="la-hist-blurb">
            Campaign records imported from the client&rsquo;s own files. They sit outside the
            review cycles and cannot be edited or decided on here.
          </p>
        </div>

        <div className="la-hist-actions">
          <label className="la-sr-only" htmlFor="la-hist-batch">Import batch</label>
          <select
            id="la-hist-batch"
            value={batchId}
            onChange={e => setBatchId(e.target.value)}
            className="la-hist-select"
          >
            <option value="">All historical data</option>
            {batches.map(b => (
              <option key={b.id} value={b.id}>{b.label} · {b.rowCount}</option>
            ))}
          </select>

          <button
            onClick={() => downloadHistoricalExcel(batchId || undefined, `${label}.xlsx`)}
            className="la-hist-download"
          >
            Download .xlsx
          </button>
        </div>
      </header>

      <div className="la-hist-banner">
        <span aria-hidden="true">🗄</span>
        <span>
          <strong>Historical data</strong> — imported from client records.
          Not part of an active review cycle.
        </span>
        <span className="la-hist-stats">
          <span><strong>{rows.length}</strong> LOAs</span>
          <span><strong>{formatBudget(totalBudget)}</strong></span>
          {activeBatch?.importedAt && (
            <span>Imported {new Date(activeBatch.importedAt).toLocaleDateString('en-GB', {
              day: 'numeric', month: 'short', year: 'numeric',
            })}</span>
          )}
        </span>
      </div>

      {error ? (
        <p className="la-hist-msg" role="alert">{error}</p>
      ) : loading ? (
        <p className="la-hist-msg">Loading historical campaigns…</p>
      ) : rows.length === 0 ? (
        <p className="la-hist-msg">No historical LOAs in this batch.</p>
      ) : (
        /* cycleId={null} + readOnly: nothing here is decidable, so the grid
           renders in exactly the locked state it uses after a review is
           submitted. No approve, no reject, no submit. */
        <div className="la-hist-grid">
          <CFOSpreadsheet
            loas={rows}
            cycleId={null}
            cycleName={label}
            readOnly
          />
        </div>
      )}
    </div>
  )
}
