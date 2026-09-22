// Pixi v8 渲染层：纯程序绘制（零纹理素材），霓虹 = 双层描边 + additive 混合
// view 只负责画与销毁，body→gfx 的每帧同步由 Game 驱动
import gsap from 'gsap'
import { Application, Container, Graphics } from 'pixi.js'
import {
  BALL_R,
  BRICK_H,
  brickWidth,
  PALETTE,
  PADDLE_H,
  PADDLE_W,
  PADDLE_Y,
  FLOW_CYCLE_TICKS,
  SHIELD_Y,
  WORLD_H,
  WORLD_W,
} from './constants'
import { hslToHex } from './color'
import { getSettings } from './settings'
import { POWERUP_COLOR, type PowerupType } from './powerups/types'

const TRAIL_LEN = 10

export class NeonView {
  app: Application | null = null
  world: Container | null = null // 震屏作用域：震容器 position，不与子 gfx 同步冲突
  fxLayer: Container | null = null // GSAP 粒子层（最顶层）
  paddleGfx: Graphics | null = null

  private ballGfxMap = new Map<number, Graphics>() // bodyId -> gfx（多球）
  private trailGfx: Graphics | null = null
  private brickRects = new Map<number, { x: number; y: number; color: number }>() // 普通砖合批数据（id → 位置/色）
  private brickBatch: Graphics | null = null // 合批渲染目标（千砖 1 draw call）
  private readonly powerupGfx = new Map<number, Container>() // 掉落物（胶囊+符号）
  private shieldGfx: Graphics | null = null // 一次性底部反弹墙
  private readonly trail: Array<{ x: number; y: number }> = []

  async init(container: HTMLDivElement): Promise<void> {
    const app = new Application()
    await app.init({
      width: WORLD_W,
      height: WORLD_H,
      background: PALETTE.bg,
      antialias: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
    })
    this.app = app
    const canvas = app.canvas
    canvas.style.position = 'absolute'
    canvas.style.inset = '0'
    canvas.style.width = '100%'
    canvas.style.height = '100%'
    container.appendChild(canvas)

    this.world = new Container()
    app.stage.addChild(this.world)
    this.drawGrid(this.world)
    this.drawWallGlow(this.world)

    this.trailGfx = new Graphics()
    this.trailGfx.blendMode = 'add'
    this.world.addChild(this.trailGfx)

    this.paddleGfx = this.buildPaddleGfx()
    this.paddleGfx.position.set(WORLD_W / 2, PADDLE_Y)
    this.world.addChild(this.paddleGfx)

    this.fxLayer = new Container()
    this.world.addChild(this.fxLayer)
  }

  private drawGrid(parent: Container): void {
    const g = new Graphics()
    const step = 32
    for (let x = step; x < WORLD_W; x += step) {
      g.moveTo(x, 0).lineTo(x, WORLD_H).stroke({ color: PALETTE.grid, width: 1, alpha: 0.5 })
    }
    for (let y = step; y < WORLD_H; y += step) {
      g.moveTo(0, y).lineTo(WORLD_W, y).stroke({ color: PALETTE.grid, width: 1, alpha: 0.5 })
    }
    parent.addChild(g)
  }

  private drawWallGlow(parent: Container): void {
    const g = new Graphics()
    const t = 3
    g.roundRect(0, 0, WORLD_W, t, 2).fill({ color: PALETTE.wallGlow, alpha: 0.65 })
    g.roundRect(0, 0, t, WORLD_H, 2).fill({ color: PALETTE.wallGlow, alpha: 0.35 })
    g.roundRect(WORLD_W - t, 0, t, WORLD_H, 2).fill({ color: PALETTE.wallGlow, alpha: 0.35 })
    g.blendMode = 'add'
    parent.addChild(g)
  }

