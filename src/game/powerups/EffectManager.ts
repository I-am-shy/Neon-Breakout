// 效果注册表：以物理步数为唯一时钟（固定步长下 tick 数即时间，不受帧率影响）
// 职责：持续效果计时、同类刷新时长、异类并存、到期回调；一次性效果（Multi/Life）不进表
import type { PowerupType } from './types'

export interface EffectOpts {
  ticks: number
  onExpire?: () => void
}

export class EffectManager {
  private readonly effects = new Map<PowerupType, { left: number; onExpire?: () => void }>()

  /** 应用持续效果；同类型重复调用刷新时长（不叠加） */
  apply(type: PowerupType, opts: EffectOpts): void {
    this.effects.set(type, { left: opts.ticks, onExpire: opts.onExpire })
  }

  /** 每个物理步调用一次；到期触发 onExpire 并移除 */
  step(): void {
    for (const [type, e] of this.effects) {
      e.left--
      if (e.left <= 0) {
        e.onExpire?.()
        this.effects.delete(type)
      }
    }
  }

  remaining(type: PowerupType): number {
    return this.effects.get(type)?.left ?? 0
  }

  has(type: PowerupType): boolean {
    return this.effects.has(type)
  }

  active(): PowerupType[] {
    return [...this.effects.keys()]
  }

  /** 重开局还原：触发全部到期回调并清空 */
  clear(): void {
    this.effects.forEach((e) => e.onExpire?.())
    this.effects.clear()
  }
}
