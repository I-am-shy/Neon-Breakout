// 砖阵图案引擎：图案库（归一化坐标函数）+ 每局随机抽取/镜像/扰动
// 图案输入 nx/ny ∈ [0,1]（列/行归一化），输出该格是否放砖
// 每局：随机抽图案 + 随机水平/垂直镜像 + 5% 随机剔除（打破完美对称，局局不同）

export interface PatternDef {
  name: string
  fn: (nx: number, ny: number) => boolean
}

/** 图案库：8 款——形状差异明显，密度 35%~75% 各档都有 */
export const PATTERNS: PatternDef[] = [
  {
    name: 'diamond',
    fn: (x, y) => Math.abs(x - 0.5) + Math.abs(y - 0.5) < 0.52,
  },
  {
    name: 'wave',
    fn: (x, y) => {
      const band = 0.18 * Math.sin(x * Math.PI * 3)
      return y > 0.18 + band && y < 0.82 + band
    },
  },
  {
    name: 'arch',
    fn: (x, y) => {
      const dx = x - 0.5
      const r = Math.hypot(dx, y)
      return r > 0.34 || y > 0.72 // 中空圆拱 + 底梁
    },
  },
  {
    name: 'checker',
    fn: (x, y) => (Math.floor(x * 7) + Math.floor(y * 7)) % 2 === 0,
  },
  {
    name: 'towers',
    fn: (x, y) => x < 0.24 || x > 0.76 || (y > 0.3 && y < 0.44), // 双侧塔 + 中横梁
  },
  {
    name: 'honeycomb',
    fn: (x, y) => {
      const row = Math.floor(y * 8)
      const offset = row % 2 === 0 ? 0 : 0.0625 // 交错半格 → 蜂窝排布
      const cx = (Math.floor((x + offset) * 8) + 0.5) / 8 - offset
      const cy = (row + 0.5) / 8
      // 半径受格距约束（格半对角 ≈0.088）：取 0.055 → 约 55% 覆盖，空隙清晰
      return Math.hypot(x - cx, y - cy) < 0.055
    },
  },
  {
    name: 'cross',
    fn: (x, y) => !(x > 0.3 && x < 0.7 && y > 0.3 && y < 0.7), // 实心场 + 中心方孔
  },
  {
    name: 'diagonals',
    fn: (x, y) => Math.floor((x + y) * 6) % 2 === 0, // 45° 斜纹带
  },
]

export interface PatternInstance {
  def: PatternDef
  mirrorX: boolean
  mirrorY: boolean
}

/** 每局抽取：随机图案 + 随机镜像（水平/垂直独立 50%） */
export function pickPattern(rand: () => number = Math.random): PatternInstance {
  const def = PATTERNS[Math.floor(rand() * PATTERNS.length)]
  return { def, mirrorX: rand() < 0.5, mirrorY: rand() < 0.5 }
}

/** 镜像坐标 */
function mirror(nx: number, ny: number, m: PatternInstance): [number, number] {
  return [m.mirrorX ? 1 - nx : nx, m.mirrorY ? 1 - ny : ny]
}

/** 单格判定：图案 + 镜像 + 5% 扰动剔除（打破完美对称） */
export function cellFilled(
  pattern: PatternInstance,
  col: number,
  row: number,
  cols: number,
  rows: number,
  rand: () => number = Math.random,
): boolean {
  const nx = cols > 1 ? col / (cols - 1) : 0.5
  const ny = rows > 1 ? row / (rows - 1) : 0.5
  const [mx, my] = mirror(nx, ny, pattern)
  if (!pattern.def.fn(mx, my)) return false
  return rand() > 0.05 // 5% 剔除
}
