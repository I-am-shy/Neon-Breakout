// KeyboardJS 封装：挡板方向键状态 + Space/Esc/R 事件
// 键位分工：Space = 启动族（发射 / 终局重开）；Esc = 暂停切换（P 为别名）；R = 重开
// 注意：KeyboardJS 是全局单例，bind/unbind 必须用同一组回调引用（StrictMode 双挂载安全）
// Callback 的 event 是可选参数（类型要求），preventRepeat 防按住连发
import KeyboardJS from 'keyboardjs'

type KbdEvent = Parameters<NonNullable<Parameters<typeof KeyboardJS.bind>[1]>>[0]

export class Input {
  readonly state = { left: false, right: false }
  onLaunch: () => void = () => {}
  onTogglePause: () => void = () => {}
  onRestart: () => void = () => {}

  private readonly noop = (): void => {}
  private readonly downLeft = (e?: KbdEvent): void => {
    e?.preventDefault()
    this.state.left = true
  }
  private readonly downRight = (e?: KbdEvent): void => {
    e?.preventDefault()
    this.state.right = true
  }
  private readonly upLeft = (): void => {
    this.state.left = false
  }
  private readonly upRight = (): void => {
    this.state.right = false
  }
  private readonly fireLaunch = (e?: KbdEvent): void => {
    e?.preventDefault()
    this.onLaunch()
  }
  private readonly firePause = (e?: KbdEvent): void => {
    e?.preventDefault()
    this.onTogglePause()
  }
  private readonly fireRestart = (e?: KbdEvent): void => {
    e?.preventDefault()
    this.onRestart()
  }

  constructor() {
    KeyboardJS.bind(['a', 'left'], this.downLeft, this.upLeft)
    KeyboardJS.bind(['d', 'right'], this.downRight, this.upRight)
    KeyboardJS.bind('space', this.fireLaunch, this.noop, true)
    KeyboardJS.bind(['escape', 'p'], this.firePause, this.noop, true)
    KeyboardJS.bind('r', this.fireRestart, this.noop, true)
  }

  destroy(): void {
    KeyboardJS.unbind(['a', 'left'], this.downLeft, this.upLeft)
    KeyboardJS.unbind(['d', 'right'], this.downRight, this.upRight)
    KeyboardJS.unbind('space', this.fireLaunch, this.noop)
    KeyboardJS.unbind(['escape', 'p'], this.firePause, this.noop)
    KeyboardJS.unbind('r', this.fireRestart, this.noop)
  }
}