  /** 多球：按 bodyId 增删球视图（Game 在 spawn/remove 路径调用） */
  addBallGfx(id: number): void {
    const g = new Graphics()
    g.circle(0, 0, BALL_R).fill({ color: PALETTE.ball })
    g.circle(0, 0, BALL_R + 2.5).stroke({ color: PALETTE.ballGlow, width: 3, alpha: 0.8 })
    this.ballGfxMap.set(id, g)
    this.world!.addChild(g)
  }

  removeBallGfx(id: number): void {
    this.ballGfxMap.get(id)?.destroy()
    this.ballGfxMap.delete(id)
  }

  removeAllBallGfx(): void {
    this.ballGfxMap.forEach((g) => g.destroy())
    this.ballGfxMap.clear()
  }

  private buildPaddleGfx(width = PADDLE_W): Graphics {
    const g = new Graphics()
    const w = width
    const h = PADDLE_H
    // 外层辉光
    g.roundRect(-w / 2 - 3, -h / 2 - 3, w + 6, h + 6, 8).stroke({
      color: PALETTE.paddle,
      width: 4,
      alpha: 0.25,
    })
    // 主体：深底 + 亮描边
    g.roundRect(-w / 2, -h / 2, w, h, 5)
      .fill({ color: 0x0a1a2a, alpha: 0.92 })
      .stroke({ color: PALETTE.paddle, width: 1.5, alpha: 1 })
    // 中心能量条
    g.roundRect(-w / 2 + 5, -1.5, w - 10, 3, 2).fill({ color: PALETTE.paddleCore, alpha: 0.9 })
    return g
  }

  /** 挡板宽度变化（Expand 道具）：销毁重建，保持位置 */
  rebuildPaddle(width: number): void {
    if (!this.world) return
    const x = this.paddleGfx?.position.x ?? WORLD_W / 2
    this.paddleGfx?.destroy()
    this.paddleGfx = this.buildPaddleGfx(width)
    this.paddleGfx.position.set(x, PADDLE_Y)
    this.world.addChild(this.paddleGfx)
  }

  /** 当前砖宽（布局动态：列数来自 settings） */
  private brickW(): number {
    return brickWidth(getSettings().brickCols)
  }

  addBrick(id: number, x: number, y: number, color: number): void {
    this.brickRects.set(id, { x, y, color })
    this.redrawBrickBatch()
  }

  removeBrick(id: number): void {
    if (this.brickRects.delete(id)) this.redrawBrickBatch()
  }

  /** 普通砖合批：单 Graphics 承载全部存活砖（千砖 1 次 draw call）。
   *  击碎/新增时整批重画（非每帧——单帧 ~2ms 尖峰可接受） */
  private redrawBrickBatch(): void {
    const g = (this.brickBatch ??= (() => {
      const bg = new Graphics()
      this.world!.addChild(bg)
      return bg
    })())
    const w = this.brickW()
    g.clear()
    for (const r of this.brickRects.values()) {
      // 外层低透明度宽描边模拟 glow（与特殊砖视觉语言一致）
      g.rect(r.x - w / 2 - 2, r.y - BRICK_H / 2 - 2, w + 4, BRICK_H + 4).stroke({
        color: r.color,
        width: 5,
        alpha: 0.16,
      })
      g.rect(r.x - w / 2, r.y - BRICK_H / 2, w, BRICK_H)
        .fill({ color: 0x000000, alpha: 0.3 })
        .stroke({ color: r.color, width: 1.5, alpha: 0.95 })
    }
  }

  // ---- 掉落物：霓虹胶囊 + 语义符号（零素材，Graphics 程序绘制） ----

  addPowerup(id: number, type: PowerupType, x: number, y: number): void {
    const c = new Container()
    const color = POWERUP_COLOR[type]
    const g = new Graphics()
    g.roundRect(-10, -7, 20, 14, 7)
      .fill({ color: 0x000814, alpha: 0.9 })
      .stroke({ color, width: 1.5 })
    g.roundRect(-12, -9, 24, 18, 9).stroke({ color, width: 2.5, alpha: 0.25 })
    g.blendMode = 'add' // 符号层：加色混合更亮更醒目
    this.drawPowerupGlyph(g, type, color)
    c.addChild(g)
    c.position.set(x, y)
    this.powerupGfx.set(id, c)
    this.world!.addChild(c)
  }

