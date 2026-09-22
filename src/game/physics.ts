// Matter 物理层：世界搭建 + Breakout 规则（多球数组版）
// 铁律：collisionStart 回调内只入队/改速度，不修改世界结构（移除统一在下一帧 flush）
import Matter from 'matter-js'
import {
  BALL_R,
  BALLS_MAX,
  BALL_SPEED,
  BRICK_H,
  brickCenterX,
  brickCenterY,
  brickWidth,
  MAX_BOUNCE_DEG,
  MIN_VERTICAL_RATIO,
  PALETTE,
  PADDLE_H,
  PADDLE_MARGIN,
  PADDLE_SPEED,
  PADDLE_W,
  PADDLE_Y,
  GIFT_HP,
  SHIELD_Y,
  WORLD_H,
  WORLD_W,
  toPerStep,
} from './constants'
import { bounceAngle, clamp, clampSpeed, ensureVertical, velocityFromAngle } from './math'
import { pickPowerupType } from './powerups/drop'
import type { PowerupType } from './powerups/types'
import { cellFilled, pickPattern, type PatternInstance } from './patterns'
import { getSettings } from './settings'

export type BrickKind = 'normal' | 'gift' | 'flow'

export interface BrickRef {
  body: Matter.Body
  row: number
  color: number
  alive: boolean
  kind: BrickKind
  hp: number
  /** gift 专属：击碎时掉落的固定道具（生成时已定，光晕颜色即此道具色——预告机制） */
  dropType?: PowerupType
}

export class Physics {
  readonly engine: Matter.Engine
  readonly paddle: Matter.Body
  balls: Matter.Body[] = []
  bricks: BrickRef[] = []

  // 事件出口（由 Game 接线）
  onBrickHit: (ref: BrickRef) => void = () => {}
  /** gift 砖首击（未破）：闪烁反馈时机 */
  onGiftHit: (ref: BrickRef) => void = () => {}
  onPaddleHit: () => void = () => {}
  onWallHit: () => void = () => {}
  /** 球全灭时触发一次（多球版本的「失球」） */
  onAllBallsLost: () => void = () => {}
  /** 挡板宽度变化（Expand 道具路径，View 据此重建） */
  onPaddleResized: (width: number) => void = () => {}
  /** 挡板拾取到道具（延迟队列触发，参数：道具类型 + bodyId） */
  onPowerupPickup: (type: PowerupType, bodyId: number) => void = () => {}
  /** 护盾被球击中一次（延迟队列触发；Game 拆墙） */
  onShieldHit: () => void = () => {}

  private readonly pendingDestroy: Matter.Body[] = []
  private readonly pendingBallRemoval: Matter.Body[] = []
  private readonly pendingPowerupPickup: Matter.Body[] = []
  private pendingShieldHit = false
  private shieldBody: Matter.Body | null = null
  private paddleHitPending = false
  /** 当前球速（px/step）——Slow 道具动态改写，clampBall/launch/bounce 全走它 */
  private ballSpeed = toPerStep(BALL_SPEED)
  /** 当前挡板宽——Expand 道具动态改写，clamp 边界随之 */
  private paddleW = PADDLE_W
  private readonly paddleV = toPerStep(PADDLE_SPEED)

  constructor() {
    this.engine = Matter.Engine.create()
    this.engine.gravity.y = 0
    this.buildWalls()
    this.paddle = this.buildPaddle()
    this.spawnServeBall()
    this.buildBricks()
    Matter.Events.on(this.engine, 'collisionStart', this.handleCollision)
  }

  private buildWalls(): void {
    const t = 60
    const wallOpts = { isStatic: true, restitution: 1, friction: 0, label: 'wall' }
    const bodies = [
      Matter.Bodies.rectangle(WORLD_W / 2, -t / 2, WORLD_W, t, wallOpts),
      Matter.Bodies.rectangle(-t / 2, WORLD_H / 2, t, WORLD_H, wallOpts),
      Matter.Bodies.rectangle(WORLD_W + t / 2, WORLD_H / 2, t, WORLD_H, wallOpts),
      // 底部 sensor：只触发事件，不产生碰撞
      Matter.Bodies.rectangle(WORLD_W / 2, WORLD_H + t / 2, WORLD_W, t, {
        isStatic: true,
        isSensor: true,
        label: 'floor',
      }),
    ]
    Matter.Composite.add(this.engine.world, bodies)
  }

