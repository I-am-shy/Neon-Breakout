// 游戏主类：组装 View / Physics / Input / Fx / Store，驱动固定步长主循环
// React 只负责挂载容器与 HUD；本类独立于 React render 循环（架构铁律）
import type Matter from 'matter-js'
import type { Ticker } from 'pixi.js'
import {
  BALL_SPEED,
  EXPAND_RATIO,
  FIXED_DT_MS,
  LIVES_MAX,
  MAX_STEPS_PER_FRAME,
  MULTI_OVERFLOW_SCORE,
  PADDLE_W,
  SLOW_RATIO,
} from './constants'
import { useGameStore, type Phase } from './gameStore'
import { Fx, POWERUP_NAME } from './fx'
import { Input } from './Input'
import { NeonView } from './NeonView'
import { Physics, type BrickRef } from './physics'
import { EffectManager } from './powerups/EffectManager'
import { pickDrop } from './powerups/drop'
import { PowerupEntities } from './powerups/PowerupEntities'
import type { PowerupType } from './powerups/types'
import { PointerInput } from './PointerInput'
import { sfx } from './Sfx'
import { POWERUP_COLOR } from './powerups/types'
import { PADDLE_Y } from './constants'
import { getSettings, useSettingsStore, type Settings } from './settings'
import { pauseAction, spaceAction, tapAction } from './inputPolicy'
import { DROP_BASE_BRICKS } from './constants'

export class Game {
  private readonly view = new NeonView()
  private readonly physics = new Physics()
  private readonly input = new Input()
  private readonly powerups = new PowerupEntities(this.physics.engine.world) // 掉落物实体池
  private readonly em = new EffectManager() // 持续效果注册表（物理步时钟）
  private lastEffectsJson = '' // activeEffects 快照比对（避免每帧 setState）
  private pointer: PointerInput | null = null
  private container: HTMLDivElement | null = null
  private fx: Fx | null = null
  private accumulator = 0
  private destroyed = false
  private tickCount = 0 // 物理步计数（渐变砖色相时钟与效果时钟）
  private specialRefs: Array<BrickRef> = [] // 存活特殊砖（gift/flow）缓存（每帧动画用）
  private countdownSteps = 0 // 局时限的步累计（跨秒余量进位）
  private prevPhase: Phase = 'idle' // phase 迁移侦测（UI 回首页按钮 → rebuildWorld）
  /** 密度归一后的普通砖有效掉率（rebuildWorld 时按图案实际砖数计算） */
  private dropRateEffective = 0.15