  /** 道具语义符号（与 Overlay 开屏图例的 SVG 造型一致）：
   *  expand=横向双箭头(加宽) · multi=三球(分裂) · slow=沙漏(时间减速) ·
   *  life=十字(生命) · shield=底弧护罩(底部反弹墙) */
  private drawPowerupGlyph(g: Graphics, type: PowerupType, color: number): void {
    g.setStrokeStyle({ color, width: 1.6, alpha: 1 })
    switch (type) {
      case 'expand': // ↔ 双箭头
        g.moveTo(-6, 0).lineTo(6, 0)
        g.moveTo(-6, 0).lineTo(-3, -3)
        g.moveTo(-6, 0).lineTo(-3, 3)
        g.moveTo(6, 0).lineTo(3, -3)
        g.moveTo(6, 0).lineTo(3, 3)
        g.stroke()
        break
      case 'multi': // 三球
        g.circle(-4, 0, 2.6).fill({ color, alpha: 1 })
        g.circle(4, 0, 2.6).fill({ color, alpha: 1 })
        g.circle(0, -4, 2.6).fill({ color, alpha: 0.7 })
        break
      case 'slow': // 沙漏（两个对顶三角）
        g.moveTo(-4, -5).lineTo(4, -5).lineTo(-4, 5).lineTo(4, 5).closePath().stroke()
        break
      case 'life': // + 十字
        g.moveTo(0, -5).lineTo(0, 5)
        g.moveTo(-5, 0).lineTo(5, 0)
        g.stroke()
        break
      case 'shield': // 底部护罩弧
        g.moveTo(-7, -3).quadraticCurveTo(0, 4, 7, -3).stroke()
        g.moveTo(-7, -3).lineTo(7, -3).stroke({ alpha: 0.5 })
        break
    }
  }

  removePowerup(id: number): void {
    this.powerupGfx.get(id)?.destroy()
    this.powerupGfx.delete(id)
  }

  /** 每帧同步：位置 + 缓慢旋转（下落动效） */
  syncPowerups(items: Array<{ id: number; x: number; y: number }>, tick: number): void {
    const rotation = tick * 0.05
    for (const item of items) {
      const c = this.powerupGfx.get(item.id)
      if (c) {
        c.position.set(item.x, item.y)
        c.rotation = Math.sin(rotation) * 0.35 // 摆动比自转更「漂浮」
      }
    }
  }

  removeAllPowerupGfx(): void {
    this.powerupGfx.forEach((c) => c.destroy())
    this.powerupGfx.clear()
  }

  // ---- 护盾（Shield）：底部一次性发光条 ----

  setShield(on: boolean): void {
    if (on && !this.shieldGfx && this.world) {
      const g = new Graphics()
      const w = WORLD_W - 16
      g.rect(-w / 2, -3, w, 6).fill({ color: 0x39ff88, alpha: 0.75 })
      g.rect(-w / 2 - 3, -6, w + 6, 12).stroke({ color: 0x39ff88, width: 3, alpha: 0.25 })
      g.position.set(WORLD_W / 2, SHIELD_Y)
      this.shieldGfx = g
      this.world.addChild(g)
    } else if (!on && this.shieldGfx) {
      this.shieldGfx.destroy()
      this.shieldGfx = null
    }
  }

  // ---- 特殊砖：gift（光晕道具砖·右上→左下流光·首击暗淡闪烁）+ flow（彩色流动渐变·自左向右） ----
  // 砖宽动态（brickW()），与普通砖同格布局

  private readonly specialGfx = new Map<
    number,
    { root: Container; base: Graphics; beam: Graphics | null; kind: 'gift' | 'flow'; color: number }
  >()

  private static readonly BEAM_PERIOD = 48 // gift 流光一轮的物理步数（~0.8s）

