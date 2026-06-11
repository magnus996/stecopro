'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface StopActionsProps {
  stopId: number
}

export default function StopActions({ stopId }: StopActionsProps) {
  const router = useRouter()
  const [ackLoading, setAckLoading] = useState(false)
  const [ackDone, setAckDone] = useState(false)
  const [ackError, setAckError] = useState<string | null>(null)

  const [comment, setComment] = useState('')
  const [correctedReason, setCorrectedReason] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [commentLoading, setCommentLoading] = useState(false)
  const [commentError, setCommentError] = useState<string | null>(null)
  const [commentDone, setCommentDone] = useState(false)
  const [expanded, setExpanded] = useState(false)

  async function handleAck() {
    setAckLoading(true)
    setAckError(null)
    try {
      const res = await fetch(`/api/stops/${stopId}/ack`, { method: 'POST' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Kvittering feilet')
      }
      setAckDone(true)
      router.refresh()
    } catch (e) {
      setAckError((e as Error).message ?? 'Ukjent feil')
    } finally {
      setAckLoading(false)
    }
  }

  async function handleSubmitComment(e: React.FormEvent) {
    e.preventDefault()
    // Client-side validation: require comment or correctedReason
    if (!comment.trim() && !correctedReason.trim()) {
      setCommentError('Skriv en kommentar eller korrigert årsak')
      return
    }
    setCommentLoading(true)
    setCommentError(null)

    try {
      let photoId: number | undefined

      // Upload photo first if one was selected
      if (photoFile) {
        const form = new FormData()
        form.append('file', photoFile)
        const photoRes = await fetch('/api/photos', { method: 'POST', body: form })
        if (!photoRes.ok) {
          const data = await photoRes.json().catch(() => ({}))
          throw new Error(data.error ?? 'Bildeopplasting feilet')
        }
        const photoData = await photoRes.json()
        photoId = photoData.id
      }

      // Post comment
      const res = await fetch(`/api/stops/${stopId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          comment: comment.trim() || undefined,
          correctedReason: correctedReason.trim() || undefined,
          photoId,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Kommentar feilet')
      }

      setComment('')
      setCorrectedReason('')
      setPhotoFile(null)
      setCommentDone(true)
      setExpanded(false)
      router.refresh()
    } catch (e) {
      setCommentError((e as Error).message ?? 'Ukjent feil')
    } finally {
      setCommentLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      {/* Kvitter button */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={handleAck}
          disabled={ackLoading || ackDone}
          className="inline-flex items-center gap-1.5 rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
        >
          {ackLoading ? 'Kvitterer…' : ackDone ? 'Kvittert' : 'Kvitter'}
        </button>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
        >
          {expanded ? 'Lukk' : 'Kommenter / kamera'}
        </button>
      </div>

      {ackError && (
        <p className="text-xs text-red-600 dark:text-red-400">{ackError}</p>
      )}

      {/* Expandable comment form */}
      {expanded && (
        <form onSubmit={handleSubmitComment} className="space-y-3 rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800">
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
              Kommentar
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={2}
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder-zinc-500"
              placeholder="Beskriv hva du observerte…"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
              Korrigert årsak (valgfritt)
            </label>
            <input
              type="text"
              value={correctedReason}
              onChange={(e) => setCorrectedReason(e.target.value)}
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder-zinc-500"
              placeholder="f.eks. papirbrudd i presse"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
              Bilde (kamera)
            </label>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
              className="text-sm text-zinc-700 dark:text-zinc-300 file:mr-2 file:rounded file:border-0 file:bg-zinc-200 file:px-2 file:py-1 file:text-xs file:font-medium file:text-zinc-700 dark:file:bg-zinc-700 dark:file:text-zinc-300"
            />
          </div>
          {commentError && (
            <p className="text-xs text-red-600 dark:text-red-400">{commentError}</p>
          )}
          {commentDone && (
            <p className="text-xs text-green-600 dark:text-green-400">Kommentar lagret</p>
          )}
          <button
            type="submit"
            disabled={commentLoading}
            className="inline-flex items-center rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {commentLoading ? 'Lagrer…' : 'Lagre kommentar'}
          </button>
        </form>
      )}
    </div>
  )
}
