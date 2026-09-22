// 图案引擎单测：图案库合法性、镜像、扰动剔除、密度区间
import { describe, expect, it } from 'vitest'
import { PATTERNS, cellFilled, pickPattern } from '../game/patterns'

/** 统计某图案在给定网格下的填充率（rand 固定不剔除） */
function density(fn: (x: number, y: number) => boolean, cols: number, rows: number): number {
  let filled = 0
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const nx = cols > 1 ? c / (cols - 1) : 0.5
      const ny = rows > 1 ? r / (rows - 1) : 0.5
      if (fn(nx, ny)) filled++
    }
  }
  return filled / (cols * rows)
}

describe('图案库', () => {
  it('8 款图案，命名唯一', () => {
    expect(PATTERNS).toHaveLength(8)
    expect(new Set(PATTERNS.map((p) => p.name)).size).toBe(8)
  })

  it.each(PATTERNS.map((p) => [p.name, p] as const))(
    '图案 %s：50×20 网格下密度在 15%~85%（既不空也不满，保证可玩）',
    (_name, def) => {
      const d = density(def.fn, 50, 20)
      expect(d).toBeGreaterThan(0.15)
      expect(d).toBeLessThan(0.85)
    },
  )

  it.each(PATTERNS.map((p) => [p.name, p] as const))('图案 %s：不规则（非满阵）', (_name, def) => {
    expect(density(def.fn, 50, 20)).toBeLessThan(0.99)
  })
})

describe('pickPattern / cellFilled', () => {
  it('pickPattern 抽取合法图案 + 双轴镜像布尔', () => {
    for (let i = 0; i < 40; i++) {
      const p = pickPattern()
      expect(PATTERNS).toContain(p.def)
      expect(typeof p.mirrorX).toBe('boolean')
      expect(typeof p.mirrorY).toBe('boolean')
    }
  })

  it('cellFilled：rand 恒 1 时无剔除（纯图案结果）', () => {
    // diamond 图案在 (0,0) 角点外 → 不填；中心 → 填
    const diamond = { def: PATTERNS[0], mirrorX: false, mirrorY: false }
    expect(cellFilled(diamond, 25, 10, 50, 20, () => 1)).toBe(true) // 中心
    expect(cellFilled(diamond, 0, 0, 50, 20, () => 1)).toBe(false) // 角
  })

  it('cellFilled：rand 恒 0 时全剔除（扰动生效）', () => {
    const diamond = { def: PATTERNS[0], mirrorX: false, mirrorY: false }
    expect(cellFilled(diamond, 25, 10, 50, 20, () => 0)).toBe(false)
  })

  it('镜像翻转变换：水平镜像后左右格互换判定', () => {
    // diagonals（45° 斜纹，左右不对称）：格 (1,0) 与 (48,0) 在镜像下互换
    const plain = { def: PATTERNS[7], mirrorX: false, mirrorY: false }
    const mirrored = { def: PATTERNS[7], mirrorX: true, mirrorY: false }
    const left = cellFilled(plain, 1, 0, 50, 20, () => 1)
    const right = cellFilled(plain, 48, 0, 50, 20, () => 1)
    expect(left).not.toBe(right) // 非对称图案前提
    expect(cellFilled(mirrored, 1, 0, 50, 20, () => 1)).toBe(right)
    expect(cellFilled(mirrored, 48, 0, 50, 20, () => 1)).toBe(left)
  })

  it('单格网格（cols=rows=1）不产生 NaN', () => {
    const p = pickPattern(() => 0)
    expect(typeof cellFilled(p, 0, 0, 1, 1, () => 1)).toBe('boolean')
  })
})