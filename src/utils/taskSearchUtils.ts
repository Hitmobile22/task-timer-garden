import React from 'react';

/**
 * Score how well a name matches a search query (0 = no match, 5 = exact).
 * Purely visual ranking for the /tasks search.
 */
export const scoreMatch = (name: string | null | undefined, query: string): number => {
  const q = query.trim().toLowerCase();
  if (!q || !name) return 0;
  const n = name.toLowerCase().trim();
  if (n === q) return 5;
  if (n.startsWith(q)) return 4;
  const words = n.split(/[\s\-_/.,:;!?()]+/).filter(Boolean);
  if (words.some(w => w.startsWith(q))) return 3;
  if (n.includes(q)) return 2;
  const terms = q.split(/\s+/).filter(Boolean);
  if (terms.length > 1 && terms.every(t => n.includes(t))) return 1;
  return 0;
};

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Wraps matching parts of text in <mark>. Returns plain text when no query. */
export const highlightMatch = (text: string, query?: string): React.ReactNode => {
  const terms = (query || '').trim().split(/\s+/).filter(Boolean);
  if (!text || terms.length === 0) return text;
  const regex = new RegExp(`(${terms.map(escapeRegExp).join('|')})`, 'gi');
  const parts = text.split(regex);
  return parts.map((part, i) =>
    i % 2 === 1
      ? React.createElement('mark', { key: i, className: 'bg-accent text-accent-foreground rounded px-0.5' }, part)
      : part
  );
};
