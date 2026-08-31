'use client';

/**
 * InlineEditField - the core inline-editable field.
 *
 *   Read state:    label + value, calm
 *   Hover state:   subtle background + "Click to edit" hint
 *   Focused state: actual input, autosaves on blur
 *   Empty + Laura: shows ghost text suggestion with Accept / Edit / Dismiss
 *   Empty + required: left rail in red, "Required" badge
 *   Locked:        no hover affordance, tooltip on hover
 *
 * Provenance dot: small colored circle next to the label.
 *   gray   = manual input
 *   green  = Laura suggestion accepted as-is
 *   gold   = Laura suggestion edited before accepting
 *   neutral = inherited from duplicate source
 */

import { useEffect, useRef, useState } from 'react';
import api from '@/lib/api';
import { color, font, motion, radius, space } from '@/styles/tokens';

export type Provenance = 'manual' | 'laura_accepted' | 'laura_edited' | 'source' | 'none';

export interface LauraSuggestion {
  value: string | string[];
  source_count: number;
  confidence: 'low' | 'medium' | 'high';
  kind: 'text' | 'list' | 'scalar';
}

interface InlineEditFieldProps {
  loaId: string;
  field: string;
  label: string;
  value: string | number | string[] | null | undefined;
  required?: boolean;
  editable?: boolean;
  /** Why it's not editable, shown on hover. */
  lockReason?: string;
  /** Display variant. */
  variant?: 'text' | 'textarea' | 'number';
  /** Optional dropdown options for a select-style field. */
  options?: string[];
  /** Source of the current value. Drives the provenance dot. */
  provenance?: Provenance;
  /** Optional Laura suggestion for this field (shown when value is empty). */
  suggestion?: LauraSuggestion;
  /** Callback after a successful save - parent updates its mirror. */
  onSaved?: (newValue: any, source: 'manual' | 'laura_accepted' | 'laura_edited') => void;
  /** Callback when Laura suggestion is dismissed. */
  onDismissSuggestion?: () => void;
}

