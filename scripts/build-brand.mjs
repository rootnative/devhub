#!/usr/bin/env node
// Builds every DevHub brand asset from the one geometry below.
//
//   pnpm run build:brand
//
// assets/brand/* and docs/static/img/* are output. Edit the constants here,
// run the script, and commit the result. Never edit an output by hand. The
// script is byte-idempotent: a run with no change gives no diff.
//
// The mark is "Fit": one square, cut in two pieces on a stepped seam. It says
// the key fact of DevHub: a stored build fits the native code of the project,
// so no new build is necessary. The left piece is light amber, the right
// piece dark amber.
//
// Four candidates were rendered side by side before the maintainer selected
// this one on 2026-10-20. Render a new candidate before you believe it:
//
//   Drawers  three slabs, the middle one pulled out. At 16 px it is a menu
//            icon, or the text-align icon.
//   Shelf    two upright spines and one that leans. A library of builds, but
//            it is the common library glyph.
//   Pick     four spines, the third one lifted. It is a bar chart, or an
//            equalizer.
//   Sliding  Fit, with the right piece moved up and to the right. It was
//            kept as a variant, and the flat square won.
//
// The sibling marks are blue cubes (ui), indigo discs (inertia), a violet
// arrow (impulse), and emerald diamonds (game-engine). The org landing site
// shows them in one grid, so DevHub takes amber and flat straight-edged
// pieces.
//
// The renderer is the one of impulse/scripts/build-brand.mjs: a polygon
// rasterizer with 4x4 samples for each pixel, and a PNG encoder. Do not use
// QuickLook (qlmanage) to make a PNG: it puts each image on opaque white, and
// it moves an image to the top-left corner when it does not scale it.

import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { deflateSync } from 'node:zlib'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BRAND_DIR = path.join(ROOT, 'assets', 'brand')
const DOCS_IMG_DIR = path.join(ROOT, 'docs', 'static', 'img')

// The docs tokens --rn-accent and --rn-accent-strong in
// docs/src/css/custom.css, and the tones in apps/web/src/theme.ts, hold the
// same values. Change them together.
const LIGHT_TONES = { soft: '#f59e0b', strong: '#b45309' }
const DARK_TONES = { soft: '#fde68a', strong: '#fbbf24' }

const CANVAS_DARK = '#0a0a0a'

const MARK_VIEWBOX = 64

// The square, and the seam: down from the top at SEAM_TOP, a step to the left
// at STEP, and down to the bottom at SEAM_BOTTOM. GAP is the width of the cut.
const SQUARE = { x0: 12, y0: 12, x1: 52, y1: 52 }
const SEAM_TOP = 37.5
const SEAM_BOTTOM = 29.5
const STEP = 25.5
const GAP = 3

// At 16 px a cut of GAP is about one pixel, and the anti-aliasing fills it.
// The favicon takes a wider cut, so the seam stays visible.
const COMPACT_GAP = 5

function fit(gap) {
  const { x0, y0, x1, y1 } = SQUARE
  const g = gap / 2
  return [
    {
      tone: 'soft',
      points: [
        [x0, y0],
        [SEAM_TOP - g, y0],
        [SEAM_TOP - g, STEP - g],
        [SEAM_BOTTOM - g, STEP - g],
        [SEAM_BOTTOM - g, y1],
        [x0, y1],
      ],
    },
    {
      tone: 'strong',
      points: [
        [SEAM_TOP + g, y0],
        [x1, y0],
        [x1, y1],
        [SEAM_BOTTOM + g, y1],
        [SEAM_BOTTOM + g, STEP + g],
        [SEAM_TOP + g, STEP + g],
      ],
    },
  ]
}

const MARK_SHAPES = fit(GAP)
const COMPACT_SHAPES = fit(COMPACT_GAP)

function insidePolygon(px, py, poly) {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]
    const [xj, yj] = poly[j]
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside
    }
  }
  return inside
}

function bounds(shapeList) {
  const xs = shapeList.flatMap((s) => s.points.map((p) => p[0]))
  const ys = shapeList.flatMap((s) => s.points.map((p) => p[1]))
  const x0 = Math.min(...xs)
  const y0 = Math.min(...ys)
  const x1 = Math.max(...xs)
  const y1 = Math.max(...ys)
  return { x0, y0, x1, y1, width: x1 - x0, height: y1 - y0 }
}

