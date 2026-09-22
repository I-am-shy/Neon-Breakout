// Breakout 手感后处理三件套的单测（纯函数，无 DOM 依赖）
import { describe, expect, it } from 'vitest'
import { bounceAngle, clampSpeed, ensureVertical, velocityFromAngle } from '../game/math'

describe('clampSpeed：速度大小锁死', () => {
  it('任意输入恒定输出 speed', () => {
    const { vx, vy } = clampSpeed(30, 40, 10)
    expect(Math.hypot(vx, vy)).toBeCloseTo(10)
    expect(vx).toBeCloseTo(6)
    expect(vy).toBeCloseTo(8)
  })

  it('方向保持（负分量不被翻转）', () => {
    const { vx, vy } = clampSpeed(-30, -40, 10)
    expect(vx).toBeCloseTo(-6)
    expect(vy).toBeCloseTo(-8)
  })

  it('零向量回退为竖直向上', () => {
    const { vx, vy } = clampSpeed(0, 0, 10)
    expect(vx).toBe(0)
    expect(vy).toBe(-10)
  })
})

describe('bounceAngle：击中位置决定出射角', () => {
  const half = 44
  const maxDeg = 58

  it('击中挡板中心 → 竖直向上', () => {
    expect(bounceAngle(240, 240, half, maxDeg)).toBeCloseTo(0)
  })

  it('击中右缘 → +max', () => {
    expect(bounceAngle(240 + half, 240, half, maxDeg)).toBeCloseTo((maxDeg * Math.PI) / 180)
  })

  it('击中越界位置 → clamp 到 ±max', () => {
    expect(bounceAngle(240 + 999, 240, half, maxDeg)).toBeCloseTo((maxDeg * Math.PI) / 180)
    expect(bounceAngle(240 - 999, 240, half, maxDeg)).toBeCloseTo((-maxDeg * Math.PI) / 180)
  })

  it('线性中点 → max/2', () => {
    expect(bounceAngle(240 + half / 2, 240, half, maxDeg)).toBeCloseTo(
      (maxDeg * Math.PI) / 180 / 2,
    )
  })
})

describe('velocityFromAngle：角度 → 向量（y 轴向下）', () => {
  it('0° 竖直向上', () => {
    const v = velocityFromAngle(0, 10)
    expect(v.vx).toBeCloseTo(0)
    expect(v.vy).toBeCloseTo(-10)
  })

  it('90° 水平向右', () => {
    const v = velocityFromAngle(Math.PI / 2, 10)
    expect(v.vx).toBeCloseTo(10)
    expect(v.vy).toBeCloseTo(0)
  })
})

describe('ensureVertical：防水平死锁', () => {
  it('纯水平速度 → 获得最小竖直分量，总速度守恒', () => {
    const v = ensureVertical(10, 0, 10, 0.3)
    expect(Math.abs(v.vy)).toBeCloseTo(3)
    expect(Math.hypot(v.vx, v.vy)).toBeCloseTo(10)
  })

  it('竖直分量足够 → 原样返回', () => {
    const v = ensureVertical(0, -10, 10, 0.3)
    expect(v).toEqual({ vx: 0, vy: -10 })
  })

  it('保持原竖直方向符号', () => {
    const v = ensureVertical(9.9, 1, 10, 0.3)
    expect(v.vy).toBeGreaterThanOrEqual(3) // 原本向下，仍向下
  })
})
