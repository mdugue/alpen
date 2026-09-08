import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ImageResponse } from 'next/og'
import passes from '@/data/passes.json'
import { passStatus } from '@/lib/status'
import type { Pass, Status } from '@/lib/types'

/**
 * Share image, rendered once at build time. The graphic is the data itself:
 * every pass as a dot at its real position, coloured by rideability for one
 * half-month – the arc of the Alps emerges on its own. Fonts come from
 * assets/fonts (Oxanium, OFL); Satori needs raw TTF data.
 */

export const alt =
  'Alpenpässe – welche Pässe sind wann mit dem Rennrad befahrbar?'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const oxaniumBold = await readFile(
  join(process.cwd(), 'assets/fonts/Oxanium-Bold.ttf'),
)
const oxaniumMedium = await readFile(
  join(process.cwd(), 'assets/fonts/Oxanium-Medium.ttf'),
)

// sRGB equivalents of the tokens in app/globals.css (light theme)
const C = {
  paper: '#fbfaf7',
  ink: '#2b2a27',
  primary: '#2f3d55',
  muted: '#8a8275',
  accent: '#e8b45a',
  status: {
    open: '#4a9a6a',
    risky: '#e0a93f',
    closed: '#c0463e',
  } satisfies Record<Status, string>,
}

/** Late October: the season's end, when all three colours show at once. */
const PERIOD = 10.5
const LABEL: Record<Status, string> = {
  open: 'meist offen',
  risky: 'wetterabhängig',
  closed: 'oft gesperrt',
}

export default function Image() {
  const W = size.width
  const H = size.height
  // Equirectangular projection into the right two thirds of the canvas.
  const box = { x: 380, y: 70, w: 760, h: 500 }
  const lats = (passes as Pass[]).map((p) => p.lat)
  const lons = (passes as Pass[]).map((p) => p.lon)
  const lat0 = Math.min(...lats)
  const lat1 = Math.max(...lats)
  const lon0 = Math.min(...lons)
  const lon1 = Math.max(...lons)
  const kx = Math.cos(((lat0 + lat1) / 2) * (Math.PI / 180))
  const scale = Math.min(box.w / ((lon1 - lon0) * kx), box.h / (lat1 - lat0))
  const dx = box.x + (box.w - (lon1 - lon0) * kx * scale) / 2
  const dy = box.y + (box.h - (lat1 - lat0) * scale) / 2
  const project = (p: Pass) => ({
    x: dx + (p.lon - lon0) * kx * scale,
    y: dy + (lat1 - p.lat) * scale,
  })
  const dots = (passes as Pass[])
    .map((p) => ({
      ...project(p),
      status: passStatus(p, PERIOD),
      r: 4.5 + p.fame * 2,
    }))
    .sort((a, b) => a.r - b.r)

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        background: C.paper,
        fontFamily: 'Oxanium',
        color: C.ink,
        position: 'relative',
      }}
    >
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        style={{ position: 'absolute', left: 0, top: 0 }}
      >
        {dots.map((d, i) => (
          <circle
            key={i}
            cx={d.x}
            cy={d.y}
            r={d.r}
            fill={C.status[d.status]}
            stroke={C.paper}
            strokeWidth={2.5}
          />
        ))}
      </svg>

      <div
        style={{
          position: 'absolute',
          left: 72,
          top: 80,
          display: 'flex',
          flexDirection: 'column',
          width: 330,
        }}
      >
        <div
          style={{
            width: 44,
            height: 6,
            borderRadius: 999,
            background: C.accent,
          }}
        />
        <div
          style={{
            marginTop: 26,
            fontSize: 56,
            fontWeight: 700,
            letterSpacing: 3,
            lineHeight: 1,
            color: C.primary,
            textTransform: 'uppercase',
          }}
        >
          Alpenpässe
        </div>
        <div
          style={{
            marginTop: 22,
            fontSize: 30,
            fontWeight: 500,
            lineHeight: 1.3,
            color: C.ink,
          }}
        >
          Welche Pässe sind gut? Wann besonders gut?
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          left: 72,
          bottom: 64,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          fontSize: 21,
          fontWeight: 500,
          color: C.muted,
        }}
      >
        {(['open', 'risky', 'closed'] as Status[]).map((s) => (
          <div
            key={s}
            style={{ display: 'flex', alignItems: 'center', gap: 12 }}
          >
            <div
              style={{
                width: 14,
                height: 14,
                borderRadius: 999,
                background: C.status[s],
              }}
            />
            <span>{LABEL[s]}</span>
          </div>
        ))}
      </div>
    </div>,
    {
      ...size,
      fonts: [
        { name: 'Oxanium', data: oxaniumBold, weight: 700, style: 'normal' },
        { name: 'Oxanium', data: oxaniumMedium, weight: 500, style: 'normal' },
      ],
    },
  )
}
