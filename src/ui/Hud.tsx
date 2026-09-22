// HUD：zustand selector 订阅，只重渲染变化字段；物理循环从另一侧 getState() 直读
import { useGameStore } from '../game/gameStore'
import { useSettingsStore } from '../game/settings'
import {
  POWERUP_COLOR,
  POWERUP_LABEL,
  type PowerupType,
} from '../game/powerups/types'
import { useIsMobile } from './useIsMobile'

function hexToCss(n: number): string {
  return `#${n.toString(16).padStart(6, '0')}`
}

function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export function Hud() {
  const score = useGameStore((s) => s.score)
  const bricks = useGameStore((s) => s.bricksLeft)
  const lives = useGameStore((s) => s.lives)
  const effects = useGameStore((s) => s.activeEffects)
  const timeLeft = useGameStore((s) => s.timeLeftSec)
  const phase = useGameStore((s) => s.phase)
  const effectSec = useSettingsStore((s) => s.settings.effectSec)
  const configuredLives = useSettingsStore((s) => s.settings.lives)
  const isMobile = useIsMobile()
  const effectKeys = Object.keys(effects) as PowerupType[]
  const showCountdown = timeLeft >= 0 && (phase === 'playing' || phase === 'paused')
  const urgent = timeLeft >= 0 && timeLeft <= 10

  return (
    <>
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 z-10 flex items-baseline justify-between font-hud tracking-[0.3em] text-cyan-200/90 [text-shadow:0_0_12px_rgba(0,229,255,0.8)] ${
          isMobile ? 'px-3 pt-2.5 text-[11px] tracking-[0.18em]' : 'px-5 pt-4 text-[13px]'
        }`}
      >
        <div>
          SCORE
          <span
            className={`ml-3 text-white [text-shadow:0_0_8px_#fff,0_0_20px_#0ff] ${
              isMobile ? 'ml-2 text-base' : 'text-lg'
            }`}
          >
            {String(score).padStart(5, '0')}
          </span>
        </div>
        <div className="text-cyan-200/50">
          BRICKS <span className="text-cyan-100">{String(bricks).padStart(2, '0')}</span>
        </div>
        {/* 局时限倒计时：作为顶栏 flex 项参与排版（原先绝对居中会压住 BRICKS / SCORE） */}
        {showCountdown && (
          <div
            className={`font-hud tabular-nums ${
              urgent
                ? 'animate-blink-soft text-red-400 [text-shadow:0_0_12px_rgba(255,60,60,0.9)]'
                : 'text-yellow-200/85 [text-shadow:0_0_10px_rgba(255,220,80,0.6)]'
            }`}
            aria-label={`剩余时间 ${fmtTime(timeLeft)}`}
          >
            {fmtTime(timeLeft)}
          </div>
        )}
        <div className="flex items-center gap-2" aria-label={`剩余生命 ${lives}`}>
          <span className="sr-only">LIVES</span>
          {Array.from({ length: Math.max(configuredLives, lives) }).map((_, i) => (
            <span
              key={i}
              className={
                i < lives
                  ? 'inline-block h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_8px_#0ff]'
                  : 'inline-block h-2 w-2 rounded-full bg-cyan-900/60'
              }
            />
          ))}
        </div>
      </div>
      {/* 活动效果条：字母 + 剩余比例（左下角，瞬时效果不进条） */}
      {effectKeys.length > 0 && (
        <div className="pointer-events-none absolute bottom-3 left-4 z-10 flex flex-col gap-1.5 font-hud text-[11px] tracking-[0.2em]">
          {effectKeys.map((t) => {
            const total = t === 'slow' ? effectSec * 0.8 : effectSec
            const ratio = Math.max(0, Math.min(1, (effects[t] ?? 0) / (total * 60)))
            const color = hexToCss(POWERUP_COLOR[t])
            return (
              <div key={t} className="flex items-center gap-2" aria-label={`效果 ${t} 剩余 ${effects[t]} 步`}>
                <span style={{ color, textShadow: `0 0 8px ${color}` }}>{POWERUP_LABEL[t]}</span>
                <span className="relative block h-1 w-16 overflow-hidden rounded bg-white/10">
                  <span
                    className="absolute inset-y-0 left-0 rounded"
                    style={{ width: `${ratio * 100}%`, background: color, boxShadow: `0 0 6px ${color}` }}
                  />
                </span>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
