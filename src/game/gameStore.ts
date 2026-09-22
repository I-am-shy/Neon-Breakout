// 游戏全局状态：物理循环用 getState() 直读（零 re-render），
// React HUD 用 selector 订阅——连接命令式游戏世界与声明式 UI 的唯一桥
import { create } from 'zustand'
import { FLOW_SCORE, GIFT_SCORE, SCORE_PER_BRICK } from './constants'
import type { PowerupType } from './powerups/types'
import { getSettings } from './settings'

export type Phase = 'idle' | 'ready' | 'playing' | 'paused' | 'gameover' | 'win'
export type BrickKind = 'normal' | 'gift' | 'flow'
/** 终局原因（gameover 时 HUD 文案分流） */
export type OverReason = 'balls' | 'time' | null
/** 拾取横幅（HUD 中央短暂提示：道具名 + 效果说明） */
export interface PickupBanner {
  type: PowerupType
  /** 显示序号（同帧多次拾取只显示最新的；序号跳变驱动重播动画） */
  seq: number
}

const BEST_KEY = 'nb-best'

function loadBest(): number {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(BEST_KEY) : null
    const n = raw ? Number(raw) : 0
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
  } catch {
    return 0
  }
}

interface GameState {
  phase: Phase
  score: number
  lives: number
  bricksLeft: number
  /** 活动持续效果（剩余物理步数），HUD 效果条订阅 */
  activeEffects: Partial<Record<PowerupType, number>>
  /** 局时限剩余秒（settings.timeLimitSec>0 时有效；-1 = 不限），HUD 倒计时 */
  timeLeftSec: number
  overReason: OverReason
  banner: PickupBanner | null
  /** 历史最高分（跨会话持久化；终局页显示） */
  best: number
  /** 开屏 PLAY → 待发射（仅 idle 态有效） */
  enterReady: () => void
  /** 返回首页（暂停/终局按钮）：状态侧重置；物理重建由 Game 的 phase 迁移侦测完成 */
  backToTitle: () => void
  start: () => void
  togglePause: () => void
  loseLife: () => void
  /** 局时限归零终局 */
  timeUp: () => void
  brickDestroyed: (kind: BrickKind) => void
  addScore: (n: number) => void
  setLives: (n: number) => void
  setEffects: (effects: Partial<Record<PowerupType, number>>) => void
  setTimeLeft: (sec: number) => void
  /** 拾取横幅显示（Game 调用；组件侧 setTimeout 自动清除） */
  showBanner: (type: PowerupType) => void
  /** 图案定形后校准实际砖数（Game.rebuildWorld 调用） */
  setBricksLeft: (n: number) => void
  /** 终局记录最高分（gameover/win 时 Game 调用） */
  recordBest: () => void
  clearBanner: () => void
  reset: () => void
}

/** 新局的初始状态（reset 与模块加载共用）。
 *  bricksLeft 为满阵估值（cols×rows）；buildBricks 图案定形后由 Game 校准为实际数 */
function freshGame() {
  const { lives, timeLimitSec, brickCols, brickRows } = getSettings()
  return {
    score: 0,
    lives,
    bricksLeft: brickCols * brickRows,
    activeEffects: {},
    timeLeftSec: timeLimitSec > 0 ? timeLimitSec : -1,
    overReason: null as OverReason,
    banner: null,
  }
}

export const useGameStore = create<GameState>((set, get) => ({
  phase: 'idle',
  best: loadBest(),
  ...freshGame(),

  /** 开屏 PLAY → 待发射：新局开始，按当前设置重取 lives/砖数/时限（仅 idle 态有效） */
  enterReady: () => {
    if (get().phase !== 'idle') return
    set({ phase: 'ready', ...freshGame() })
  },

  backToTitle: () => set({ phase: 'idle', ...freshGame() }),

  start: () => {
    if (get().phase === 'ready') set({ phase: 'playing' })
  },

  togglePause: () => {
    const { phase } = get()
    if (phase === 'playing') set({ phase: 'paused' })
    else if (phase === 'paused') set({ phase: 'playing' })
  },

  loseLife: () => {
    const { phase, lives } = get()
    if (phase !== 'playing') return
    if (lives <= 1) set({ lives: 0, phase: 'gameover', overReason: 'balls' }) // 归零，HUD 生命点全灭
    else set({ lives: lives - 1, phase: 'ready' })
  },

  timeUp: () => {
    if (get().phase !== 'playing') return
    set({ phase: 'gameover', overReason: 'time', timeLeftSec: 0 })
  },

  brickDestroyed: (kind) => {
    const { phase, bricksLeft, score } = get()
    if (phase !== 'playing') return
    const next = bricksLeft - 1
    set({
      bricksLeft: Math.max(next, 0),
      score: score + (kind === 'gift' ? GIFT_SCORE : kind === 'flow' ? FLOW_SCORE : SCORE_PER_BRICK),
    })
    if (next <= 0) set({ phase: 'win' })
  },

  addScore: (n) => {
    if (get().phase !== 'playing') return
    set((s) => ({ score: s.score + n }))
  },

  setLives: (n) => set({ lives: n }),

  setEffects: (effects) => set({ activeEffects: effects }),

  setTimeLeft: (sec) => set({ timeLeftSec: sec }),

  showBanner: (type) =>
    set((s) => ({ banner: { type, seq: (s.banner?.seq ?? 0) + 1 } })),

  setBricksLeft: (n) => set({ bricksLeft: Math.max(0, n) }),

  recordBest: () => {
    const { score, best } = get()
    if (score <= best) return
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(BEST_KEY, String(score))
    } catch {
      /* 存储不可用：仅会话内生效 */
    }
    set({ best: score })
  },

  clearBanner: () => set({ banner: null }),

  /** 重开局：直达待发射（跳过开屏）；lives/砖数/时限按当前设置重取 */
  reset: () => set({ phase: 'ready', ...freshGame() }),
}))
