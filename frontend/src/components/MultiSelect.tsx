'use client'

import { useState, useRef, useEffect } from 'react'

interface MultiSelectProps {
  options: string[]
  values: string[]
  onChange: (values: string[]) => void
  placeholder?: string
}

export default function MultiSelect({ options, values, onChange, placeholder = 'Select…' }: MultiSelectProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  function toggle(opt: string) {
    if (values.includes(opt)) onChange(values.filter(v => v !== opt))
    else onChange([...values, opt])
  }

  function removePill(opt: string, e: React.MouseEvent) {
    e.stopPropagation()
    onChange(values.filter(v => v !== opt))
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div className="input cursor-pointer flex flex-wrap items-center gap-1.5"
        onClick={() => setOpen(o => !o)}
        style={{ minHeight: '38px', padding: '6px 10px' }}>
        {values.length === 0 && (
          <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{placeholder}</span>
        )}
        {values.map(v => (
          <span key={v}
            className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-md"
            style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>
            {v}
            <button type="button" onClick={e => removePill(v, e)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px', color: 'var(--text-muted)' }}>
              ×
            </button>
          </span>
        ))}
        <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
          {open ? '▴' : '▾'}
        </span>
      </div>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
          background: 'var(--bg-surface)', border: '1px solid var(--border-strong)',
          borderRadius: '0 0 10px 10px', boxShadow: 'var(--shadow-md)',
          maxHeight: '220px', overflow: 'auto', marginTop: '2px',
        }}>
          {options.map(opt => {
            const selected = values.includes(opt)
            return (
              <div key={opt} onClick={() => toggle(opt)}
                className="px-3 py-2 cursor-pointer text-sm flex items-center gap-2"
                style={{
                  background: selected ? 'var(--bg-elevated)' : 'transparent',
                  color: 'var(--text-primary)',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-elevated)')}
                onMouseLeave={e => (e.currentTarget.style.background = selected ? 'var(--bg-elevated)' : 'transparent')}>
                <span style={{
                  display: 'inline-block', width: '14px', height: '14px',
                  border: `2px solid ${selected ? 'var(--accent)' : 'var(--border-strong)'}`,
                  borderRadius: '3px', background: selected ? 'var(--accent)' : 'transparent',
                  color: 'white', fontSize: '10px', lineHeight: '12px', textAlign: 'center',
                }}>{selected ? '✓' : ''}</span>
                {opt}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}