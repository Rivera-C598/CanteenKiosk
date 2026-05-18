export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { prisma } = await import('@/lib/prisma')
    try {
      await prisma.$executeRaw`PRAGMA journal_mode=WAL`
      await prisma.$executeRaw`PRAGMA busy_timeout=5000`
    } catch {
      // libsql may not support all PRAGMAs — non-fatal
    }
  }
}
