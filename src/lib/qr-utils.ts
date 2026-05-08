import QRCode from 'qrcode'
import { randomUUID } from 'crypto'

export function generateQrToken(): string {
  return randomUUID()
}

export async function generateQrSvg(qrToken: string): Promise<string> {
  return QRCode.toString(qrToken, { type: 'svg', width: 256, margin: 1 })
}
