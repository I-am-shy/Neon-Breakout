// 触屏/鼠标统一输入：Pointer Events——单指拖拽移动挡板，tap 触发发射/恢复/重开
// 不引 Hammer.js 的理由：本作只需要拖拽 + 点按两种手势，原生 Pointer Events 零依赖即覆盖，
// 且 Hammer 2.0.8 停更于 2016、不基于 Pointer Events；此方案同时白送桌面鼠标拖拽
import { WORLD_W } from './constants'

/** 屏幕坐标 → 世界坐标（纯函数，可单测） */
export function clientToWorldX(clientX: number, rectLeft: number, rectWidth: number): number {
  if (rectWidth <= 0) return WORLD_W / 2 // 元素不可见时回退居中，防 NaN
  return ((clientX - rectLeft) / rectWidth) * WORLD_W
}

const TAP_SLOP = 12 // down→up 位移小于此值视为点按（像素）

export class PointerInput {
  onDrag: (worldX: number) => void = () => {}
  onTap: () => void = () => {}

  private dragging = false
  private startX = 0
  private startY = 0

  constructor(private readonly el: HTMLElement) {}

  attach(): void {
    this.el.addEventListener('pointerdown', this.onDown)
    this.el.addEventListener('pointermove', this.onMove)
    this.el.addEventListener('pointerup', this.onUp)
    this.el.addEventListener('pointercancel', this.onCancel)
  }

  detach(): void {
    this.el.removeEventListener('pointerdown', this.onDown)
    this.el.removeEventListener('pointermove', this.onMove)
    this.el.removeEventListener('pointerup', this.onUp)
    this.el.removeEventListener('pointercancel', this.onCancel)
  }

  private worldX(e: PointerEvent): number {
    const r = this.el.getBoundingClientRect()
    return clientToWorldX(e.clientX, r.left, r.width)
  }

  /** UI 控件选择器：命中即跳过手势（按钮/滑条自有 onClick；否则 tap 与 click 双触发——
   *  React 合成事件的 stopPropagation 挡不住本类的原生容器监听，事件流顺序相反） */
  private static readonly UI_HIT = 'button, input, select, [data-ui]'

  private isUiHit(e: PointerEvent): boolean {
    return e.target instanceof Element && e.target.closest(PointerInput.UI_HIT) !== null
  }

  private readonly onDown = (e: PointerEvent): void => {
    if (this.isUiHit(e)) return
    this.dragging = true
    this.startX = e.clientX
    this.startY = e.clientY
    try {
      this.el.setPointerCapture(e.pointerId) // 手指滑出元素仍持续跟踪
    } catch {
      // 合成事件（验收注入/测试环境）无活跃 pointer id，容错跳过
    }
    this.onDrag(this.worldX(e)) // 按下即跟手
  }

  private readonly onMove = (e: PointerEvent): void => {
    if (!this.dragging) return
    this.onDrag(this.worldX(e))
  }

  private readonly onUp = (e: PointerEvent): void => {
    if (!this.dragging) return
    this.dragging = false
    const moved = Math.hypot(e.clientX - this.startX, e.clientY - this.startY)
    if (moved < TAP_SLOP) this.onTap()
  }

  private readonly onCancel = (): void => {
    this.dragging = false
  }
}