  async init(container: HTMLDivElement): Promise<void> {
    this.container = container
    await this.view.init(container)
    if (this.destroyed) {
      // destroy 先于 init 完成的 race（React StrictMode / 快速卸载）
      this.view.destroy()
      return
    }
    this.fx = new Fx(this.view.fxLayer!)
    this.spawnBrickViews()
    this.view.addBallGfx(this.physics.balls[0].id)

    this.physics.onBrickHit = (ref) => {
      sfx.brick(ref.row)
      useGameStore.getState().brickDestroyed(ref.kind)
    }
    this.physics.onGiftHit = (ref) => {
      sfx.giftHit()
      this.view.flashGift(ref.body.id)
    }
    this.physics.onPaddleHit = () => {
      sfx.paddle()
      this.fx?.paddleFlash(this.view.paddleGfx!)
    }
    this.physics.onWallHit = () => sfx.wall()
    this.physics.onAllBallsLost = () => this.loseBall()
    this.physics.onPaddleResized = (w) => this.view.rebuildPaddle(w)
    this.physics.onPowerupPickup = (type, id) => {
      this.powerups.remove(id)
      this.view.removePowerup(id)
      this.applyPowerup(type)
    }
    this.physics.onShieldHit = () => {
      this.physics.setShield(false) // 一次性：挡一下就碎
      this.view.setShield(false)
      sfx.shieldBreak()
      this.fx?.shake(this.view.world!, 4)
    }

    this.input.onLaunch = () => this.handleLaunch()
    this.input.onTogglePause = () => {
      const s = useGameStore.getState()
      if (pauseAction(s.phase) === 'togglePause') s.togglePause()
    }
    this.input.onRestart = () => this.restart()

    // 触屏/鼠标：拖拽跟手移动挡板，tap = 启动 / 暂停 / 继续 / 重开（移动端唯一入口）
    this.pointer = new PointerInput(container)
    this.pointer.onDrag = (x) => this.physics.setPaddleX(x)
    this.pointer.onTap = () => this.handleTap()
    this.pointer.attach()

    // 浏览器 autoplay 政策：首个 keydown / pointerdown 解锁 AudioContext
    window.addEventListener('keydown', this.unlockAudio, { once: true })
    container.addEventListener('pointerdown', this.unlockAudio, { once: true })

    this.view.app!.ticker.add(this.tick)

    // 调试钩子：把内部状态挂到 window，便于在浏览器控制台实时检查
    const w = window as unknown as Record<string, unknown>
    w.__NB__ = {
      store: () => useGameStore.getState(),
      ball: () => {
        const b = this.physics.balls[0]
        return b
          ? { x: b.position.x, y: b.position.y, vx: b.velocity.x, vy: b.velocity.y }
          : null
      },
      ballsCount: () => this.physics.balls.length,
      paddle: () => this.physics.paddle.position.x,
      input: () => ({ ...this.input.state }),
      bricksAlive: () => this.physics.bricks.filter((b) => b.alive).length,
      lastPickup: () => this.lastPickup,
      specialBricks: () =>
        this.physics.bricks
          .filter((b) => b.kind !== 'normal' && b.alive)
          .map((b) => ({
            id: b.body.id,
            kind: b.kind,
            hp: b.hp,
            dropType: b.dropType ?? null,
            x: Math.round(b.body.position.x),
            y: Math.round(b.body.position.y),
          })),
      effects: () => useGameStore.getState().activeEffects,
      paddleWidth: () => this.physics.paddleWidth,
      hasShield: () => this.physics.hasShield(),
      /** 本局图案信息（名称 + 镜像），验收/调试用 */
      pattern: () => {
        const p = this.physics.pattern
        return p ? { name: p.def.name, mirrorX: p.mirrorX, mirrorY: p.mirrorY } : null
      },
      /** 当前设置快照 / 验收注入设置（改砖阵尺寸、掉率模式等） */
      settings: () => ({ ...getSettings() }),
      setSettings: (patch: Partial<Settings>) => useSettingsStore.getState().set(patch),
      /** Pixi ticker 实时帧率（性能验收） */
      fps: () => this.view.app?.ticker.FPS ?? 0,
      /** 当前生效的普通砖掉率（密度归一后） */
      dropRate: () => this.dropRateEffective,
      /** 验收注入：在挡板上方直接生成道具 */
      spawnPowerup: (type: PowerupType) => {
        const x = this.physics.paddle.position.x
        const y = PADDLE_Y - 90
        const id = this.powerups.spawn(type, x, y)
        this.view.addPowerup(id, type, x, y)
      },
      forceBall: (x: number, y: number, vx: number, vy: number) => {
        this.physics.forceBall(x, y, vx, vy)
      },
    }
  }

  private readonly unlockAudio = (): void => {
    sfx.unlock()
  }

  private spawnBrickViews(): void {
    this.specialRefs = []
    this.physics.bricks.forEach((b) => {
      if (b.kind === 'gift' || b.kind === 'flow') {
        this.specialRefs.push(b)
        this.view.addSpecialBrick(
          b.body.id,
          b.body.position.x,
          b.body.position.y,
          b.kind,
          b.dropType,
        )
      } else {
        this.view.addBrick(b.body.id, b.body.position.x, b.body.position.y, b.color)
      }
    })
  }

