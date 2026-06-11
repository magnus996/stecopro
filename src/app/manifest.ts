import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'StecoPro — Mitt skift',
    short_name: 'Mitt skift',
    description: 'Operatørapp for sorteringsanlegget',
    start_url: '/skift',
    display: 'standalone',
    background_color: '#18181b',
    theme_color: '#18181b',
    lang: 'nb',
    icons: [
      { src: '/icon-192', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512', sizes: '512x512', type: 'image/png' },
    ],
  }
}
