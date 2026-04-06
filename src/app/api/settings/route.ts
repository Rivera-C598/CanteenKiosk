import { NextResponse } from 'next/server'
import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'

const SETTINGS_PATH = join(process.cwd(), 'settings.json')

export async function GET() {
  try {
    const raw = await readFile(SETTINGS_PATH, 'utf-8')
    return NextResponse.json(JSON.parse(raw))
  } catch {
    return NextResponse.json({ error: 'Failed to read settings' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const raw = await readFile(SETTINGS_PATH, 'utf-8')
    const current = JSON.parse(raw)
    const updates = await request.json()
    const merged = { ...current, ...updates }
    await writeFile(SETTINGS_PATH, JSON.stringify(merged, null, 2))
    return NextResponse.json(merged)
  } catch {
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 })
  }
}
