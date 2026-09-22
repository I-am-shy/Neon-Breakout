// 设置存储：跨会话持久化（localStorage，node 环境安全降级）
// 与 gameStore 分离——UI 配置域与游戏运行态解耦；游戏循环 getState() 直读
import { create } from 'zustand'

export interface Settings {
  /** 生命（重试）数 1-5 */
  lives: number
  /** 砖阵列数 10-50（列数决定砖宽，自适应） */
  brickCols: number
  /** 砖阵行数 4-24（与列数组合可达千砖） */
  brickRows: number
  /** 道具砖（光晕砖）数量 0-10：颜色预告掉落类型，2 击破 */
  giftCount: number
  /** 渐变砖（流动渐变）数量 0-10：随机道具，1 击破 */
  flowCount: number
  /** 道具效果时长（秒）5-20，Expand 全额 / Slow ×0.8 */
  effectSec: number
  /** 局时限（秒），0 = 不限；>0 时倒计时归零 TIME UP 终局结算 */
  timeLimitSec: number
  /** 球速倍率 0.8-1.2 */
  speedMult: number
  /** 普通砖道具占比 0-0.3（密度归一：每 60 砖掉此比例，千砖局总量守恒） */
  dropRate: number
  /** 掉落模式：fixed = 用 dropRate；random = 每局随机 roll 5%-25% */
  dropMode: 'fixed' | 'random'
}

export const SETTING_RANGES = {
  lives: { min: 1, max: 5, step: 1 },
  brickCols: { min: 10, max: 50, step: 1 },
  brickRows: { min: 4, max: 24, step: 1 },
  giftCount: { min: 0, max: 10, step: 1 },
  flowCount: { min: 0, max: 10, step: 1 },
  effectSec: { min: 5, max: 20, step: 1 },
  timeLimitSec: { min: 0, max: 300, step: 30 },
  speedMult: { min: 0.8, max: 1.2, step: 0.05 },
  dropRate: { min: 0, max: 0.3, step: 0.05 },
} as const

export const DEFAULT_SETTINGS: Settings = {
  lives: 3,
  brickCols: 50,
  brickRows: 20,
  giftCount: 4,
  flowCount: 4,
  effectSec: 10,
  timeLimitSec: 0,
  speedMult: 1,
  dropRate: 0.15,
  dropMode: 'fixed',
}

/** 难度预设：一键全套 */
export const PRESETS: Record<'casual' | 'standard' | 'hardcore', Settings> = {
  casual: { lives: 5, brickCols: 30, brickRows: 12, giftCount: 6, flowCount: 6, effectSec: 15, timeLimitSec: 0, speedMult: 0.8, dropRate: 0.25, dropMode: 'fixed' },
  standard: { ...DEFAULT_SETTINGS },
  hardcore: { lives: 2, brickCols: 50, brickRows: 20, giftCount: 2, flowCount: 3, effectSec: 8, timeLimitSec: 0, speedMult: 1.2, dropRate: 0.1, dropMode: 'random' },
}

const STORAGE_KEY = 'nb-settings'

function loadPersisted(): Partial<Settings> {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Partial<Settings>
    // 逐项 clamp 到合法范围，坏数据静默丢弃
    const out: Partial<Settings> = {}
    for (const k of Object.keys(SETTING_RANGES) as Array<keyof Settings>) {
      const v = parsed[k]
      if (typeof v === 'number' && Number.isFinite(v)) {
        const r = SETTING_RANGES[k as keyof typeof SETTING_RANGES]
        out[k] = Math.min(r.max, Math.max(r.min, v)) as never
      }
    }
    if (parsed.dropMode === 'fixed' || parsed.dropMode === 'random') {
      out.dropMode = parsed.dropMode
    }
    return out
  } catch {
    return {}
  }
}

interface SettingsState {
  settings: Settings
  /** 设置面板开合（仅 idle 开屏可达） */
  panelOpen: boolean
  set: (patch: Partial<Settings>) => void
  applyPreset: (name: keyof typeof PRESETS) => void
  openPanel: () => void
  closePanel: () => void
}

export const useSettingsStore = create<SettingsState>((set) => {
  const persist = (s: Settings): void => {
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
    } catch {
      /* 隐私模式等存储不可用：静默降级为会话内生效 */
    }
  }
  return {
    settings: { ...DEFAULT_SETTINGS, ...loadPersisted() },
    panelOpen: false,
    set: (patch) =>
      set((st) => {
        const next = { ...st.settings, ...patch }
        persist(next)
        return { settings: next }
      }),
    applyPreset: (name) =>
      set(() => {
        const next = { ...PRESETS[name] }
        persist(next)
        return { settings: next }
      }),
    openPanel: () => set({ panelOpen: true }),
    closePanel: () => set({ panelOpen: false }),
  }
})

/** 游戏侧直读便捷函数（物理循环高频路径） */
export function getSettings(): Settings {
  return useSettingsStore.getState().settings
}
