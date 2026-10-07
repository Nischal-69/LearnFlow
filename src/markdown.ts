/** Minimal markdown subset: headings, bold, italic, bullet/numbered lists, code blocks, links. */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function toDisplayUrl(v: string): string {
  const t = v.trim();
  if (/^https?:\/\//i.test(t)) return t;
  if (/^www\./i.test(t)) return `https://${t}`;
  return t;
}

/** Inline: `code`, **bold**, *italic*, [label](url). Input must already be escaped. */
function renderInline(escaped: string): string {
  let out = escaped;
  const codes: string[] = [];
  // inline code — protect from further formatting
  out = out.replace(/`([^`\n]+)`/g, (_m, code) => {
    codes.push(`<code class="rounded bg-slate-100 px-1 py-0.5 font-mono text-[13px] text-ink">${code}</code>`);
    return `\u0000${codes.length - 1}\u0000`;
  });
  // links
  out = out.replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, (_m, label, url) => {
    const href = escapeHtml(toDisplayUrl(url));
    return `<a href="${href}" target="_blank" rel="noreferrer" class="font-medium text-primary-600 hover:underline">${label}</a>`;
  });
  // bold
  out = out.replace(/\*\*([^*\n]+)\*\*/g, '<strong class="font-semibold">$1</strong>');
  // italic (avoid matching already-bolded)
  out = out.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  // restore code placeholders
  out = out.replace(/\u0000(\d+)\u0000/g, (_m, i) => codes[Number(i)] ?? '');
  return out;
}

export function renderMarkdown(src: string): string {
  const text = (src ?? '').replace(/\r\n/g, '\n');
  if (!text.trim()) return '';
  const lines = text.split('\n');
  const html: string[] = [];
  let inCode = false;
  let codeBuf: string[] = [];
  let listKind: 'ul' | 'ol' | null = null;
  let paraBuf: string[] = [];

  function flushPara() {
    if (paraBuf.length === 0) return;
    const joined = paraBuf.join(' ').trim();
    if (joined) html.push(`<p class="text-sm leading-relaxed text-ink-secondary">${renderInline(escapeHtml(joined))}</p>`);
    paraBuf = [];
  }

  function flushList() {
    if (!listKind) return;
    html.push(listKind === 'ul' ? '</ul>' : '</ol>');
    listKind = null;
  }

  function openList(kind: 'ul' | 'ol') {
    if (listKind === kind) return;
    flushPara();
    flushList();
    listKind = kind;
    html.push(
      kind === 'ul'
        ? '<ul class="list-disc space-y-1 pl-5 text-sm text-ink-secondary">'
        : '<ol class="list-decimal space-y-1 pl-5 text-sm text-ink-secondary">',
    );
  }

  for (const raw of lines) {
    const line = raw;
    // fenced code
    if (line.trim().startsWith('```')) {
      if (!inCode) {
        flushPara();
        flushList();
        inCode = true;
        codeBuf = [];
      } else {
        inCode = false;
        html.push(
          `<pre class="overflow-x-auto rounded-lg bg-slate-900 p-3 font-mono text-[13px] leading-relaxed text-slate-100"><code>${escapeHtml(codeBuf.join('\n'))}</code></pre>`,
        );
        codeBuf = [];
      }
      continue;
    }
    if (inCode) {
      codeBuf.push(line);
      continue;
    }

    const trimmed = line.trim();
    if (!trimmed) {
      flushPara();
      flushList();
      continue;
    }

    const heading = /^(#{1,3})\s+(.+)$/.exec(trimmed);
    if (heading) {
      flushPara();
      flushList();
      const level = heading[1].length;
      const cls =
        level === 1
          ? 'text-base font-bold text-ink'
          : level === 2
            ? 'text-[15px] font-bold text-ink'
            : 'text-sm font-semibold text-ink';
      html.push(`<h${level} class="${cls}">${renderInline(escapeHtml(heading[2].trim()))}</h${level}>`);
      continue;
    }

    const bullet = /^[-*]\s+(.+)$/.exec(trimmed);
    if (bullet) {
      openList('ul');
      html.push(`<li>${renderInline(escapeHtml(bullet[1].trim()))}</li>`);
      continue;
    }

    const numbered = /^\d+[.)]\s+(.+)$/.exec(trimmed);
    if (numbered) {
      openList('ol');
      html.push(`<li>${renderInline(escapeHtml(numbered[1].trim()))}</li>`);
      continue;
    }

    flushList();
    paraBuf.push(trimmed);
  }

  if (inCode) {
    html.push(
      `<pre class="overflow-x-auto rounded-lg bg-slate-900 p-3 font-mono text-[13px] leading-relaxed text-slate-100"><code>${escapeHtml(codeBuf.join('\n'))}</code></pre>`,
    );
  }
  flushPara();
  flushList();
  return `<div class="space-y-2">${html.join('')}</div>`;
}

