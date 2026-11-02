'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Usuario {
  nome: string
  sobrenome: string
  email: string
  telefone: string
  username: string
  avatar_url?: string | null
}

export default function MinhaContaPage() {
  const router = useRouter()
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploadando, setUploadando] = useState(false)
  const [uploadMsg, setUploadMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

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

  async function handleAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadando(true)
    setUploadMsg('')

    const form = new FormData()
    form.append('avatar', file)

    const r = await fetch('/api/minha-conta/avatar', {
      method: 'POST',
      credentials: 'include',
      body: form,
    })

    const d = await r.json()
    if (r.ok) {
      setUsuario(prev => prev ? { ...prev, avatar_url: d.avatar_url } : prev)
      setUploadMsg('✓ Foto atualizada!')
      // Notifica o widget para recarregar mensagens com o novo avatar
      window.dispatchEvent(new CustomEvent('avatar-atualizado', { detail: { avatar_url: d.avatar_url } }))
    } else {
      setUploadMsg('✗ ' + (d.error || 'Erro ao enviar imagem.'))
    }

    setUploadando(false)
    // Limpa input para permitir reenviar o mesmo arquivo
    if (fileRef.current) fileRef.current.value = ''
  }

  async function removerAvatar() {
    if (!confirm('Remover foto de perfil?')) return
    setUploadando(true)
    await fetch('/api/minha-conta/avatar', { method: 'DELETE', credentials: 'include' })
    setUsuario(prev => prev ? { ...prev, avatar_url: null } : prev)
    setUploadMsg('✓ Foto removida.')
    // Notifica o widget para recarregar mensagens sem avatar
    window.dispatchEvent(new CustomEvent('avatar-atualizado', { detail: { avatar_url: null } }))
    setUploadando(false)
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#090F1A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#647489' }}>Carregando...</p>
      </div>
    )
  }

  const iniciais = `${usuario?.nome?.charAt(0) || ''}${usuario?.sobrenome?.charAt(0) || ''}`.toUpperCase()

  return (
    <div style={{ minHeight: '100vh', background: '#090F1A', color: '#F1F5FA', padding: '80px 24px 40px', fontFamily: 'Inter, sans-serif' }}>
      {/* Nav */}
      <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, background: 'rgba(9,15,26,0.9)', backdropFilter: 'blur(16px)', borderBottom: '1px solid #1E2939', height: '64px', display: 'flex', alignItems: 'center', padding: '0 24px', justifyContent: 'space-between' }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none', color: '#F1F5FA', fontWeight: '700' }}>
          <div style={{ width: '30px', height: '30px', borderRadius: '6px', overflow: 'hidden', flexShrink: 0 }}>
            <img src="/assets/logomarca.png" alt="SumblerControl" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          SumblerControl
        </Link>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Link href="/minhas-compras" style={{ padding: '6px 14px', background: 'transparent', border: '1px solid #243044', borderRadius: '6px', color: '#647489', fontSize: '13px', textDecoration: 'none' }}>
            📦 Minhas Compras
          </Link>
          <Link href="/notificacoes" style={{ padding: '6px 14px', background: 'transparent', border: '1px solid #243044', borderRadius: '6px', color: '#647489', fontSize: '13px', textDecoration: 'none' }}>
            🔔 Suporte
          </Link>
          <button onClick={logout} style={{ padding: '6px 14px', background: 'transparent', border: '1px solid #243044', borderRadius: '6px', color: '#647489', fontSize: '13px', cursor: 'pointer' }}>
            Sair
          </button>
        </div>
      </nav>

      <div style={{ maxWidth: '720px', margin: '0 auto' }}>
        {/* Header com avatar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px', marginBottom: '32px' }}>
          {/* Avatar */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            {usuario?.avatar_url ? (
              <img
                src={usuario.avatar_url}
                alt="Avatar"
                style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', border: '3px solid rgba(59,130,246,0.4)' }}
              />
            ) : (
              <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'linear-gradient(135deg, #3B82F6, #818CF8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', fontWeight: '800', color: '#fff', border: '3px solid rgba(59,130,246,0.4)' }}>
                {iniciais}
              </div>
            )}
          </div>

          {/* Nome + ações de avatar */}
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: '22px', fontWeight: '800', marginBottom: '4px' }}>
              {usuario?.nome} {usuario?.sobrenome}
            </h1>
            <p style={{ color: '#647489', fontSize: '13px', marginBottom: '12px' }}>{usuario?.email}</p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handleAvatar}
                style={{ display: 'none' }}
                id="avatar-input"
              />
              <label
                htmlFor="avatar-input"
                style={{ padding: '6px 14px', background: '#3B82F6', borderRadius: '7px', color: '#fff', fontSize: '12px', fontWeight: '600', cursor: uploadando ? 'not-allowed' : 'pointer', opacity: uploadando ? 0.6 : 1 }}>
                {uploadando ? 'Enviando...' : '📷 Alterar foto'}
              </label>
              {usuario?.avatar_url && (
                <button
                  onClick={removerAvatar}
                  disabled={uploadando}
                  style={{ padding: '6px 14px', background: 'transparent', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '7px', color: '#EF4444', fontSize: '12px', cursor: 'pointer' }}>
                  Remover foto
                </button>
              )}
              {uploadMsg && (
                <span style={{ fontSize: '12px', color: uploadMsg.startsWith('✓') ? '#22C55E' : '#EF4444' }}>
                  {uploadMsg}
                </span>
              )}
            </div>
          </div>
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
                <p style={{ fontSize: '14px', margin: 0 }}>{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
