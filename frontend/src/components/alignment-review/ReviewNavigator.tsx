'use client'

interface Props {
  current: number
  total: number
  onPrev: () => void
  onNext: () => void
}

export default function ReviewNavigator({ current, total, onPrev, onNext }: Props) {
  if (total === 0) return null
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <button
        onClick={onPrev}
        disabled={current <= 1}
        style={{
          background: 'none', border: '1px solid #D9D2C8', borderRadius: 4,
          width: 28, height: 28, cursor: current <= 1 ? 'default' : 'pointer',
          fontSize: 14, color: current <= 1 ? '#ccc' : '#444',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        ‹
      </button>
      <span style={{ fontSize: 12, color: '#666', whiteSpace: 'nowrap' }}>
        LOA <strong style={{ color: '#111' }}>{current}</strong> of <strong style={{ color: '#111' }}>{total}</strong>
      </span>
      <button
        onClick={onNext}
        disabled={current >= total}
        style={{
          background: 'none', border: '1px solid #D9D2C8', borderRadius: 4,
          width: 28, height: 28, cursor: current >= total ? 'default' : 'pointer',
          fontSize: 14, color: current >= total ? '#ccc' : '#444',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        ›
      </button>
    </div>
  )
}
