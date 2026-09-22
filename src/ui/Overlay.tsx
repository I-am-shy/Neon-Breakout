// 覆盖层：idle（开屏 PLAY + SETTING + 图例 + 本局配置）/ ready（轻提示无遮罩）/ paused / gameover（含 TIME UP）/ win
// 纯展示，动作走键盘（Input）、点按（PointerInput）与 PLAY/SETTING/BACK 按钮
// 响应式（视口 ≤640px = 移动端）：操作提示**纵向逐条堆叠**（触屏语义：滑动/点按），
//   容器 justify-evenly 铺开、去掉上下留空，并把砖阵/生命/时限/最高分等信息补进开屏
import { useGameStore } from '../game/gameStore'
import { useSettingsStore } from '../game/settings'
import { POWERUP_NAME } from '../game/fx'
import {
  POWERUP_COLOR,
  POWERUP_DESC,
  type PowerupType,
} from '../game/powerups/types'
import { useIsMobile } from './useIsMobile'

function hexToCss(n: number): string {
  return `#${n.toString(16).padStart(6, '0')}`
}

/** 图例符号：SVG 复刻 NeonView.drawPowerupGlyph 的造型（同一语义映射，双端一致） */
function Glyph({ type, color }: { type: PowerupType; color: string }) {
  const stroke = { stroke: color, strokeWidth: 1.6, fill: 'none', strokeLinecap: 'round' } as const
  const w = { width: 17, height: 17, viewBox: '-12 -12 24 24' } as const
  switch (type) {
    case 'expand':
      return (
        <svg {...w}>
          <path d="M-6 0 H6 M-6 0 L-3 -3 M-6 0 L-3 3 M6 0 L3 -3 M6 0 L3 3" {...stroke} />
        </svg>
      )
    case 'multi':
      return (
        <svg {...w}>
          <circle cx={-4} cy={0} r={2.6} fill={color} />
          <circle cx={4} cy={0} r={2.6} fill={color} />
          <circle cx={0} cy={-4} r={2.6} fill={color} fillOpacity={0.7} />
        </svg>
      )
    case 'slow':
      return (
        <svg {...w}>
          <path d="M-4 -5 H4 L-4 5 H4 Z" {...stroke} />
        </svg>
      )
    case 'life':
      return (
        <svg {...w}>
          <path d="M0 -5 V5 M-5 0 H5" {...stroke} />
        </svg>
      )
    case 'shield':
      return (
        <svg {...w}>
          <path d="M-7 -3 Q0 4 7 -3" {...stroke} />
          <path d="M-7 -3 H7" stroke={color} strokeWidth={1.6} fill="none" strokeOpacity={0.5} />
        </svg>
      )
  }
}

/** 操作提示：移动端纵向逐条堆叠（窄屏不折行、可容纳多条），桌面保持单行 */
function Hints({ lines, vertical }: { lines: string[]; vertical: boolean }) {
  if (!vertical) {
    return (
      <p className="animate-blink-soft font-hud text-[10px] tracking-[0.35em] text-cyan-100/55">
        {lines.join(' · ')}
      </p>
    )
  }
  return (
    <div className="flex flex-col items-center gap-1">
      {lines.map((l) => (
        <span
          key={l}
          className="animate-blink-soft font-hud text-[11px] leading-snug tracking-[0.25em] text-cyan-100/70"
        >
          {l}
        </span>
      ))}
    </div>
  )
}

const LEGEND: PowerupType[] = ['expand', 'multi', 'slow', 'life', 'shield']

