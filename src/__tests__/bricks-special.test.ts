// 特殊砖数据层：gift（光晕道具砖·HP2·掉固定道具）+ flow（渐变砖·HP1·掉随机道具）
import { beforeEach, describe, expect, it } from 'vitest'
import { GIFT_HP, GIFT_SCORE, FLOW_SCORE } from '../game/constants'
import { useSettingsStore } from '../game/settings'
import { POWERUP_COLOR, type PowerupType } from '../game/powerups/types'
import { Physics } from '../game/physics'

const store = useSettingsStore

function resetSettings(): void {
  store.getState().set({ giftCount: 4, flowCount: 4, brickRows: 6 })
}

beforeEach(() => {
  store.setState({ settings: { ...store.getState().settings, giftCount: 4, flowCount: 4, brickRows: 6 } })
})

describe('特殊砖数据层', () => {
  it('默认各 4 块：gift 带 dropType（颜色预告源）且 hp=2，flow hp=1', () => {
    const p = new Physics()
    const gifts = p.bricks.filter((b) => b.kind === 'gift')
    const flows = p.bricks.filter((b) => b.kind === 'flow')
    expect(gifts).toHaveLength(4)
    expect(flows).toHaveLength(4)
    gifts.forEach((b) => {
      expect(b.hp).toBe(GIFT_HP)
      expect(b.dropType).toBeDefined()
      expect(Object.keys(POWERUP_COLOR)).toContain(b.dropType)
    })
    flows.forEach((b) => expect(b.hp).toBe(1))
  })

  it('设置驱动：giftCount=6 / flowCount=2 → 数量随设置（新局生效路径）', () => {
    store.getState().set({ giftCount: 6, flowCount: 2 })
    const p = new Physics()
    expect(p.bricks.filter((b) => b.kind === 'gift')).toHaveLength(6)
    expect(p.bricks.filter((b) => b.kind === 'flow')).toHaveLength(2)
    resetSettings()
  })

  it('gift 首击不碎（onGiftHit + hp 降），第二击碎', () => {
    const p = new Physics()
    let hits = 0
    p.onGiftHit = () => hits++
    const gift = p.bricks.find((b) => b.kind === 'gift')!
    p.debugHitBrick(gift)
    expect(hits).toBe(1)
    expect(gift.alive).toBe(true)
    expect(gift.hp).toBe(1)
    expect(p.pendingDestroyLength()).toBe(0)
    p.debugHitBrick(gift)
    expect(hits).toBe(1) // 破碎走 onBrickHit 不再触发 onGiftHit
    expect(gift.alive).toBe(false)
    expect(p.pendingDestroyLength()).toBe(1)
  })

  it('flow 一击即碎（行为与普通砖一致）', () => {
    const p = new Physics()
    const flow = p.bricks.find((b) => b.kind === 'flow')!
    p.debugHitBrick(flow)
    expect(flow.alive).toBe(false)
    expect(p.pendingDestroyLength()).toBe(1)
  })

  it('普通砖一击即碎（行为不变）', () => {
    const p = new Physics()
    const normal = p.bricks.find((b) => b.kind === 'normal')!
    p.debugHitBrick(normal)
    expect(normal.alive).toBe(false)
  })
})

describe('特殊砖分数', () => {
  it('gift 50 / flow 30 / normal 10', () => {
    expect(GIFT_SCORE).toBe(50)
    expect(FLOW_SCORE).toBe(30)
  })
})

describe('dropType 权重采样', () => {
  it('gift 的 dropType 分布在五种合法道具内', () => {
    const p = new Physics()
    const valid: PowerupType[] = ['expand', 'multi', 'slow', 'life', 'shield']
    p.bricks
      .filter((b) => b.kind === 'gift')
      .forEach((b) => expect(valid).toContain(b.dropType))
  })
})
