// 霓虹打砖块 —— 全部可调参数与调色板
// 坐标系：世界 960x1280（大世界支撑千砖阵），原点左上；Matter 速度单位为 px/step（step = FIXED_DT_MS）
// 尺寸体系等比 ×2（相对速度感/操作感与旧 480x640 一致）；砖阵为动态布局（cols/rows 见 settings）

export const WORLD_W = 960
export const WORLD_H = 1280

export const FIXED_DT_MS = 1000 / 60 // 固定物理步长，Matter 稳定性的前提
export const MAX_STEPS_PER_FRAME = 4 // 低帧率时的追帧上限，超过则丢弃时间（防螺旋死亡）

export const BALL_R = 14
export const BALL_SPEED = 920 // px/s
export const MIN_VERTICAL_RATIO = 0.28 // 防水平死锁：|vy| 至少占 speed 的比例

export const PADDLE_W = 176
export const PADDLE_H = 28
export const PADDLE_Y = WORLD_H - 96
export const PADDLE_SPEED = 1240 // px/s
export const PADDLE_MARGIN = 16 // 距侧墙最小间距

// ---- 砖阵（动态布局：cols/rows 由 settings 提供） ----
export const BRICK_GAP = 4
export const BRICK_TOP = 176
export const BRICK_H = 26
// 侧通道必须 < 球直径（2*BALL_R=28），否则球能贴墙钻到砖阵上方（实测踩过）
export const BRICK_MARGIN_X = 16

/** 列数 → 砖宽（世界宽 - 边距 - 列间缝均摊） */
export function brickWidth(cols: number): number {
  return (WORLD_W - BRICK_MARGIN_X * 2 - (cols - 1) * BRICK_GAP) / cols
}

/** 列数 → 砖中心 x */
export function brickCenterX(col: number, cols: number): number {
  const w = brickWidth(cols)
  return BRICK_MARGIN_X + w / 2 + col * (w + BRICK_GAP)
}

/** 行号 → 砖中心 y */
export function brickCenterY(row: number): number {
  return BRICK_TOP + BRICK_H / 2 + row * (BRICK_H + BRICK_GAP)
}

export const MAX_BOUNCE_DEG = 58 // 挡板反弹角上限：手感核心
export const SCORE_PER_BRICK = 10
export const LIVES = 3

// ---- 特殊砖 ----
export const GIFT_HP = 2 // 道具砖耐久（首击变暗闪烁，再击破碎）
export const GIFT_SCORE = 50 // 道具砖击碎分
export const FLOW_SCORE = 30 // 渐变砖击碎分
export const FLOW_CYCLE_TICKS = 90 // 渐变砖色带流动一圈的物理步数
export const EXPAND_RATIO = 1.5 // 加长倍率
export const SLOW_RATIO = 0.7 // 起始减速比（线性恢复至 1.0）
export const BALLS_MAX = 6 // 场上球数上限（超出转化分）
export const LIVES_MAX = 5 // 生命上限（Extra Life 道具）
export const SHIELD_Y = WORLD_H - 12 // 护盾条 y（floor 内侧实体，几何与 floor 不相交）
export const MULTI_OVERFLOW_SCORE = 50 // 球满时拾取 Multi 的转化分

// ---- 掉落平衡基准 ----
/** 密度归一基准砖数：dropRate 语义 = 「每 60 砖掉 dropRate 比例」，
 *  实际概率 = dropRate × BASE_BRICKS / 总砖数（千砖局道具总量守恒） */
export const DROP_BASE_BRICKS = 60

/** px/s → px/step（Matter 的 velocity 语义） */
export const toPerStep = (pxPerSec: number): number => (pxPerSec * FIXED_DT_MS) / 1000

export const PALETTE = {
  bg: 0x05060e,
  grid: 0x11263a,
  wallGlow: 0x00e5ff,
  rows: [0x00e5ff, 0x2f7bff, 0x8a5cff, 0xff2df7, 0xff8a2a, 0xf8e71c], // 青→蓝→紫→品红→橙→黄
  paddle: 0x00e5ff,
  paddleCore: 0x9ff8ff,
  ball: 0xffffff,
  ballGlow: 0x00e5ff,
} as const

export const hex = (n: number): string => '#' + n.toString(16).padStart(6, '0')
