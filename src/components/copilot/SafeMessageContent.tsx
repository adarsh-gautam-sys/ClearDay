"use client";

import { Fragment, type ReactNode } from "react";

/**
 * Safe XSS-free formatter for Copilot replies: converts `**bold**` spans and
 * bullet lines (`* `, `- `, `• `) into native React elements without innerHTML.
 */
function renderInlineBold(line: string, keyPrefix: string): ReactNode[] {
  const segments = line.split(/(\*\*[^*]+\*\*)/g);
  return segments.map((part, idx) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return (
        <strong key={`${keyPrefix}-b-${idx}`} className="font-semibold text-[#18181B]">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <Fragment key={`${keyPrefix}-t-${idx}`}>{part}</Fragment>;
  });
}

export function SafeMessageContent({ content }: { content: string }) {
  if (!content) {
    return <span>…</span>;
  }

  const lines = content.split("\n");
  const blocks: ReactNode[] = [];
  let listItems: string[] = [];

  function flushList(keyBase: string) {
    if (listItems.length === 0) return;
    blocks.push(
      <ul
        key={`ul-${keyBase}`}
        className="my-1.5 list-disc space-y-1 pl-4 text-xs leading-relaxed text-[#27272A]"
      >
        {listItems.map((item, idx) => (
          <li key={`li-${keyBase}-${idx}`}>
            {renderInlineBold(item, `${keyBase}-${idx}`)}
          </li>
        ))}
      </ul>,
    );
    listItems = [];
  }

  lines.forEach((rawLine, index) => {
    const trimmed = rawLine.trim();
    const bulletMatch = trimmed.match(/^(?:\*|-|•)\s+(.*)$/);
    if (bulletMatch) {
      listItems.push(bulletMatch[1] ?? "");
      return;
    }

    flushList(`b-${index}`);

    if (trimmed === "") {
      return;
    }

    blocks.push(
      <p key={`p-${index}`} className="text-xs leading-relaxed text-[#18181B]">
        {renderInlineBold(trimmed, `p-${index}`)}
      </p>,
    );
  });

  flushList("end");

  return <div className="space-y-1.5">{blocks}</div>;
}