export default function InlineEditField({
  loaId, field, label, value, required, editable = true, lockReason,
  variant = 'text', options, provenance = 'none', suggestion,
  onSaved, onDismissSuggestion,
}: InlineEditFieldProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>(stringify(value));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hover, setHover] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null>(null);

  useEffect(() => { setDraft(stringify(value)); }, [value]);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  const isEmpty = isEmptyValue(value);
  const showSuggestion = isEmpty && suggestion && !editing;

  /* ----- Save ----- */

  const save = async (rawValue: string, source: 'manual' | 'laura_accepted' | 'laura_edited' = 'manual') => {
    setSaving(true); setError(null);
    try {
      const payload = variant === 'number' && rawValue !== ''
        ? Number(rawValue)
        : rawValue;
      const { data } = await api.patch(`/loa/${loaId}/field`, {
        field, value: payload, source,
      });
      onSaved?.(data.value, source);
      setEditing(false);
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const acceptSuggestion = () => {
    if (!suggestion) return;
    const v = Array.isArray(suggestion.value) ? suggestion.value.join(', ') : String(suggestion.value);
    save(v, 'laura_accepted');
  };

  const editSuggestion = () => {
    if (!suggestion) return;
    const v = Array.isArray(suggestion.value) ? suggestion.value.join(', ') : String(suggestion.value);
    setDraft(v);
    setEditing(true);
  };

  /* ----- Styles ----- */

  const wrapperBase: React.CSSProperties = {
    padding: `${space[2] + 2}px ${space[3]}px`,
    borderRadius: radius.field,
    borderWidth: '1px', borderStyle: 'solid', borderColor: 'transparent',
    background: 'transparent',
    cursor: editable && !editing ? 'text' : 'default',
    transition: `background-color ${motion.duration.quick}ms ${motion.easing}, border-color ${motion.duration.quick}ms ${motion.easing}`,
    position: 'relative',
  };

  const wrapperReadStyle = editable && hover && !editing && !showSuggestion ? {
    background: color.bg.canvas, borderColor: color.border.soft,
  } : {};

  const wrapperRequiredEmptyStyle = (required && isEmpty && !editing && !showSuggestion) ? {
    background: '#FFF8F7', borderColor: '#E6C1BD',
    boxShadow: `inset 2px 0 0 ${color.status.danger}`,
  } : {};

  /* ----- Render ----- */

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={() => { if (editable && !editing && !showSuggestion) setEditing(true); }}
      title={!editable && lockReason ? lockReason : undefined}
      style={{ ...wrapperBase, ...wrapperReadStyle, ...wrapperRequiredEmptyStyle }}
    >
      <FieldLabel
        label={label} required={required}
        provenance={provenance} hover={hover && editable && !editing}
      />

      {editing ? (
        <EditingInput
          variant={variant} options={options} initial={draft}
          onChange={setDraft}
          onCommit={() => save(draft, provenance === 'laura_accepted' || provenance === 'laura_edited' ? 'laura_edited' : 'manual')}
          onCancel={() => { setEditing(false); setDraft(stringify(value)); setError(null); }}
          inputRef={inputRef as any}
          saving={saving}
        />
      ) : showSuggestion ? (
        <LauraSuggestionBlock
          suggestion={suggestion!}
          onAccept={acceptSuggestion}
          onEdit={editSuggestion}
          onDismiss={() => onDismissSuggestion?.()}
        />
      ) : isEmpty ? (
        required ? (
          <p style={{
            margin: 0, fontSize: 14, fontWeight: 500,
            color: color.status.danger,
          }}>— Required</p>
        ) : (
          <p style={{ margin: 0, fontSize: 14, color: color.text.tertiary, fontStyle: 'italic' }}>
            Click to add…
          </p>
        )
      ) : (
        <p style={{
          margin: 0, fontSize: 14, lineHeight: '22px', color: color.text.primary,
          whiteSpace: variant === 'textarea' ? 'pre-wrap' : 'normal',
        }}>{Array.isArray(value) ? value.join(', ') : String(value)}</p>
      )}

      {error && (
        <p style={{
          margin: `${space[1]}px 0 0`, fontSize: 11,
          color: color.status.danger,
        }}>{error}</p>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------- */
/* Sub-components                                                       */
/* -------------------------------------------------------------------- */

function FieldLabel({ label, required, provenance, hover }: {
  label: string; required?: boolean; provenance: Provenance; hover: boolean;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: space[2],
      marginBottom: 4, minHeight: 18,
    }}>
      <ProvenanceDot provenance={provenance} />
      <span style={{ fontSize: 12, fontWeight: 500, color: color.text.secondary }}>
        {label}
      </span>
      {required && (
        <span style={{
          fontSize: 10, padding: '0 6px', borderRadius: 999,
          color: color.status.danger,
          background: '#FFF1EF', border: '1px solid #E6C1BD',
          height: 16, lineHeight: '14px', fontWeight: 500,
        }}>Required</span>
      )}
      <div style={{ flex: 1 }} />
      {hover && (
        <span style={{
          fontSize: 11, color: color.text.tertiary, fontStyle: 'italic',
          opacity: 0.7,
        }}>Click to edit</span>
      )}
    </div>
  );
}

function ProvenanceDot({ provenance }: { provenance: Provenance }) {
  if (provenance === 'none') return <span style={{ width: 6 }} aria-hidden />;
  const dot = {
    manual:          { color: color.text.tertiary, title: 'Manual entry' },
    laura_accepted:  { color: color.status.success, title: 'Accepted from Laura' },
    laura_edited:    { color: color.accent.gold,    title: 'Edited from Laura suggestion' },
    source:          { color: color.border.strong,  title: 'Inherited from source LOA' },
    none:            { color: 'transparent',         title: '' },
  }[provenance];
  return (
    <span title={dot.title} aria-label={dot.title} style={{
      display: 'inline-block', width: 6, height: 6, borderRadius: 999,
      background: dot.color, flexShrink: 0,
    }} />
  );
}

function EditingInput({ variant, options, initial, onChange, onCommit, onCancel, inputRef, saving }: {
  variant: 'text' | 'textarea' | 'number';
  options?: string[];
  initial: string;
  onChange: (v: string) => void;
  onCommit: () => void;
  onCancel: () => void;
  inputRef: React.MutableRefObject<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null>;
  saving: boolean;
}) {
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
    if (e.key === 'Enter' && variant !== 'textarea') { e.preventDefault(); onCommit(); }
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && variant === 'textarea') { e.preventDefault(); onCommit(); }
  };

  const sharedStyle: React.CSSProperties = {
    width: '100%',
    border: `1px solid ${color.border.strong}`,
    borderRadius: radius.field,
    background: color.bg.surface,
    padding: '8px 10px',
    fontFamily: font.sans,
    fontSize: 14, lineHeight: '22px',
    color: color.text.primary,
    outline: `2px solid ${color.bg.tint}`,
  };

  if (options && options.length > 0) {
    return (
      <select
        ref={inputRef as any} value={initial}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onCommit} onKeyDown={onKeyDown}
        disabled={saving}
        style={sharedStyle}
      >
        <option value="">—</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  }

  if (variant === 'textarea') {
    return (
      <textarea
        ref={inputRef as any} value={initial}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onCommit} onKeyDown={onKeyDown}
        disabled={saving} rows={3}
        style={{ ...sharedStyle, resize: 'vertical', minHeight: 80 }}
      />
    );
  }

  return (
    <input
      ref={inputRef as any}
      type={variant === 'number' ? 'number' : 'text'}
      value={initial}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onCommit} onKeyDown={onKeyDown}
      disabled={saving}
      style={sharedStyle}
    />
  );
}

