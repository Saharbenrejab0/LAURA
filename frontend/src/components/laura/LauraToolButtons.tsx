'use client';

/**
 * LauraToolButtons — Tool selector for Laura Chat
 *
 * Renders above the chat input. When a tool is selected, it's sent
 * with the next message as `tool` in the API request.
 *
 * Tools:
 *   - deep_search: RAG hybrid search across all historical LOAs
 *   - summarize: Summarize reviewer comments (per-LOA only)
 *   - stats: Text-to-SQL statistical queries
 *   - null: Auto-detect (default, no button selected)
 */

import { useState } from 'react';

const CHAMPAGNE = '#C9A678';

interface Tool {
  id: string | null;
  icon: string;
  label: string;
  description: string;
}

const TOOLS: Tool[] = [
  {
    id: 'deep_search',
    icon: '🔍',
    label: 'Deep Search',
    description: 'Search across all historical LOAs using AI',
  },
  {
    id: 'stats',
    icon: '📊',
    label: 'Stats',
    description: 'Run statistical queries on LOA data',
  },
  {
    id: 'summarize',
    icon: '📝',
    label: 'Summarize',
    description: 'Summarize reviewer comments',
  },
];

interface LauraToolButtonsProps {
  activeTool: string | null;
  onSelectTool: (tool: string | null) => void;
  /** Hide summarize button when not in a specific LOA context */
  showSummarize?: boolean;
}

export default function LauraToolButtons({
  activeTool,
  onSelectTool,
  showSummarize = true,
}: LauraToolButtonsProps) {
  const [hoveredTool, setHoveredTool] = useState<string | null>(null);

  const visibleTools = showSummarize
    ? TOOLS
    : TOOLS.filter((t) => t.id !== 'summarize');

  return (
    <div
      style={{
        display: 'flex',
        gap: 6,
        padding: '8px 16px 4px',
        flexWrap: 'wrap',
      }}
    >
      {visibleTools.map((tool) => {
        const isActive = activeTool === tool.id;
        const isHovered = hoveredTool === tool.id;

        return (
          <button
            key={tool.id}
            onClick={() => onSelectTool(isActive ? null : tool.id)}
            onMouseEnter={() => setHoveredTool(tool.id)}
            onMouseLeave={() => setHoveredTool(null)}
            title={tool.description}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 12px',
              borderRadius: 999,
              border: isActive
                ? `1.5px solid ${CHAMPAGNE}`
                : '1.5px solid var(--laura-champagne-border, #E8D9B8)',
              background: isActive
                ? `${CHAMPAGNE}18`
                : isHovered
                  ? 'var(--laura-champagne-mist, #FAF5EA)'
                  : 'transparent',
              color: isActive
                ? CHAMPAGNE
                : 'var(--laura-text-secondary, #6B6B6B)',
              fontSize: 12,
              fontWeight: isActive ? 600 : 500,
              fontFamily: 'inherit',
              cursor: 'pointer',
              transition: 'all 200ms cubic-bezier(0.2, 0, 0, 1)',
              userSelect: 'none',
              letterSpacing: '0.01em',
            }}
          >
            <span style={{ fontSize: 13 }}>{tool.icon}</span>
            <span>{tool.label}</span>
          </button>
        );
      })}

      {activeTool && (
        <button
          onClick={() => onSelectTool(null)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '5px 10px',
            borderRadius: 999,
            border: '1px solid transparent',
            background: 'transparent',
            color: 'var(--laura-text-tertiary, #999)',
            fontSize: 11,
            fontFamily: 'inherit',
            cursor: 'pointer',
          }}
        >
          ✕ Auto
        </button>
      )}
    </div>
  );
}
