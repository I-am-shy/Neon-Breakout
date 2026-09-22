// GSAP 特效：砖块碎裂粒子 / 震屏 / 挡板闪光 / 浮字提示
// GSAP 动 Pixi 对象属性（position/alpha/rotation），DOM 之外的标准用法
// 全部 tween 入册，destroy 时统一 kill（防 StrictMode 双挂载泄漏）
import gsap from 'gsap'
import { Container, Graphics, Text } from 'pixi.js'

/** 道具英文名（浮字 / 横幅共用文案源） */
export const POWERUP_NAME: Record<string, string> = {
  expand: 'EXPAND',
  multi: 'MULTI BALL',
  slow: 'SLOW',
  life: 'EXTRA LIFE',
  shield: 'SHIELD',
}

export class Fx {
  private readonly layer: Container
  private readonly tweens = new Set<gsap.core.Tween>()
  private shakeTl: gsap.core.Timeline | null = null

  constructor(layer: Container) {
    this.layer = layer
  }

  private track(t: gsap.core.Tween, onDone?: () => void): gsap.core.Tween {
    this.tweens.add(t)
    t.eventCallback('onComplete', () => {
      this.tweens.delete(t)
      onDone?.()
    })
    return t
  }

  /** 砖块碎裂：色块炸成 7 片向外飞散 + 轻微下坠 + 旋转淡出 */
  brickBreak(x: number, y: number, color: number): void {
    this.shardBurst(x, y, color, 7, 26, 64, 22)
  }

  /** 道具拾取：小范围粒子爆（比碎砖更收敛、无下坠，正向反馈感） */
  pickupBurst(x: number, y: number, color: number): void {
    this.shardBurst(x, y, color, 10, 10, 30, 0)
  }

  /** 浮字提示：道具名在掉落点上飘淡出（识别辅助——击碎瞬间即知道掉的是什么） */
  floatText(text: string, color: number, x: number, y: number): void {
    const t = new Text({
      text,
      style: {
        fontFamily: 'monospace',
        fontSize: 11,
        fontWeight: 'bold',
        fill: color,
        letterSpacing: 2,
      },
    })
    t.anchor.set(0.5)
    t.position.set(x, y)
    t.blendMode = 'add'
    this.layer.addChild(t)
    this.track(gsap.to(t.position, { y: y - 34, duration: 0.9, ease: 'power1.out' }))
    this.track(
      gsap.to(t, { alpha: 0, duration: 0.9, ease: 'power1.in' }),
      () => t.destroy(), // 与位置 tween 同时长同刻完成，仅此一处销毁
    )
  }

  private shardBurst(
    x: number,
    y: number,
    color: number,
    shards: number,
    distMin: number,
    distMax: number,
    drop: number,
  ): void {
    for (let i = 0; i < shards; i++) {
      const size = 2.5 + Math.random() * 4
      const g = new Graphics()
      g.rect(-size / 2, -size / 2, size, size).fill({ color, alpha: 0.9 })
      g.position.set(x, y)
      g.rotation = Math.random() * Math.PI
      g.blendMode = 'add'
      this.layer.addChild(g)

      const ang = Math.random() * Math.PI * 2
      const dist = distMin + Math.random() * distMax
      this.track(
        gsap.to(g.position, {
          x: x + Math.cos(ang) * dist,
          y: y + Math.sin(ang) * dist + drop,
          duration: 0.45 + Math.random() * 0.3,
          ease: 'power2.out',
        }),
      )
      this.track(
        gsap.to(g, {
          alpha: 0,
          rotation: g.rotation + Math.random() * 1.5,
          duration: 0.5,
          ease: 'power1.in',
        }),
        () => g.destroy(),
      )
    }
  }

  /** 震屏：衰减随机步进，结束后精确归零 */
  shake(world: Container, strength = 4): void {
    this.shakeTl?.kill()
    const tl = gsap.timeline()
    const STEPS = 5
    for (let i = 0; i < STEPS; i++) {
      const s = strength * (1 - i / STEPS)
      tl.to(world.position, {
        x: (Math.random() - 0.5) * 2 * s,
        y: (Math.random() - 0.5) * 2 * s,
        duration: 0.04,
        ease: 'none',
      })
    }
    tl.to(world.position, { x: 0, y: 0, duration: 0.06, ease: 'power2.out' })
    this.shakeTl = tl
  }

  paddleFlash(gfx: Graphics): void {
    this.track(gsap.fromTo(gfx, { alpha: 0.3 }, { alpha: 1, duration: 0.18, ease: 'power2.out' }))
  }

  destroy(): void {
    this.tweens.forEach((t) => t.kill())
    this.tweens.clear()
    this.shakeTl?.kill()
    this.shakeTl = null
  }
}
