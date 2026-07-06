'use client';

/**
 * LauraChat — redesigned workspace.
 *
 * Two modes:
 *   - Laura Intelligence: global chat, all historical LOAs
 *   - Laura Lens:         LOA-scoped chat, current LOA + historical context
 *
 * Sidebar splits sessions by scope, not just by time:
 *   - CURRENT LOA (only when on /loa/{id})
 *   - GLOBAL INTELLIGENCE
 *   - OTHER LOAS (collapsed by default when on a LOA)
 *
 * Design system:
 *   - Champagne #C9A678 for context/brand moments only (not decoration)
 *   - DM Sans body, Cormorant Garamond for headline empty states
 *   - Light/dark aware
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useLaura, LauraSession, LauraMessage, LauraSource } from './LauraProvider';
import LauraToolButtons from './LauraToolButtons';

const CHAMPAGNE = '#C9A678';
const CHAMPAGNE_DEEP = '#8A6A3F';
const CHAMPAGNE_MIST = 'var(--laura-champagne-mist, #FAF5EA)';
const CHAMPAGNE_BORDER = 'var(--laura-champagne-border, #E8D9B8)';

/* ═══════════════════════════════════════════════════════════════
   Root
   ═══════════════════════════════════════════════════════════════ */

export default function LauraChat() {
  const pathname = usePathname();
  const {
    isOpen, closeChat, sessions, currentSession, currentSessionId,
    newChat, selectSession, deleteSession, sendMessage, isSending,
    loaContextId,
  } = useLaura();

  const [voiceModeOpen, setVoiceModeOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (voiceModeOpen) setVoiceModeOpen(false);
        else closeChat();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, voiceModeOpen, closeChat]);

  if (pathname?.startsWith('/login')) return null;

  return (
    <>
      <div
        onClick={closeChat}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(10, 10, 10, 0.18)',
          zIndex: 1000,
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'all' : 'none',
          transition: 'opacity 160ms cubic-bezier(0.2, 0, 0, 1)',
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Laura"
        style={{
          position: 'fixed',
          top: 0, right: 0, bottom: 0,
          width: 'min(640px, 96vw)',
          height: '100vh',
          background: 'var(--surface-raised, #FFFFFF)',
          borderLeft: '1px solid var(--border, #E4DFD5)',
          boxShadow: '-16px 0 48px rgba(10, 10, 10, 0.16)',
          zIndex: 1001,
          overflow: 'hidden',
          display: 'grid',
          gridTemplateColumns: '196px 1fr',
          transform: `translateX(${isOpen ? '0' : '24px'})`,
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'all' : 'none',
          transition: 'transform 220ms cubic-bezier(0.2, 0, 0, 1), opacity 220ms cubic-bezier(0.2, 0, 0, 1)',
        }}
      >
        <Sidebar
          sessions={sessions}
          currentSessionId={currentSessionId}
          onNewChat={newChat}
          onSelectSession={selectSession}
          onDeleteSession={deleteSession}
          loaContextId={loaContextId}
        />
        <ConversationPane
          session={currentSession}
          isSending={isSending}
          loaContextId={loaContextId}
          onSend={sendMessage}
          onClose={closeChat}
          onVoiceClick={() => setVoiceModeOpen(true)}
        />
      </div>
      <VoiceModeStub isOpen={voiceModeOpen} onClose={() => setVoiceModeOpen(false)} />
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Sidebar — split by scope, not just time
   ═══════════════════════════════════════════════════════════════ */

interface GroupedSessions {
  currentLoa: LauraSession[];
  global: LauraSession[];
  otherLoas: LauraSession[];
}

function groupSessionsByScope(
  sessions: LauraSession[],
  loaContextId: string | undefined,
): GroupedSessions {
  const currentLoa: LauraSession[] = [];
  const global: LauraSession[] = [];
  const otherLoas: LauraSession[] = [];

  const sorted = sessions.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  for (const s of sorted) {
    if (!s.loaContextId) {
      global.push(s);
    } else if (loaContextId && s.loaContextId === loaContextId) {
      currentLoa.push(s);
    } else {
      otherLoas.push(s);
    }
  }
  return { currentLoa, global, otherLoas };
}

function Sidebar({
  sessions, currentSessionId, onNewChat, onSelectSession, onDeleteSession, loaContextId,
}: {
  sessions: LauraSession[];
  currentSessionId: string | null;
  onNewChat: () => void;
  onSelectSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  loaContextId: string | undefined;
}) {
  const [search, setSearch] = useState('');
  const [otherOpen, setOtherOpen] = useState(false);

  const grouped = useMemo(() => groupSessionsByScope(sessions, loaContextId), [sessions, loaContextId]);

  const filter = (list: LauraSession[]) => {
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(s =>
      s.title.toLowerCase().includes(q) ||
      (s.loaLabel || '').toLowerCase().includes(q) ||
      s.messages.some(m => m.content.toLowerCase().includes(q))
    );
  };

  const currentLoaFiltered = filter(grouped.currentLoa);
  const globalFiltered = filter(grouped.global);
  const otherLoasFiltered = filter(grouped.otherLoas);

  return (
    <aside style={{
      borderRight: '1px solid var(--laura-border-soft, #E6E1D8)',
      background: 'var(--laura-bg-subtle, #F7F6F3)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 16px 10px',
        display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          fontSize: 13, fontWeight: 600,
          color: 'var(--laura-text-primary, #0A0A0A)',
          letterSpacing: '0.02em',
        }}>
          <span style={{ color: CHAMPAGNE, fontSize: 12 }}>◆</span>
          <span>LAURA</span>
          <span style={{
            fontSize: 10,
            fontWeight: 500,
            color: 'var(--laura-text-tertiary, #6F6A62)',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}>
            {loaContextId ? 'Lens' : 'Intelligence'}
          </span>
        </div>
      </div>

      <NewChatButton onClick={onNewChat} />

      <SessionSearch value={search} onChange={setSearch} />

      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 8px 16px' }}>
        {loaContextId && (
          <SessionGroup
            label="Current LOA"
            emphasis
            sessions={currentLoaFiltered}
            currentId={currentSessionId}
            onSelect={onSelectSession}
            onDelete={onDeleteSession}
            emptyLabel="No conversations yet on this LOA."
          />
        )}
        <SessionGroup
          label="Global Intelligence"
          sessions={globalFiltered}
          currentId={currentSessionId}
          onSelect={onSelectSession}
          onDelete={onDeleteSession}
          emptyLabel="No global conversations yet."
        />
        {otherLoasFiltered.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <button
              onClick={() => setOtherOpen(v => !v)}
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 12px 6px',
                cursor: 'pointer',
                fontSize: 10,
                color: 'var(--laura-text-tertiary, #6F6A62)',
                letterSpacing: '0.06em',
                fontWeight: 600,
                textTransform: 'uppercase',
                fontFamily: 'inherit',
              }}
            >
              <span>Other LOAs</span>
              <span>{otherOpen ? '−' : `+ ${otherLoasFiltered.length}`}</span>
            </button>
            {otherOpen && otherLoasFiltered.map(s => (
              <SessionRow
                key={s.id}
                session={s}
                active={s.id === currentSessionId}
                onSelect={() => onSelectSession(s.id)}
                onDelete={() => onDeleteSession(s.id)}
              />
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}

function NewChatButton({ onClick }: { onClick: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: hover ? 'var(--laura-action-hover, #2A2A2A)' : 'var(--laura-action, #0A0A0A)',
        color: 'var(--laura-text-on-primary, #FFFFFF)',
        border: 'none', borderRadius: 6,
        padding: '9px 12px',
        fontSize: 12, fontWeight: 500,
        cursor: 'pointer',
        fontFamily: 'inherit',
        display: 'inline-flex', alignItems: 'center', gap: 6,
        margin: '2px 12px 8px',
        transition: 'background-color 120ms cubic-bezier(0.2, 0, 0, 1)',
        letterSpacing: '0.01em',
      }}
    >
      <span>+</span>
      <span>New chat</span>
    </button>
  );
}

function SessionSearch({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ padding: '0 12px 8px' }}>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search conversations"
        style={{
          width: '100%',
          background: 'transparent',
          border: '1px solid var(--laura-border-soft, #E6E1D8)',
          borderRadius: 6,
          padding: '7px 10px',
          fontSize: 12,
          fontFamily: 'inherit',
          color: 'var(--laura-text-primary, #0A0A0A)',
          outline: 'none',
        }}
      />
    </div>
  );
}

function SessionGroup({
  label, emphasis, sessions, currentId, onSelect, onDelete, emptyLabel,
}: {
  label: string;
  emphasis?: boolean;
  sessions: LauraSession[];
  currentId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  emptyLabel: string;
}) {
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{
        fontSize: 10,
        color: emphasis ? CHAMPAGNE_DEEP : 'var(--laura-text-tertiary, #6F6A62)',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        padding: '6px 12px',
        fontWeight: 600,
      }}>{label}</div>
      {sessions.length === 0 ? (
        <div style={{
          fontSize: 11,
          color: 'var(--laura-text-tertiary, #9B9690)',
          padding: '4px 12px 8px',
          lineHeight: 1.5,
        }}>{emptyLabel}</div>
      ) : sessions.map(s => (
        <SessionRow
          key={s.id}
          session={s}
          active={s.id === currentId}
          onSelect={() => onSelect(s.id)}
          onDelete={() => onDelete(s.id)}
        />
      ))}
    </div>
  );
}

