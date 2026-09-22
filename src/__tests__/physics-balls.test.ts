// 多球数组化（Task 1）与动态参数（Task 2/6）的 Physics 层单测
import { describe, expect, it } from 'vitest'
import { BALLS_MAX, BALL_SPEED, PADDLE_MARGIN, PADDLE_Y, WORLD_W, toPerStep } from '../game/constants'
import { Physics } from '../game/physics'

describe('道具效果（physics 层：镜像球与护盾）', () => {
  it('spawnMirrorBall：镜像弹射（主球 vx>0 → 新球 vx<0, vy<0），球数 +1', () => {
    const p = new Physics()
    p.forceBall(240, 300, 5, -5) // 主球向右上
    const nb = p.spawnMirrorBall()
    expect(nb).not.toBeNull()
    expect(p.balls).toHaveLength(2)
    expect(nb!.velocity.x).toBeLessThan(0)
    expect(nb!.velocity.y).toBeLessThan(0)
    // 速度大小与当前球速一致（手感锁速不变）
    expect(Math.hypot(nb!.velocity.x, nb!.velocity.y)).toBeCloseTo(toPerStep(BALL_SPEED), 5)
  })

  it('镜像球生成位高于挡板顶 12px（不即时碰撞）', () => {
    const p = new Physics()
    const nb = p.spawnMirrorBall()!
    expect(nb.position.y).toBeLessThanOrEqual(PADDLE_Y - 26)
  })

  it('球数上限 6：超限返回 null', () => {
    const p = new Physics()
    for (let i = 0; i < 10; i++) p.spawnMirrorBall()
    expect(p.balls.length).toBe(BALLS_MAX)
    expect(p.spawnMirrorBall()).toBeNull()
  })

  it('setShield 开关：hasShield 状态随动', () => {
    const p = new Physics()
    p.setShield(true)
    expect(p.hasShield()).toBe(true)
    p.setShield(false)
    expect(p.hasShield()).toBe(false)
  })

  it('resetAll 清除护盾', () => {
    const p = new Physics()
    p.setShield(true)
    p.resetAll()
    expect(p.hasShield()).toBe(false)
  })

  it('spawnServeBall：全灭后重发一球（贴板位，数组化回归修复）', () => {
    const p = new Physics()
    p.removeBall(p.balls[0])
    expect(p.balls).toHaveLength(0)
    const b = p.spawnServeBall()
    expect(p.balls).toHaveLength(1)
    expect(b.position.y).toBeCloseTo(PADDLE_Y - 26)
    expect(b.velocity.y).toBe(0)
  })
})

describe('动态球速与挡板宽（Task 2）', () => {
  it('setBallSpeed 后 step 内 clamp 锁定到新速度', () => {
    const p = new Physics()
    p.setBallSpeed(240) // px/s → 4/step
    p.forceBall(240, 300, 99, 0)
    p.step(1000 / 60, 0)
    const v = p.balls[0].velocity
    expect(Math.hypot(v.x, v.y)).toBeCloseTo(4, 5)
  })

  it('setPaddleWidth 后 clamp 边界随宽度变化（挡板不穿墙）', () => {
    const p = new Physics()
    p.setPaddleWidth(264)
    p.setPaddleX(-999)
    expect(p.paddle.position.x).toBeCloseTo(264 / 2 + PADDLE_MARGIN)
    p.setPaddleX(9999)
    expect(p.paddle.position.x).toBeCloseTo(WORLD_W - 264 / 2 - PADDLE_MARGIN)
  })

  it('setPaddleWidth 触发 onPaddleResized（View 重建钩子）', () => {
    const p = new Physics()
    let resized = 0
    p.onPaddleResized = () => resized++
    p.setPaddleWidth(132)
    expect(resized).toBe(1)
  })
})

describe('Physics 多球数组化', () => {
  it('初始单球，数组长度 1', () => {
    expect(new Physics().balls).toHaveLength(1)
  })

  it('removeBall 后球数减少；全灭触发 onAllBallsLost（单个回调）', () => {
    const p = new Physics()
    let lost = 0
    p.onAllBallsLost = () => lost++
    p.removeBall(p.balls[0])
    expect(p.balls).toHaveLength(0)
    expect(lost).toBe(1)
  })

  it('掉一球还有其余球时不触发全灭', () => {
    const p = new Physics()
    let lost = 0
    p.onAllBallsLost = () => lost++
    p.spawnBall(240, 300, 3, -3) // 手动加一球
    p.removeBall(p.balls[0])
    expect(lost).toBe(0)
    expect(p.balls).toHaveLength(1)
  })

  it('spawnBall：指定位置与速度', () => {
    const p = new Physics()
    p.spawnBall(100, 200, 1, -2)
    const b = p.balls[1]
    expect(b.position.x).toBeCloseTo(100)
    expect(b.velocity.y).toBeCloseTo(-2)
  })
})
