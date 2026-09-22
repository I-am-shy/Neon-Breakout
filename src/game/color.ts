// HSL → 0xRRGGBB 色彩换算（纯函数，不依赖 Pixi，可单测）
// 渐变砖（flow）的彩色色带与所有 hue 驱动视觉共用

/** 标准 hsl → 0xRRGGBB 整数 */
export function hslToHex(h: number, s: number, l: number): number {
  const hue = ((h % 360) + 360) % 360
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1))
  const m = l - c / 2
  let r = 0
  let g = 0
  let b = 0
  if (hue < 60) [r, g, b] = [c, x, 0]
  else if (hue < 120) [r, g, b] = [x, c, 0]
  else if (hue < 180) [r, g, b] = [0, c, x]
  else if (hue < 240) [r, g, b] = [0, x, c]
  else if (hue < 300) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]
  const to255 = (v: number) => Math.round((v + m) * 255)
  return (to255(r) << 16) | (to255(g) << 8) | to255(b)
}
