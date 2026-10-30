import { NextResponse } from 'next/server'

export async function POST() {
  const response = NextResponse.json({ message: 'Logout realizado' })
  response.cookies.delete('sc_token')
  response.cookies.delete('sc_admin_token')
  return response
}
