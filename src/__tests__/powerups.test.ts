// 道具纯逻辑层：EffectManager（物理步时钟）与 pickDrop（双通道掉落）
import { describe, expect, it } from 'vitest'
import Matter from 'matter-js'
import { WORLD_H } from '../game/constants'
import { EffectManager } from '../game/powerups/EffectManager'
import { pickDrop, POWERUP_WEIGHTS } from '../game/powerups/drop'
import { PowerupEntities } from '../game/powerups/PowerupEntities'

// 可注入的确定性随机源
const seqRand = (values: number[]) => {
  let i = 0
  return () => values[i++ % values.length]
}

describe('EffectManager（物理步时钟）', () => {
  it('apply 持续效果 → step 递减 → 到期触发 onExpire 并移除', () => {
    const em = new EffectManager()
    let expired = false
    em.apply('expand', { ticks: 3, onExpire: () => (expired = true) })
    em.step()
    em.step()
    expect(em.remaining('expand')).toBe(1)
    em.step()
    expect(expired).toBe(true)
    expect(em.remaining('expand')).toBe(0)
  })

  it('同类重复 apply 刷新时长（不叠加）', () => {
    const em = new EffectManager()
    em.apply('expand', { ticks: 5 })
    em.step()
    em.step()
    em.apply('expand', { ticks: 5 }) // 刷新回 5
    expect(em.remaining('expand')).toBe(5)
  })

  it('异类并存', () => {
    const em = new EffectManager()
    em.apply('expand', { ticks: 5 })
    em.apply('slow', { ticks: 3 })
    expect(em.active().sort()).toEqual(['expand', 'slow'])
  })

  it('clear 还原全部（重开局用）', () => {
    const em = new EffectManager()
    let expired = 0
    em.apply('expand', { ticks: 5, onExpire: () => expired++ })
    em.apply('slow', { ticks: 5, onExpire: () => expired++ })
    em.clear()
    expect(em.active()).toEqual([])
    expect(expired).toBe(2)
  })
})

describe('pickDrop（双通道掉落）', () => {
  it('flow 砖必掉（50 次全有产出）', () => {
    const types = new Set<string>()
    for (let i = 0; i < 50; i++) types.add(pickDrop('flow', Math.random)!)
    expect(types.size).toBeGreaterThan(0)
  })

  it('normal 概率 ≈15%（1000 采样容差）', () => {
    let dropped = 0
    for (let i = 0; i < 1000; i++) if (pickDrop('normal', Math.random)) dropped++
    expect(dropped).toBeGreaterThan(110)
    expect(dropped).toBeLessThan(190)
  })

  it('显式 rate 覆盖设置（密度归一：千砖局有效掉率 ≈0.9%）', () => {
    let dropped = 0
    const rate = (0.15 * 60) / 1000 // 1000 砖、设置 15% → 公平化后 0.9%
    for (let i = 0; i < 2000; i++) if (pickDrop('normal', Math.random, rate)) dropped++
    expect(dropped).toBeGreaterThan(6)
    expect(dropped).toBeLessThan(42) // ≈18 期望
    let none = 0
    for (let i = 0; i < 200; i++) if (!pickDrop('normal', Math.random, 0)) none++
    expect(none).toBe(200) // rate=0 必不掉
  })

  it('权重分布方向正确（Expand 最常见、Life 最稀有）', () => {
    const counts: Record<string, number> = {}
    for (let i = 0; i < 1000; i++) {
      const t = pickDrop('flow', Math.random)!
      counts[t] = (counts[t] ?? 0) + 1
    }
    expect(counts['expand']).toBeGreaterThan(counts['life'])
    expect(counts['expand']).toBeGreaterThan(counts['shield'])
  })

  it('确定性随机源可复现（落在第一权重段 → expand）', () => {
    expect(pickDrop('flow', seqRand([0.01]))).toBe('expand')
  })

  it('权重表总和 100', () => {
    expect(POWERUP_WEIGHTS.reduce((s, x) => s + x.w, 0)).toBe(100)
  })
})

describe('PowerupEntities（掉落物实体）', () => {
  const mkWorld = () => Matter.Engine.create().world

  it('spawn 创建 sensor 并登记；remove 销毁', () => {
    const ents = new PowerupEntities(mkWorld())
    const id = ents.spawn('expand', 240, 100)
    expect(ents.count()).toBe(1)
    expect(ents.get(id)?.type).toBe('expand')
    ents.remove(id)
    expect(ents.count()).toBe(0)
  })

  it('step 下落：y 递增且恒速', () => {
    const ents = new PowerupEntities(mkWorld())
    const id = ents.spawn('slow', 100, 50)
    const before = ents.get(id)!.body.position.y
    ents.step()
    const after = ents.get(id)!.body.position.y
    expect(after).toBeGreaterThan(before)
    expect(after - before).toBeCloseTo(2.6, 5)
  })

  it('触底回收（y 超界自动移除并报告）', () => {
    const ents = new PowerupEntities(mkWorld())
    const id = ents.spawn('life', 100, WORLD_H + 60)
    const removed = ents.step()
    expect(removed).toContain(id)
    expect(ents.get(id)).toBeUndefined()
  })
})
