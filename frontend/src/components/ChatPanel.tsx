'use client'

import { useEffect, useState, useRef } from 'react'
import api from '@/lib/api'

interface Alert {
  severity: 'warning' | 'info'
  code: string
  message: string
}

interface ChatMessage {
  role: 'user' | 'laura'
  content: string
  sql?: string
}

export default function ChatPanel({ loaId }: { loaId?: string }) {
  console.log('🚨 CHATPANEL RENDERING, loaId=', loaId)
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'laura',
      content: loaId
        ? 'Hi! Loading observations about this LOA...'
        : 'Hi! Ask me about LOA history, budgets, or trends.',
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [alertsLoaded, setAlertsLoaded] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Load alerts ONCE on mount if loaId is provided
  useEffect(() => {
    if (!loaId || alertsLoaded) return
    setAlertsLoaded(true)
    ;(async () => {
      try {
        const resp = await api.get(`/loa/${loaId}/chat/alerts`)
        const alerts: Alert[] = resp.data?.alerts || []
        if (alerts.length > 0) {
          const lines = alerts.map(a => {
            const icon = a.severity === 'warning' ? '\u26A0' : '\u2139'
            return `${icon} ${a.message}`
          }).join('\n\n')
          setMessages([{
            role: 'laura',
            content: `${alerts.length} observation${alerts.length > 1 ? 's' : ''} about this LOA:\n\n${lines}`,
          }])
        } else {
          setMessages([{
            role: 'laura',
            content: 'No observations. Ask me anything about LOA history!',
          }])
        }
      } catch (err: any) {
        if (err?.response?.status === 403) {
          setMessages([{
            role: 'laura',
            content: 'Chat is available to reviewers and admins only.',
          }])
        } else {
          setMessages([{
            role: 'laura',
            content: 'Hi! Ask me anything about LOA history, budgets, or trends.',
          }])
        }
      }
    })()
  }, [loaId, alertsLoaded])

  const handleSend = async () => {
    const msg = input.trim()
    if (!msg || loading) return

    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: msg }])
    setLoading(true)

    try {
      const endpoint = loaId ? `/loa/${loaId}/chat/ask` : `/chat/ask`
      const resp = await api.post(endpoint, { message: msg })
      setMessages(prev => [...prev, {
        role: 'laura',
        content: resp.data?.answer || 'No response',
        sql: resp.data?.sql,
      }])
    } catch (err: any) {
      const detail = err?.response?.data?.detail || 'Something went wrong'
      setMessages(prev => [...prev, {
        role: 'laura',
        content: typeof detail === 'string' ? detail : 'Error processing request',
      }])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div style={{
      background: '#FAFAFA',
      border: '2px solid #1E40AF',
      borderRadius: '12px',
      padding: '0',
      marginBottom: '20px',
      height: '450px',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px',
        background: '#1E40AF',
        color: 'white',
        fontWeight: 600,
        fontSize: '14px',
      }}>
        {'\uD83D\uDCAC'} Ask LAURA
      </div>

      {/* Messages */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '12px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        background: 'white',
      }}>
        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
              background: m.role === 'user' ? '#1E40AF' : '#F3F4F6',
              color: m.role === 'user' ? 'white' : '#111',
              padding: '8px 14px',
              borderRadius: '12px',
              maxWidth: '85%',
              fontSize: '13px',
              lineHeight: '1.5',
              whiteSpace: 'pre-wrap',
            }}
          >
            {m.role === 'laura' && (
              <div style={{
                fontSize: '10px',
                fontWeight: 700,
                color: '#6B7280',
                marginBottom: '4px',
              }}>LAURA</div>
            )}
            {m.content}
            {m.sql && (
              <details style={{ marginTop: '6px' }}>
                <summary style={{ fontSize: '10px', cursor: 'pointer', color: '#6B7280' }}>
                  View SQL
                </summary>
                <pre style={{
                  fontSize: '10px',
                  background: '#F9FAFB',
                  padding: '6px',
                  borderRadius: '4px',
                  marginTop: '4px',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                }}>{m.sql}</pre>
              </details>
            )}
          </div>
        ))}
        {loading && (
          <div style={{
            alignSelf: 'flex-start',
            background: '#F3F4F6',
            padding: '8px 14px',
            borderRadius: '12px',
            fontSize: '13px',
            color: '#9CA3AF',
            fontStyle: 'italic',
          }}>
            LAURA is thinking...
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: '10px 12px',
        borderTop: '1px solid #E5E7EB',
        background: 'white',
        display: 'flex',
        gap: '8px',
      }}>
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask anything... (e.g. 'average budget for Events in Italy')"
          disabled={loading}
          style={{
            flex: 1,
            border: '1px solid #D1D5DB',
            borderRadius: '8px',
            padding: '8px 12px',
            fontSize: '13px',
            outline: 'none',
            color: '#111',
          }}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || loading}
          style={{
            background: '#1E40AF',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            padding: '0 16px',
            fontSize: '13px',
            fontWeight: 500,
            cursor: 'pointer',
            opacity: (!input.trim() || loading) ? 0.5 : 1,
          }}
        >
          Send
        </button>
      </div>
    </div>
  )
}
