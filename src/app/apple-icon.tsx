import { ImageResponse } from 'next/og'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  const logo = readFileSync(join(process.cwd(), 'public', 'logo-hvit.png')).toString('base64')
  return new ImageResponse(
    (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', background: '#18181b' }}>
        <img src={`data:image/png;base64,${logo}`} width={140} style={{ objectFit: 'contain' }} />
      </div>
    ),
    { width: 180, height: 180 },
  )
}