  /** 创建一球并加入世界（多球地基：初始球/镜像球共用） */
  spawnBall(x: number, y: number, vx: number, vy: number): Matter.Body {
    const ball = Matter.Bodies.circle(x, y, BALL_R, {
      label: 'ball',
      restitution: 1,
      friction: 0,
      frictionAir: 0,
      frictionStatic: 0,
      inertia: Infinity, // 防自转带偏反弹
      slop: 0.02,
    })
    Matter.Body.setVelocity(ball, { x: vx, y: vy })
    Matter.Composite.add(this.engine.world, ball)
    this.balls.push(ball)
    return ball
  }

  /** 移除一球；球全灭时触发 onAllBallsLost（仅在 flush 路径调用，遵守回调铁律） */
  removeBall(ball: Matter.Body): void {
    const i = this.balls.indexOf(ball)
    if (i === -1) return
    this.balls.splice(i, 1)
    Matter.Composite.remove(this.engine.world, ball)
    if (this.balls.length === 0) this.onAllBallsLost()
  }

  private buildPaddle(): Matter.Body {
    const paddle = Matter.Bodies.rectangle(WORLD_W / 2, PADDLE_Y, PADDLE_W, PADDLE_H, {
      isStatic: true,
      restitution: 0.6,
      friction: 0,
      label: 'paddle',
    })
    Matter.Composite.add(this.engine.world, paddle)
    return paddle
  }

  /** 本局砖阵图案（buildBricks 时定形；验收/调试用） */
  pattern: PatternInstance | null = null

