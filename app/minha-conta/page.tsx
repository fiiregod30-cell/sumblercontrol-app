'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Usuario {
  nome: string
  sobrenome: string
  email: string
  telefone: string
  username: string
}

export default function MinhaContaPage() {
  const router = useRouter()
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/minha-conta', { credentials: 'include' })
      .then(r => {
        if (r.status === 401) { router.push('/login'); return null }
        return r.json()
      })
      .then(d => {
        if (!d) return
        setUsuario(d.usuario)
      })
      .catch(() => router.push('/login'))
      .finally(() => setLoading(false))
  }, [router])

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/')
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#090F1A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#647489' }}>Carregando...</p>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#090F1A', color: '#F1F5FA', padding: '80px 24px 40px' }}>
      {/* Nav */}
      <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, background: 'rgba(9,15,26,0.9)', backdropFilter: 'blur(16px)', borderBottom: '1px solid #1E2939', height: '64px', display: 'flex', alignItems: 'center', padding: '0 24px', justifyContent: 'space-between' }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none', color: '#F1F5FA', fontWeight: '700' }}>
          <div style={{ width: '30px', height: '30px', background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="#3B82F6" strokeWidth="2"/><circle cx="12" cy="12" r="4" stroke="#3B82F6" strokeWidth="2"/></svg>
          </div>
          SumblerControl
        </Link>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Link href="/minhas-compras" style={{ padding: '6px 14px', background: 'transparent', border: '1px solid #243044', borderRadius: '6px', color: '#647489', fontSize: '13px', textDecoration: 'none' }}>
            📦 Minhas Compras
          </Link>
          <button onClick={logout} style={{ padding: '6px 14px', background: 'transparent', border: '1px solid #243044', borderRadius: '6px', color: '#647489', fontSize: '13px', cursor: 'pointer' }}>
            Sair
          </button>
        </div>
      </nav>

      <div style={{ maxWidth: '720px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: '800', marginBottom: '4px' }}>
            Olá, {usuario?.nome}!
          </h1>
          <p style={{ color: '#647489', fontSize: '14px' }}>{usuario?.email}</p>
        </div>

        {/* Dados da conta */}
        <div style={{ background: '#111826', border: '1px solid #1E2939', borderRadius: '12px', padding: '24px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '20px', color: '#647489' }}>Dados da conta</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            {[
              { label: 'Nome', value: `${usuario?.nome} ${usuario?.sobrenome}` },
              { label: 'Usuário', value: usuario?.username || '—' },
              { label: 'E-mail', value: usuario?.email },
              { label: 'Telefone', value: usuario?.telefone || '—' },
            ].map(item => (
              <div key={item.label}>
                <p style={{ fontSize: '12px', color: '#647489', marginBottom: '4px' }}>{item.label}</p>
                <p style={{ fontSize: '14px' }}>{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
