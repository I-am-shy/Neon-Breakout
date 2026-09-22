// 拾取横幅：挡板上方短暂显示「道具名 + 效果说明」（反馈出现在交互点）
// banner.seq 跳变驱动动画重播；1.1s 后自动清除（快速连拾时以最新为准）
import { useEffect } from 'react'
import { useGameStore } from '../game/gameStore'
import { useSettingsStore } from '../game/settings'
import { POWERUP_NAME } from '../game/fx'
import {
  POWERUP_COLOR,
  POWERUP_DESC,
  type PowerupType,
} from '../game/powerups/types'

const ALL: PowerupType[] = ['expand', 'multi', 'slow', 'life', 'shield']

function desc(type: PowerupType, effectSec: number): string {
  if (type === 'expand') return `挡板加宽 ${effectSec} 秒`
  return POWERUP_DESC[type]
}

function hexToCss(n: number): string {
  return `#${n.toString(16).padStart(6, '0')}`
}

export function Banner() {
  const banner = useGameStore((s) => s.banner)
  const clearBanner = useGameStore((s) => s.clearBanner)
  const effectSec = useSettingsStore((s) => s.settings.effectSec)

  useEffect(() => {
    if (!banner) return
    const t = setTimeout(() => clearBanner(), 1100)
    return () => clearTimeout(t)
  }, [banner, clearBanner])

  if (!banner) return null
  if (!ALL.includes(banner.type)) return null

  const color = hexToCss(POWERUP_COLOR[banner.type])
  return (
    <div
      key={banner.seq} // seq 跳变 → 元素重建 → 动画重播
      // w-max：绝对定位元素的 shrink-to-fit 只按 left:50% 到右边界的剩余宽度算（窄舞台仅半屏），
      // 不加会被挤成逐字换行（移动端描述文字竖排的根因）
      // 不加 -translate-x-1/2：Tailwind v4 该工具类走独立 translate 属性，会与关键帧里的
      // transform: translate(-50%) 叠加成 -100% 导致左移出界；居中由关键帧自己完成
      className="pointer-events-none absolute left-1/2 bottom-[10%] z-20 w-max max-w-[96%] animate-banner-in"
    >
      <div
        className="flex items-center gap-2.5 rounded-md border px-4 py-2 backdrop-blur-[2px] sm:gap-3 sm:px-5"
        style={{
          borderColor: `${color}88`,
          background: '#05060ecc',
          boxShadow: `0 0 18px ${color}55, inset 0 0 10px ${color}22`,
        }}
      >
        <span
          className="font-display text-base font-bold tracking-[0.2em] sm:text-lg"
          style={{ color, textShadow: `0 0 10px ${color}` }}
        >
          {POWERUP_NAME[banner.type]}
        </span>
        <span className="font-hud text-[11px] tracking-[0.2em] text-white/75 sm:text-xs sm:tracking-[0.25em]">
          {desc(banner.type, effectSec)}
        </span>
      </div>
    </div>
  )
}
