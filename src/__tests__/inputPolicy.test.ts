// 输入策略单测：锁死「Space = 启动族、Esc = 暂停、点按 = 移动端万能键」的语义
// 浏览器侧对真实按键/指针事件的验收受 KeyboardJS 与 pointer capture 的合成事件限制，
// 故把「各 phase 下该做什么」抽成纯函数在此完整覆盖
import { describe, expect, it } from 'vitest'
import { pauseAction, spaceAction, tapAction } from '../game/inputPolicy'
import type { Phase } from '../game/gameStore'

const ALL: Phase[] = ['idle', 'ready', 'playing', 'paused', 'gameover', 'win']

describe('spaceAction：启动族，绝不暂停', () => {
  it('idle → enterReady（开屏开始）', () => {
    expect(spaceAction('idle')).toBe('enterReady')
  })
  it('ready → launch（发射）', () => {
    expect(spaceAction('ready')).toBe('launch')
  })
  it('gameover / win → restart（终局重开）', () => {
    expect(spaceAction('gameover')).toBe('restart')
    expect(spaceAction('win')).toBe('restart')
  })
  it('paused → resume（暂停态按空格继续）', () => {
    expect(spaceAction('paused')).toBe('resume')
  })
  it('playing → none（Space 不再主动暂停——回归防线）', () => {
    expect(spaceAction('playing')).toBe('none')
  })
  it('任何 phase 都不会返回 togglePause（Space 与暂停彻底解耦）', () => {
    for (const p of ALL) expect(spaceAction(p)).not.toBe('togglePause')
  })
})

describe('pauseAction：仅进行/暂停两态生效', () => {
  it('playing / paused → togglePause', () => {
    expect(pauseAction('playing')).toBe('togglePause')
    expect(pauseAction('paused')).toBe('togglePause')
  })
  it('其余 phase → none（不误伤开屏/待发射/终局）', () => {
    for (const p of ['idle', 'ready', 'gameover', 'win'] as Phase[]) {
      expect(pauseAction(p)).toBe('none')
    }
  })
})

describe('tapAction：移动端唯一入口（启动 + 暂停兼做）', () => {
  it('playing / paused → togglePause（点屏幕即暂停/继续）', () => {
    expect(tapAction('playing')).toBe('togglePause')
    expect(tapAction('paused')).toBe('togglePause')
  })
  it('其余 phase 回落启动族（与 Space 一致）', () => {
    for (const p of ['idle', 'ready', 'gameover', 'win'] as Phase[]) {
      expect(tapAction(p)).toBe(spaceAction(p))
    }
  })
  it('六态全覆盖且无非空返回（类型收窄保障）', () => {
    for (const p of ALL) {
      const a = tapAction(p)
      expect(['togglePause', 'enterReady', 'launch', 'resume', 'restart', 'none']).toContain(a)
    }
  })
})