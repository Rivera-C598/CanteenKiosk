import { SessionOptions } from 'iron-session'

export interface SessionData {
  userId?: number
  username?: string
  role?: string
  isLoggedIn: boolean
}

const secret = process.env.SESSION_SECRET
if (!secret || secret.length < 32) {
  throw new Error('SESSION_SECRET env var must be set and at least 32 characters long')
}

export const sessionOptions: SessionOptions = {
  password: secret,
  cookieName: 'hyperbite-admin-session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 60 * 60 * 8, // 8 hours
  },
}