  private readonly tick = (ticker: Ticker): void => {
    const { phase } = useGameStore.getState()
    if (phase === 'playing') {
      this.accumulator += ticker.deltaMS
      let steps = 0
      while (this.accumulator >= FIXED_DT_MS && steps < MAX_STEPS_PER_FRAME) {
        this.physics.step(FIXED_DT_MS, this.paddleDir())
        this.accumulator -= FIXED_DT_MS
        this.tickCount++
        this.em.step() // 效果时钟与物理步同频
        this.applySpeedPolicy() // 球速策略：倍率 × Slow 插值（每物理步统一写入）
        steps++
      }
      if (steps === MAX_STEPS_PER_FRAME) this.accumulator = 0 // 追不上就丢帧，防螺旋死亡
      this.physics.flushDestroyed(
        (body) => this.onBrickRemoved(body),
        (body) => this.view.removeBallGfx(body.id),
      )
      this.advanceCountdown(steps)
      // 掉落物推进：恒速下落 + 触底回收（拾取已在 flush 内触发回调）
      const despawned = this.powerups.step()
      despawned.forEach((id) => this.view.removePowerup(id))
      const items: Array<{ id: number; x: number; y: number }> = []
      this.powerups.forEach((e) =>
        items.push({ id: e.body.id, x: e.body.position.x, y: e.body.position.y }),
      )
      this.view.syncPowerups(items, this.tickCount)
    } else if (phase === 'ready') {
      // 贴板待发射阶段也要能移动挡板（走位瞄准是核心操作）
      this.physics.movePaddle(this.paddleDir(), Math.min(ticker.deltaMS, 32))
      this.physics.stickBall()
      this.accumulator = 0
    }
    this.view.updateSpecialBricks(this.tickCount, this.specialRefs)
    // phase 迁移侦测：两条外部路径需要物理重建——
    // ① UI 按钮回首页（→idle）② PLAY 开始新局（idle→ready，砖阵按当前设置重建）
    if (phase !== this.prevPhase && (phase === 'idle' || this.prevPhase === 'idle')) {
      this.rebuildWorld()
    }
    // 终局（gameover/win）迁移：记录最高分
    if ((phase === 'gameover' || phase === 'win') && phase !== this.prevPhase) {
      useGameStore.getState().recordBest()
    }
    this.prevPhase = phase
    this.syncEffects()
    this.syncRender(phase)
  }

  private paddleDir(): -1 | 0 | 1 {
    const { left, right } = this.input.state
    if (right === left) return 0
    return right ? 1 : -1
  }

  private onBrickRemoved(body: Matter.Body): void {
    const ref = body.plugin?.ref as BrickRef | undefined
    if (ref?.kind === 'gift' || ref?.kind === 'flow') {
      this.view.removeSpecialBrick(body.id)
      this.specialRefs = this.specialRefs.filter((p) => p.body.id !== body.id)
    } else {
      this.view.removeBrick(body.id)
    }
    if (ref) {
      this.fx?.brickBreak(
        body.position.x,
        body.position.y,
        ref.kind === 'gift' && ref.dropType
          ? POWERUP_COLOR[ref.dropType] // gift 碎裂粒子用道具色（颜色预告闭环）
          : ref.kind === 'flow'
            ? 0xffffff
            : ref.color,
      )
      // 掉落三通道：gift 固定（生成时预埋）· flow 必掉随机 · normal 概率（密度归一有效值）
      const drop =
        ref.kind === 'gift'
          ? (ref.dropType ?? null)
          : pickDrop(ref.kind === 'flow' ? 'flow' : 'normal', Math.random, this.dropRateEffective)
      if (drop) {
        const id = this.powerups.spawn(drop, body.position.x, body.position.y)
        this.view.addPowerup(id, drop, body.position.x, body.position.y)
        // 掉落瞬间浮字：击碎即可辨认道具（符号 + 名字双重提示）
        this.fx?.floatText(
          POWERUP_NAME[drop],
          POWERUP_COLOR[drop],
          body.position.x,
          body.position.y - 14,
        )
      }
    }
    this.fx?.shake(this.view.world!, 3)
  }

