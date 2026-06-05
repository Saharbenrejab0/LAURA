'use client'

import { useState, useRef, useEffect } from 'react'

interface VoiceInputProps {
  onResult: (text: string) => void
  disabled?: boolean
}

export default function VoiceInput({ onResult, disabled }: VoiceInputProps) {
  const [listening, setListening]   = useState(false)
  const [supported, setSupported]   = useState(false)
  const [dots, setDots]             = useState(0)
  const recogRef = useRef<any>(null)

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    setSupported(!!SR)
  }, [])

  useEffect(() => {
    if (!listening) return
    const id = setInterval(() => setDots(d => (d + 1) % 4), 350)
    return () => clearInterval(id)
  }, [listening])

  function toggle() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) return

    if (listening) {
      recogRef.current?.stop()
      setListening(false)
      return
    }

    const recog = new SR()
    recog.lang = 'en-US'          // EL templates are in English
    recog.continuous = false
    recog.interimResults = false
    recog.maxAlternatives = 1

    recog.onstart = () => setListening(true)

    recog.onresult = (e: any) => {
      const transcript = Array.from(e.results)
        .map((r: any) => r[0].transcript)
        .join(' ')
        .trim()
      if (transcript) onResult(transcript)
    }

    recog.onspeechend = () => recog.stop()
    recog.onend = () => setListening(false)
    recog.onerror = (e: any) => {
      console.warn('Speech recognition error:', e.error)
      setListening(false)
    }

    try {
      recog.start()
      recogRef.current = recog
    } catch (e) {
      setListening(false)
    }
  }

  if (!supported) return null

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={disabled}
      title={listening ? 'Stop recording (click or wait)' : 'Dictate in English'}
      className={listening ? 'recording' : ''}
      style={{
        width: '30px',
        height: '30px',
        borderRadius: '8px',
        border: `1.5px solid ${listening ? 'var(--red)' : 'var(--border-strong)'}`,
        background: listening ? 'var(--red-bg)' : 'var(--bg-elevated)',
        color: listening ? 'var(--red-text)' : 'var(--text-muted)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: disabled ? 'not-allowed' : 'pointer',
        flexShrink: 0,
        transition: 'all 0.15s',
        padding: 0,
      }}
    >
      {listening ? (
        <span style={{ fontSize: '8px', letterSpacing: '1px', fontWeight: 700 }}>
          {'●'.repeat(dots + 1)}{'○'.repeat(3 - dots)}
        </span>
      ) : (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <rect x="5" y="1" width="4" height="7" rx="2" fill="currentColor"/>
          <path d="M2 7C2 9.76 4.24 12 7 12s5-2.24 5-5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" fill="none"/>
          <line x1="7" y1="12" x2="7" y2="13.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
        </svg>
      )}
    </button>
  )
}
