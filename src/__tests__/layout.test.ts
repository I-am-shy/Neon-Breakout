// 几何布局守卫：把「球钻缝」类 bug 锁死在测试层
// 背景：BRICK_MARGIN_X 曾为 14 = 球直径，球贴墙从砖阵侧面挤过直达顶部（实测）
// 砖阵为动态布局（列数来自 settings），守卫对最大/默认/最小列数全档校验
import { describe, expect, it } from 'vitest'
import { BALL_R, BRICK_GAP, BRICK_MARGIN_X, PADDLE_MARGIN, WORLD_W, brickWidth } from '../game/constants'

const COL_CASES = [10, 30, 50] // 最小/中档/最大列数

describe('几何守卫：无球可钻的缝隙', () => {
  it('砖阵两侧通道 < 球直径（球无法贴墙绕过砖阵）', () => {
    expect(BRICK_MARGIN_X).toBeLessThan(2 * BALL_R)
  })

  it('砖块间隙 < 球直径（球无法从砖缝穿过）', () => {
    expect(BRICK_GAP).toBeLessThan(2 * BALL_R)
  })

  it.each(COL_CASES)('列数 %i：砖阵恰好铺满世界宽度（布局无意外空隙）', (cols) => {
    const w = brickWidth(cols)
    const total = BRICK_MARGIN_X * 2 + cols * w + (cols - 1) * BRICK_GAP
    expect(Math.abs(total - WORLD_W)).toBeLessThan(1e-9)
  })

  it.each(COL_CASES)('列数 %i：砖宽 > 球半径（球不会同时触碰过多砖）', (cols) => {
    expect(brickWidth(cols)).toBeGreaterThan(BALL_R)
  })

  it('挡板两侧逃生缝 < 球直径（贴墙球仍可被挡板接到）', () => {
    // 挡板最左位时左边缘距墙的空隙：PADDLE_MARGIN。球贴墙（球心 x=BALL_R）主体应与挡板重叠
    const paddleLeftEdgeAtMin = PADDLE_MARGIN // 挡板左边缘 x（挡板贴墙位）
    expect(paddleLeftEdgeAtMin).toBeLessThan(2 * BALL_R)
  })
})
