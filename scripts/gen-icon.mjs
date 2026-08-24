// 生成 512x512 应用图标 build/icon.png（纯 Node 实现，无第三方依赖）
import zlib from 'node:zlib'
import fs from 'node:fs'
import path from 'node:path'

const SIZE = 512
const px = new Uint8Array(SIZE * SIZE * 4)

const lerp = (a, b, t) => a + (b - a) * t
const c1 = [79, 70, 229] // indigo #4f46e5
const c2 = [14, 165, 233] // sky #0ea5e9
const radius = 96

// M 字形位图（11 行 x 13 列）
const M = [
  'M.............M',
  'MM...........MM',
  'M.M.........M.M',
  'M..M.......M..M',
  'M...M.....M...M',
  'M....M...M....M',
  'M.....M.M.....M',
  'M......M......M',
  'M.............M',
  'M.............M',
]
const cell = 26
const mW = M[0].length * cell
const mH = M.length * cell
const ox = Math.round((SIZE - mW) / 2)
const oy = Math.round((SIZE - mH) / 2) - 12

function insideRoundedRect(x, y) {
  const x0 = 12, y0 = 12, x1 = SIZE - 12, y1 = SIZE - 12, r = radius
  if (x < x0 || x > x1 || y < y0 || y > y1) return false
  const inX = x >= x0 + r && x <= x1 - r
  const inY = y >= y0 + r && y <= y1 - r
  if (inX || inY) return true
  const corners = [
    [x0 + r, y0 + r],
    [x1 - r, y0 + r],
    [x0 + r, y1 - r],
    [x1 - r, y1 - r],
  ]
  for (const [cx, cy] of corners) {
    const dx = x - cx, dy = y - cy
    if (dx * dx + dy * dy <= r * r) return true
  }
  return false
}

for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    const i = (y * SIZE + x) * 4
    if (!insideRoundedRect(x + 0.5, y + 0.5)) {
      px[i + 3] = 0
      continue
    }
    const t = (x + y) / (2 * SIZE)
    px[i] = Math.round(lerp(c1[0], c2[0], t))
    px[i + 1] = Math.round(lerp(c1[1], c2[1], t))
    px[i + 2] = Math.round(lerp(c1[2], c2[2], t))
    px[i + 3] = 255
  }
}

for (let ry = 0; ry < M.length; ry++) {
  for (let rx = 0; rx < M[0].length; rx++) {
    if (M[ry][rx] !== 'M') continue
    for (let dy = 0; dy < cell; dy++) {
      for (let dx = 0; dx < cell; dx++) {
        const x = ox + rx * cell + dx
        const y = oy + ry * cell + dy
        if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) continue
        const i = (y * SIZE + x) * 4
        // 字母圆角：四角 25% 像素挖掉
        const inL = dx < cell * 0.25, inR = dx >= cell * 0.75
        const inT = dy < cell * 0.25, inB = dy >= cell * 0.75
        if ((inL && inT) || (inR && inT) || (inL && inB) || (inR && inB)) continue
        px[i] = 255; px[i + 1] = 255; px[i + 2] = 255; px[i + 3] = 255
      }
    }
  }
}

// ---------- PNG 编码 ----------
function crc32(buf) {
  let table = crc32.table
  if (!table) {
    table = crc32.table = new Int32Array(256)
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      table[n] = c
    }
  }
  let crc = -1
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff]
  return (crc ^ -1) >>> 0
}

function chunk(type, data) {
  const t = Buffer.from(type, 'ascii')
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])))
  return Buffer.concat([len, t, data, crc])
}

const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(SIZE, 0)
ihdr.writeUInt32BE(SIZE, 4)
ihdr[8] = 8 // bit depth
ihdr[9] = 6 // color type RGBA
ihdr[10] = 0
ihdr[11] = 0
ihdr[12] = 0

const stride = 1 + SIZE * 4
const raw = Buffer.alloc(SIZE * stride)
for (let y = 0; y < SIZE; y++) {
  raw[y * stride] = 0 // filter: none
  Buffer.from(px.buffer, y * SIZE * 4, SIZE * 4).copy(raw, y * stride + 1)
}
const idat = zlib.deflateSync(raw, { level: 9 })
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', idat),
  chunk('IEND', Buffer.alloc(0)),
])

const outDir = path.join(process.cwd(), 'build')
fs.mkdirSync(outDir, { recursive: true })
const out = path.join(outDir, 'icon.png')
fs.writeFileSync(out, png)
console.log(`icon.png 已生成 (${png.length} bytes) -> ${out}`)
