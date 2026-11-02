'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface UserData {
  logado: boolean
  nome?: string
  sobrenome?: string
  email?: string
  nomeCompleto?: string
}

export default function NavBar() {
  const router = useRouter()
  const [user, setUser] = useState<UserData>({ logado: false })
  const [dropdown, setDropdown] = useState(false)
  const [banner, setBanner] = useState(false)
  const [totalNaoLidas, setTotalNaoLidas] = useState(0)
  const dropRef = useRef<HTMLDivElement>(null)
  const notifIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        setUser(d)
        if (d.logado) {
          const jaViu = sessionStorage.getItem('banner_visto')
          if (!jaViu) setBanner(true)
          // Inicia polling de notificações
          pollarNotificacoes()
          notifIntervalRef.current = setInterval(pollarNotificacoes, 10_000)
        }
      })
      .catch(() => {})
    return () => { if (notifIntervalRef.current) clearInterval(notifIntervalRef.current) }
  }, [])

  async function pollarNotificacoes() {
    try {
      const r = await fetch('/api/notificacoes', { credentials: 'include' })
      if (!r.ok) return
      const d = await r.json()
      setTotalNaoLidas(d.total_nao_lidas || 0)
    } catch {}
  }

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node))
        setDropdown(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function fecharBanner() {
    setBanner(false)
    sessionStorage.setItem('banner_visto', '1')
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    setUser({ logado: false })
    setDropdown(false)
    router.push('/')
    router.refresh()
  }

  return (
    <>
      {/* Banner de boas-vindas */}
      {banner && user.logado && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 200, background: 'linear-gradient(90deg, rgba(59,130,246,0.15), rgba(129,140,248,0.15))', borderBottom: '1px solid rgba(59,130,246,0.2)', padding: '10px 24px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
          <span style={{ fontSize: '14px' }}>✨ Bem-vindo de volta, <strong>{user.nomeCompleto}</strong>!</span>
          <Link href="/minhas-compras" style={{ padding: '4px 12px', background: 'rgba(59,130,246,0.2)', border: '1px solid rgba(59,130,246,0.4)', borderRadius: '999px', color: '#3B82F6', fontSize: '12px', fontWeight: '600', textDecoration: 'none' }}>
            📦 Minhas Compras
          </Link>
          <button onClick={fecharBanner} style={{ background: 'none', border: 'none', color: '#647489', cursor: 'pointer', fontSize: '16px', lineHeight: 1, padding: '0 4px' }}>×</button>
        </div>
      )}

      {/* Nav */}
      <nav style={{ position: 'fixed', top: banner && user.logado ? '41px' : '0', left: 0, right: 0, zIndex: 100, background: 'rgba(9,15,26,0.9)', backdropFilter: 'blur(16px)', borderBottom: '1px solid #1E2939', transition: 'top 0.2s' }}>
        <div style={{ maxWidth: '1160px', margin: '0 auto', padding: '0 24px', height: '64px', display: 'flex', alignItems: 'center', gap: '24px' }}>
          {/* Logo */}
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none', color: '#F1F5FA', fontWeight: '800', fontSize: '17px', flex: 1 }}>
            <div style={{ width: '34px', height: '34px', borderRadius: '8px', overflow: 'hidden', flexShrink: 0 }}>
              <img src="/assets/logomarca.png" alt="SumblerControl" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            SumblerControl
          </Link>

          {/* Links */}
          <div style={{ display: 'flex', gap: '4px' }}>
            {[['#features', 'Recursos'], ['#preco', 'Planos'], ['#faq', 'FAQ']].map(([href, label]) => (
              <a key={href} href={href} style={{ padding: '6px 14px', borderRadius: '6px', textDecoration: 'none', color: '#647489', fontSize: '14px', fontWeight: '500' }}>{label}</a>
            ))}
          </div>

          {/* Auth */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
            {user.logado ? (
              <div ref={dropRef} style={{ position: 'relative' }}>
                {/* Avatar button */}
                <button
                  onClick={() => setDropdown(!dropdown)}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: '8px', color: '#F1F5FA', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>
                  <div style={{ width: '26px', height: '26px', background: '#3B82F6', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '800', color: '#fff', flexShrink: 0 }}>
                    {user.nome?.charAt(0).toUpperCase()}
                  </div>
                  {user.nome} {user.sobrenome}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ transform: dropdown ? 'rotate(180deg)' : 'none', transition: '0.2s' }}><path d="M6 9L12 15L18 9" stroke="#647489" strokeWidth="2" strokeLinecap="round"/></svg>
                </button>

                {/* Dropdown */}
                {dropdown && (
                  <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, minWidth: '220px', background: '#111826', border: '1px solid #1E2939', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 16px 48px rgba(0,0,0,0.5)', zIndex: 200 }}>
                    {/* Header */}
                    <div style={{ padding: '14px 16px', borderBottom: '1px solid #1E2939' }}>
                      <p style={{ fontWeight: '700', fontSize: '14px', marginBottom: '2px' }}>{user.nomeCompleto}</p>
                      <p style={{ color: '#647489', fontSize: '12px' }}>{user.email}</p>
                    </div>
                    {/* Links */}
                    <div style={{ padding: '6px' }}>
                      <Link href="/minha-conta" onClick={() => setDropdown(false)} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '8px', textDecoration: 'none', color: '#F1F5FA', fontSize: '14px', transition: 'background 0.15s' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#151D2C')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        👤 Minha Conta
                      </Link>
                      <Link href="/minhas-compras" onClick={() => setDropdown(false)} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '8px', textDecoration: 'none', color: '#F1F5FA', fontSize: '14px' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#151D2C')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        📦 Minhas Compras
                      </Link>
                      <Link href="/notificacoes" onClick={() => setDropdown(false)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: '8px', textDecoration: 'none', color: '#F1F5FA', fontSize: '14px' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#151D2C')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          🔔 Notificações
                        </span>
                        {totalNaoLidas > 0 && (
                          <span style={{ background: '#EF4444', color: '#fff', borderRadius: '999px', padding: '1px 7px', fontSize: '11px', fontWeight: '800' }}>
                            {totalNaoLidas}
                          </span>
                        )}
                      </Link>
                    </div>
                    <div style={{ borderTop: '1px solid #1E2939', padding: '6px' }}>
                      <button onClick={logout} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '8px', background: 'none', border: 'none', color: '#EF4444', fontSize: '14px', cursor: 'pointer', textAlign: 'left' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.08)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        🚪 Sair
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Link href="/login" style={{ padding: '8px 16px', background: 'transparent', border: '1px solid #243044', borderRadius: '8px', textDecoration: 'none', color: '#F1F5FA', fontSize: '14px', fontWeight: '500' }}>
                Entrar
              </Link>
            )}
            <a href="#preco" style={{ padding: '8px 18px', background: '#3B82F6', color: '#fff', borderRadius: '8px', textDecoration: 'none', fontSize: '14px', fontWeight: '600' }}>
              Ver Planos
            </a>
          </div>
        </div>
      </nav>
    </>
  )
}
