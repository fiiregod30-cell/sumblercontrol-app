'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function LoginPage() {
  const router = useRouter()
  const [form, setForm] = useState({ email: '', senha: '' })
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })
      const data = await res.json()
      if (!res.ok) { setErro(data.error || 'Erro ao fazer login'); return }
      router.push('/checkout')
    } catch { setErro('Erro de conexão') } finally { setLoading(false) }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', background: '#090F1A' }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ width: '48px', height: '48px', background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: '12px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="#3B82F6" strokeWidth="2"/><circle cx="12" cy="12" r="4" stroke="#3B82F6" strokeWidth="2"/></svg>
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: '800', marginBottom: '6px' }}>Entrar</h1>
          <p style={{ color: '#647489', fontSize: '14px' }}>Acesse sua conta SumblerControl</p>
        </div>

        <form onSubmit={handleSubmit} style={{ background: '#111826', border: '1px solid #1E2939', borderRadius: '16px', padding: '32px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', color: '#647489', marginBottom: '6px' }}>E-mail</label>
            <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="seu@email.com" required style={inputStyle} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '13px', color: '#647489', marginBottom: '6px' }}>Senha</label>
            <input type="password" value={form.senha} onChange={e => setForm(p => ({ ...p, senha: e.target.value }))} placeholder="Sua senha" required style={inputStyle} />
          </div>
          {erro && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '12px', fontSize: '13px', color: '#EF4444' }}>{erro}</div>}
          <button type="submit" disabled={loading} style={btnStyle}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
          <p style={{ textAlign: 'center', fontSize: '13px', color: '#647489' }}>
            Não tem conta?{' '}
            <Link href="/registro" style={{ color: '#3B82F6', textDecoration: 'none' }}>Criar conta grátis</Link>
          </p>
        </form>

        <p style={{ textAlign: 'center', marginTop: '24px', fontSize: '13px', color: '#647489' }}>
          <Link href="/" style={{ color: '#647489', textDecoration: 'none' }}>← Voltar ao site</Link>
        </p>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px', background: '#151D2C', border: '1px solid #1E2939',
  borderRadius: '8px', color: '#F1F5FA', fontSize: '14px', outline: 'none',
}
const btnStyle: React.CSSProperties = {
  width: '100%', padding: '12px', background: '#3B82F6', color: '#fff',
  border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: '600', cursor: 'pointer',
}
