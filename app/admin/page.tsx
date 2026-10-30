'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AdminLoginPage() {
  const router = useRouter()
  const [form, setForm] = useState({ email: '', senha: '' })
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro(''); setLoading(true)
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })
      const data = await res.json()
      if (!res.ok) { setErro(data.error || 'Credenciais inválidas'); return }
      router.push('/admin/dashboard')
    } catch { setErro('Erro de conexão') } finally { setLoading(false) }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#090F1A', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '380px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ width: '48px', height: '48px', background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: '12px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px', fontSize: '22px' }}>⚙️</div>
          <h1 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '6px' }}>Painel Admin</h1>
          <p style={{ color: '#647489', fontSize: '13px' }}>Acesso restrito — SumblerControl</p>
        </div>
        <form onSubmit={handleSubmit} style={{ background: '#111826', border: '1px solid #1E2939', borderRadius: '16px', padding: '28px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', color: '#647489', marginBottom: '6px' }}>E-mail admin</label>
            <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} required style={inputStyle} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '13px', color: '#647489', marginBottom: '6px' }}>Senha</label>
            <input type="password" value={form.senha} onChange={e => setForm(p => ({ ...p, senha: e.target.value }))} required style={inputStyle} />
          </div>
          {erro && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '10px', fontSize: '13px', color: '#EF4444' }}>{erro}</div>}
          <button type="submit" disabled={loading} style={{ padding: '12px', background: '#FBBF24', color: '#090F1A', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '700', cursor: 'pointer' }}>
            {loading ? 'Entrando...' : 'Acessar painel'}
          </button>
        </form>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px', background: '#151D2C', border: '1px solid #1E2939',
  borderRadius: '8px', color: '#F1F5FA', fontSize: '14px', outline: 'none',
}
