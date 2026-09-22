// Breakout 手感后处理三件套（纯函数，可单测）
// 1. clampSpeed：物理引擎 restitution=1 也不守恒，速度大小每帧锁死
// 2. bounceAngle：经典 Breakout 灵魂——击中挡板位置决定出射角，而非按法线反弹
// 3. ensureVertical：防水平死锁（球永远打不到砖/挡板）

export interface Vec2 {
  vx: number
  vy: number
}

export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v))

/** 速度大小恒定为 speed，方向保持 */
export function clampSpeed(vx: number, vy: number, speed: number): Vec2 {
  const mag = Math.hypot(vx, vy)
  if (mag < 1e-9) return { vx: 0, vy: -speed } // 静止球默认竖直向上
  return { vx: (vx / mag) * speed, vy: (vy / mag) * speed }
}

/**
 * 挡板反弹角：offset ∈ [-1,1] = (ballX - paddleX) / paddleHalfW
 * 返回与竖直向上方向的夹角（弧度，向右为正）
 */
export function bounceAngle(
  ballX: number,
  paddleX: number,
  paddleHalfW: number,
  maxDeg: number,
): number {
  const offset = clamp((ballX - paddleX) / paddleHalfW, -1, 1)
  return (offset * maxDeg * Math.PI) / 180
}

/** 出射角 + 速度大小 → 速度向量（屏幕 y 轴向下，向上为 -y） */
export function velocityFromAngle(angle: number, speed: number): Vec2 {
  return { vx: Math.sin(angle) * speed, vy: -Math.cos(angle) * speed }
}

/** 保证 |vy| ≥ speed * minRatio（总速度大小不变），vy=0 时默认改为向上 */
export function ensureVertical(vx: number, vy: number, speed: number, minRatio: number): Vec2 {
  const minVy = speed * minRatio
  if (Math.abs(vy) >= minVy) return { vx, vy }
  const vySign = vy === 0 ? -1 : Math.sign(vy)
  const newVy = vySign * minVy
  const vxSign = vx === 0 ? 1 : Math.sign(vx)
  const newVx = Math.sqrt(Math.max(speed * speed - newVy * newVy, 0)) * vxSign
  return { vx: newVx, vy: newVy }
}
