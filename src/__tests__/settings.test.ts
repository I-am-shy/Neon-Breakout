// 设置存储单测：默认值、clamp、预设、set/applyPreset 流转
import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, PRESETS, useSettingsStore } from '../game/settings'

const store = useSettingsStore

beforeEach(() => {
  store.setState({ settings: { ...DEFAULT_SETTINGS }, panelOpen: false })
})

describe('settingsStore', () => {
  it('默认值完整（千砖局：50 列 × 20 行）', () => {
    const s = store.getState().settings
    expect(s).toEqual(DEFAULT_SETTINGS)
    expect(s.lives).toBe(3)
    expect(s.brickCols).toBe(50)
    expect(s.brickRows).toBe(20)
    expect(s.giftCount).toBe(4)
    expect(s.flowCount).toBe(4)
    expect(s.timeLimitSec).toBe(0)
    expect(s.dropMode).toBe('fixed')
  })

  it('set 局部合并，多次累积', () => {
    store.getState().set({ lives: 5 })
    store.getState().set({ dropRate: 0.25 })
    const s = store.getState().settings
    expect(s.lives).toBe(5)
    expect(s.dropRate).toBe(0.25)
    expect(s.brickRows).toBe(20) // 未动项保持
  })

  it('dropMode 枚举可切换（持久化白名单）', () => {
    store.getState().set({ dropMode: 'random' })
    expect(store.getState().settings.dropMode).toBe('random')
    store.getState().set({ dropMode: 'fixed' })
    expect(store.getState().settings.dropMode).toBe('fixed')
  })

  it('applyPreset 一键全套（casual/hardcore 与 standard 差异正确）', () => {
    store.getState().applyPreset('casual')
    expect(store.getState().settings).toEqual(PRESETS.casual)
    store.getState().applyPreset('hardcore')
    expect(store.getState().settings).toEqual(PRESETS.hardcore)
    store.getState().applyPreset('standard')
    expect(store.getState().settings).toEqual(DEFAULT_SETTINGS)
  })

  it('面板开合状态', () => {
    store.getState().openPanel()
    expect(store.getState().panelOpen).toBe(true)
    store.getState().closePanel()
    expect(store.getState().panelOpen).toBe(false)
  })
})