  addSpecialBrick(
    id: number,
    x: number,
    y: number,
    kind: 'gift' | 'flow',
    dropType?: PowerupType,
  ): void {
    const W = this.brickW()
    const root = new Container()
    root.position.set(x, y)
    const base = new Graphics()
    root.addChild(base)
    let beam: Graphics | null = null
    let color = 0xffffff
    if (kind === 'gift') {
      // 光晕色 = 掉落道具色（预告机制：看砖色即知道会掉什么）
      color = POWERUP_COLOR[dropType ?? 'expand']
      // 遮罩：只裁流光（sheen 不得溢出砖面）；base 的光晕描边不受裁剪
      const mask = new Graphics()
      mask.rect(-W / 2, -BRICK_H / 2, W, BRICK_H).fill({ color: 0xffffff })
      root.addChild(mask)
      // 流光：软边亮带扫过（多条平行带近似渐变边缘——玻璃光面 sheen）
      // 中心亮、两侧渐弱，倾斜 45°，从右上向左下循环
      beam = new Graphics()
      const bands: Array<{ off: number; w: number; a: number }> = [
        { off: 0, w: 5, a: 0.5 },
        { off: -4.5, w: 4, a: 0.22 },
        { off: 4.5, w: 4, a: 0.22 },
        { off: -8, w: 3, a: 0.08 },
        { off: 8, w: 3, a: 0.08 },
      ]
      for (const b of bands) {
        beam.rect(b.off - b.w / 2, -BRICK_H * 1.5, b.w, BRICK_H * 3)
        beam.fill({ color, alpha: b.a })
      }
      beam.rotation = -Math.PI / 4
      beam.blendMode = 'add'
      root.addChild(beam)
      beam.mask = mask
    }
    this.world!.addChild(root)
    this.specialGfx.set(id, { root, base, beam, kind, color })
  }

  removeSpecialBrick(id: number): void {
    this.specialGfx.get(id)?.root.destroy()
    this.specialGfx.delete(id)
  }

  /** 每帧动画（tick 持续递增即可驱动）；refs 为存活特殊砖（physics 的 BrickRef） */
  updateSpecialBricks(
    tick: number,
    refs: Array<{ body: { id: number }; hp: number }>,
  ): void {
    const W = this.brickW()
    for (const ref of refs) {
      const e = this.specialGfx.get(ref.body.id)
      if (!e) continue
      if (e.kind === 'gift') {
        this.redrawGift(e, tick, ref.hp)
        // 流光：从右上扫向左下循环（position.x 由 +W/2 → -W/2，y 随倾斜补偿视觉对角）
        const t = (tick % NeonView.BEAM_PERIOD) / NeonView.BEAM_PERIOD
        if (e.beam) e.beam.position.set(W / 2 + 5 - t * (W + 10), 0)
      } else {
        this.redrawFlow(e, tick)
      }
    }
  }

  /** 命中白闪（GSAP 控 root.alpha；流光与暗淡由每帧重画管） */
  flashGift(id: number): void {
    const e = this.specialGfx.get(id)
    if (e) {
      gsap.fromTo(e.root, { alpha: 0.2 }, { alpha: 1, duration: 0.15, ease: 'power2.out' })
    }
  }

  /** gift 砖：道具色光晕（多层描边）；hp=1 变暗淡 + 闪烁（提示再击一下就破） */
  private redrawGift(
    e: { base: Graphics; color: number },
    _tick: number,
    hp: number,
  ): void {
    const g = e.base
    const c = e.color
    const W = this.brickW()
    const damaged = hp <= 1
    g.clear()
    if (!damaged) {
      // 完好：三层光晕（内亮外暗）
      g.rect(-W / 2 - 7, -BRICK_H / 2 - 7, W + 14, BRICK_H + 14)
        .stroke({ color: c, width: 2, alpha: 0.12 })
      g.rect(-W / 2 - 4, -BRICK_H / 2 - 4, W + 8, BRICK_H + 8)
        .stroke({ color: c, width: 3, alpha: 0.3 })
    } else {
      // 被击：光晕塌缩成微弱外框 + 整体闪烁
      const flicker = 0.25 + 0.3 * Math.abs(Math.sin(_tick / 4))
      g.rect(-W / 2 - 4, -BRICK_H / 2 - 4, W + 8, BRICK_H + 8)
        .stroke({ color: c, width: 2, alpha: flicker })
    }
    g.rect(-W / 2, -BRICK_H / 2, W, BRICK_H)
      .fill({ color: 0x000814, alpha: damaged ? 0.55 : 0.85 })
      .stroke({ color: c, width: 1.5, alpha: damaged ? 0.5 + 0.35 * Math.abs(Math.sin(_tick / 4)) : 0.95 })
  }

