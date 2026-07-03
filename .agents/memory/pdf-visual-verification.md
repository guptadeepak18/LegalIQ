---
name: PDF visual verification technique
description: How to render a client-side jsPDF report generator to PNG images for visual QA, without a browser or the app's auth wall.
---

When a PDF is generated client-side by a `jsPDF`-based module (e.g. a `pdfGenerator.ts` that exports a `generateReportPDF(data)` function calling `doc.save(...)`), you can visually verify layout changes without going through the app UI (which may be behind an auth wall like Clerk).

**Steps:**
1. Copy the generator file into a scratch dir (e.g. `/tmp/pdftest/src/`).
2. Symlink the real `jspdf` package from the artifact's `node_modules` into the scratch dir's `node_modules/jspdf` (don't reinstall — versions must match).
3. Add a minimal `tsconfig.json` (`target: ES2020`, `module: ESNext`, `moduleResolution: node`, `esModuleInterop: true`, `skipLibCheck: true`) and transpile with the **workspace's own** TypeScript binary: `node /home/runner/workspace/node_modules/typescript/bin/tsc -p tsconfig.json`. Do NOT use `npx tsc` — npx may resolve to an unrelated `tsc` npm package that isn't the TypeScript compiler.
4. Write a `.mjs` runner that imports the compiled JS, monkey-patches `jsPDF.prototype.save` to write the arraybuffer output via `fs.writeFileSync`, builds a realistic sample `data` object matching the generator's input type, and calls the export function.
5. Note: `doc.save(filename)` in jsPDF report generators often derives the filename dynamically from report data (e.g. company name + score) — don't assume a fixed output filename; `ls` the directory afterward to find the actual `.pdf` file.
6. Convert to images: `pdftoppm -png -r 100 <file>.pdf page` (produces `page-1.png`, `page-2.png`, ...).
7. Read the PNGs with the file-read tool to inspect layout, spacing, and text rendering per page.

This is faster and more reliable than trying to screenshot an authenticated in-app PDF download flow.