function SessionRow({
  session, active, onSelect, onDelete,
}: {
  session: LauraSession;
  active: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const [hover, setHover] = useState(false);
  const last = session.messages[session.messages.length - 1];
  const scopeBadge = session.loaLabel ? session.loaLabel : 'Global';

  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        padding: '8px 12px',
        borderRadius: 6,
        cursor: 'pointer',
        marginBottom: 1,
        background: active ? CHAMPAGNE_MIST : hover ? 'var(--laura-border-soft, #EAEAEA)' : 'transparent',
        borderLeft: active ? `2px solid ${CHAMPAGNE}` : '2px solid transparent',
        paddingLeft: active ? 10 : 12,
        transition: 'background-color 120ms cubic-bezier(0.2, 0, 0, 1)',
        position: 'relative',
      }}
    >
      <div style={{
        fontSize: 12,
        fontWeight: 500,
        color: active ? '#0A0A0A' : 'var(--laura-text-primary, #0A0A0A)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        paddingRight: hover ? 20 : 0,
        lineHeight: 1.35,
      }}>{session.title || 'Untitled'}</div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        marginTop: 3,
        fontSize: 10,
        color: active ? CHAMPAGNE_DEEP : 'var(--laura-text-tertiary, #9B9690)',
      }}>
        <ScopeBadge kind={session.loaLabel ? 'loa' : 'global'} label={scopeBadge} />
        {last?.tool && <span>· {last.tool.replace('_', ' ')}</span>}
      </div>
      {hover && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          aria-label="Delete session"
          style={{
            position: 'absolute',
            right: 6, top: 6,
            background: 'transparent',
            border: 'none',
            color: 'var(--laura-text-tertiary, #9B9690)',
            cursor: 'pointer',
            fontSize: 12,
            padding: 2,
            lineHeight: 1,
          }}
        >×</button>
      )}
    </div>
  );
}

