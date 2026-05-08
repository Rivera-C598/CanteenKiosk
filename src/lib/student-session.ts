import { SessionOptions } from 'iron-session'

export interface StudentSessionData {
  studentId?: number
  studentIdNumber?: string
  isLoggedIn: boolean
  isTemporaryPin: boolean
}

export const studentSessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET ?? 'canteen-kiosk-secret-key-change-in-production-32chars',
  cookieName: 'hyperbite-student-session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 60 * 60 * 2, // 2 hours max; UI enforces 3-min inactivity
  },
}
