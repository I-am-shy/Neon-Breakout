// 设置面板：仅 idle（开屏）可达。预设 + 滑条；标注生效时机（下一局 / 即时）
import {
  PRESETS,
  SETTING_RANGES,
  useSettingsStore,
  type Settings,
} from '../game/settings'
import { useIsMobile } from './useIsMobile'

/** 数值设置键（dropMode 为枚举，单独渲染） */
type NumericKey = Exclude<keyof Settings, 'dropMode'>

interface ItemDef {
  key: NumericKey
  label: string
  fmt: (v: number) => string
  /** next = 下一局生效；instant = 即时生效 */
  timing: 'next' | 'instant'
}

const ITEMS: ItemDef[] = [
  { key: 'lives', label: 'LIVES', fmt: (v) => `${v}`, timing: 'next' },
  { key: 'brickCols', label: 'COLUMNS', fmt: (v) => `${v}`, timing: 'next' },
  { key: 'brickRows', label: 'ROWS', fmt: (v) => `${v}`, timing: 'next' },
  { key: 'giftCount', label: 'GIFT BRICKS', fmt: (v) => `${v}`, timing: 'next' },
  { key: 'flowCount', label: 'FLOW BRICKS', fmt: (v) => `${v}`, timing: 'next' },
  { key: 'timeLimitSec', label: 'TIME LIMIT', fmt: (v) => (v === 0 ? 'OFF' : `${v}s`), timing: 'next' },
  { key: 'effectSec', label: 'EFFECT TIME', fmt: (v) => `${v}s`, timing: 'instant' },
  { key: 'speedMult', label: 'BALL SPEED', fmt: (v) => `${v.toFixed(2)}x`, timing: 'instant' },
  { key: 'dropRate', label: 'DROP RATE', fmt: (v) => `${Math.round(v * 100)}%`, timing: 'instant' },
]

const PRESET_LABELS: Array<{ name: keyof typeof PRESETS; label: string }> = [
  { name: 'casual', label: 'CASUAL' },
  { name: 'standard', label: 'STANDARD' },
  { name: 'hardcore', label: 'HARDCORE' },
]

export function SettingPanel() {
  const open = useSettingsStore((s) => s.panelOpen)
  const settings = useSettingsStore((s) => s.settings)
  const set = useSettingsStore((s) => s.set)
  const applyPreset = useSettingsStore((s) => s.applyPreset)
  const closePanel = useSettingsStore((s) => s.closePanel)
  const isMobile = useIsMobile()

  if (!open) return null

  return (
    <div
      data-ui
      className={`animate-fade-in absolute inset-0 z-30 flex flex-col items-center bg-[#05060e]/88 backdrop-blur-[2px] ${
        isMobile ? 'gap-2.5 py-3' : 'gap-4 py-4'
      }`}
    >
      <h2
        className="shrink-0 font-display text-2xl font-bold tracking-[0.3em] text-cyan-300"
        style={{ textShadow: '0 0 8px currentColor, 0 0 24px currentColor' }}
      >
        SETTING
      </h2>

      {/* 难度预设 */}
      <div className="flex shrink-0 gap-3">
        {PRESET_LABELS.map(({ name, label }) => (
          <button
            key={name}
            type="button"
            onClick={() => applyPreset(name)}
            className="rounded border border-cyan-300/40 bg-cyan-300/5 px-4 py-1.5 font-hud text-[11px] tracking-[0.25em] text-cyan-200/80 transition hover:border-cyan-300 hover:bg-cyan-300/15 active:scale-95"
          >
            {label}
          </button>
        ))}
      </div>

      {/* 参数区：唯一滚动容器（标题/预设/CLOSE 不滚）——
          窄屏时滑条可滚，CLOSE 永远可见；.nb-scroll 让滚动条常驻提示可滚 */}
      <div className="nb-scroll min-h-0 w-full flex-1 overflow-y-auto">
        <div
          className={`mx-auto flex min-h-full flex-col justify-center ${
            isMobile ? 'w-[94%] gap-2 py-1' : 'w-[78%] max-w-xs gap-3 py-2'
          }`}
        >
        {ITEMS.map(({ key, label, fmt, timing }) => {
          const r = SETTING_RANGES[key as keyof typeof SETTING_RANGES]
          const v = settings[key] as number
          return (
            <label key={key} className="flex items-center gap-3" aria-label={`${label} ${fmt(v)}`}>
              <span
                className={`shrink-0 font-hud text-[10px] tracking-[0.18em] text-cyan-100/70 ${
                  isMobile ? 'w-20' : 'w-24'
                }`}
              >
                {label}
                {timing === 'next' && <span className="block text-[8px] text-cyan-100/40">下一局生效</span>}
              </span>
              <input
                type="range"
                min={r.min}
                max={r.max}
                step={r.step}
                value={v}
                onChange={(e) => set({ [key]: Number(e.target.value) } as Partial<Settings>)}
                className="h-1 flex-1 cursor-pointer appearance-none rounded bg-cyan-900/60 accent-cyan-300"
              />
              <span className="w-12 shrink-0 text-right font-hud text-xs text-cyan-200">
                {fmt(v)}
              </span>
            </label>
          )
        })}
        {/* 掉落模式（枚举）：固定占比 / 每局随机 */}
        <div className="flex items-center gap-3">
          <span
            className={`shrink-0 font-hud text-[10px] tracking-[0.18em] text-cyan-100/70 ${
              isMobile ? 'w-20' : 'w-24'
            }`}
          >
            DROP MODE
          </span>
          <div className="flex flex-1 gap-2">
            {(['fixed', 'random'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => set({ dropMode: m })}
                className={`flex-1 rounded border px-2 py-1 font-hud text-[9px] tracking-[0.2em] transition active:scale-95 ${
                  settings.dropMode === m
                    ? 'border-cyan-300 bg-cyan-300/20 text-cyan-100'
                    : 'border-cyan-300/30 text-cyan-200/60 hover:border-cyan-300/60'
                }`}
              >
                {m === 'fixed' ? 'FIXED' : 'RANDOM'}
              </button>
            ))}
          </div>
          <span className="w-12 shrink-0 text-right font-hud text-[9px] text-cyan-200/70">
            {settings.dropMode === 'random' ? '5-25%' : 'SET'}
          </span>
        </div>

          <p
            className={`px-3 text-center font-hud text-[9px] tracking-[0.2em] text-cyan-100/40 ${
              isMobile ? 'leading-relaxed' : ''
            }`}
          >
            设置自动保存 · 掉率密度归一（千砖局道具总量守恒）· 砖阵/特殊砖/时限下一局生效
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={closePanel}
        className={`shrink-0 rounded-md border border-cyan-300/80 bg-cyan-300/10 font-hud tracking-[0.45em] text-cyan-100 shadow-[0_0_18px_rgba(0,229,255,0.35),inset_0_0_12px_rgba(0,229,255,0.15)] transition hover:bg-cyan-300/20 active:scale-95 ${
          isMobile ? 'px-7 py-2 text-xs' : 'px-8 py-2.5 text-sm'
        }`}
      >
        CLOSE
      </button>
    </div>
  )
}