function ScopeBadge({ kind, label }: { kind: 'loa' | 'global'; label: string }) {
  if (kind === 'loa') {
    return (
      <span style={{
        background: CHAMPAGNE,
        color: '#0A0A0A',
        padding: '1px 6px',
        borderRadius: 3,
        fontSize: 9,
        fontWeight: 600,
        letterSpacing: '0.02em',
      }}>{label}</span>
    );
  }
  return (
    <span style={{
      border: `1px solid ${CHAMPAGNE_BORDER}`,
      color: CHAMPAGNE_DEEP,
      padding: '1px 6px',
      borderRadius: 3,
      fontSize: 9,
      fontWeight: 600,
      letterSpacing: '0.02em',
    }}>{label}</span>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Conversation Pane
   ═══════════════════════════════════════════════════════════════ */

function ConversationPane({
  session, isSending, loaContextId, onSend, onClose, onVoiceClick,
}: {
  session: LauraSession | undefined;
  isSending: boolean;
  loaContextId: string | undefined;
  onSend: (text: string, tool?: string | null) => Promise<void>;
  onClose: () => void;
  onVoiceClick: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [session?.messages.length, isSending]);

  const isLensMode = !!loaContextId;
  const modeTitle = isLensMode ? 'Laura Lens' : 'Laura Intelligence';
  const modeSubtitle = isLensMode
    ? (session?.loaLabel || 'This LOA')
    : 'All historical LOAs · 2,712 records';

  return (
    <main style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Header
        title={modeTitle}
        subtitle={modeSubtitle}
        isLens={isLensMode}
        session={session}
        onClose={onClose}
      />
      <div
        ref={scrollRef}
        style={{
          flex: 1, overflowY: 'auto',
          padding: '24px 40px',
          display: 'flex', flexDirection: 'column', gap: 24,
        }}
      >
        {!session || session.messages.length === 0 ? (
          <EmptyState isLens={isLensMode} loaLabel={session?.loaLabel} onPick={(t) => onSend(t)} />
        ) : (
          <>
            {session.messages.map(msg => (
              <MessageBlock key={msg.id} message={msg} />
            ))}
            {isSending && <ThinkingBlock />}
          </>
        )}
      </div>
      <Composer
        onSend={onSend}
        onVoiceClick={onVoiceClick}
        disabled={isSending}
        isLens={isLensMode}
        loaLabel={session?.loaLabel}
      />
    </main>
  );
}

function Header({
  title, subtitle, isLens, session, onClose,
}: {
  title: string;
  subtitle: string;
  isLens: boolean;
  session: LauraSession | undefined;
  onClose: () => void;
}) {
  return (
    <header style={{
      padding: '14px 24px',
      borderBottom: '1px solid var(--laura-border-soft, #E6E1D8)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      background: 'var(--laura-bg-surface, #FFFFFF)',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <div style={{
          fontSize: 15, fontWeight: 600,
          color: 'var(--laura-text-primary, #0A0A0A)',
          fontFamily: 'inherit',
        }}>
          {title}
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          fontSize: 11,
          color: 'var(--laura-text-tertiary, #6F6A62)',
        }}>
          <ContextPill kind={isLens ? 'loa' : 'global'} label={subtitle} />
          {session && session.messages.length > 0 && (
            <span>· {session.messages.length} message{session.messages.length !== 1 ? 's' : ''}</span>
          )}
        </div>
      </div>
      <IconButton onClick={onClose} title="Close (Esc)">✕</IconButton>
    </header>
  );
}

function ContextPill({ kind, label }: { kind: 'loa' | 'global'; label: string }) {
  if (kind === 'loa') {
    return (
      <span style={{
        background: CHAMPAGNE,
        color: '#0A0A0A',
        padding: '2px 8px',
        borderRadius: 4,
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: '0.02em',
      }}>Context · {label}</span>
    );
  }
  return (
    <span style={{
      border: `1px solid ${CHAMPAGNE_BORDER}`,
      color: CHAMPAGNE_DEEP,
      padding: '2px 8px',
      borderRadius: 4,
      fontSize: 10,
      fontWeight: 600,
      letterSpacing: '0.02em',
    }}>Context · Global</span>
  );
}

function IconButton({ children, onClick, title }: {
  children: React.ReactNode; onClick: () => void; title?: string;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title={title}
      style={{
        background: hover ? 'var(--laura-action, #0A0A0A)' : 'transparent',
        border: `1px solid ${hover ? 'var(--laura-action, #0A0A0A)' : 'var(--laura-border-soft, #E6E1D8)'}`,
        color: hover ? 'var(--laura-text-on-primary, #FFFFFF)' : 'var(--laura-text-secondary, #6F6A62)',
        borderRadius: 4,
        width: 30, height: 30,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer',
        transition: 'background-color 120ms cubic-bezier(0.2, 0, 0, 1), color 120ms cubic-bezier(0.2, 0, 0, 1)',
        fontSize: 12,
      }}
    >{children}</button>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Empty States
   ═══════════════════════════════════════════════════════════════ */

const GLOBAL_SUGGESTIONS = [
  'Top Ray-Ban campaigns by budget',
  'Average budget for Events in Italy',
  'Which clusters have most rejected LOAs?',
  'Find approved campaigns similar to retail visibility',
];

const LENS_SUGGESTIONS = [
  'What is risky in this LOA?',
  'Compare budget to similar historical campaigns',
  'Summarize reviewer comments',
  'Suggest stronger KPIs',
];

function EmptyState({
  isLens, loaLabel, onPick,
}: {
  isLens: boolean;
  loaLabel: string | undefined;
  onPick: (text: string) => void;
}) {
  const chips = isLens ? LENS_SUGGESTIONS : GLOBAL_SUGGESTIONS;
  const headline = isLens ? 'Laura Lens' : 'Laura Intelligence';
  const subhead = isLens
    ? `This chat is focused on ${loaLabel || 'the current LOA'}.`
    : 'Ask across 2,712 historical LOAs.';
  const description = isLens
    ? 'Laura can review this LOA, compare it with historical campaigns, summarize comments, and prepare reviewer notes.'
    : 'Use Laura to find precedents, analyze spend, and understand patterns across brands, clusters, and activities.';

  return (
    <div style={{
      flex: 1,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: 32, textAlign: 'center',
      maxWidth: 620, margin: '0 auto',
    }}>
      <div style={{ color: CHAMPAGNE, fontSize: 20, marginBottom: 12 }}>◆</div>
      <div style={{
        fontFamily: '"Cormorant Garamond", serif',
        fontSize: 34,
        fontWeight: 500,
        color: 'var(--laura-text-primary, #0A0A0A)',
        letterSpacing: '-0.01em',
        lineHeight: 1.1,
        marginBottom: 8,
      }}>{headline}</div>
      <div style={{
        fontSize: 14,
        color: 'var(--laura-text-secondary, #6F6A62)',
        marginBottom: 6,
        fontWeight: 500,
      }}>{subhead}</div>
      <div style={{
        fontSize: 13,
        color: 'var(--laura-text-tertiary, #9B9690)',
        lineHeight: 1.55,
        maxWidth: 480,
        marginBottom: 24,
      }}>{description}</div>
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 8,
        justifyContent: 'center',
        maxWidth: 560,
      }}>
        {chips.map(chip => (
          <SuggestionChip key={chip} onClick={() => onPick(chip)}>{chip}</SuggestionChip>
        ))}
      </div>
      <div style={{
        marginTop: 32,
        fontSize: 11,
        color: 'var(--laura-text-tertiary, #9B9690)',
        maxWidth: 420,
        lineHeight: 1.5,
      }}>
        Laura answers with sources from LOAs, comments, and structured budget data.
      </div>
    </div>
  );
}

function SuggestionChip({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        border: `1px solid ${hover ? CHAMPAGNE : 'var(--laura-border-soft, #E6E1D8)'}`,
        background: hover ? CHAMPAGNE_MIST : 'transparent',
        color: hover ? '#0A0A0A' : 'var(--laura-text-secondary, #6F6A62)',
        borderRadius: 6,
        padding: '8px 14px',
        fontSize: 12,
        cursor: 'pointer',
        transition: 'all 120ms cubic-bezier(0.2, 0, 0, 1)',
        fontFamily: 'inherit',
        textAlign: 'left',
      }}
    >{children}</button>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Message Block — editorial, not chat bubble
   ═══════════════════════════════════════════════════════════════ */

const TOOL_LABELS: Record<string, string> = {
  deep_search: 'Deep Search',
  stats: 'Stats',
  summarize: 'Summary',
};

function MessageBlock({ message }: { message: LauraMessage }) {
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', gap: 4,
        alignItems: 'flex-start',
      }}>
        <div style={{
          fontSize: 10,
          fontWeight: 600,
          color: 'var(--laura-text-tertiary, #6F6A62)',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
        }}>You</div>
        <div style={{
          fontSize: 15,
          lineHeight: 1.5,
          color: 'var(--laura-text-primary, #0A0A0A)',
          fontWeight: 500,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}>
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 10,
      borderLeft: `2px solid ${CHAMPAGNE_BORDER}`,
      paddingLeft: 18,
    }}>
      {/* Header: Laura · Tool */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        fontSize: 11,
        color: 'var(--laura-text-tertiary, #6F6A62)',
      }}>
        <span style={{ color: CHAMPAGNE, fontSize: 11 }}>◆</span>
        <span style={{ fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Laura</span>
        {message.tool && (
          <>
            <span style={{ color: 'var(--laura-text-tertiary, #C0BBB3)' }}>—</span>
            <ToolBadge tool={message.tool} />
          </>
        )}
      </div>

      {/* Body */}
      <div style={{
        fontSize: 14,
        lineHeight: 1.6,
        color: 'var(--laura-text-primary, #0A0A0A)',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}>
        {message.content}
      </div>

      {/* Evidence — for RAG */}
      {message.tool === 'deep_search' && message.sources && message.sources.length > 0 && (
        <EvidenceBlock sources={message.sources} />
      )}

      {/* SQL details */}
      {message.sql && <SqlDisclosure sql={message.sql} />}
    </div>
  );
}

function ToolBadge({ tool }: { tool: string }) {
  const label = TOOL_LABELS[tool] || tool;
  const isSearch = tool === 'deep_search';
  return (
    <span style={{
      border: `1px solid ${isSearch ? CHAMPAGNE : 'var(--laura-border-soft, #E6E1D8)'}`,
      color: isSearch ? CHAMPAGNE_DEEP : 'var(--laura-text-secondary, #6F6A62)',
      background: isSearch ? CHAMPAGNE_MIST : 'transparent',
      padding: '1px 8px',
      borderRadius: 3,
      fontSize: 10,
      fontWeight: 600,
      letterSpacing: '0.02em',
    }}>{label}</span>
  );
}

function EvidenceBlock({ sources }: { sources: LauraSource[] }) {
  const [expanded, setExpanded] = useState<number | null>(null);
  return (
    <div style={{
      marginTop: 6,
      padding: '12px 14px',
      background: 'var(--laura-bg-subtle, #FAFAFA)',
      borderRadius: 8,
      border: '1px solid var(--laura-border-soft, #E6E1D8)',
    }}>
      <div style={{
        fontSize: 10,
        fontWeight: 600,
        color: 'var(--laura-text-tertiary, #6F6A62)',
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        marginBottom: 8,
      }}>
        Evidence · {sources.length} LOA{sources.length !== 1 ? 's' : ''}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {sources.map((s, i) => (
          <SourceCard
            key={i}
            index={i + 1}
            source={s}
            expanded={expanded === i}
            onToggle={() => setExpanded(expanded === i ? null : i)}
          />
        ))}
      </div>
    </div>
  );
}

function SourceCard({
  index, source, expanded, onToggle,
}: {
  index: number;
  source: LauraSource;
  expanded: boolean;
  onToggle: () => void;
}) {
  const label = source.loa_number || `${source.brand} · ${source.activity_type}`;
  const relevance = source.distance ? Math.round((1 - source.distance) * 100) : null;
  return (
    <div
      onClick={onToggle}
      style={{
        padding: '7px 10px',
        borderRadius: 5,
        cursor: 'pointer',
        background: expanded ? CHAMPAGNE_MIST : 'transparent',
        transition: 'background 120ms cubic-bezier(0.2, 0, 0, 1)',
        fontSize: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{
          color: CHAMPAGNE_DEEP,
          fontWeight: 600,
          fontFamily: 'IBM Plex Mono, ui-monospace, monospace',
          fontSize: 11,
          minWidth: 20,
        }}>[{index}]</span>
        <span style={{
          fontWeight: 500,
          color: 'var(--laura-text-primary, #0A0A0A)',
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>{label}</span>
        {relevance !== null && (
          <span style={{
            fontSize: 10,
            color: 'var(--laura-text-tertiary, #9B9690)',
            fontFamily: 'IBM Plex Mono, ui-monospace, monospace',
          }}>{relevance}%</span>
        )}
      </div>
      <div style={{
        fontSize: 11,
        color: 'var(--laura-text-tertiary, #6F6A62)',
        marginTop: 3,
        marginLeft: 28,
        display: 'flex', gap: 8, flexWrap: 'wrap',
      }}>
        <span>{source.country}</span>
        <span>·</span>
        <span>{source.budget}</span>
      </div>
    </div>
  );
}

function SqlDisclosure({ sql }: { sql: string }) {
  return (
    <details style={{ marginTop: 8 }}>
      <summary style={{
        cursor: 'pointer',
        userSelect: 'none',
        fontSize: 11,
        color: 'var(--laura-text-tertiary, #6F6A62)',
        fontWeight: 500,
      }}>
        Show SQL
      </summary>
      <pre style={{
        marginTop: 8,
        padding: '10px 14px',
        background: 'var(--laura-bg-subtle, #FAFAFA)',
        border: '1px solid var(--laura-border-soft, #E6E1D8)',
        borderRadius: 6,
        fontSize: 11,
        fontFamily: 'IBM Plex Mono, ui-monospace, monospace',
        color: 'var(--laura-text-primary, #0A0A0A)',
        overflow: 'auto',
        whiteSpace: 'pre-wrap',
      }}>{sql}</pre>
    </details>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Thinking State
   ═══════════════════════════════════════════════════════════════ */

function ThinkingBlock() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 8,
      borderLeft: `2px solid ${CHAMPAGNE_BORDER}`,
      paddingLeft: 18,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        fontSize: 11,
        color: 'var(--laura-text-tertiary, #6F6A62)',
      }}>
        <span style={{ color: CHAMPAGNE, fontSize: 11 }}>◆</span>
        <span style={{ fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Laura</span>
        <span style={{ color: 'var(--laura-text-tertiary, #C0BBB3)' }}>—</span>
        <span style={{
          color: CHAMPAGNE_DEEP,
          fontSize: 11,
          fontWeight: 500,
        }}>Thinking…</span>
      </div>
      <div style={{
        height: 2,
        background: 'var(--laura-border-soft, #E6E1D8)',
        borderRadius: 999,
        overflow: 'hidden',
        maxWidth: 240,
        position: 'relative',
      }}>
        <div style={{
          position: 'absolute',
          height: '100%',
          width: '40%',
          background: CHAMPAGNE,
          borderRadius: 999,
          animation: 'laura-progress 1200ms infinite cubic-bezier(0.4, 0, 0.6, 1)',
        }} />
      </div>
      <style>{`
        @keyframes laura-progress {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
      `}</style>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Composer
   ═══════════════════════════════════════════════════════════════ */

function Composer({
  onSend, onVoiceClick, disabled, isLens, loaLabel,
}: {
  onSend: (text: string, tool?: string | null) => Promise<void>;
  onVoiceClick: () => void;
  disabled: boolean;
  isLens: boolean;
  loaLabel: string | undefined;
}) {
  const [value, setValue] = useState('');
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [toolsOpen, setToolsOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const canSend = value.trim().length > 0 && !disabled;

  const handleSend = async () => {
    if (!canSend) return;
    const text = value;
    const tool = activeTool;
    setValue('');
    setActiveTool(null);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    await onSend(text, tool);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(140, el.scrollHeight) + 'px';
  };

  const placeholder = activeTool === 'deep_search'
    ? 'Search across historical LOAs…'
    : activeTool === 'stats'
      ? 'Ask a statistical question…'
      : activeTool === 'summarize'
        ? 'What should Laura summarize?'
        : isLens
          ? `Ask about ${loaLabel || 'this LOA'}, or historical patterns…`
          : 'Ask about budgets, brands, clusters, trends…';

  const modeLabel = activeTool ? TOOL_LABELS[activeTool] : 'Auto';

  return (
    <div style={{
      borderTop: '1px solid var(--laura-border-soft, #E6E1D8)',
      padding: '14px 24px 18px',
      background: 'var(--laura-bg-surface, #FFFFFF)',
    }}>
      <div style={{
        display: 'flex', flexDirection: 'column',
        border: `1px solid ${activeTool ? CHAMPAGNE : 'var(--laura-border-strong, #D4D4D4)'}`,
        borderRadius: 12,
        background: 'var(--laura-bg-surface, #FFFFFF)',
        transition: 'border-color 160ms cubic-bezier(0.2, 0, 0, 1)',
        padding: '8px 10px',
      }}>
        {/* Mode selector header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '2px 4px 6px',
        }}>
          <button
            onClick={() => setToolsOpen(v => !v)}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: 11,
              fontWeight: 600,
              color: activeTool ? CHAMPAGNE_DEEP : 'var(--laura-text-tertiary, #6F6A62)',
              letterSpacing: '0.02em',
              cursor: 'pointer',
              padding: '2px 6px',
              borderRadius: 3,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontFamily: 'inherit',
            }}
          >
            <span>Mode: {modeLabel}</span>
            <span style={{ fontSize: 8 }}>▾</span>
          </button>
          {activeTool && (
            <button
              onClick={() => setActiveTool(null)}
              style={{
                background: 'transparent',
                border: 'none',
                fontSize: 10,
                color: 'var(--laura-text-tertiary, #9B9690)',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >Reset</button>
          )}
        </div>

        {/* Tool picker */}
        {toolsOpen && (
          <div style={{ padding: '2px 4px 8px' }}>
            <LauraToolButtons
              activeTool={activeTool}
              onSelectTool={(t) => { setActiveTool(t); setToolsOpen(false); }}
              showSummarize={isLens}
            />
          </div>
        )}

        {/* Input + send */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', padding: '0 4px' }}>
          <VoiceButton onClick={onVoiceClick} />
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            rows={1}
            disabled={disabled}
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontFamily: 'inherit',
              fontSize: 14,
              color: 'var(--laura-text-primary, #0A0A0A)',
              resize: 'none',
              padding: '9px 4px',
              lineHeight: 1.5,
              minHeight: 24,
              maxHeight: 140,
            }}
          />
          <SendButton onClick={handleSend} disabled={!canSend} />
        </div>
      </div>
    </div>
  );
}

function VoiceButton({ onClick }: { onClick: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title="Voice mode"
      aria-label="Open voice mode"
      style={{
        width: 32, height: 32,
        borderRadius: 999,
        border: 'none',
        background: hover ? CHAMPAGNE : CHAMPAGNE_MIST,
        color: hover ? '#0A0A0A' : CHAMPAGNE_DEEP,
        cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13,
        transition: 'transform 120ms cubic-bezier(0.2, 0, 0, 1), background-color 120ms cubic-bezier(0.2, 0, 0, 1)',
        transform: hover ? 'scale(1.05)' : 'scale(1)',
        flexShrink: 0,
      }}
    >🎤</button>
  );
}

function SendButton({ onClick, disabled }: { onClick: () => void; disabled: boolean }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      aria-label="Send message"
      style={{
        width: 32, height: 32,
        borderRadius: 999,
        border: 'none',
        background: hover && !disabled ? 'var(--laura-action-hover, #2A2A2A)' : 'var(--laura-action, #0A0A0A)',
        color: 'var(--laura-text-on-primary, #FFFFFF)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13,
        transition: 'background-color 140ms cubic-bezier(0.2, 0, 0, 1)',
        flexShrink: 0,
      }}
    >↑</button>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Voice Mode Stub (unchanged)
   ═══════════════════════════════════════════════════════════════ */

function VoiceModeStub({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(10, 10, 10, 0.96)',
        zIndex: 2000,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        opacity: isOpen ? 1 : 0,
        pointerEvents: isOpen ? 'all' : 'none',
        transition: 'opacity 320ms cubic-bezier(0.2, 0, 0, 1)',
      }}
    >
      <button
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        aria-label="Close voice mode"
        style={{
          position: 'absolute',
          top: 24, right: 24,
          background: 'rgba(255, 255, 255, 0.1)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          color: '#FFFFFF',
          width: 40, height: 40,
          borderRadius: 999,
          cursor: 'pointer',
          fontSize: 16,
        }}
      >✕</button>
      <div style={{
        width: 280, height: 280,
        borderRadius: 999,
        background: `radial-gradient(circle at 35% 30%, #F5E4C3 0%, ${CHAMPAGNE} 40%, ${CHAMPAGNE_DEEP} 100%)`,
        boxShadow: `0 0 80px rgba(201, 166, 120, 0.5), 0 0 160px rgba(201, 166, 120, 0.25)`,
        animation: 'laura-orb-breathe 3s infinite ease-in-out',
      }} />
      <div style={{
        marginTop: 60,
        color: 'rgba(255, 255, 255, 0.9)',
        fontSize: 18,
        textAlign: 'center',
      }}>Voice mode is coming in Sprint 8</div>
      <style>{`
        @keyframes laura-orb-breathe {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.06); }
        }
      `}</style>
    </div>
  );
}
