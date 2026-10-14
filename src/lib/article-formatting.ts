/** The article body accepts a small text syntax, never HTML or executable MDX. */
export type InlineNode =
  | { type: "text"; text: string }
  | { type: "strong" | "em"; children: InlineNode[] }
  | { type: "link"; href: string; children: InlineNode[] };

export type ArticleTextBlock =
  | { type: "paragraph"; children: InlineNode[] }
  | {
      type: "unordered-list" | "ordered-list";
      items: InlineNode[][];
      start?: number;
    };

export type ArticleFormat = "bold" | "italic" | "unordered-list" | "ordered-list";
export type ArticleFormatResult = {
  value: string;
  selectionStart: number;
  selectionEnd: number;
};

const MAX_DEPTH = 8;
const PLACEHOLDER = "文字";
const ESCAPABLE = /[\\*\[\]()]/;

/** Require an explicit HTTPS URL; URL normalization must not hide unsafe input. */
export function safeArticleLink(value: string): string | null {
  if (
    !/^https:\/\/[^/]/i.test(value) ||
    /[\s\u0000-\u001f\u007f-\u009f\\]/u.test(value) ||
    /%(?:0[0-9a-f]|1[0-9a-f]|7f)/i.test(value)
  ) {
    return null;
  }
  try {
    const url = new URL(value);
    const authority = value.slice(value.indexOf("://") + 3).split(/[/?#]/, 1)[0];
    if (
      url.protocol !== "https:" ||
      !url.hostname ||
      url.username ||
      url.password ||
      authority.includes("@")
    ) {
      return null;
    }
    return url.href;
  } catch {
    return null;
  }
}

type Budget = { left: number };
type Frame = { marker: string; children: InlineNode[]; depth: number };

function appendText(nodes: InlineNode[], text: string) {
  if (!text) return;
  const last = nodes[nodes.length - 1];
  if (last?.type === "text") last.text += text;
  else nodes.push({ type: "text", text });
}

function appendNodes(target: InlineNode[], nodes: InlineNode[]) {
  for (const node of nodes) {
    if (node.type === "text") appendText(target, node.text);
    else target.push(node);
  }
}

function flattenFrame(frame: Frame, target: InlineNode[]) {
  appendText(target, frame.marker);
  appendNodes(target, frame.children);
}

/** Find one complete link, with a shared budget for unmatched delimiter searches. */
function readLink(text: string, start: number, budget: Budget) {
  let endLabel = -1;
  let i = start + 1;
  for (; i < text.length && budget.left > 0; i++, budget.left--) {
    if (text[i] === "\\") {
      i++;
      continue;
    }
    if (text[i] === "[" || text[i] === "\n") return null;
    if (text[i] === "]") {
      endLabel = i;
      break;
    }
  }
  if (endLabel < 0 || text[endLabel + 1] !== "(" || endLabel === start + 1) return null;
  const malformed = () => ({
    end: text.indexOf("\n", endLabel + 2) < 0 ? text.length : text.indexOf("\n", endLabel + 2),
    label: "",
    url: "",
  });
  let parentheses = 1;
  for (i = endLabel + 2; i < text.length && budget.left > 0; i++, budget.left--) {
    if (text[i] === "\n") return malformed();
    if (text[i] === "(") parentheses++;
    if (parentheses > MAX_DEPTH) return malformed();
    if (text[i] === ")" && --parentheses === 0) {
      return {
        end: i + 1,
        label: text.slice(start + 1, endLabel),
        url: text.slice(endLabel + 2, i),
      };
    }
  }
  return malformed();
}

function parseInlineWithBudget(text: string, budget: Budget, depth: number, links: boolean): InlineNode[] {
  if (depth >= MAX_DEPTH) return text ? [{ type: "text", text }] : [];
  const root: Frame = { marker: "", children: [], depth: 0 };
  const stack = [root];
  let i = 0;

  while (i < text.length) {
    let target = stack[stack.length - 1].children;
    if (budget.left-- <= 0) {
      appendText(target, text.slice(i));
      break;
    }
    if (text[i] === "\\" && ESCAPABLE.test(text[i + 1] ?? "")) {
      appendText(target, text[i + 1]);
      i += 2;
      continue;
    }
    if (links && text[i] === "[") {
      const link = readLink(text, i, budget);
      if (link) {
        const href = safeArticleLink(link.url);
        const activeDepth = depth + stack.reduce((sum, frame) => sum + frame.depth, 0);
        if (href && activeDepth < MAX_DEPTH) {
          target.push({
            type: "link",
            href,
            children: parseInlineWithBudget(link.label, budget, activeDepth + 1, false),
          });
        } else {
          // Invalid links stay literal, including any formatting in their labels.
          appendText(target, text.slice(i, link.end));
        }
        i = link.end;
        continue;
      }
    }
    if (text[i] !== "*") {
      appendText(target, text[i++]);
      continue;
    }

    let length = 1;
    while (text[i + length] === "*" && budget.left > 0) {
      length++;
      budget.left--;
    }
    const marker = text.slice(i, i + length);
    if (length > 3) {
      appendText(target, marker);
      i += length;
      continue;
    }
    const canClose = i > 0 && !/\s/.test(text[i - 1]);
    const canOpen = i + length < text.length && !/\s/.test(text[i + length]);
    // A shared *** closer can end nested single/double markers in either order.
    if (
      length === 3 && canClose && stack.length > 2 &&
      stack[stack.length - 1].marker.length + stack[stack.length - 2].marker.length === 3
    ) {
      for (let count = 0; count < 2; count++) {
        const frame = stack.pop()!;
        stack[stack.length - 1].children.push({
          type: frame.marker.length === 2 ? "strong" : "em",
          children: frame.children,
        });
      }
      i += length;
      continue;
    }
    let matching = -1;
    if (canClose) {
      for (let j = stack.length - 1; j > 0; j--) {
        if (stack[j].marker === marker) {
          matching = j;
          break;
        }
      }
    }
    if (matching > 0) {
      while (stack.length - 1 > matching) {
        const unmatched = stack.pop()!;
        flattenFrame(unmatched, stack[stack.length - 1].children);
      }
      const frame = stack.pop()!;
      target = stack[stack.length - 1].children;
      const node: InlineNode = length === 3
        ? { type: "strong", children: [{ type: "em", children: frame.children }] }
        : { type: length === 2 ? "strong" : "em", children: frame.children };
      target.push(node);
    } else if (
      canOpen &&
      depth + stack.reduce((sum, frame) => sum + frame.depth, 0) + (length === 3 ? 2 : 1) <= MAX_DEPTH
    ) {
      if (length === 3) {
        // Keep the markers separate so **bold *italic*** and ***bold** italic*
        // can close one nested style before the other.
        let nextMarkerLength = 0;
        for (let j = i + length; j < text.length && budget.left > 0; j++, budget.left--) {
          if (text[j] === "\\") { j++; continue; }
          if (text[j] === "*") {
            nextMarkerLength = text[j + 1] !== "*" ? 1 : text[j + 2] === "*" ? 3 : 2;
            break;
          }
        }
        const markers = nextMarkerLength === 2 ? ["*", "**"] : ["**", "*"];
        for (const part of markers) stack.push({ marker: part, children: [], depth: 1 });
      } else {
        stack.push({ marker, children: [], depth: 1 });
      }
    } else {
      appendText(target, marker);
    }
    i += length;
  }
  while (stack.length > 1) {
    const frame = stack.pop()!;
    flattenFrame(frame, stack[stack.length - 1].children);
  }
  return root.children;
}

export function parseInline(text: string): InlineNode[] {
  return parseInlineWithBudget(text, { left: text.length * 16 + 64 }, 0, true);
}

function listLine(line: string) {
  const unordered = line.match(/^[ \t]{0,3}-[ \t]+(.+)$/);
  if (unordered) return { type: "unordered-list" as const, text: unordered[1], start: 1 };
  const ordered = line.match(/^[ \t]{0,3}([1-9]\d{0,8})\.[ \t]+(.+)$/);
  if (ordered) return { type: "ordered-list" as const, text: ordered[2], start: Number(ordered[1]) };
  return null;
}

/** Existing paragraph boundaries stay boundaries; only contiguous list lines group. */
export function parseArticleParagraphs(paragraphs: string[]): ArticleTextBlock[] {
  const blocks: ArticleTextBlock[] = [];
  for (const paragraph of paragraphs) {
    const lines = paragraph.split(/\r?\n/);
    if (!lines.some((line) => listLine(line))) {
      blocks.push({ type: "paragraph", children: parseInline(paragraph) });
      continue;
    }
    let i = 0;
    while (i < lines.length) {
      const item = listLine(lines[i]);
      if (item) {
        const block: ArticleTextBlock = {
          type: item.type,
          items: [parseInline(item.text)],
          ...(item.type === "ordered-list" ? { start: item.start } : {}),
        };
        i++;
        for (; i < lines.length; i++) {
          const next = listLine(lines[i]);
          if (next?.type !== item.type) break;
          block.items.push(parseInline(next.text));
        }
        blocks.push(block);
      } else if (!lines[i].trim()) {
        i++;
      } else {
        const ordinary = [lines[i++]];
        while (i < lines.length && lines[i].trim() && !listLine(lines[i])) ordinary.push(lines[i++]);
        blocks.push({ type: "paragraph", children: parseInline(ordinary.join("\n")) });
      }
    }
  }
  return blocks;
}

function boundedPosition(position: number, length: number) {
  return Number.isFinite(position) ? Math.max(0, Math.min(length, Math.trunc(position))) : 0;
}

function hasStyle(nodes: InlineNode[], type: "strong" | "em"): boolean {
  return nodes.some((node) => node.type === type || ("children" in node && hasStyle(node.children, type)));
}

function inlineSyntax(nodes: InlineNode[], omit: "strong" | "em"): string {
  return nodes.map((node): string => {
    if (node.type === "text") return node.text.replace(/([\\*\[\]])/g, "\\$1");
    const children = inlineSyntax(node.children, omit);
    if (node.type === omit) return children;
    if (node.type === "link") return `[${children}](${node.href})`;
    const marker = node.type === "strong" ? "**" : "*";
    return marker + children + marker;
  }).join("");
}

function formatInlineSegment(value: string, start: number, end: number, format: "bold" | "italic"): ArticleFormatResult {
  const marker = format === "bold" ? "**" : "*";
  const wanted = format === "bold" ? "strong" : "em";
  let selected = value.slice(start, end);

  // A multi-line selection may include one boundary of the first/last wrapper.
  if (selected.endsWith(marker) && !selected.startsWith(marker) &&
      value.slice(start - marker.length, start) === marker &&
      value[start - marker.length - 1] !== "\\") {
    start -= marker.length;
    selected = value.slice(start, end);
  }
  if (selected.startsWith(marker) && !selected.endsWith(marker) &&
      value.slice(end, end + marker.length) === marker) {
    end += marker.length;
    selected = value.slice(start, end);
  }

  const leading = selected.match(/^\s*/)?.[0] ?? "";
  const trailing = selected.trim() ? selected.match(/\s*$/)?.[0] ?? "" : "";
  const content = selected.trim();
  const parsed = parseInline(content);
  const only = parsed.length === 1 ? parsed[0] : null;
  const combined = only && (only.type === "strong" || only.type === "em") &&
    only.children.length === 1 &&
    (only.children[0].type === "strong" || only.children[0].type === "em") &&
    only.children[0].type !== only.type &&
    content.startsWith("***") && content.endsWith("***");
  const exactWrapper = only?.type === wanted && content.startsWith(marker) &&
    content.endsWith(marker) && content.length > marker.length * 2;
  if (combined || exactWrapper) {
    const inner = content.slice(marker.length, -marker.length);
    const remainingMarker = combined ? (format === "bold" ? 1 : 2) : 0;
    return {
      value: value.slice(0, start) + leading + inner + trailing + value.slice(end),
      selectionStart: start + leading.length + remainingMarker,
      selectionEnd: start + leading.length + inner.length - remainingMarker,
    };
  }
  if (
    selected &&
    value.slice(start - marker.length, start) === marker &&
    value.slice(end, end + marker.length) === marker &&
    value[start - marker.length - 1] !== "\\" &&
    (format === "bold" || (
      (value[start - 2] !== "*" || value[start - 3] === "*") &&
      (value[end + 1] !== "*" || value[end + 2] === "*")
    ))
  ) {
    return { value: value.slice(0, start - marker.length) + selected + value.slice(end + marker.length), selectionStart: start - marker.length, selectionEnd: end - marker.length };
  }
  // Do not create **** or split separate wrappers by stripping only outer markers.
  // Existing matching styles are consolidated before the selection is wrapped.
  const inner = (content && hasStyle(parsed, wanted)
    ? inlineSyntax(parseInline(content), wanted) : content) || PLACEHOLDER;
  const replacement = leading + marker + inner + marker + trailing;
  const selectionStart = start + leading.length + marker.length;
  return { value: value.slice(0, start) + replacement + value.slice(end), selectionStart, selectionEnd: selectionStart + inner.length };
}

/** Format a textarea selection and return the selection the editor should restore. */
export function applyArticleFormat(value: string, start: number, end: number, format: ArticleFormat): ArticleFormatResult {
  start = boundedPosition(start, value.length);
  end = boundedPosition(end, value.length);
  if (start > end) [start, end] = [end, start];

  if (format === "bold" || format === "italic") {
    if (start === end) return formatInlineSegment(value, start, end, format);
    const segments: { start: number; end: number }[] = [];
    let cursor = start;
    while (cursor < end) {
      const nextBreak = value.indexOf("\n", cursor);
      const lineEnd = nextBreak < 0 ? end : Math.min(nextBreak, end);
      const lineStart = cursor === 0 ? 0 : value.lastIndexOf("\n", cursor - 1) + 1;
      const prefix = value.slice(lineStart, lineEnd).match(/^[ \t]{0,3}(?:-[ \t]+|[1-9]\d{0,8}\.[ \t]+)/);
      const contentStart = Math.max(cursor, lineStart + (prefix?.[0].length ?? 0));
      if (value.slice(contentStart, lineEnd).trim()) segments.push({ start: contentStart, end: lineEnd });
      cursor = lineEnd + 1;
    }
    if (segments.length === 0) return formatInlineSegment(value, start, end, format);
    if (segments.length === 1 && segments[0].start === start && segments[0].end === end) {
      return formatInlineSegment(value, start, end, format);
    }
    let current = value;
    let selectionStart = start;
    let selectionEnd = end;
    // Keep list prefixes and blank paragraph boundaries outside the style markers.
    for (let i = segments.length - 1; i >= 0; i--) {
      const segment = segments[i];
      const result = formatInlineSegment(current, segment.start, segment.end, format);
      selectionEnd = Math.max(selectionEnd + result.value.length - current.length, result.selectionEnd);
      selectionStart = Math.min(selectionStart, result.selectionStart);
      current = result.value;
    }
    return { value: current, selectionStart, selectionEnd };
  }

  const blockStart = start === 0 ? 0 : value.lastIndexOf("\n", start - 1) + 1;
  const lastSelected = end > start ? end - 1 : end;
  const nextBreak = value.indexOf("\n", lastSelected);
  const blockEnd = nextBreak < 0 ? value.length : nextBreak;
  const lines = value.slice(blockStart, blockEnd).split("\n");
  const prefix = /^([ \t]{0,3})(?:-[ \t]+|[1-9]\d{0,8}\.[ \t]+)(.*)$/;
  const ownPrefix = format === "unordered-list" ? /^[ \t]{0,3}-[ \t]+/ : /^[ \t]{0,3}[1-9]\d{0,8}\.[ \t]+/;
  const nonblank = lines.filter((line) => line.trim());
  const remove = nonblank.length > 0 && nonblank.every((line) => ownPrefix.test(line));
  let number = 0;
  const replacement = lines.map((line) => {
    if (!line.trim() && lines.length > 1) return line;
    const existing = line.match(prefix);
    if (remove) return existing ? existing[1] + existing[2] : line;
    const indent = existing?.[1] ?? line.match(/^[ \t]{0,3}/)?.[0] ?? "";
    const content = existing ? existing[2] : line.slice(indent.length);
    number++;
    return indent + (format === "unordered-list" ? "- " : `${number}. `) + (content.trim() ? content : PLACEHOLDER);
  }).join("\n");
  if (!value.slice(blockStart, blockEnd).trim() && lines.length === 1 && !remove) {
    const selectionStart = blockStart + replacement.length - PLACEHOLDER.length;
    return { value: value.slice(0, blockStart) + replacement + value.slice(blockEnd), selectionStart, selectionEnd: selectionStart + PLACEHOLDER.length };
  }
  return { value: value.slice(0, blockStart) + replacement + value.slice(blockEnd), selectionStart: blockStart, selectionEnd: blockStart + replacement.length };
}
