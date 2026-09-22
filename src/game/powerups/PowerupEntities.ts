// 掉落物实体：isSensor 胶囊（本作零重力，恒速下落靠每步 setVelocity）
// body 生命周期与视图 gfx 的增删由 Game 编排；拾取走 Physics 碰撞事件的延迟队列
import Matter from 'matter-js'
import { WORLD_H } from '../constants'
import type { PowerupType } from './types'

const POWERUP_W = 20
const POWERUP_H = 14
const FALL_V = 2.6 // px/step
const DESPAWN_Y = WORLD_H + 40 // 触底回收线

interface PowerupEntity {
  type: PowerupType
  body: Matter.Body
}

export class PowerupEntities {
  private readonly entities = new Map<number, PowerupEntity>()

  constructor(private readonly world: Matter.World) {}

  spawn(type: PowerupType, x: number, y: number): number {
    const body = Matter.Bodies.rectangle(x, y, POWERUP_W, POWERUP_H, {
      isSensor: true, // 只出事件，不与球产生物理响应
      // 注意不能 isStatic：Matter 对 static-static 对不产生碰撞事件（挡板是 static），
      // 零重力下非静态也稳定，位移由 step 的 setPosition 手动驱动（运动学控制）
      inertia: Infinity,
      label: 'powerup',
      chamfer: { radius: 7 },
    })
    body.plugin = { type }
    Matter.Composite.add(this.world, body)
    this.entities.set(body.id, { type, body })
    return body.id
  }

  remove(id: number): void {
    const e = this.entities.get(id)
    if (!e) return
    Matter.Composite.remove(this.world, e.body)
    this.entities.delete(id)
  }

  get(id: number): PowerupEntity | undefined {
    return this.entities.get(id)
  }

  count(): number {
    return this.entities.size
  }

  forEach(cb: (e: PowerupEntity) => void): void {
    this.entities.forEach(cb)
  }

  /** 每物理步调用：恒速下落 + 触底回收；返回本步被回收的 bodyId（供视图同步删除） */
  step(): number[] {
    const removed: number[] = []
    for (const [id, e] of this.entities) {
      const y = e.body.position.y + FALL_V
      if (y > DESPAWN_Y) {
        this.remove(id)
        removed.push(id)
        continue
      }
      Matter.Body.setPosition(e.body, { x: e.body.position.x, y })
    }
    return removed
  }
}
