'use client'

/**
 * Shared primitives for the LOA reviewer detail page.
 * Self-contained (no token import) so it can't break on alias resolution —
 * the page passes its own colors in via the `color` prop.
 */

import React from 'react'

export function Icon({
  d,
  size = 18,
  color = '#666666',
  style: s,
  ...props
}: {
  d: string | React.ReactNode
  size?: number
  color?: string
  style?: React.CSSProperties
  [key: string]: any
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={s}
      {...props}
    >
      {typeof d === 'string' ? <path d={d} /> : d}
    </svg>
  )
}

export const ic = {
  back: 'M15 18l-6-6 6-6',
  check: 'M20 6L9 17l-5-5',
  chevL: 'M15 18l-6-6 6-6',
  chevR: 'M9 18l6-6-6-6',
  extLink: (
    <>
      <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </>
  ),
  user: (
    <>
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </>
  ),
}

export function LoaNav({
  current,
  total,
  onPrev,
  onNext,
  gold = '#c9a84c',
  border = '#2a2a2a',
  text2 = '#aaaaaa',
  text3 = '#666666',
}: {
  current: number
  total: number
  onPrev: () => void
  onNext: () => void
  gold?: string
  border?: string
  text2?: string
  text3?: string
}) {
  const atStart = current === 0
  const atEnd = current === total - 1
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <button
        onClick={onPrev}
        disabled={atStart}
        aria-label="Previous LOA"
        style={{
          width: 34, height: 34, borderRadius: 8,
          border: `1px solid ${atStart ? border : gold + '44'}`,
          background: 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: atStart ? 'default' : 'pointer', opacity: atStart ? 0.3 : 1,
        }}
      >
        <Icon d={ic.chevL} size={16} color={atStart ? text3 : gold} />
      </button>
      <span style={{ fontSize: 12, color: text2, minWidth: 48, textAlign: 'center', fontWeight: 500 }}>
        {current + 1} / {total}
      </span>
      <button
        onClick={onNext}
        disabled={atEnd}
        aria-label="Next LOA"
        style={{
          width: 34, height: 34, borderRadius: 8,
          border: `1px solid ${atEnd ? border : gold + '44'}`,
          background: 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: atEnd ? 'default' : 'pointer', opacity: atEnd ? 0.3 : 1,
        }}
      >
        <Icon d={ic.chevR} size={16} color={atEnd ? text3 : gold} />
      </button>
    </div>
  )
}