const round = (n) => Number(n.toFixed(2))

function svgPath(s, colour) {
  const [first, ...rest] = s.points
  const d =
    `M ${round(first[0])} ${round(first[1])} ` +
    rest.map((p) => `L ${round(p[0])} ${round(p[1])}`).join(' ') +
    ' Z'
  return `<path d="${d}" fill="${colour}" />`
}

// `width` and `height` are set with `viewBox`, because Safari gives an SVG
// with no size a zero width in an <img> that sets only a height. The artwork
// is centred with a transform from its measured bounds, the same as the PNGs.
function markSvg({ tones, shapeList, note }) {
  const box = bounds(shapeList)
  const dx = round(MARK_VIEWBOX / 2 - (box.x0 + box.x1) / 2)
  const dy = round(MARK_VIEWBOX / 2 - (box.y0 + box.y1) / 2)
  const moved = dx !== 0 || dy !== 0
  const indent = moved ? '    ' : '  '
  return [
    note ? `<!--\n${note}\n-->` : null,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${MARK_VIEWBOX}" height="${MARK_VIEWBOX}" viewBox="0 0 ${MARK_VIEWBOX} ${MARK_VIEWBOX}" fill="none" role="img" aria-label="DevHub">`,
    '  <title>DevHub</title>',
    moved ? `  <g transform="translate(${dx} ${dy})">` : null,
    ...shapeList.map((s) => `${indent}${svgPath(s, tones[s.tone])}`),
    moved ? '  </g>' : null,
    '</svg>',
    '',
  ]
    .filter((line) => line !== null)
    .join('\n')
}

function hexToRgb(hex) {
  const value = parseInt(hex.slice(1), 16)
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff]
}

const AA = 4

/**
 * Draws layers of polygons, back to front, onto a width x height canvas.
 * Each layer maps its canvas units to pixels with `unit` and an origin.
 * Each tone is opaque, so a partial alpha comes only from an edge pixel.
 */
function renderCanvas({ width, height, background = null, layers }) {
  const items = layers.flatMap((layer) =>
    layer.shapeList.map((s) => {
      const b = bounds([s])
      return {
        points: s.points,
        rgb: hexToRgb(layer.tones[s.tone]),
        unit: layer.unit,
        ox: layer.originX,
        oy: layer.originY,
        left: b.x0 * layer.unit + layer.originX - 1,
        top: b.y0 * layer.unit + layer.originY - 1,
        right: b.x1 * layer.unit + layer.originX + 1,
        bottom: b.y1 * layer.unit + layer.originY + 1,
      }
    }),
  )
  const base = background ? hexToRgb(background) : null
  const rgba = Buffer.alloc(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let [r, g, b] = base ?? [0, 0, 0]
      let a = base ? 1 : 0
      for (const item of items) {
        if (
          x < item.left ||
          x > item.right ||
          y < item.top ||
          y > item.bottom
        ) {
          continue
        }
        let hits = 0
        for (let sy = 0; sy < AA; sy++) {
          const uy = (y + (sy + 0.5) / AA - item.oy) / item.unit
          for (let sx = 0; sx < AA; sx++) {
            const ux = (x + (sx + 0.5) / AA - item.ox) / item.unit
            if (insidePolygon(ux, uy, item.points)) hits++
          }
        }
        if (hits === 0) continue
        const alpha = hits / (AA * AA)
        const out = alpha + a * (1 - alpha)
        const keep = (a * (1 - alpha)) / out
        const add = alpha / out
        r = item.rgb[0] * add + r * keep
        g = item.rgb[1] * add + g * keep
        b = item.rgb[2] * add + b * keep
        a = out
      }
      const o = (y * width + x) * 4
      rgba[o] = Math.round(r)
      rgba[o + 1] = Math.round(g)
      rgba[o + 2] = Math.round(b)
      rgba[o + 3] = Math.round(a * 255)
    }
  }
  return encodePng(rgba, width, height)
}

