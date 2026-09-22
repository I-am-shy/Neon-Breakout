// 双层架构落地：canvas 层（Game 全权管理）+ HUD/Overlay 层（React + Tailwind）
// React 不碰游戏循环；Game 也不感知 React 存在——两边只通过 zustand store 交汇
import { useEffect, useRef } from 'react'
import { Game } from './game/Game'
import { Hud } from './ui/Hud'
import { Overlay } from './ui/Overlay'
import { SettingPanel } from './ui/SettingPanel'
import { Banner } from './ui/Banner'

export default function App() {
  const hostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const game = new Game()
    let cancelled = false
    game.init(hostRef.current!).then(() => {
      if (cancelled) game.destroy() // destroy 先于 init 完成的 race
    })
    return () => {
      cancelled = true
      game.destroy()
    }
  }, [])

  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-[#03040a]">
      {/* 背景氛围：径向渐层 + 扫描线 */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,229,255,0.06),transparent_60%)]" />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, rgba(0,229,255,0.04) 0 1px, transparent 1px 4px)',
        }}
      />
      {/* 游戏舞台：与物理世界 960x1280（3:4）等比，HUD 挂同一容器天然对齐；touch-none 防浏览器手势抢事件 */}
      <div
        ref={hostRef}
        className="relative touch-none select-none overflow-hidden shadow-[0_0_60px_rgba(0,229,255,0.12)] ring-1 ring-cyan-400/25"
        style={{
          aspectRatio: '960 / 1280',
          height: 'min(100%, calc(100vw * 1280 / 960))',
          width: 'auto',
        }}
      >
        <Hud />
        <Overlay />
        <Banner />
        <SettingPanel />
      </div>
    </div>
  )
}