/** 特殊砖示意（CSS 复刻 View 造型）：光晕砖 = 预告道具色 + 2 击；渐变砖 = 流动渐变 + 随机道具 */
function SpecialBrickLegend({ mobile }: { mobile: boolean }) {
  return (
    <div
      className={`grid gap-x-6 ${mobile ? 'grid-cols-1 gap-y-1' : 'grid-cols-2 gap-y-1.5'}`}
      aria-label="特殊砖图例"
    >
      <div
        className={`${mobile ? '' : 'col-span-2'} font-hud text-[9px] tracking-[0.3em] text-cyan-100/40`}
      >
        — SPECIAL BRICKS —
      </div>
      <div className="flex items-center gap-2">
        <span
          className="inline-block h-3.5 w-7 shrink-0 rounded-[2px] border border-cyan-300 bg-[#000814]"
          style={{ boxShadow: '0 0 7px rgba(0,229,255,0.7), inset 0 0 4px rgba(0,229,255,0.3)' }}
        />
        <span className="font-hud text-[9px] tracking-[0.12em] text-cyan-200/80">
          光晕砖 <span className="text-white/55">颜色=道具 · 2 击</span>
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span
          className="animate-flow-demo inline-block h-3.5 w-7 shrink-0 rounded-[2px] border border-white/30"
          style={{
            background:
              'linear-gradient(90deg, #ff5588, #ffdd44, #55ff88, #44ddff, #8855ff, #ff5588)',
          }}
        />
        <span className="font-hud text-[9px] tracking-[0.12em] text-cyan-200/80">
          渐变砖 <span className="text-white/55">随机道具 · 1 击</span>
        </span>
      </div>
    </div>
  )
}

/** 开屏道具图例：一次学习，局内识别零成本 */
function Legend({ mobile }: { mobile: boolean }) {
  return (
    <div
      className={`grid gap-x-6 ${mobile ? 'grid-cols-1 gap-y-1' : 'grid-cols-2 gap-y-1.5'}`}
      aria-label="道具图例"
    >
      {LEGEND.map((t) => {
        const color = hexToCss(POWERUP_COLOR[t])
        return (
          <div key={t} className="flex items-center gap-2">
            <Glyph type={t} color={color} />
            <span
              className="font-hud text-[9px] tracking-[0.15em]"
              style={{ color, textShadow: `0 0 6px ${color}66` }}
            >
              {POWERUP_NAME[t]}
            </span>
            <span className="font-hud text-[9px] tracking-[0.1em] text-white/55">
              {POWERUP_DESC[t]}
            </span>
          </div>
        )
      })}
    </div>
  )
}

/** 本局配置摘要 + 最高分（移动端开屏的「信息补位」：设置面板在另一屏，开屏直接摊开关键参数） */
function SessionInfo({ mobile }: { mobile: boolean }) {
  const s = useSettingsStore((st) => st.settings)
  const best = useGameStore((st) => st.best)
  const lines = [
    `砖阵 ${s.brickCols}×${s.brickRows} · 生命 ${s.lives}`,
    `光晕 ${s.giftCount} · 渐变 ${s.flowCount}`,
    `时限 ${s.timeLimitSec === 0 ? 'OFF' : `${s.timeLimitSec}s`} · 球速 ${s.speedMult.toFixed(2)}×`,
    `掉落 ${Math.round(s.dropRate * 100)}% ${s.dropMode === 'random' ? 'RANDOM' : 'FIXED'}`,
  ]
  return (
    <div className="flex flex-col items-center gap-0.5" aria-label="本局配置">
      <p className="font-hud text-[9px] tracking-[0.3em] text-cyan-100/40">— THIS ROUND —</p>
      {/* 移动端：配置压成双列两行（375px 窄屏省 ~24px 竖向空间） */}
      <div className={mobile ? 'grid grid-cols-2 gap-x-2.5 gap-y-0.5' : 'contents'}>
        {lines.map((l) => (
          <p
            key={l}
            className={`font-hud text-[9px] tracking-[0.12em] text-cyan-100/55 ${
              mobile ? 'whitespace-nowrap text-center' : ''
            }`}
          >
            {l}
          </p>
        ))}
      </div>
      {best > 0 && (
        <p className="mt-0.5 font-hud text-[10px] tracking-[0.2em] text-fuchsia-300/80">
          BEST {String(best).padStart(5, '0')}
        </p>
      )}
    </div>
  )
}

const TONE: Record<string, string> = {
  idle: 'text-cyan-300',
  paused: 'text-yellow-300',
  gameover: 'text-fuchsia-400',
  win: 'text-cyan-300',
}

