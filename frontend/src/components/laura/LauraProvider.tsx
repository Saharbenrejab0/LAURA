'use client';

/**
 * LauraProvider — Context + state for the unified Laura AI surface.
 *
 * Session title strategy:
 *   - Global chat (no LOA context)     → title from first message content
 *   - LOA-scoped chat (on /loa/{id})   → "LAURA-LOA-XXXX · <first message>"
 *
 * The LOA number is fetched once when the chat is opened on a LOA page,
 * cached per session so we don't refetch on every message.
 */

import {
  createContext, useCallback, useContext, useEffect, useMemo,
  useRef, useState, ReactNode,
} from 'react';
import { usePathname } from 'next/navigation';
import api from '@/lib/api';

/* ───── Types ─────────────────────────────────────────── */

export type LauraMessageRole = 'user' | 'assistant';

export interface LauraSource {
  loa_number: string | null;
  brand: string;
  activity_type: string;
  country: string;
  budget: string;
  distance: number;
}

export interface LauraMessage {
  id: string;
  role: LauraMessageRole;
  content: string;
  timestamp: string;
  sql?: string;
  tool?: string;
  sources?: LauraSource[];
}

export interface LauraSession {
  id: string;
  title: string;
  messages: LauraMessage[];
  createdAt: string;
  updatedAt: string;
  loaContextId?: string;      // Which LOA this session is scoped to (if any)
  loaLabel?: string;          // Human label, e.g. "LAURA-LOA-2026-003"
}

export type LauraPillState = 'idle' | 'thinking' | 'results';

interface LauraContextValue {
  isOpen: boolean;
  pillState: LauraPillState;
  pillBadge: number | null;
  sessions: LauraSession[];
  currentSessionId: string | null;
  currentSession: LauraSession | undefined;
  isSending: boolean;
  loaContextId: string | undefined;

  openChat: (sessionId?: string) => void;
  closeChat: () => void;
  newChat: () => void;
  selectSession: (id: string) => void;
  deleteSession: (id: string) => void;
  sendMessage: (text: string, tool?: string | null) => Promise<void>;
  setPillState: (state: LauraPillState, badge?: number | null) => void;
}

const LauraContext = createContext<LauraContextValue | null>(null);

/* ───── Helpers ───────────────────────────────────────── */

const STORAGE_KEY = 'laura.chat.sessions';
const CURRENT_KEY = 'laura.chat.currentId';
const LOA_LABEL_CACHE_KEY = 'laura.chat.loaLabels';  // { [loaId]: loa_number }
const MAX_SESSIONS = 50;
const HISTORY_WINDOW = 6;

function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return 'laura-' + Math.random().toString(36).slice(2) + '-' + Date.now();
}

function nowISO(): string { return new Date().toISOString(); }

function loadSessions(): LauraSession[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch { return []; }
}

