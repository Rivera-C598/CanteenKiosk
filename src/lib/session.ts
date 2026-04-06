import { SessionOptions } from 'iron-session'

export interface SessionData {
  userId?: number
  username?: string
  role?: string
  isLoggedIn: boolean
}

export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET ?? 'canteen-kiosk-secret-key-change-in-production-32chars',
  cookieName: 'hyperbite-admin-session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 60 * 60 * 8, // 8 hours
  },
}