/** 开屏标题 */
function Title({ mobile }: { mobile: boolean }) {
  return (
    <h1
      className={`animate-neon-flicker font-display font-bold tracking-[0.28em] text-cyan-300 ${
        mobile ? 'text-2xl' : 'text-4xl'
      }`}
      style={{ textShadow: '0 0 8px currentColor, 0 0 32px currentColor' }}
    >
      NEON
      <span className={`text-white/90 ${mobile ? 'mx-1.5' : 'mx-3'}`}>BREAKOUT</span>
    </h1>
  )
}

/** 开屏动作按钮：移动端沉底（拇指可达区），桌面居中堆叠 */
function IdleButtons({ mobile }: { mobile: boolean }) {
  const enterReady = useGameStore((s) => s.enterReady)
  const openPanel = useSettingsStore((s) => s.openPanel)
  return (
    <div className={`flex flex-col items-center ${mobile ? 'w-full gap-2.5' : 'gap-6'}`}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          enterReady()
        }}
        className={`pointer-events-auto rounded-md border border-cyan-300/80 bg-cyan-300/10 font-hud tracking-[0.45em] text-cyan-100 shadow-[0_0_18px_rgba(0,229,255,0.35),inset_0_0_12px_rgba(0,229,255,0.15)] transition hover:bg-cyan-300/20 active:scale-95 ${
          mobile ? 'px-12 py-3 text-sm' : 'px-10 py-3 text-sm'
        }`}
      >
        PLAY
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          openPanel()
        }}
        className={`pointer-events-auto rounded-md border border-cyan-300/40 bg-transparent font-hud tracking-[0.4em] text-cyan-200/80 transition hover:border-cyan-300/80 hover:text-cyan-100 active:scale-95 ${
          mobile ? 'px-7 py-2 text-xs' : 'px-6 py-2 text-xs'
        }`}
      >
        SETTING
      </button>
    </div>
  )
}

// 操作提示按视口语义分流：移动端 = 滑动/点按（点按兼做启动与暂停，故无 ⏸ 按钮）；桌面 = 键盘
// 键位分工：Space = 启动族（发射/终局重开）；Esc = 暂停切换（P 别名）；R = 重开
const HINT_IDLE_MOBILE = ['滑动屏幕 · 左右移动挡板', '点按屏幕 · 发射', '点按屏幕 · 暂停 / 继续']
const HINT_IDLE_DESKTOP = ['A/D 或 ←/→ 移动', 'SPACE 发射', 'ESC 暂停 · R 重开']
const HINT_READY_MOBILE = ['滑动屏幕 · 左右移动挡板', '点按屏幕 · 发射']
const HINT_READY_DESKTOP = ['SPACE 发射 · A/D 或 ←/→ 移动']
const HINT_PAUSED_MOBILE = ['点按屏幕 · 继续', 'BACK TO TITLE · 回开屏']
const HINT_PAUSED_DESKTOP = ['按 SPACE 或 ESC 继续']
const HINT_OVER_MOBILE = ['点按屏幕 · 重开', 'BACK TO TITLE · 回开屏']
const HINT_OVER_DESKTOP = ['按 R 或 SPACE 重开']

