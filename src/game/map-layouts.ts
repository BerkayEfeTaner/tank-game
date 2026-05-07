export type WallRect = readonly [number, number, number, number]

export type MapLayout = {
  id: string
  name: string
  walls: ReadonlyArray<WallRect>
}

export const MAP_LAYOUTS: MapLayout[] = [
  {
    id: 'diamond',
    name: 'Diamond',
    walls: [
      [240, 260, 30, 210],
      [440, 150, 210, 30],
      [500, 395, 260, 30],
      [720, 260, 30, 180],
    ],
  },
  {
    id: 'cross',
    name: 'Cross',
    walls: [
      [480, 90, 26, 360],
      [200, 270, 220, 26],
      [540, 270, 220, 26],
    ],
  },
  {
    id: 'corridors',
    name: 'Corridors',
    walls: [
      [180, 170, 540, 22],
      [240, 350, 540, 22],
    ],
  },
  {
    id: 'pillars',
    name: 'Pillars',
    walls: [
      [465, 250, 30, 30],
      [220, 110, 26, 100],
      [740, 110, 26, 100],
      [220, 330, 26, 100],
      [740, 330, 26, 100],
    ],
  },
  {
    id: 'zigzag',
    name: 'Zigzag',
    walls: [
      [180, 180, 22, 200],
      [380, 100, 22, 200],
      [560, 240, 22, 200],
      [760, 100, 22, 200],
      [300, 380, 200, 22],
      [560, 380, 200, 22],
    ],
  },
  {
    id: 'arena',
    name: 'Arena',
    walls: [
      [120, 200, 22, 140],
      [820, 200, 22, 140],
      [400, 100, 160, 22],
      [400, 420, 160, 22],
      [475, 250, 30, 30],
    ],
  },
]

export function pickLayout(waveIndex: number, lastLayoutId?: string): MapLayout {
  const rotation = Math.floor(waveIndex / 2)
  const offset = rotation % MAP_LAYOUTS.length
  const candidates = MAP_LAYOUTS.filter((layout) => layout.id !== lastLayoutId)
  const seed = (waveIndex * 13 + offset * 7) % candidates.length
  return candidates[seed] ?? MAP_LAYOUTS[offset]
}
