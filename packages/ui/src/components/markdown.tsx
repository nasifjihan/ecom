import * as React from "react";
import { cn } from "@ecom/utils";

/**
 * A small Markdown renderer for store content (pages, blog posts, FAQ answers).
 *
 * It builds React elements and never injects HTML, so text typed by a store admin
 * can't run scripts on the storefront. Supported: # headings, paragraphs, - and 1.
 * lists, > quotes, **bold**, *italic*, `code` and [links](/path).
 */

const SAFE_URL = /^(\/(?!\/)|#|https?:\/\/|mailto:|tel:)/i;
const INLINE = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|_[^_\s][^_]*_|`[^`]+`|\[[^\]]+\]\([^)\s]+\))/g;

function inline(text: string, keyPrefix: string): React.ReactNode[] {
  return text.split(INLINE).map((part, i) => {
    const key = `${keyPrefix}-${i}`;
    if (!part) return null;
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) return <strong key={key}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) return <code key={key}>{part.slice(1, -1)}</code>;
    if (/^(\*[^*].*\*|_[^_].*_)$/.test(part)) return <em key={key}>{part.slice(1, -1)}</em>;
    const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(part);
    if (link) {
      const [, label, href] = link;
      if (!SAFE_URL.test(href!)) return <React.Fragment key={key}>{label}</React.Fragment>;
      const external = /^https?:\/\//i.test(href!);
      return (
        <a key={key} href={href} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
          {label}
        </a>
      );
    }
    return <React.Fragment key={key}>{part}</React.Fragment>;
  });
}

/** Keeps line breaks inside a paragraph. */
function lines(text: string, key: string) {
  return text.split("\n").flatMap((line, i) => (i === 0 ? inline(line, `${key}-${i}`) : [<br key={`${key}-br${i}`} />, ...inline(line, `${key}-${i}`)]));
}

type Block =
  | { kind: "h"; level: number; text: string }
  | { kind: "ul" | "ol"; items: string[] }
  | { kind: "quote" | "p"; lines: string[] };

const HEADING = /^(#{1,4})\s+(.*)$/;
const UL = /^\s*[-*+]\s+(.*)$/;
const OL = /^\s*\d+[.)]\s+(.*)$/;

/** Line-based parse: headings stand alone, list and quote lines group, anything else joins a paragraph. */
function parse(source: string): Block[] {
  const blocks: Block[] = [];
  let cur = null as Block | null;
  const flush = () => {
    if (cur) blocks.push(cur);
    cur = null;
  };
  for (const raw of source.replace(/\r\n/g, "\n").split("\n")) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      flush();
      continue;
    }
    const h = HEADING.exec(line.trim());
    const ul = UL.exec(line);
    const ol = OL.exec(line);
    if (h) {
      flush();
      blocks.push({ kind: "h", level: Math.min(h[1]!.length + 1, 4), text: h[2]! });
    } else if (ul || ol) {
      const kind = ul ? "ul" : "ol";
      const text = (ul ?? ol)![1]!;
      if (cur?.kind === kind) cur.items.push(text);
      else {
        flush();
        cur = { kind, items: [text] };
      }
    } else if (line.startsWith(">")) {
      const text = line.replace(/^>\s?/, "");
      if (cur?.kind === "quote") cur.lines.push(text);
      else {
        flush();
        cur = { kind: "quote", lines: [text] };
      }
    } else if (cur?.kind === "p") {
      cur.lines.push(line.trim());
    } else {
      flush();
      cur = { kind: "p", lines: [line.trim()] };
    }
  }
  flush();
  return blocks;
}

export function Markdown({ source, className }: { source: string | null | undefined; className?: string }) {
  return (
    <div className={cn("cms-prose", className)}>
      {parse(source ?? "").map((b, i) => {
        const key = `b${i}`;
        switch (b.kind) {
          case "h": {
            const Tag = `h${b.level}` as "h2" | "h3" | "h4";
            return <Tag key={key}>{inline(b.text, key)}</Tag>;
          }
          case "ul":
            return <ul key={key}>{b.items.map((t, j) => <li key={j}>{inline(t, `${key}-${j}`)}</li>)}</ul>;
          case "ol":
            return <ol key={key}>{b.items.map((t, j) => <li key={j}>{inline(t, `${key}-${j}`)}</li>)}</ol>;
          case "quote":
            return <blockquote key={key}>{lines(b.lines.join("\n"), key)}</blockquote>;
          default:
            return <p key={key}>{lines(b.lines.join("\n"), key)}</p>;
        }
      })}
    </div>
  );
}

/** Plain-text version for meta descriptions and excerpts. */
export function markdownToText(source: string | null | undefined, max = 160): string {
  const text = (source ?? "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[#>*_`]/g, "")
    .replace(/^\s*[-\d.)]+\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}
