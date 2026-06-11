'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ShiftNoteComposer() {
  const router = useRouter()
  const [content, setContent] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!content.trim()) {
      setError('Skriv inn innhold i notatet')
      return
    }
    setLoading(true)
    setError(null)

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

      // Post shift note (plantId defaults to first plant server-side)
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: content.trim(),
          photoId,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Notat feilet')
      }

      setContent('')
      setPhotoFile(null)
      setDone(true)
      setTimeout(() => setDone(false), 3000)
      router.refresh()
    } catch (e) {
      setError((e as Error).message ?? 'Ukjent feil')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-md border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800 space-y-3"
    >
      <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        Nytt skiftnotat
      </h3>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={3}
        className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder-zinc-500"
        placeholder="Skriv skiftnotat…"
      />
      <div>
        <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
          Bilde (valgfritt)
        </label>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
          className="text-sm text-zinc-700 dark:text-zinc-300 file:mr-2 file:rounded file:border-0 file:bg-zinc-200 file:px-2 file:py-1 file:text-xs file:font-medium file:text-zinc-700 dark:file:bg-zinc-700 dark:file:text-zinc-300"
        />
      </div>
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      {done && <p className="text-xs text-green-600 dark:text-green-400">Notat lagret</p>}
      <button
        type="submit"
        disabled={loading}
        className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? 'Lagrer…' : 'Lagre notat'}
      </button>
    </form>
  )
}
