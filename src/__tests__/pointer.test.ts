// 指针输入 + 跟手挡板的单测（PointerInput 坐标换算纯函数 / Physics.setPaddleX clamp）
import { describe, expect, it } from 'vitest'
import { PADDLE_MARGIN, PADDLE_W, WORLD_W } from '../game/constants'
import { clientToWorldX } from '../game/PointerInput'
import { Physics } from '../game/physics'

describe('clientToWorldX：屏幕坐标 → 世界坐标', () => {
  it('1:1 满幅映射', () => {
    expect(clientToWorldX(0, 0, WORLD_W)).toBe(0)
    expect(clientToWorldX(WORLD_W / 2, 0, WORLD_W)).toBe(WORLD_W / 2)
    expect(clientToWorldX(WORLD_W, 0, WORLD_W)).toBe(WORLD_W)
  })

  it('元素实际宽度非世界宽时按比例缩放', () => {
    expect(clientToWorldX(1920, 0, 1920)).toBe(WORLD_W) // 高分屏放大 2 倍
    expect(clientToWorldX(110, 10, 200)).toBeCloseTo(WORLD_W / 2) // 带偏移：(110-10)/200*WORLD_W
  })

  it('非法宽度回退世界中心（防 NaN）', () => {
    expect(clientToWorldX(100, 0, 0)).toBe(WORLD_W / 2)
  })
})

describe('Physics.setPaddleX：跟手模式边界 clamp', () => {
  const p = new Physics()

  it('中间值直通', () => {
    p.setPaddleX(240)
    expect(p.paddle.position.x).toBeCloseTo(240)
  })

  it('越左侧 clamp 到最小位', () => {
    p.setPaddleX(-100)
    expect(p.paddle.position.x).toBeCloseTo(PADDLE_W / 2 + PADDLE_MARGIN)
  })

  it('越右侧 clamp 到最大位', () => {
    p.setPaddleX(9999)
    expect(p.paddle.position.x).toBeCloseTo(WORLD_W - PADDLE_W / 2 - PADDLE_MARGIN)
  })
})
