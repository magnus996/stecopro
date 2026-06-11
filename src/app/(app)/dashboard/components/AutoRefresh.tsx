'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface AutoRefreshProps {
  intervalMs?: number
}

/**
 * Client-side polling component. Renders null but drives periodic router.refresh()
 * so the server component re-fetches getDashboardData on every interval.
 */
export default function AutoRefresh({ intervalMs = 30_000 }: AutoRefreshProps) {
  const router = useRouter()

  useEffect(() => {
    const id = setInterval(() => {
      router.refresh()
    }, intervalMs)
    return () => clearInterval(id)
  }, [router, intervalMs])

  return null
}