export function Overlay() {
  const phase = useGameStore((s) => s.phase)
  const score = useGameStore((s) => s.score)
  const best = useGameStore((s) => s.best)
  const bricksLeft = useGameStore((s) => s.bricksLeft)
  const overReason = useGameStore((s) => s.overReason)
  const backToTitle = useGameStore((s) => s.backToTitle)
  const panelOpen = useSettingsStore((s) => s.panelOpen)
  const isMobile = useIsMobile()

  if (phase === 'playing') return null

  // 设置面板打开时开屏让位（轮替而非叠加：任何时刻最多一层覆盖界面）
  if (phase === 'idle' && panelOpen) return null

  // ready：清屏待发射——无遮罩无模糊，仅一条不挡视线的轻提示
  if (phase === 'ready') {
    return (
      <div className="pointer-events-none absolute inset-x-0 bottom-[26%] z-20 flex justify-center px-3">
        <Hints
          vertical={isMobile}
          lines={isMobile ? HINT_READY_MOBILE : HINT_READY_DESKTOP}
        />
      </div>
    )
  }

  return (
    <div
      className={`absolute inset-0 z-20 flex flex-col items-center bg-[#05060e]/72 backdrop-blur-[2px] ${
        isMobile ? 'justify-between gap-1.5 px-3 py-2' : 'justify-center gap-6'
      }${phase === 'idle' ? ' animate-fade-in' : ''}`}
    >
      {phase === 'idle' ? (
        isMobile ? (
          // 移动端三段式：标题置顶 · 信息居中 · 动作按钮沉底（拇指可达，符合移动端操作逻辑）
          <>
            <Title mobile />
            {/* 中间块收缩 + 可滚动：极矮屏（320×568 等）也不会把按钮挤出屏幕 */}
            <div className="nb-scroll flex min-h-0 flex-1 flex-col items-center justify-center gap-1.5 overflow-y-auto">
              <p className="font-hud text-[9px] tracking-[0.3em] text-cyan-100/40">— POWER-UPS —</p>
              <Legend mobile />
              <SpecialBrickLegend mobile />
              <SessionInfo mobile />
            </div>
            <div className="flex w-full shrink-0 flex-col items-center gap-2">
              <Hints vertical lines={HINT_IDLE_MOBILE} />
              <IdleButtons mobile />
            </div>
          </>
        ) : (
          <>
            <Title mobile={false} />
            <IdleButtons mobile={false} />
            {/* 道具图例：击碎砖块会掉落霓虹胶囊，接住即生效 */}
            <p className="mt-3 font-hud text-[9px] tracking-[0.3em] text-cyan-100/40">— POWER-UPS —</p>
            <Legend mobile={false} />
            <SpecialBrickLegend mobile={false} />
            <Hints vertical={false} lines={HINT_IDLE_DESKTOP} />
          </>
        )
      ) : (
        <>
          <h1
            className={`font-display font-bold tracking-[0.28em] ${isMobile ? 'text-3xl' : 'text-4xl'} ${TONE[phase]}`}
            style={{ textShadow: '0 0 8px currentColor, 0 0 32px currentColor' }}
          >
            {phase === 'paused'
              ? 'PAUSED'
              : phase === 'win'
                ? 'STAGE CLEAR'
                : overReason === 'time'
                  ? 'TIME UP'
                  : 'GAME OVER'}
          </h1>

          {(phase === 'gameover' || phase === 'win') && (
            <div className="flex flex-col items-center gap-1.5">
              <p className="font-hud text-sm tracking-[0.35em] text-white/80">
                FINAL SCORE {String(score).padStart(5, '0')}
              </p>
              <p
                className={`font-hud text-[11px] tracking-[0.3em] ${
                  score >= best && score > 0 ? 'animate-blink-soft text-fuchsia-300' : 'text-cyan-100/50'
                }`}
              >
                {score >= best && score > 0 ? '★ NEW BEST' : `BEST ${String(best).padStart(5, '0')}`}
              </p>
            </div>
          )}

          {phase === 'paused' && isMobile && (
            <p className="font-hud text-[10px] tracking-[0.25em] text-cyan-100/50">
              分数 {String(score).padStart(5, '0')} · 砖块 {String(bricksLeft).padStart(2, '0')}
            </p>
          )}

          <Hints
            vertical={isMobile}
            lines={
              phase === 'paused'
                ? isMobile
                  ? HINT_PAUSED_MOBILE
                  : HINT_PAUSED_DESKTOP
                : isMobile
                  ? HINT_OVER_MOBILE
                  : HINT_OVER_DESKTOP
            }
          />

          {/* 返回首页：暂停页与终局页共用 */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              backToTitle()
            }}
            className={`pointer-events-auto rounded-md border border-yellow-300/50 bg-transparent font-hud tracking-[0.4em] text-yellow-200/80 transition hover:border-yellow-300 hover:text-yellow-100 active:scale-95 ${
              isMobile ? 'px-5 py-1.5 text-[11px]' : 'mt-2 px-6 py-2 text-xs'
            }`}
          >
            BACK TO TITLE
          </button>
        </>
      )}
    </div>
  )
}