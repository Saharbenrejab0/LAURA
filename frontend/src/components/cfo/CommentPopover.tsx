'use client';
import { useState, useEffect, useRef } from 'react';
import type { ReviewComment } from '@/types/review';
import { postComment } from '@/lib/review-api';

const POP_W = 340;
const POP_H = 420;

interface Props {
  loaId: string;
  cycleId: string;
  comments: ReviewComment[];
  /**
   * Rect of the comment button that opened this thread. The popover opens beside
   * it — in the Decision column, on the row being decided — instead of docking
   * to the corner of the window away from what the reviewer is looking at.
   */
  anchor?: DOMRect | null;
  onCommentAdded: (comment: ReviewComment) => void;
  onClose: () => void;
}

/** Keep the popover beside its anchor and fully on screen. */
function place(anchor?: DOMRect | null): React.CSSProperties {
  if (!anchor) return { bottom: 80, right: 24 };
  const margin = 12;
  // Prefer opening to the left of the button (the Decision column is far right).
  let left = anchor.left - POP_W - 8;
  if (left < margin) left = Math.min(anchor.right + 8, window.innerWidth - POP_W - margin);
  let top = anchor.bottom + 6;
  if (top + POP_H > window.innerHeight - margin) {
    top = Math.max(margin, anchor.top - POP_H - 6);
  }
  return { left, top };
}

export default function CommentPopover({ loaId, cycleId, comments, anchor, onCommentAdded, onClose }: Props) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const loaComments = comments.filter(c => c.slideId === loaId);

  useEffect(() => {
    inputRef.current?.focus();

    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [loaComments.length]);

  const handleSubmit = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      const comment = await postComment(cycleId, loaId, text.trim());
      onCommentAdded(comment);
      setText('');
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      ref={popoverRef}
      style={{
        position: 'fixed',
        ...place(anchor),
        width: POP_W,
        maxHeight: POP_H,
        background: '#fff',
        border: '1px solid #D9D5CD',
        borderRadius: 10,
        boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 200,
      }}
    >
      {/* Header */}
      <div style={{ padding: '12px 14px 10px', borderBottom: '1px solid #E8E6E0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#1a1a1a' }}>
          Comments {loaComments.length > 0 && <span style={{ color: '#999', fontWeight: 400 }}>({loaComments.length})</span>}
        </span>
        <button
          onClick={onClose}
          style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 20, color: '#aaa', lineHeight: 1, padding: '0 2px', display: 'flex', alignItems: 'center' }}
        >
          ×
        </button>
      </div>

      {/* Comment list */}
      <div ref={listRef} style={{ flex: 1, overflow: 'auto', padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {loaComments.length === 0 ? (
          <p style={{ fontSize: 12.5, color: '#bbb', margin: 0, textAlign: 'center', padding: '18px 0' }}>No comments yet.</p>
        ) : loaComments.map(c => (
          <div key={c.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <div style={{ width: 28, height: 28, borderRadius: 14, background: '#B08D2F', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10.5, fontWeight: 700, flexShrink: 0, letterSpacing: '0.02em' }}>
              {(c.authorName || '?').split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'baseline', marginBottom: 3 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#333' }}>{c.authorName}</span>
                <span style={{ fontSize: 11, color: '#bbb' }}>
                  {new Date(c.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                </span>
              </div>
              <div style={{ fontSize: 13, color: '#444', lineHeight: 1.45, wordBreak: 'break-word' }}>{c.text}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div style={{ padding: '10px 14px 12px', borderTop: '1px solid #E8E6E0', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            ref={inputRef}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
            placeholder="Add a comment…"
            style={{ flex: 1, borderRadius: 6, border: '1.5px solid #D9D5CD', padding: '6px 10px', fontSize: 13, outline: 'none', fontFamily: 'inherit', transition: 'border-color 150ms' }}
            onFocus={e => { e.target.style.borderColor = '#B08D2F'; }}
            onBlur={e => { e.target.style.borderColor = '#D9D5CD'; }}
          />
          <button
            onClick={handleSubmit}
            disabled={!text.trim() || sending}
            style={{ height: 32, padding: '0 12px', borderRadius: 6, border: 'none', background: text.trim() ? '#B08D2F' : '#E8E6E0', color: text.trim() ? '#fff' : '#aaa', fontSize: 12, fontWeight: 600, cursor: text.trim() ? 'pointer' : 'default', flexShrink: 0, transition: 'background 150ms' }}
          >
            {sending ? '…' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}
