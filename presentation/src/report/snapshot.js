// One self-contained HTML file for a sheet: its markup, print.css and the fonts it
// uses as data URIs, plus the spec it came from (so the studio can open it again).
// No scripts; it prints to exactly one A4 page.
import printCss from './sheet/print.css?raw';
import { FACES, fontFaceCss, subsetsFor } from './fonts.js';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

async function dataUri(url) {
  const buf = new Uint8Array(await (await fetch(url)).arrayBuffer());
  let bin = '';
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return `data:font/woff2;base64,${btoa(bin)}`;
}

export async function standaloneHtml(sheet, spec) {
  const subsets = subsetsFor(sheet.textContent);
  const uris = new Map();
  await Promise.all(FACES.flatMap(face => [...subsets].map(async s => {
    uris.set(face.files[s], await dataUri(face.files[s]));
  })));
  const fonts = fontFaceCss((face, s) => (subsets.has(s) ? uris.get(face.files[s]) : null));

  const clone = sheet.cloneNode(true);
  clone.querySelectorAll('.fs-noexport').forEach(n => n.remove());
  clone.querySelectorAll('[data-clipped]').forEach(n => n.removeAttribute('data-clipped'));
  const json = JSON.stringify(spec).replace(/</g, '\\u003c');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="Foreshock report">
<title>${esc(spec.title || 'Foreshock report')}</title>
<style>
${fonts}
${printCss}
</style>
</head>
<body class="fs-page">
${clone.outerHTML}
<script type="application/json" id="foreshock-spec">${json}</script>
</body>
</html>
`;
}

/** The spec embedded in an exported HTML file, or null. */
export function specFromHtml(html) {
  const m = html.match(/<script type="application\/json" id="foreshock-spec">([\s\S]*?)<\/script>/);
  return m ? JSON.parse(m[1]) : null;
}
