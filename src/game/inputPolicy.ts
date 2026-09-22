// 输入策略（纯函数，可单测）：键位与点按在各 phase 下的语义
// 键位分工：
//   Space = 启动族——开屏→待发射 / 待发射→发射 / **暂停→继续** / 终局→重开；playing 下不做事
//   Esc（P 为别名）= 暂停切换——playing ⇄ paused
//   点按（触屏/鼠标）= 移动端唯一入口：兼做启动与暂停/继续（故 HUD 不再需要 ⏸ 按钮）
import type { Phase } from './gameStore'

/** 启动族动作 */
export type StartAction = 'enterReady' | 'launch' | 'resume' | 'restart' | 'none'
/** 点按动作：暂停切换，或回落到启动族 */
export type TapAction = 'togglePause' | StartAction

/** Space / 初始化按钮：只负责「开始」这一族，绝不暂停 */
export function spaceAction(phase: Phase): StartAction {
  switch (phase) {
    case 'idle':
      return 'enterReady'
    case 'ready':
      return 'launch'
    case 'paused':
      return 'resume' // 暂停态按空格继续
    case 'gameover':
    case 'win':
      return 'restart'
    default:
      return 'none' // playing：Space 不做事（暂停归 Esc）
  }
}

/** 点按：playing/paused 下暂停切换，其余回落启动族 */
export function tapAction(phase: Phase): TapAction {
  if (phase === 'playing' || phase === 'paused') return 'togglePause'
  return spaceAction(phase)
}

/** Esc / P：仅 playing ⇄ paused 生效（其余 phase 无操作） */
export function pauseAction(phase: Phase): 'togglePause' | 'none' {
  return phase === 'playing' || phase === 'paused' ? 'togglePause' : 'none'
}