function saveSessions(sessions: LauraSession[]): void {
  if (typeof window === 'undefined') return;
  try {
    const trimmed = sessions
      .slice()
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, MAX_SESSIONS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {/* quota exceeded — silent */}
}

function loadLoaLabelCache(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(LOA_LABEL_CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveLoaLabel(loaId: string, label: string): void {
  if (typeof window === 'undefined') return;
  try {
    const cache = loadLoaLabelCache();
    cache[loaId] = label;
    localStorage.setItem(LOA_LABEL_CACHE_KEY, JSON.stringify(cache));
  } catch {/* silent */}
}

/**
 * Fetch a LOA's human label (loa_number like LAURA-LOA-2026-003)
 * with localStorage caching so we don't refetch on every chat open.
 */
async function fetchLoaLabel(loaId: string): Promise<string | null> {
  const cache = loadLoaLabelCache();
  if (cache[loaId]) return cache[loaId];

  try {
    const { data } = await api.get(`/loa/${loaId}`);
    const label = data?.loa_draft_id || data?.loa_number || null;
    if (label) saveLoaLabel(loaId, label);
    return label;
  } catch {
    return null;
  }
}

function generateSessionTitle(content: string, loaLabel?: string): string {
  const clean = content.trim().replace(/\s+/g, ' ');
  const maxContent = loaLabel ? 32 : 48;
  const truncated = clean.length <= maxContent
    ? clean
    : clean.slice(0, maxContent - 1).trimEnd() + '…';
  return loaLabel ? `${loaLabel} · ${truncated}` : truncated;
}

function extractLoaId(pathname: string | null): string | undefined {
  if (!pathname) return undefined;
  const match = pathname.match(/^\/loa\/([^/]+)(?:\/.*)?$/);
  if (!match) return undefined;
  if (match[1] === 'new') return undefined;
  return match[1];
}

function buildHistoryPayload(session: LauraSession | undefined): Array<{ role: string; content: string }> {
  if (!session || session.messages.length === 0) return [];
  return session.messages
    .slice(-HISTORY_WINDOW)
    .map(m => ({ role: m.role, content: m.content }));
}

async function callChatAPI(
  text: string,
  loaContextId: string | undefined,
  tool?: string | null,
  history?: Array<{ role: string; content: string }>,
  sessionId?: string,
): Promise<{ answer: string; sql?: string; tool?: string; sources?: LauraSource[] }> {
  try {
    const endpoint = loaContextId
      ? `/loa/${loaContextId}/chat/ask`
      : '/chat/ask';
    const payload: Record<string, unknown> = { message: text };
    if (tool) payload.tool = tool;
    if (history && history.length > 0) payload.history = history;
    if (sessionId) payload.session_id = sessionId;

    const { data } = await api.post(endpoint, payload);
    return {
      answer: data?.answer || 'Laura returned an empty response.',
      sql: data?.sql,
      tool: data?.tool,
      sources: data?.sources,
    };
  } catch (e: any) {
    const detail = e?.response?.data?.detail;
    if (e?.response?.status === 403) {
      return { answer: 'I can answer questions about historical LOA data. Try "average budget for Events in Italy".' };
    }
    return {
      answer: typeof detail === 'string'
        ? detail
        : 'Something went wrong reaching the chat backend. Please try again in a moment.',
    };
  }
}

/* ───── Provider ──────────────────────────────────────── */

export function LauraProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const loaContextId = extractLoaId(pathname);

  const [isOpen, setIsOpen] = useState(false);
  const [sessions, setSessions] = useState<LauraSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [pillState, setPillStateInternal] = useState<LauraPillState>('idle');
  const [pillBadge, setPillBadge] = useState<number | null>(null);
  const [currentLoaLabel, setCurrentLoaLabel] = useState<string | null>(null);

  useEffect(() => {
    const loaded = loadSessions();
    setSessions(loaded);
    try {
      const curr = localStorage.getItem(CURRENT_KEY);
      if (curr && loaded.find(s => s.id === curr)) {
        setCurrentSessionId(curr);
      }
    } catch {/* ignore */}
  }, []);

  // Fetch LOA label when the loa context changes
  useEffect(() => {
    if (!loaContextId) {
      setCurrentLoaLabel(null);
      return;
    }
    // Set cached value immediately if available
    const cache = loadLoaLabelCache();
    if (cache[loaContextId]) {
      setCurrentLoaLabel(cache[loaContextId]);
    }
    // Then refresh from server
    fetchLoaLabel(loaContextId).then(label => {
      if (label) setCurrentLoaLabel(label);
    });
  }, [loaContextId]);

  const sessionsRef = useRef(sessions);
  useEffect(() => {
    sessionsRef.current = sessions;
    saveSessions(sessions);
  }, [sessions]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (currentSessionId) localStorage.setItem(CURRENT_KEY, currentSessionId);
      else localStorage.removeItem(CURRENT_KEY);
    } catch {/* ignore */}
  }, [currentSessionId]);

  const currentSession = useMemo(
    () => sessions.find(s => s.id === currentSessionId),
    [sessions, currentSessionId]
  );

  const openChat = useCallback((sessionId?: string) => {
    if (sessionId) setCurrentSessionId(sessionId);
    setIsOpen(true);
  }, []);

  const closeChat = useCallback(() => {
    setIsOpen(false);
  }, []);

  const newChat = useCallback(() => {
    const newSession: LauraSession = {
      id: uuid(),
      title: 'New conversation',
      messages: [],
      createdAt: nowISO(),
      updatedAt: nowISO(),
      loaContextId: loaContextId,
      loaLabel: currentLoaLabel || undefined,
    };
    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newSession.id);
  }, [loaContextId, currentLoaLabel]);

  const selectSession = useCallback((id: string) => {
    setCurrentSessionId(id);
  }, []);

  const deleteSession = useCallback((id: string) => {
    setSessions(prev => prev.filter(s => s.id !== id));
    setCurrentSessionId(curr => (curr === id ? null : curr));
  }, []);

  const setPillState = useCallback((state: LauraPillState, badge?: number | null) => {
    setPillStateInternal(state);
    setPillBadge(badge ?? null);
  }, []);

  const sendMessage = useCallback(async (text: string, tool?: string | null) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    let sessionId = currentSessionId;
    let session = sessionsRef.current.find(s => s.id === sessionId);

    if (!session) {
      const label = loaContextId ? currentLoaLabel || undefined : undefined;
      const newSession: LauraSession = {
        id: uuid(),
        title: generateSessionTitle(trimmed, label),
        messages: [],
        createdAt: nowISO(),
        updatedAt: nowISO(),
        loaContextId: loaContextId,
        loaLabel: label,
      };
      sessionId = newSession.id;
      session = newSession;
      setSessions(prev => [newSession, ...prev]);
      setCurrentSessionId(newSession.id);
    } else if (session.messages.length === 0) {
      // First message: set the title (with LOA prefix if applicable)
      const label = session.loaLabel || (loaContextId ? currentLoaLabel || undefined : undefined);
      setSessions(prev => prev.map(s =>
        s.id === sessionId
          ? {
              ...s,
              title: generateSessionTitle(trimmed, label),
              loaContextId: s.loaContextId || loaContextId,
              loaLabel: s.loaLabel || label,
            }
          : s
      ));
    }

    const historyPayload = buildHistoryPayload(session);

    const userMsg: LauraMessage = {
      id: uuid(),
      role: 'user',
      content: trimmed,
      timestamp: nowISO(),
      tool: tool || undefined,
    };

    setSessions(prev => prev.map(s =>
      s.id === sessionId
        ? { ...s, messages: [...s.messages, userMsg], updatedAt: nowISO() }
        : s
    ));

    setIsSending(true);
    setPillStateInternal('thinking');

    try {
      const result = await callChatAPI(
        trimmed, loaContextId, tool, historyPayload, sessionId || undefined,
      );

      const assistantMsg: LauraMessage = {
        id: uuid(),
        role: 'assistant',
        content: result.answer,
        timestamp: nowISO(),
        sql: result.sql,
        tool: result.tool,
        sources: result.sources,
      };

      setSessions(prev => prev.map(s =>
        s.id === sessionId
          ? { ...s, messages: [...s.messages, assistantMsg], updatedAt: nowISO() }
          : s
      ));

      if (result.tool === 'deep_search' && result.sources && result.sources.length > 0) {
        setPillStateInternal('results');
        setPillBadge(result.sources.length);
        setTimeout(() => {
          setPillStateInternal('idle');
          setPillBadge(null);
        }, 5000);
      }
    } finally {
      setIsSending(false);
      if (pillState !== 'results') {
        setPillStateInternal('idle');
      }
    }
  }, [currentSessionId, loaContextId, currentLoaLabel, pillState]);

  const value: LauraContextValue = {
    isOpen,
    pillState,
    pillBadge,
    sessions,
    currentSessionId,
    currentSession,
    isSending,
    loaContextId,
    openChat,
    closeChat,
    newChat,
    selectSession,
    deleteSession,
    sendMessage,
    setPillState,
  };

  return (
    <LauraContext.Provider value={value}>
      {children}
    </LauraContext.Provider>
  );
}

/* ───── Hook ──────────────────────────────────────────── */

export function useLaura(): LauraContextValue {
  const ctx = useContext(LauraContext);
  if (!ctx) {
    throw new Error('useLaura must be used inside <LauraProvider>');
  }
  return ctx;
}
