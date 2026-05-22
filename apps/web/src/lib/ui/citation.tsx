/**
 * Citation rendering.
 *
 * Scripture citations render as a clickable reference that opens a popover
 * with the ESV verse text fetched server-side through /api/esv. Willis and
 * secondary citations render as reference text only — there is no API
 * fetch for non-scripture sources.
 *
 * The verse text never lives in the bundle (ADR 0006); only references do.
 */

import type { Citation } from "@/lib/data/types";
import { ScriptureCitationPopover } from "./citation-popover";

export function CitationLine({ citation }: { citation: Citation }) {
  if (citation.source_type === "scripture") {
    return (
      <span
        data-citation-id={citation.id}
        data-source-type={citation.source_type}
      >
        <ScriptureCitationPopover citation={citation} />
      </span>
    );
  }
  return (
    <span
      data-citation-id={citation.id}
      data-source-type={citation.source_type}
      className="font-mono text-xs text-(--color-fg-muted)"
    >
      {formatCitation(citation)}
    </span>
  );
}

export function formatCitation(citation: Citation): string {
  switch (citation.source_type) {
    case "scripture": {
      const { book, chapter, verse_start, verse_end } = citation;
      if (!book || chapter == null) return "Scripture (reference incomplete)";
      let ref = `${book} ${chapter}`;
      if (verse_start != null) {
        ref += `:${verse_start}`;
        if (verse_end != null && verse_end !== verse_start) {
          ref += `-${verse_end}`;
        }
      }
      return ref;
    }
    case "willis": {
      const { willis_chapter, willis_page_start, willis_page_end } = citation;
      const chap = willis_chapter ?? "Willis";
      if (willis_page_start == null) return `Willis — ${chap}`;
      const pages =
        willis_page_end != null && willis_page_end !== willis_page_start
          ? `pp. ${willis_page_start}–${willis_page_end}`
          : `p. ${willis_page_start}`;
      return `Willis — ${chap}, ${pages}`;
    }
    case "secondary": {
      const { secondary_work, secondary_locator } = citation;
      const work = secondary_work ?? "Secondary source";
      return secondary_locator ? `${work} — ${secondary_locator}` : work;
    }
  }
}