/** Strip markdown syntax for plain-text previews / search snippets. */
export function stripMarkdown(src: string): string {
  return (src ?? '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^#{1,3}\s+/gm, '')
    .replace(/^\s*[-*]\s+/gm, '')
    .replace(/^\s*\d+[.)]\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1$2')
    .replace(/\s+/g, ' ')
    .trim();
}

export type FormatKind = 'h1' | 'h2' | 'h3' | 'bold' | 'italic' | 'bullet' | 'numbered' | 'code' | 'link';

export interface FormatResult {
  text: string;
  selStart: number;
  selEnd: number;
}

function wrapSelection(value: string, start: number, end: number, before: string, after: string, placeholder: string): FormatResult {
  const s = Math.min(start, end);
  const e = Math.max(start, end);
  const selected = value.slice(s, e) || placeholder;
  const next = value.slice(0, s) + before + selected + after + value.slice(e);
  return { text: next, selStart: s + before.length, selEnd: s + before.length + selected.length };
}

export function applyMarkdownFormat(value: string, start: number, end: number, kind: FormatKind): FormatResult {
  const s = Math.min(Math.max(0, start), value.length);
  const e = Math.min(Math.max(0, end), value.length);

  if (kind === 'bold') return wrapSelection(value, s, e, '**', '**', 'bold text');
  if (kind === 'italic') return wrapSelection(value, s, e, '*', '*', 'italic text');
  if (kind === 'code') {
    // multiline selection → fenced block, else inline code
    if (value.slice(s, e).includes('\n')) return wrapSelection(value, s, e, '```\n', '\n```', 'code');
    return wrapSelection(value, s, e, '`', '`', 'code');
  }
  if (kind === 'link') {
    const selected = value.slice(s, e) || 'link text';
    const next = `${value.slice(0, s)}[${selected}](https://)${value.slice(e)}`;
    return { text: next, selStart: s + 1, selEnd: s + 1 + selected.length };
  }

  // line-based formats: operate on every touched line
  const lineStart = value.lastIndexOf('\n', s - 1) + 1;
  let lineEnd = value.indexOf('\n', Math.max(e, s + 1));
  if (lineEnd === -1) lineEnd = value.length;
  const block = value.slice(lineStart, lineEnd);
  const lines = block.split('\n');
  let mapped: string[];
  if (kind === 'h1' || kind === 'h2' || kind === 'h3') {
    const prefix = kind === 'h1' ? '# ' : kind === 'h2' ? '## ' : '### ';
    mapped = lines.map((ln) => {
      const t = ln.replace(/^#{1,3}\s+/, '');
      return `${prefix}${t || 'Heading'}`;
    });
  } else if (kind === 'bullet') {
    mapped = lines.map((ln, i) => {
      const t = ln.replace(/^(\s*)([-*]|\d+[.)])\s+/, '$1').trim();
      return `- ${t || (lines.length > 1 ? `item ${i + 1}` : 'list item')}`;
    });
  } else {
    mapped = lines.map((ln, i) => {
      const t = ln.replace(/^(\s*)([-*]|\d+[.)])\s+/, '$1').trim();
      // continue existing numbering when possible
      return `${i + 1}. ${t || (lines.length > 1 ? `item ${i + 1}` : 'list item')}`;
    });
  }
  const replacement = mapped.join('\n');
  const next = value.slice(0, lineStart) + replacement + value.slice(lineEnd);
  return { text: next, selStart: lineStart, selEnd: lineStart + replacement.length };
}
