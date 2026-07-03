---
name: jsPDF watermark opacity
description: How to draw translucent watermark images/shapes in jsPDF without breaking the render.
---

To draw a translucent background watermark (e.g. a large logo behind certificate/report content) with jsPDF:

```js
const gState = new doc.GState({ opacity: 0.06 });
doc.setGState(gState);
doc.addImage(dataUrl, "PNG", x, y, w, h);
doc.setGState(new doc.GState({ opacity: 1 })); // reset before drawing opaque content
```

**Why:** `GState` is an instance method on the `jsPDF` document object, not a static export — `jsPDF.GState` is `undefined`. Using the static form silently throws/fails. Always construct it via `new doc.GState(...)`.

**How to apply:** Any time you need semi-transparent shapes/images in a jsPDF document (watermarks, subtle overlays), get the constructor off the live `doc` instance and remember to reset opacity to 1 afterward so subsequent content isn't unintentionally faded.

Images embedded via `doc.addImage` need actual image data (data URL or base64), not just a URL string — in browser code, fetch the asset and convert via `FileReader.readAsDataURL` before passing it in.