  /** 道具效果入口：五种效果的全量接线 */
  private applyPowerup(type: PowerupType): void {
    this.lastPickup = type
    sfx.pickup(type)
    const store = useGameStore.getState()
    store.showBanner(type) // HUD 中央横幅（组件侧自动消失）
    this.fx?.pickupBurst(
      this.physics.paddle.position.x,
      PADDLE_Y - 20,
      POWERUP_COLOR[type],
    )
    switch (type) {
      case 'expand':
        this.physics.setPaddleWidth(PADDLE_W * EXPAND_RATIO)
        this.em.apply('expand', {
          ticks: this.effectTicks('expand'),
          onExpire: () => this.physics.setPaddleWidth(PADDLE_W),
        })
        break
      case 'slow':
        this.em.apply('slow', {
          ticks: this.effectTicks('slow'),
        })
        break
      case 'multi': {
        const nb = this.physics.spawnMirrorBall()
        if (nb) {
          this.view.addBallGfx(nb.id)
        } else {
          store.addScore(MULTI_OVERFLOW_SCORE) // 满员转化：反馈不落空
        }
        break
      }
      case 'life':
        store.setLives(Math.min(store.lives + 1, LIVES_MAX))
        break
      case 'shield':
        this.physics.setShield(true)
        this.view.setShield(true)
        break
    }
  }

  /** 道具时长（物理步）：settings.effectSec 为 Expand 全额，Slow ×0.8（沿用原 600/480 比例） */
  private effectTicks(type: 'expand' | 'slow'): number {
    const sec = getSettings().effectSec
    return Math.round(sec * (type === 'slow' ? 0.8 : 1) * 60)
  }

  /**
   * 球速策略（每物理步统一写入）：基准 × 设置倍率 × Slow 恢复因子。
   * 取代原先分散的 setBallSpeed 调用——设置即时生效，Slow 到期自然回到倍率基准。
   */
  private applySpeedPolicy(): void {
    const mult = getSettings().speedMult
    let factor = 1
    if (this.em.has('slow')) {
      const total = this.effectTicks('slow')
      const t = 1 - this.em.remaining('slow') / total
      factor = SLOW_RATIO + (1 - SLOW_RATIO) * t // 0.7 → 1.0 线性恢复
    }
    this.physics.setBallSpeed(BALL_SPEED * mult * factor)
  }

  /** 局时限倒计时：按物理步精确累计（暂停天然停表），归零触发 TIME UP 终局 */
  private advanceCountdown(steps: number): void {
    const limit = getSettings().timeLimitSec
    if (limit <= 0) return
    const store = useGameStore.getState()
    if (store.phase !== 'playing') return
    const stepsPerSec = 60
    this.countdownSteps += steps
    if (this.countdownSteps >= stepsPerSec) {
      const elapsed = Math.floor(this.countdownSteps / stepsPerSec)
      this.countdownSteps -= elapsed * stepsPerSec
      const left = store.timeLeftSec - elapsed
      if (left <= 0) {
        useGameStore.getState().timeUp()
        sfx.lose()
      } else {
        useGameStore.getState().setTimeLeft(left)
      }
    }
  }

  /** activeEffects 快照同步到 store（HUD 订阅；JSON 比对避免无变化 setState） */
  private syncEffects(): void {
    const snap: Partial<Record<PowerupType, number>> = {}
    for (const t of this.em.active()) snap[t] = this.em.remaining(t)
    const json = JSON.stringify(snap)
    if (json !== this.lastEffectsJson) {
      this.lastEffectsJson = json
      useGameStore.getState().setEffects(snap)
    }
  }

