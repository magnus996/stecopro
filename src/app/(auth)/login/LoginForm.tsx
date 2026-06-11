'use client'
import { useActionState } from 'react'
import Image from 'next/image'
import { login } from '@/actions/auth'

type FormState = {
  errors?: Record<string, string[]>
} | undefined

export default function LoginForm() {
  const [state, formAction, isPending] = useActionState<FormState, FormData>(login, undefined)

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-sm">
        <div className="rounded-2xl bg-white px-8 py-10 shadow-sm ring-1 ring-zinc-200">
          {/* Logo / title */}
          <div className="mb-8 text-center">
            <div className="mx-auto mb-3 inline-flex">
              <Image src="/logo.png" alt="Steco" width={200} height={42}
                style={{ height: 'auto', width: '200px' }} priority />
            </div>
            <p className="mt-1 text-sm text-zinc-500">Logg inn for å fortsette</p>
          </div>

          <form action={formAction} className="space-y-5">
            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-zinc-700">
                E-post
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="din@epost.no"
                className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 placeholder-zinc-400 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
              />
              {state?.errors?.email && (
                <p className="mt-1 text-sm text-red-600">{state.errors.email[0]}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-zinc-700">
                Passord
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                placeholder="••••••••"
                className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 placeholder-zinc-400 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
              />
              {state?.errors?.password && (
                <p className="mt-1 text-sm text-red-600">{state.errors.password[0]}</p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isPending}
              className="w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2 disabled:opacity-50"
            >
              {isPending ? 'Logger inn…' : 'Logg inn'}
            </button>
          </form>

          {/* Demo hint */}
          <div className="mt-8 rounded-lg bg-zinc-50 px-4 py-3 ring-1 ring-zinc-200">
            <p className="text-xs font-medium text-zinc-600">Demo-kontoer (passord: demo123)</p>
            <ul className="mt-2 space-y-1 text-xs text-zinc-500">
              <li>operator@steco-demo.no — Operatør</li>
              <li>leder@steco-demo.no — Produksjonsleder</li>
              <li>admin@steco-demo.no — Admin</li>
              <li>system@steco.no — System-admin</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
