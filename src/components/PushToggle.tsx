'use client'

import { useState, useEffect } from 'react'

/**
 * PushToggle — client component that manages Web Push notification subscription.
 *
 * Handles:
 *   - SW/PushManager availability check (graceful degradation on unsupported devices)
 *   - VAPID public key fetch from /api/push/vapid-public-key
 *   - Notification permission request
 *   - PushManager.subscribe → POST /api/push/subscribe
 *   - Toggle off → POST /api/push/unsubscribe
 *
 * Norwegian UI strings throughout.
 */

/** Convert VAPID public key from base64url to Uint8Array for PushManager. */
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray as Uint8Array<ArrayBuffer>
}

type UnsupportedReason = 'insecure' | 'ios_not_installed' | 'generic'

export default function PushToggle() {
  const [supported, setSupported] = useState<boolean | null>(null)
  const [unsupportedReason, setUnsupportedReason] = useState<UnsupportedReason>('generic')
  const [diagnostics, setDiagnostics] = useState<string>('')
  const [subscribed, setSubscribed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentSubscription, setCurrentSubscription] = useState<PushSubscription | null>(null)

  useEffect(() => {
    // Check support on mount
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      // Figure out WHY so the user gets actionable guidance instead of a dead end.
      const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent)
      const standalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        (navigator as unknown as { standalone?: boolean }).standalone === true
      if (!window.isSecureContext) {
        setUnsupportedReason('insecure')
      } else if (isIos && !standalone) {
        setUnsupportedReason('ios_not_installed')
      } else {
        setUnsupportedReason('generic')
      }
      // Capability readout so "why is there no button" is answerable
      // from the phone screen instead of remote guesswork.
      setDiagnostics(
        [
          `sikker kontekst: ${window.isSecureContext ? 'ja' : 'nei'}`,
          `service worker: ${'serviceWorker' in navigator ? 'ja' : 'nei'}`,
          `push-API: ${'PushManager' in window ? 'ja' : 'nei'}`,
          `varslings-API: ${'Notification' in window ? 'ja' : 'nei'}`,
          `installert (standalone): ${standalone ? 'ja' : 'nei'}`,
        ].join(' · '),
      )
      setSupported(false)
      return
    }
    setSupported(true)

    // Check existing subscription
    navigator.serviceWorker.ready.then((reg) => {
      reg.pushManager.getSubscription().then((sub) => {
        if (sub) {
          setSubscribed(true)
          setCurrentSubscription(sub)
        }
      })
    })
  }, [])

  async function handleSubscribe() {
    setLoading(true)
    setError(null)
    try {
      // Fetch VAPID public key
      const keyRes = await fetch('/api/push/vapid-public-key')
      if (!keyRes.ok) {
        setError('Push ikke konfigurert på serveren')
        return
      }
      const { publicKey } = await keyRes.json()

      // Request notification permission
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setError('Varsler ble blokkert. Tillat varsler i nettleserinnstillingene.')
        return
      }

      // Subscribe via PushManager
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      })

      // Send subscription to server
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription.toJSON()),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Kunne ikke aktivere varsler')
      }

      setSubscribed(true)
      setCurrentSubscription(subscription)
    } catch (e) {
      setError((e as Error).message ?? 'Ukjent feil')
    } finally {
      setLoading(false)
    }
  }

  async function handleUnsubscribe() {
    setLoading(true)
    setError(null)
    try {
      if (currentSubscription) {
        // Remove from server first
        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: currentSubscription.endpoint }),
        })
        // Then unsubscribe locally
        await currentSubscription.unsubscribe()
      }
      setSubscribed(false)
      setCurrentSubscription(null)
    } catch (e) {
      setError((e as Error).message ?? 'Ukjent feil')
    } finally {
      setLoading(false)
    }
  }

  if (supported === null) {
    // Still checking
    return null
  }

  if (!supported) {
    if (unsupportedReason === 'insecure') {
      return (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
          <p className="font-medium">Varsler krever sikker tilkobling (HTTPS)</p>
          <p className="mt-1">
            Du er koblet til over http. Start serveren med HTTPS (f.eks.{' '}
            <code className="font-mono text-xs">next dev --experimental-https</code>) og åpne
            siden på nytt for å aktivere varsler.
          </p>
        </div>
      )
    }
    if (unsupportedReason === 'ios_not_installed') {
      return (
        <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300">
          <p className="font-medium">Installer appen for å få varsler på iPhone</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>Trykk på Del-knappen i Safari (firkanten med pil opp)</li>
            <li>Velg «Legg til på Hjem-skjerm»</li>
            <li>Åpne StecoPro fra Hjem-skjermen og aktiver varsler her</li>
          </ol>
          <p className="mt-2 text-xs">Krever iOS 16.4 eller nyere.</p>
          <p className="mt-2 text-xs opacity-70">{diagnostics}</p>
        </div>
      )
    }
    return (
      <div className="space-y-2">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Push-varsler støttes ikke i denne nettleseren. På iPhone kreves iOS 16.4
          eller nyere, og at appen er åpnet fra Hjem-skjermen.
        </p>
        <p className="text-xs text-zinc-400 dark:text-zinc-500">{diagnostics}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
      {subscribed ? (
        <div className="flex items-center gap-3">
          <span className="text-sm text-green-700 font-medium">Varsler aktivert</span>
          <button
            onClick={handleUnsubscribe}
            disabled={loading}
            className="text-sm text-gray-600 underline hover:text-gray-900 disabled:opacity-50"
          >
            {loading ? 'Skrur av…' : 'Skru av'}
          </button>
        </div>
      ) : (
        <button
          onClick={handleSubscribe}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Aktiverer…' : 'Aktiver varsler på denne enheten'}
        </button>
      )}
    </div>
  )
}
