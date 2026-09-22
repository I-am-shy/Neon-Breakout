// 游戏状态机生命周期单测（纯 store，无 DOM 依赖）
import { beforeEach, describe, expect, it } from 'vitest'
import { LIVES, SCORE_PER_BRICK } from '../game/constants'
import { DEFAULT_SETTINGS } from '../game/settings'
import { useGameStore } from '../game/gameStore'

const store = useGameStore

beforeEach(() => {
  store.getState().reset()
})

describe('gameStore 状态机', () => {
  it('初始为 idle、满命、满砖、零分；reset 后为 ready（重开直达待发射）', () => {
    store.setState({ phase: 'idle' })
    const s = store.getState()
    expect(s.phase).toBe('idle')
    expect(s.lives).toBe(LIVES)
    expect(s.bricksLeft).toBe(DEFAULT_SETTINGS.brickCols * DEFAULT_SETTINGS.brickRows)
    expect(s.score).toBe(0)
    store.getState().reset()
    expect(store.getState().phase).toBe('ready')
  })

  it('enterReady 仅 idle 有效；start 仅 ready 有效（守卫状态机）', () => {
    store.setState({ phase: 'idle' })
    store.getState().enterReady()
    expect(store.getState().phase).toBe('ready')
    store.getState().enterReady() // ready 下幂等无操作
    expect(store.getState().phase).toBe('ready')
    store.getState().start()
    expect(store.getState().phase).toBe('playing')
    store.setState({ phase: 'gameover' })
    store.getState().start() // gameover 下无操作
    expect(store.getState().phase).toBe('gameover')
  })

  it('togglePause 在 playing/paused 间双向切换，其他状态下无操作', () => {
    store.setState({ phase: 'ready' })
    store.getState().start()
    expect(store.getState().phase).toBe('playing')
    store.getState().togglePause() // playing → paused
    expect(store.getState().phase).toBe('paused')
    store.getState().togglePause() // paused → playing
    expect(store.getState().phase).toBe('playing')

    store.setState({ phase: 'ready' })
    store.getState().togglePause() // ready 下无操作
    expect(store.getState().phase).toBe('ready')
    store.setState({ phase: 'gameover' })
    store.getState().togglePause() // gameover 下无操作
    expect(store.getState().phase).toBe('gameover')
  })

  it('brickDestroyed 计分，砖清空进入 win', () => {
    store.setState({ phase: 'playing' })
    const total = DEFAULT_SETTINGS.brickCols * DEFAULT_SETTINGS.brickRows
    for (let i = 0; i < total; i++) store.getState().brickDestroyed('normal')
    const s = store.getState()
    expect(s.phase).toBe('win')
    expect(s.bricksLeft).toBe(0)
    expect(s.score).toBe(total * SCORE_PER_BRICK)
  })

  it('gift 击碎 50 分、flow 30 分、normal 10 分', () => {
    store.setState({ phase: 'playing' })
    store.getState().brickDestroyed('gift')
    store.getState().brickDestroyed('flow')
    store.getState().brickDestroyed('normal')
    expect(store.getState().score).toBe(90)
  })

  it('非 playing 状态下 brickDestroyed 不计分', () => {
    store.getState().brickDestroyed('normal') // ready 状态
    expect(store.getState().score).toBe(0)
  })

  it('三连失球 → lives 归零 + gameover', () => {
    store.setState({ phase: 'playing' })
    store.getState().loseLife()
    expect(store.getState().phase).toBe('ready')
    expect(store.getState().lives).toBe(LIVES - 1)
    store.setState({ phase: 'playing' })
    store.getState().loseLife()
    store.setState({ phase: 'playing' })
    store.getState().loseLife() // 最后一条命
    expect(store.getState().phase).toBe('gameover')
    expect(store.getState().lives).toBe(0)
  })

  it('非 playing 状态下 loseLife 无效（守卫）', () => {
    store.setState({ phase: 'ready', lives: 1 })
    store.getState().loseLife()
    expect(store.getState().phase).toBe('ready')
    expect(store.getState().lives).toBe(1)
  })

  it('reset 完整复位', () => {
    store.setState({ phase: 'gameover', score: 999, lives: 0, bricksLeft: 0 })
    store.getState().reset()
    const s = store.getState()
    expect(s.phase).toBe('ready')
    expect(s.score).toBe(0)
    expect(s.lives).toBe(LIVES)
    expect(s.bricksLeft).toBe(DEFAULT_SETTINGS.brickCols * DEFAULT_SETTINGS.brickRows)
  })

  it('setBricksLeft 校准实际砖数（图案过滤后由 Game 回写）', () => {
    store.getState().setBricksLeft(479)
    expect(store.getState().bricksLeft).toBe(479)
    store.getState().setBricksLeft(-5) // 负数钳到 0
    expect(store.getState().bricksLeft).toBe(0)
  })

  it('recordBest：仅刷新更高分（无 localStorage 的 node 环境下不抛错）', () => {
    store.setState({ score: 0, best: 0 })
    store.getState().recordBest() // 0 分不记录
    expect(store.getState().best).toBe(0)
    store.setState({ score: 320 })
    store.getState().recordBest()
    expect(store.getState().best).toBe(320)
    store.setState({ score: 100 })
    store.getState().recordBest() // 低于最高分不覆盖
    expect(store.getState().best).toBe(320)
  })
})
