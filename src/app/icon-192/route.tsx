import { ImageResponse } from 'next/og'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export const dynamic = 'force-static'

export function GET() {
  const logo = readFileSync(join(process.cwd(), 'public', 'logo-hvit.png')).toString('base64')
  return new ImageResponse(
    (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', background: '#18181b' }}>
        <img src={`data:image/png;base64,${logo}`} width={150} style={{ objectFit: 'contain' }} />
      </div>
    ),
    { width: 192, height: 192 },
  )
}