  /** flow 砖：窄竖条密集采样模拟平滑横向渐变（条间 hue 步进 ~5°，低于视觉分辨阈值）；
   *  相位随 tick 递进 → 色带自左向右流动；外圈彩色光晕取砖中心 hue，随渐变同步流动 */
  private redrawFlow(e: { base: Graphics }, tick: number): void {
    const g = e.base
    const W = this.brickW()
    const N = 24 // 密条融合（原 8 条块状割裂）
    const SPAN = 135 // hue 跨度（度）：任一时刻 3~4 个连续色，彩色不花哨
    const base = ((tick / FLOW_CYCLE_TICKS) * 360) % 360
    g.clear()
    // 外圈彩色光晕（随中心 hue 流动）
    const glow = hslToHex(base + SPAN / 2, 0.95, 0.55)
    g.rect(-W / 2 - 6, -BRICK_H / 2 - 6, W + 12, BRICK_H + 12)
      .stroke({ color: glow, width: 2, alpha: 0.14 })
    g.rect(-W / 2 - 3, -BRICK_H / 2 - 3, W + 6, BRICK_H + 6)
      .stroke({ color: glow, width: 2, alpha: 0.32 })
    // 砖面渐变
    for (let i = 0; i < N; i++) {
      // (N-1-i)：相位增 → 同一 hue 出现在更右侧 → 图案右移（自左向右流动）
      const hue = base + (N - 1 - i) * (SPAN / (N - 1))
      const x = -W / 2 + (i * W) / N
      g.rect(x, -BRICK_H / 2, W / N + 0.5, BRICK_H)
        .fill({ color: hslToHex(hue, 0.95, 0.55), alpha: 0.88 })
    }
    g.rect(-W / 2, -BRICK_H / 2, W, BRICK_H)
      .stroke({ color: glow, width: 1, alpha: 0.5 })
  }

  resetBrickViews(): void {
    this.brickRects.clear()
    if (this.brickBatch) this.brickBatch.clear()
    this.specialGfx.forEach((e) => e.root.destroy())
    this.specialGfx.clear()
  }

  syncBall(id: number, x: number, y: number): void {
    this.ballGfxMap.get(id)?.position.set(x, y)
  }

  syncPaddle(x: number): void {
    this.paddleGfx?.position.set(x, PADDLE_Y)
  }

  updateTrail(x: number, y: number): void {
    const g = this.trailGfx
    if (!g) return
    this.trail.push({ x, y })
    if (this.trail.length > TRAIL_LEN) this.trail.shift()
    g.clear()
    for (let i = 0; i < this.trail.length; i++) {
      const t = this.trail[i]
      const f = (i + 1) / this.trail.length // 越新越亮
      g.circle(t.x, t.y, BALL_R * 0.75 * f).fill({
        color: PALETTE.ballGlow,
        alpha: 0.05 + 0.2 * f,
      })
    }
  }

  clearTrail(): void {
    this.trail.length = 0
    this.trailGfx?.clear()
  }

  destroy(): void {
    if (this.app) {
      this.app.destroy({ removeView: true }, { children: true })
      this.app = null
    }
    this.brickRects.clear()
    this.ballGfxMap.clear()
    this.world = null
    this.fxLayer = null
  }
}
