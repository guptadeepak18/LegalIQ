---
name: jsPDF helvetica dash encoding bug
description: En-dash/em-dash characters render as garbled glyphs when using jsPDF's built-in helvetica font.
---

jsPDF's default built-in fonts (helvetica, etc., not embedded custom fonts) use WinAnsi-style encoding that does not map en-dash (–, U+2013) or em-dash (—, U+2014) correctly. Text containing these characters renders as a broken/garbled glyph in the output PDF instead of a dash.

**Why:** Discovered when a "12–24 months" string in a PDF report section rendered as "1224 months" (dash disappeared) on visual QA render-to-PNG check.

**How to apply:** When writing any string that will be passed to `doc.text(...)` in a jsPDF generator using standard (non-embedded) fonts, use a plain hyphen `-` instead of en-dash/em-dash. This applies to ranges ("12-24 months"), interruptions, etc. If an embedded custom font with full Unicode coverage is added later, this restriction may no longer apply — verify via the PDF visual verification technique before assuming it's safe to use dashes again.
