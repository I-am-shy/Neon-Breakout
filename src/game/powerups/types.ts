// 道具类型系统：类型、HUD 标识、配色（单处定义，全工程引用）
export type PowerupType = 'expand' | 'multi' | 'slow' | 'life' | 'shield'

export const POWERUP_LABEL: Record<PowerupType, string> = {
  expand: 'E',
  multi: 'M',
  slow: 'S',
  life: '+',
  shield: '◇',
}

export const POWERUP_COLOR: Record<PowerupType, number> = {
  expand: 0x00e5ff,
  multi: 0xff2df7,
  slow: 0x2f7bff,
  life: 0xf8e71c,
  shield: 0x39ff88,
}

/** 中文效果短说明（拾取横幅 / 开屏图例共用） */
export const POWERUP_DESC: Record<PowerupType, string> = {
  expand: '挡板加宽',
  multi: '多一颗球',
  slow: '球速减速',
  life: '生命 +1',
  shield: '底部护盾',
}
