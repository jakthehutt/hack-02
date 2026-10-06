// Self-hosted faces for the sheet, so a PDF or HTML export never depends on
// Google Fonts (whose cross-origin CSS also can't be inlined into a snapshot).
// Only the latin, latin-ext and cyrillic subsets: the bundle quotes Cyrillic sources.
import geistLatin600 from '@fontsource/geist/files/geist-latin-600-normal.woff2?url';
import geistLatinExt600 from '@fontsource/geist/files/geist-latin-ext-600-normal.woff2?url';
import geistCyr600 from '@fontsource/geist/files/geist-cyrillic-600-normal.woff2?url';
import geistLatin800 from '@fontsource/geist/files/geist-latin-800-normal.woff2?url';
import geistLatinExt800 from '@fontsource/geist/files/geist-latin-ext-800-normal.woff2?url';
import geistCyr800 from '@fontsource/geist/files/geist-cyrillic-800-normal.woff2?url';
import interLatin400 from '@fontsource/inter/files/inter-latin-400-normal.woff2?url';
import interLatinExt400 from '@fontsource/inter/files/inter-latin-ext-400-normal.woff2?url';
import interCyr400 from '@fontsource/inter/files/inter-cyrillic-400-normal.woff2?url';
import interLatin500 from '@fontsource/inter/files/inter-latin-500-normal.woff2?url';
import interLatinExt500 from '@fontsource/inter/files/inter-latin-ext-500-normal.woff2?url';
import interCyr500 from '@fontsource/inter/files/inter-cyrillic-500-normal.woff2?url';
import interLatin600 from '@fontsource/inter/files/inter-latin-600-normal.woff2?url';
import interLatinExt600 from '@fontsource/inter/files/inter-latin-ext-600-normal.woff2?url';
import interCyr600 from '@fontsource/inter/files/inter-cyrillic-600-normal.woff2?url';
import interLatin400i from '@fontsource/inter/files/inter-latin-400-italic.woff2?url';
import interLatinExt400i from '@fontsource/inter/files/inter-latin-ext-400-italic.woff2?url';
import interCyr400i from '@fontsource/inter/files/inter-cyrillic-400-italic.woff2?url';
import monoLatin400 from '@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2?url';
import monoLatinExt400 from '@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-ext-400-normal.woff2?url';
import monoCyr400 from '@fontsource/ibm-plex-mono/files/ibm-plex-mono-cyrillic-400-normal.woff2?url';
import monoLatin500 from '@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff2?url';
import monoLatinExt500 from '@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-ext-500-normal.woff2?url';
import monoCyr500 from '@fontsource/ibm-plex-mono/files/ibm-plex-mono-cyrillic-500-normal.woff2?url';

// From the @fontsource CSS (unicode-range per subset).
export const RANGES = {
  latin: 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD',
  'latin-ext': 'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF',
  cyrillic: 'U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116',
};

export const FAMILY = { display: 'Foreshock Geist', body: 'Foreshock Inter', mono: 'Foreshock Plex Mono' };

export const FACES = [
  { family: FAMILY.display, weight: 600, style: 'normal', files: { latin: geistLatin600, 'latin-ext': geistLatinExt600, cyrillic: geistCyr600 } },
  { family: FAMILY.display, weight: 800, style: 'normal', files: { latin: geistLatin800, 'latin-ext': geistLatinExt800, cyrillic: geistCyr800 } },
  { family: FAMILY.body, weight: 400, style: 'normal', files: { latin: interLatin400, 'latin-ext': interLatinExt400, cyrillic: interCyr400 } },
  { family: FAMILY.body, weight: 400, style: 'italic', files: { latin: interLatin400i, 'latin-ext': interLatinExt400i, cyrillic: interCyr400i } },
  { family: FAMILY.body, weight: 500, style: 'normal', files: { latin: interLatin500, 'latin-ext': interLatinExt500, cyrillic: interCyr500 } },
  { family: FAMILY.body, weight: 600, style: 'normal', files: { latin: interLatin600, 'latin-ext': interLatinExt600, cyrillic: interCyr600 } },
  { family: FAMILY.mono, weight: 400, style: 'normal', files: { latin: monoLatin400, 'latin-ext': monoLatinExt400, cyrillic: monoCyr400 } },
  { family: FAMILY.mono, weight: 500, style: 'normal', files: { latin: monoLatin500, 'latin-ext': monoLatinExt500, cyrillic: monoCyr500 } },
];

/** @font-face rules; `src(face, subset)` returns the URL (or data URI) to use, or null to skip. */
export function fontFaceCss(src = (face, subset) => face.files[subset]) {
  const rules = [];
  for (const face of FACES) {
    for (const subset of Object.keys(RANGES)) {
      const url = src(face, subset);
      if (!url) continue;
      rules.push(`@font-face{font-family:'${face.family}';font-style:${face.style};font-weight:${face.weight};font-display:block;src:url(${url}) format('woff2');unicode-range:${RANGES[subset]}}`);
    }
  }
  return rules.join('\n');
}

let installed = null;
/** Add the faces to the page and wait until every one of them has loaded. */
export function installFonts() {
  if (installed) return installed;
  const style = document.createElement('style');
  style.id = 'foreshock-fonts';
  style.textContent = fontFaceCss();
  document.head.appendChild(style);
  installed = Promise.all(FACES.map(f => document.fonts.load(`${f.style} ${f.weight} 12px "${f.family}"`, 'AaЖ')))
    .then(() => document.fonts.ready);
  return installed;
}

/** Subsets whose unicode-range covers any character in `text`. */
export function subsetsFor(text) {
  const used = new Set(['latin']);
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (cp >= 0x400 && cp <= 0x52f) used.add('cyrillic');
    else if (cp >= 0x100 && cp <= 0x2ff) used.add('latin-ext');
  }
  return used;
}
