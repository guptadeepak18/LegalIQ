---
name: rgb(var()) alpha syntax
description: How to apply alpha transparency to CSS custom-property-based RGB colors without breaking the color value.
---

When a theme defines colors as space-separated RGB triplets in a custom property (e.g. `--pillar-rgb-0: 220 38 38;`), the correct way to use them with transparency is the CSS relative-color alpha syntax:

```css
rgb(var(--pillar-rgb-0) / 26%)
```

**Why:** Concatenating a hex-alpha suffix (e.g. appending `2b`/`44` to try to build `#rrggbb + alpha`) onto a `rgb(var(...))` string does not work — `rgb()` takes either a full component list or the `/ alpha` slash syntax, not string-appended hex suffixes. This was the bug behind mismatched/broken pillar accent colors before the fix.

**How to apply:** Any helper that derives themed alpha variants from a CSS custom property should build the string as `` `rgb(var(${cssVar}) / ${alphaPct}%)` `` and only omit the slash clause for the fully opaque case (`rgb(var(${cssVar}))`).