  private buildBricks(): void {
    const { brickCols, brickRows, giftCount, flowCount } = getSettings() // 新局生效（resetAll 重建时直读）
    const pattern = pickPattern() // 每局随机图案 + 镜像
    this.pattern = pattern // 暴露给验收/调试（图案名、镜像）
    const w = brickWidth(brickCols)
    const refs: BrickRef[] = []
    for (let r = 0; r < brickRows; r++) {
      for (let c = 0; c < brickCols; c++) {
        if (!cellFilled(pattern, c, r, brickCols, brickRows)) continue // 图案过滤
        const x = brickCenterX(c, brickCols)
        const y = brickCenterY(r)
        const body = Matter.Bodies.rectangle(x, y, w, BRICK_H, {
          isStatic: true,
          label: 'brick',
        })
        const ref: BrickRef = {
          body,
          row: r,
          color: PALETTE.rows[r % PALETTE.rows.length],
          alive: true,
          kind: 'normal',
          hp: 1,
        }
        body.plugin = { ref } // body→业务数据 的快速查找挂载点
        refs.push(ref)
        Matter.Composite.add(this.engine.world, body)
      }
    }
    // 特殊砖采样：洗牌——前 giftCount 个为道具砖（光晕，掉固定道具），接着 flowCount 个为渐变砖（随机道具）
    const indices = refs.map((_, i) => i)
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[indices[i], indices[j]] = [indices[j], indices[i]]
    }
    const giftTotal = Math.min(giftCount, indices.length)
    for (let k = 0; k < giftTotal; k++) {
      const ref = refs[indices[k]]
      ref.kind = 'gift'
      ref.hp = GIFT_HP
      ref.dropType = pickPowerupType()
      ref.color = 0xffffff
    }
    const flowTotal = Math.min(flowCount, indices.length - giftTotal)
    for (let k = 0; k < flowTotal; k++) {
      const ref = refs[indices[giftTotal + k]]
      ref.kind = 'flow'
      ref.hp = 1
      ref.color = 0xffffff
    }
    this.bricks = refs
  }

  /** 砖块受击分流：gift 扣 HP（未碎不入销毁队列），normal/flow/HP 归零走销毁 */
  private hitBrick(ref: BrickRef): void {
    if (!ref.alive) return
    if (ref.kind === 'gift' && ref.hp > 1) {
      ref.hp--
      this.onGiftHit(ref)
      return
    }
    ref.alive = false
    this.pendingDestroy.push(ref.body)
    this.onBrickHit(ref)
  }

  /** 测试后门：直接对指定砖执行受击分流（绕过碰撞事件） */
  debugHitBrick(ref: BrickRef): void {
    this.hitBrick(ref)
  }

  /** 测试后门：待销毁队列长度 */
  pendingDestroyLength(): number {
    return this.pendingDestroy.length
  }

  private readonly handleCollision = (e: Matter.IEventCollision<Matter.Engine>): void => {
    for (const pair of e.pairs) {
      const { bodyA, bodyB } = pair
      // 道具拾取：paddle × powerup（该 pair 无球参与，先于球分支处理）
      const pairLabels = `${bodyA.label}|${bodyB.label}`
      if (pairLabels === 'paddle|powerup' || pairLabels === 'powerup|paddle') {
        const pu = bodyA.label === 'powerup' ? bodyA : bodyB
        if (!this.pendingPowerupPickup.includes(pu)) {
          this.pendingPowerupPickup.push(pu)
        }
        continue
      }
      const ball = bodyA.label === 'ball' ? bodyA : bodyB.label === 'ball' ? bodyB : null
      if (!ball) continue
      const other = ball === bodyA ? bodyB : bodyA
      if (other.label === 'paddle') {
        this.paddleHitPending = true
      } else if (other.label === 'brick') {
        const ref = other.plugin?.ref as BrickRef | undefined
        if (ref?.alive) {
          this.hitBrick(ref)
        }
      } else if (other.label === 'shield') {
        this.pendingShieldHit = true // 球自然反弹（实体），墙的销毁走下一帧
      } else if (other.label === 'wall') {
        this.onWallHit()
      } else if (other.label === 'floor') {
        // 只入队：移除世界结构统一走下一帧 flush
        this.pendingBallRemoval.push(ball)
      }
    }
  }

  /** 固定步长推进：移动挡板 → 物理求解 → 手感后处理 */
  step(dtMs: number, paddleDir: -1 | 0 | 1): void {
    this.movePaddle(paddleDir, dtMs)
    Matter.Engine.update(this.engine, dtMs)
    this.applyPaddleBounce()
    this.clampBall()
  }

  /** 挡板运动学移动（Game 在 ready/playing 阶段都驱动） */
  movePaddle(dir: -1 | 0 | 1, dtMs: number): void {
    if (dir === 0) return
    const delta = dir * this.paddleV * (dtMs / (1000 / 60))
    this.setPaddleX(this.paddle.position.x + delta)
  }

  /** 跟手模式：直接设定挡板 x（指针拖拽路径），与键盘速度制共用边界 clamp */
  setPaddleX(x: number): void {
    const clamped = clamp(
      x,
      this.paddleW / 2 + PADDLE_MARGIN,
      WORLD_W - this.paddleW / 2 - PADDLE_MARGIN,
    )
    Matter.Body.setPosition(this.paddle, { x: clamped, y: PADDLE_Y })
  }

  /** 动态球速（px/s，内部换算 per-step）——Slow 道具的线性恢复写入口 */
  setBallSpeed(pxPerSec: number): void {
    this.ballSpeed = toPerStep(pxPerSec)
  }

  /** 动态挡板宽（Expand 道具）：Body.scale 缩放刚体并通知视图重建 */
  setPaddleWidth(w: number): void {
    const ratio = w / this.paddleW
    Matter.Body.scale(this.paddle, ratio, 1)
    this.paddleW = w
    this.onPaddleResized(w)
  }

  /** 当前挡板宽（验收钩子） */
  get paddleWidth(): number {
    return this.paddleW
  }

  /** 手感后处理 #2：击中挡板位置决定出射角（覆盖物理法线反弹），多球各算各的 */
  private applyPaddleBounce(): void {
    if (!this.paddleHitPending) return
    this.paddleHitPending = false
    for (const ball of this.balls) {
      const above = ball.position.y < this.paddle.position.y
      const angle = bounceAngle(
        ball.position.x,
        this.paddle.position.x,
        this.paddleW / 2,
        MAX_BOUNCE_DEG,
      )
      const v = velocityFromAngle(above ? angle : -angle, this.ballSpeed)
      Matter.Body.setVelocity(ball, { x: v.vx, y: v.vy })
    }
    this.onPaddleHit()
  }

  /** 手感后处理 #1：速度大小锁死 + #3 防水平死锁（多球逐一处理） */
  private clampBall(): void {
    for (const ball of this.balls) {
      const v = ball.velocity
      const c = clampSpeed(v.x, v.y, this.ballSpeed)
      const e = ensureVertical(c.vx, c.vy, this.ballSpeed, MIN_VERTICAL_RATIO)
      Matter.Body.setVelocity(ball, { x: e.vx, y: e.vy })
    }
  }

  /** ready 阶段：所有球贴在挡板上 */
  stickBall(): void {
    for (const ball of this.balls) {
      Matter.Body.setPosition(ball, {
        x: this.paddle.position.x,
        y: PADDLE_Y - PADDLE_H / 2 - BALL_R - 2,
      })
      Matter.Body.setVelocity(ball, { x: 0, y: 0 })
    }
  }

  /** 发射：±17° 随机抖动（所有球同角度；ready 时场上仅单球） */
  launch(): void {
    const jitter = (Math.random() - 0.5) * 0.6
    const v = velocityFromAngle(jitter, this.ballSpeed)
    for (const ball of this.balls) {
      Matter.Body.setVelocity(ball, { x: v.vx, y: v.vy })
    }
  }

  /** 发球位重置（构造/重开/失球后共用）：挡板上方 26px 静止球 */
  spawnServeBall(): Matter.Body {
    return this.spawnBall(WORLD_W / 2, PADDLE_Y - 26, 0, 0)
  }

  /** 调试/验收注入：直接摆放主球并赋速度 */
  forceBall(x: number, y: number, vx: number, vy: number): void {
    const ball = this.balls[0]
    if (!ball) return
    Matter.Body.setPosition(ball, { x, y })
    Matter.Body.setVelocity(ball, { x: vx, y: vy })
  }

  /**
   * Multi-ball 道具：+1 镜像球。
   * 生成位 PADDLE_Y-26（高于挡板顶 12px，避开生成瞬间碰撞）；
   * 速度：水平分量与主球反向（轨迹镜像分离），vy 向上补足至当前球速；
   * 主球近垂直时取随机 ±20°；场上满 BALLS_MAX 返回 null（Game 转化加分）。
   */
  spawnMirrorBall(): Matter.Body | null {
    if (this.balls.length >= BALLS_MAX) return null
    const main = this.balls[0]
    const off = this.balls.length % 2 === 1 ? 3 : -3 // 交替偏移消解与主球重叠
    let vx: number
    let vy: number
    if (main && Math.abs(main.velocity.x) > 0.5) {
      vx = -Math.sign(main.velocity.x) * Math.abs(main.velocity.x)
      vy = -Math.sqrt(Math.max(this.ballSpeed * this.ballSpeed - vx * vx, 0.1))
    } else {
      const ang = (Math.random() > 0.5 ? 1 : -1) * (Math.PI / 180) * 20
      vx = Math.sin(ang) * this.ballSpeed
      vy = -Math.cos(ang) * this.ballSpeed
    }
    return this.spawnBall(this.paddle.position.x + off, PADDLE_Y - 26, vx, vy)
  }

  /** Shield 道具：底部一次性反弹墙（实体，球自然反弹；击中一次由事件拆墙） */
  setShield(on: boolean): void {
    if (on && !this.shieldBody) {
      this.shieldBody = Matter.Bodies.rectangle(WORLD_W / 2, SHIELD_Y, WORLD_W - 16, 8, {
        isStatic: true,
        restitution: 1,
        friction: 0,
        label: 'shield',
      })
      Matter.Composite.add(this.engine.world, this.shieldBody)
    } else if (!on && this.shieldBody) {
      Matter.Composite.remove(this.engine.world, this.shieldBody)
      this.shieldBody = null
    }
  }

  hasShield(): boolean {
    return this.shieldBody !== null
  }

  /** 下一帧统一移除碰撞回调里入队的 body（铁律的另一半）：砖与失球 */
  flushDestroyed(
    onRemoved: (body: Matter.Body) => void,
    onBallRemoved: (body: Matter.Body) => void,
  ): void {
    while (this.pendingDestroy.length > 0) {
      const body = this.pendingDestroy.shift()!
      Matter.Composite.remove(this.engine.world, body)
      onRemoved(body)
    }
    while (this.pendingBallRemoval.length > 0) {
      const body = this.pendingBallRemoval.shift()!
      this.removeBall(body) // 内部触发全灭判定
      onBallRemoved(body)
    }
    // 道具拾取：只出事件（实体删除归 Game 的 PowerupEntities 管）
    while (this.pendingPowerupPickup.length > 0) {
      const body = this.pendingPowerupPickup.shift()!
      const type = (body.plugin as { type?: PowerupType })?.type
      if (type) this.onPowerupPickup(type, body.id)
    }
    // 护盾被击中一次：拆墙动作交 Game（回调栈外）
    if (this.pendingShieldHit) {
      this.pendingShieldHit = false
      this.onShieldHit()
    }
  }

  /** 重开局：清世界重建砖阵，挡板/球/护盾归位 */
  resetAll(): void {
    this.setShield(false)
    this.bricks.forEach((b) => Matter.Composite.remove(this.engine.world, b.body))
    this.bricks = []
    this.balls.forEach((b) => Matter.Composite.remove(this.engine.world, b))
    this.balls = []
    this.pendingDestroy.length = 0
    this.pendingBallRemoval.length = 0
    this.paddleHitPending = false
    Matter.Body.setPosition(this.paddle, { x: WORLD_W / 2, y: PADDLE_Y })
    this.spawnServeBall()
    this.buildBricks()
  }

  destroy(): void {
    Matter.Events.off(this.engine, 'collisionStart', this.handleCollision)
    Matter.Composite.clear(this.engine.world, false)
    Matter.Engine.clear(this.engine)
  }
}
