// 掉落决策（纯函数）：flow 砖必掉随机、普通砖按设置掉率、gift 砖生成时已定类型；类型按权重表抽取
import { getSettings } from '../settings'
import type { PowerupType } from './types'

export interface WeightEntry {
  type: PowerupType
  w: number
}

/** 权重表：Expand 30 / Slow 25 / Multi 20 / Shield 15 / Life 10（总和 100） */
export const POWERUP_WEIGHTS: WeightEntry[] = [
  { type: 'expand', w: 30 },
  { type: 'slow', w: 25 },
  { type: 'multi', w: 20 },
  { type: 'shield', w: 15 },
  { type: 'life', w: 10 },
]

/** 按权重表随机抽一个道具类型（gift 砖生成时的类型预埋同源） */
export function pickPowerupType(rand: () => number = Math.random): PowerupType {
  const total = POWERUP_WEIGHTS.reduce((s, x) => s + x.w, 0)
  let roll = rand() * total
  for (const x of POWERUP_WEIGHTS) {
    roll -= x.w
    if (roll <= 0) return x.type
  }
  return POWERUP_WEIGHTS[POWERUP_WEIGHTS.length - 1].type
}

/**
 * 掉落决策：flow（渐变砖）→ 必掉随机；normal → rate 概率后权重抽取。
 * gift 砖不走此函数（生成时已预埋 dropType）。
 * rate 缺省读 settings.dropRate；千砖局由 Game 传入密度归一后的有效值。
 * rand 注入便于测试复现与未来服务端权威化。
 */
export function pickDrop(
  kind: 'normal' | 'flow',
  rand: () => number,
  rate = getSettings().dropRate,
): PowerupType | null {
  if (kind === 'normal' && rand() > rate) return null
  return pickPowerupType(rand)
}
