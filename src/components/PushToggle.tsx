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

export default function PushToggle() {
  const [supported, setSupported] = useState<boolean | null>(null)
  const [subscribed, setSubscribed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentSubscription, setCurrentSubscription] = useState<PushSubscription | null>(null)

  useEffect(() => {
    // Check support on mount
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
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
    return (
      <p className="text-sm text-gray-500">
        Push-varsler støttes ikke på denne enheten. Installer appen på startskjermen for å aktivere varsler.
      </p>
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