/** The mark centred on a square canvas. `scale` is the part it fills. */
function renderMark({ shapeList, tones, size, scale, background = null }) {
  const box = bounds(shapeList)
  const unit = (size * scale) / Math.max(box.width, box.height)
  return renderCanvas({
    width: size,
    height: size,
    background,
    layers: [
      {
        shapeList,
        tones,
        unit,
        originX: size / 2 - ((box.x0 + box.x1) / 2) * unit,
        originY: size / 2 - ((box.y0 + box.y1) / 2) * unit,
      },
    ],
  })
}

const CARD_WIDTH = 1200
const CARD_HEIGHT = 630
const CARD_MARK_SIZE = 300
const CARD_BAR_HEIGHT = 6

// The Open Graph card of the docs site. It has the mark and no text, because
// this renderer has no text renderer. A link preview shows the page title
// next to the card.
function renderSocialCard() {
  const box = bounds(MARK_SHAPES)
  const unit = CARD_MARK_SIZE / Math.max(box.width, box.height)
  return renderCanvas({
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    background: CANVAS_DARK,
    layers: [
      {
        shapeList: MARK_SHAPES,
        tones: DARK_TONES,
        unit,
        originX: CARD_WIDTH / 2 - ((box.x0 + box.x1) / 2) * unit,
        originY: CARD_HEIGHT / 2 - ((box.y0 + box.y1) / 2) * unit,
      },
      {
        shapeList: [
          {
            tone: 'bar',
            points: [
              [0, CARD_HEIGHT - CARD_BAR_HEIGHT],
              [CARD_WIDTH, CARD_HEIGHT - CARD_BAR_HEIGHT],
              [CARD_WIDTH, CARD_HEIGHT],
              [0, CARD_HEIGHT],
            ],
          },
        ],
        tones: { bar: LIGHT_TONES.soft },
        unit: 1,
        originX: 0,
        originY: 0,
      },
    ],
  })
}

const CRC_TABLE = (() => {
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  return table
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  }
  return (c ^ 0xffffffff) >>> 0
}

function pngChunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body), 0)
  return Buffer.concat([length, body, crc])
}

/** 8-bit RGBA PNG, one filter-0 scanline for each row. */
function encodePng(rgba, width, height) {
  const stride = width * 4
  const raw = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

const written = []

function write(file, contents) {
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, contents)
  written.push(path.relative(ROOT, file))
}

const MARK = { tones: LIGHT_TONES, shapeList: MARK_SHAPES }
const MARK_DARK = { tones: DARK_TONES, shapeList: MARK_SHAPES }
const COMPACT = { tones: LIGHT_TONES, shapeList: COMPACT_SHAPES }

write(path.join(BRAND_DIR, 'devhub-mark.svg'), markSvg(MARK))
write(
  path.join(BRAND_DIR, 'devhub-mark-dark.svg'),
  markSvg({ ...MARK_DARK, note: '  Lighter tones, for a dark surface.' }),
)
write(
  path.join(BRAND_DIR, 'devhub-mark-compact.svg'),
  markSvg({
    ...COMPACT,
    note: '  A wider cut, for 32 px and less, where the anti-aliasing fills the\n  normal cut.',
  }),
)
// The org landing site and the READMEs read this file over
// raw.githubusercontent.com. Do not rename it. It is transparent, so it shows
// correctly on the light and the dark theme of GitHub.
write(
  path.join(BRAND_DIR, 'devhub-mark.png'),
  renderMark({ ...MARK, size: 512, scale: 0.9 }),
)

write(path.join(DOCS_IMG_DIR, 'logo.svg'), markSvg(MARK))
write(path.join(DOCS_IMG_DIR, 'logo-dark.svg'), markSvg(MARK_DARK))
// A browser tab gives a favicon about 16 px, so the mark fills the frame.
write(
  path.join(DOCS_IMG_DIR, 'favicon.png'),
  renderMark({ ...COMPACT, size: 180, scale: 0.94 }),
)
write(path.join(DOCS_IMG_DIR, 'social-card.png'), renderSocialCard())

console.log(`Wrote ${written.length} brand assets:`)
for (const file of written) console.log(`  ${file}`)