function LauraSuggestionBlock({ suggestion, onAccept, onEdit, onDismiss }: {
  suggestion: LauraSuggestion;
  onAccept: () => void;
  onEdit: () => void;
  onDismiss: () => void;
}) {
  const valueText = Array.isArray(suggestion.value) ? suggestion.value.join(', ') : suggestion.value;
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        background: color.bg.tint,
        border: `1px solid #CFE0D7`,
        borderRadius: radius.field,
        padding: space[3],
        marginTop: 2,
      }}
    >
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, marginBottom: space[2],
      }}>
        <span style={{ fontSize: 12, color: color.action.primary }}>✦</span>
        <span style={{
          fontSize: 12, fontWeight: 600, color: color.action.primary,
        }}>Laura suggests</span>
        <span style={{
          fontSize: 10, color: color.text.tertiary, marginLeft: 'auto',
        }}>
          {suggestion.confidence} confidence · {suggestion.source_count} similar
        </span>
      </div>
      <p style={{
        margin: `0 0 ${space[3]}px`, fontSize: 14, lineHeight: '22px',
        color: color.text.primary, whiteSpace: 'pre-wrap',
      }}>{valueText}</p>
      <div style={{ display: 'flex', gap: space[2] }}>
        <button onClick={onAccept} style={primaryMiniButton}>Accept</button>
        <button onClick={onEdit}   style={secondaryMiniButton}>Edit</button>
        <button onClick={onDismiss} style={ghostMiniButton}>Dismiss</button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------- */
/* Helpers + button styles                                              */
/* -------------------------------------------------------------------- */

function stringify(v: any): string {
  if (v == null) return '';
  if (Array.isArray(v)) return v.join(', ');
  return String(v);
}

function isEmptyValue(v: any): boolean {
  if (v == null) return true;
  if (typeof v === 'string' && !v.trim()) return true;
  if (Array.isArray(v) && v.length === 0) return true;
  return false;
}

const baseMiniButton: React.CSSProperties = {
  height: 28, borderRadius: 8,
  fontSize: 12, fontWeight: 500, fontFamily: font.sans,
  cursor: 'pointer', padding: '0 12px',
};

const primaryMiniButton: React.CSSProperties = {
  ...baseMiniButton,
  background: color.action.primary, color: color.text.onPrimary, border: 'none',
};

const secondaryMiniButton: React.CSSProperties = {
  ...baseMiniButton,
  background: color.bg.surface,
  border: `1px solid ${color.border.strong}`,
  color: color.text.primary,
};

const ghostMiniButton: React.CSSProperties = {
  ...baseMiniButton,
  background: 'transparent', border: 'none',
  color: color.text.secondary,
};
