import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'

const JWT_SECRET = process.env.ADMIN_SECRET_KEY as string
if (!JWT_SECRET) throw new Error('[auth] ADMIN_SECRET_KEY não está definida nas variáveis de ambiente')
const JWT_EXPIRES = '7d'

// ── Hash de senha ────────────────────────────────────────────
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

// ── JWT ──────────────────────────────────────────────────────
export interface JWTPayload {
  id: string
  email: string
  role: 'user' | 'admin'
}

export function signToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET as string, { expiresIn: JWT_EXPIRES })
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET as string)
    return decoded as JWTPayload
  } catch {
    return null
  }
}

// ── Validações ───────────────────────────────────────────────
export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function validatePhone(phone: string): boolean {
  return /^\(?[1-9]{2}\)?\s?9?\d{4}-?\d{4}$/.test(phone.replace(/\s/g, ''))
}

export function validatePassword(password: string): string | null {
  if (password.length < 8) return 'Senha deve ter pelo menos 8 caracteres'
  return null
}
