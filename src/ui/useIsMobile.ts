// 移动端判定：按**视口宽度**（非触摸能力）——窄视口走移动端布局与触屏语义提示。
// 触摸能力判定会误伤「触屏笔记本」（宽视口也显示移动提示），视口判定更可控。
import { useEffect, useState } from 'react'

/** 移动端断点：≤ 640px（手机竖屏） */
export const MOBILE_QUERY = '(max-width: 640px)'

export function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(MOBILE_QUERY).matches
      : false,
  )

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia(MOBILE_QUERY)
    const onChange = (): void => setMobile(mq.matches)
    onChange() // 挂载时同步一次（SSR/初始竞态兜底）
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return mobile
}