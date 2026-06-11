'use client'
import { useEffect } from 'react'

export default function PwaRegistrar() {
  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((e) => {
        console.warn('[pwa] service worker registration failed', e)
      })
    }
  }, [])
  return null
}
