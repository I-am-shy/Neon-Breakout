// Web Audio 程序合成音效：零音频素材文件
// oscillator + gain envelope，每次一个节点，用完即弃
// 浏览器 autoplay 政策：首次用户交互时 unlock()（AudioContext.resume）

interface BeepOpts {
  freq: number
  endFreq?: number
  dur: number
  type?: OscillatorType
  gain?: number
  delay?: number
}

class Sfx {
  private ctx: AudioContext | null = null

  unlock(): void {
    this.ensure()?.resume().catch(() => {})
  }

  private ensure(): AudioContext | null {
    if (this.ctx) return this.ctx
    const w = window as { webkitAudioContext?: typeof AudioContext }
    const AC = typeof AudioContext !== 'undefined' ? AudioContext : w.webkitAudioContext
    if (!AC) return null
    this.ctx = new AC()
    return this.ctx
  }

  private beep({ freq, endFreq, dur, type = 'square', gain = 0.12, delay = 0 }: BeepOpts): void {
    const ctx = this.ctx
    if (!ctx || ctx.state !== 'running') return
    const t0 = ctx.currentTime + delay
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, t0)
    if (endFreq !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(endFreq, 1), t0 + dur)
    }
    g.gain.setValueAtTime(0, t0)
    g.gain.linearRampToValueAtTime(gain, t0 + 0.008) // 快 attack
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur) // 指数 decay
    osc.connect(g)
    g.connect(ctx.destination)
    osc.start(t0)
    osc.stop(t0 + dur + 0.05)
  }

  paddle(): void {
    this.beep({ freq: 220, dur: 0.07, type: 'triangle', gain: 0.16 })
  }
  wall(): void {
    this.beep({ freq: 150, dur: 0.05, type: 'sine', gain: 0.1 })
  }
  brick(row: number): void {
    // 行号越高音越亮，破坏反馈带音高梯度
    this.beep({ freq: 440 + row * 55, endFreq: 700 + row * 55, dur: 0.09, gain: 0.09 })
  }
  /** gift 砖首击（未碎）钝击：低频短促（提示「再来一下」） */
  giftHit(): void {
    this.beep({ freq: 180, endFreq: 140, dur: 0.06, type: 'sine', gain: 0.14 })
  }
  /** flow 砖击碎：清脆双音上行（惊喜感，与普通破砖区分） */
  flowBreak(): void {
    this.beep({ freq: 660, dur: 0.06, gain: 0.1 })
    this.beep({ freq: 990, dur: 0.06, gain: 0.1, delay: 0.05 })
  }
  /** 护盾碎裂：高频方波玻璃感 */
  shieldBreak(): void {
    this.beep({ freq: 1200, endFreq: 300, dur: 0.18, type: 'square', gain: 0.08 })
  }
  /** 道具拾取：每道具一个频率特征，双音上行（正向反馈） */
  pickup(type: 'expand' | 'multi' | 'slow' | 'life' | 'shield'): void {
    const base = { expand: 660, multi: 880, slow: 440, life: 990, shield: 550 }[type]
    this.beep({ freq: base, dur: 0.08, type: 'triangle', gain: 0.12 })
    this.beep({ freq: base * 1.5, dur: 0.1, type: 'triangle', gain: 0.1, delay: 0.07 })
  }
  launch(): void {
    this.beep({ freq: 180, endFreq: 520, dur: 0.14, type: 'sawtooth', gain: 0.1 })
  }
  lose(): void {
    this.beep({ freq: 300, endFreq: 55, dur: 0.5, type: 'sawtooth', gain: 0.14 })
  }
  win(): void {
    // 小琶音 C-E-G-C
    const notes = [523, 659, 784, 1047]
    notes.forEach((f, i) =>
      this.beep({ freq: f, dur: 0.16, type: 'triangle', gain: 0.12, delay: i * 0.1 }),
    )
  }

  destroy(): void {
    this.ctx?.close().catch(() => {})
    this.ctx = null
  }
}

export const sfx = new Sfx()