  private lastPickup: PowerupType | null = null

  private loseBall(): void {
    const s = useGameStore.getState()
    if (s.phase !== 'playing') return
    sfx.lose()
    this.fx?.shake(this.view.world!, 7)
    this.view.clearTrail()
    s.loseLife() // → ready（重发球）或 gameover
    // 数组化回归修复：全灭时 body 已移除，ready 需重新生成发球球
    if (useGameStore.getState().phase === 'ready') {
      const serve = this.physics.spawnServeBall()
      this.view.addBallGfx(serve.id)
    }
  }

  /** Space 的启动族动作：开屏→待发射、待发射→发射、终局→重开；playing/paused 无操作（暂停归 Esc） */
  private handleLaunch(): void {
    sfx.unlock()
    const s = useGameStore.getState()
    switch (spaceAction(s.phase)) {
      case 'enterReady':
        s.enterReady()
        break
      case 'launch':
        s.start()
        this.physics.launch()
        sfx.launch()
        break
      case 'restart':
        this.restart()
        break
      case 'resume':
        s.togglePause() // 暂停态按空格继续
        break
      default:
        break
    }
  }

  /** 点按（触屏/鼠标）：移动端唯一入口——兼做启动与暂停/继续（⏸ 按钮已移除） */
  private handleTap(): void {
    sfx.unlock()
    const s = useGameStore.getState()
    const action = tapAction(s.phase)
    if (action === 'togglePause') s.togglePause()
    else this.handleLaunch()
  }

  /** 重开局：直达待发射（R 键 / 终局重开）；返回首页走 store.backToTitle + tick 的 phase 迁移侦测 */
  private restart(): void {
    useGameStore.getState().reset() // phase → ready
    this.rebuildWorld()
  }

  /** 物理世界与视图全量重建（两条重置路径共用） */
  private rebuildWorld(): void {
    this.physics.resetAll()
    this.em.clear() // 触发 onExpire：还原挡板宽
    this.physics.setShield(false)
    this.view.setShield(false)
    this.view.resetBrickViews()
    this.view.removeAllBallGfx()
    this.view.removeAllPowerupGfx()
    this.powerups.forEach((e) => this.powerups.remove(e.body.id))
    this.view.addBallGfx(this.physics.balls[0].id)
    this.spawnBrickViews()
    // 图案定形后校准：实际砖数回写 store（freshGame 只能给满阵估值）
    useGameStore.getState().setBricksLeft(this.physics.bricks.length)
    // 掉落率密度归一（千砖局道具总量守恒）；random 模式每局 roll 5%-25%
    const st = getSettings()
    const base = st.dropMode === 'random' ? 0.05 + Math.random() * 0.2 : st.dropRate
    const total = Math.max(this.physics.bricks.length, 1)
    this.dropRateEffective = Math.min(0.5, (base * DROP_BASE_BRICKS) / total)
    this.accumulator = 0
    this.tickCount = 0
    this.countdownSteps = 0
    this.view.clearTrail()
  }

  private syncRender(phase: Phase): void {
    // 多球同步；拖尾仅主球（多球时其余球省略，性能零风险）
    for (const ball of this.physics.balls) {
      this.view.syncBall(ball.id, ball.position.x, ball.position.y)
    }
    this.view.syncPaddle(this.physics.paddle.position.x)
    const main = this.physics.balls[0]
    if (main && phase === 'playing') {
      this.view.updateTrail(main.position.x, main.position.y)
    }
  }

  destroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    window.removeEventListener('keydown', this.unlockAudio)
    this.container?.removeEventListener('pointerdown', this.unlockAudio)
    if (this.view.app) this.view.app.ticker.remove(this.tick)
    this.input.destroy()
    this.pointer?.detach()
    this.fx?.destroy()
    this.physics.destroy()
    this.view.destroy()
    sfx.destroy()
  }
}
