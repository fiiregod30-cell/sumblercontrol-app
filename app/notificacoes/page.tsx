'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import NavBar from '@/components/NavBar'

interface Notificacao {
  id: string
  ticket_id: string | null
  tipo: 'ticket_resposta' | 'ticket_resolvido' | 'ticket_reaberto'
  titulo: string
  lida: boolean
  criado_em: string
}

const TIPO_ICONE: Record<string, string> = {
  ticket_resposta: '💬',
  ticket_resolvido: '✅',
  ticket_reaberto: '🔄',
}

function tempoRelativo(data: string) {
  const diff = Date.now() - new Date(data).getTime()
  const min = Math.floor(diff / 60_000)
  const h = Math.floor(diff / 3_600_000)
  const d = Math.floor(diff / 86_400_000)
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min} min`
  if (h < 24) return `há ${h}h`
  if (d === 1) return 'ontem'
  return `há ${d} dias`
}

export default function NotificacoesPage() {
  const router = useRouter()
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([])
  const [loading, setLoading] = useState(true)
  const [removendo, setRemovendoIds] = useState<Set<string>>(new Set())
  const [limpando, setLimpando] = useState(false)

  const carregar = useCallback(async () => {
    try {
      const r = await fetch('/api/notificacoes', { credentials: 'include' })
      if (r.status === 401) { router.push('/login'); return }
      const d = await r.json()
      setNotificacoes(d.notificacoes || [])
    } catch {}
    setLoading(false)
  }, [router])

  useEffect(() => {
    // Verifica auth
    fetch('/api/auth/me', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (!d.logado) router.push('/login') })
      .catch(() => router.push('/login'))
    carregar()
  }, [carregar, router])

  // Marca todas como lidas ao entrar na página
  useEffect(() => {
    fetch('/api/notificacoes', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({}),
    }).catch(() => {})
  }, [])

  async function remover(id: string) {
    setRemovendoIds(prev => new Set(prev).add(id))
    await fetch('/api/notificacoes', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ ids: [id] }),
    })
    setNotificacoes(prev => prev.filter(n => n.id !== id))
    setRemovendoIds(prev => { const s = new Set(prev); s.delete(id); return s })
  }

  async function limparTodas() {
    if (!confirm('Remover todas as notificações?')) return
    setLimpando(true)
    await fetch('/api/notificacoes', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({}),
    })
    setNotificacoes([])
    setLimpando(false)
  }

  const naoLidas = notificacoes.filter(n => !n.lida)
  const lidas = notificacoes.filter(n => n.lida)

  return (
    <div style={{ minHeight: '100vh', background: '#090F1A', color: '#F1F5FA', fontFamily: 'Inter, sans-serif' }}>
      <NavBar />

      <div style={{ maxWidth: '680px', margin: '0 auto', padding: '96px 24px 48px' }}>
        {/* Cabeçalho */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: '800', margin: 0 }}>🔔 Notificações</h1>
            {notificacoes.length > 0 && (
              <p style={{ color: '#647489', fontSize: '13px', marginTop: '4px' }}>
                {naoLidas.length > 0 ? `${naoLidas.length} não lida${naoLidas.length > 1 ? 's' : ''}` : 'Todas lidas'}
              </p>
            )}
          </div>
          {notificacoes.length > 0 && (
            <button
              onClick={limparTodas}
              disabled={limpando}
              style={{ padding: '8px 16px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '8px', color: '#EF4444', fontSize: '13px', fontWeight: '600', cursor: limpando ? 'not-allowed' : 'pointer' }}>
              {limpando ? 'Limpando...' : '🗑 Limpar notificações'}
            </button>
          )}
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '64px', color: '#647489' }}>
            Carregando...
          </div>
        )}

        {/* Estado vazio */}
        {!loading && notificacoes.length === 0 && (
          <div style={{ textAlign: 'center', padding: '80px 24px' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔔</div>
            <h2 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>Nenhuma notificação</h2>
            <p style={{ color: '#647489', fontSize: '14px', marginBottom: '24px' }}>
              Quando a equipe de suporte responder seu ticket, você verá aqui.
            </p>
            <Link href="/" style={{ padding: '10px 20px', background: '#3B82F6', borderRadius: '8px', color: '#fff', textDecoration: 'none', fontSize: '14px', fontWeight: '600' }}>
              Voltar ao início
            </Link>
          </div>
        )}

        {/* Não lidas */}
        {naoLidas.length > 0 && (
          <div style={{ marginBottom: '32px' }}>
            <p style={{ fontSize: '11px', fontWeight: '700', color: '#3B82F6', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>
              Não lidas
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {naoLidas.map(n => (
                <NotifCard
                  key={n.id}
                  n={n}
                  removendo={removendo.has(n.id)}
                  onRemover={() => remover(n.id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Lidas */}
        {lidas.length > 0 && (
          <div>
            {naoLidas.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <div style={{ flex: 1, height: '1px', background: '#1E2939' }} />
                <span style={{ fontSize: '11px', color: '#3D4F63', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>Anteriores</span>
                <div style={{ flex: 1, height: '1px', background: '#1E2939' }} />
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {lidas.map(n => (
                <NotifCard
                  key={n.id}
                  n={n}
                  removendo={removendo.has(n.id)}
                  onRemover={() => remover(n.id)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Card de notificação ──────────────────────────────────────────────────────

function NotifCard({ n, removendo, onRemover }: {
  n: Notificacao
  removendo: boolean
  onRemover: () => void
}) {
  const router = useRouter()

  function abrir() {
    if (n.ticket_id) router.push(`/notificacoes/${n.ticket_id}`)
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '14px 16px',
        background: n.lida ? '#111826' : 'rgba(59,130,246,0.06)',
        border: `1px solid ${n.lida ? '#1E2939' : 'rgba(59,130,246,0.2)'}`,
        borderRadius: '12px',
        opacity: removendo ? 0.4 : 1,
        transition: 'opacity 0.2s',
      }}>
      {/* Bolinha de não lida */}
      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: n.lida ? 'transparent' : '#3B82F6', flexShrink: 0, boxShadow: n.lida ? 'none' : '0 0 6px rgba(59,130,246,0.6)' }} />

      {/* Ícone */}
      <span style={{ fontSize: '20px', flexShrink: 0 }}>{TIPO_ICONE[n.tipo] || '🔔'}</span>

      {/* Texto — clicável */}
      <button
        onClick={abrir}
        disabled={!n.ticket_id}
        style={{ flex: 1, background: 'none', border: 'none', cursor: n.ticket_id ? 'pointer' : 'default', textAlign: 'left', padding: 0 }}>
        <p style={{ fontSize: '14px', fontWeight: n.lida ? '400' : '600', color: '#F1F5FA', margin: '0 0 3px' }}>
          {n.titulo}
        </p>
        <p style={{ fontSize: '12px', color: '#647489', margin: 0 }}>
          {tempoRelativo(n.criado_em)}
          {n.ticket_id && <span style={{ color: '#3B82F6', marginLeft: '8px' }}>Ver conversa →</span>}
        </p>
      </button>

      {/* Botão remover */}
      <button
        onClick={e => { e.stopPropagation(); onRemover() }}
        disabled={removendo}
        title="Remover notificação"
        style={{ background: 'none', border: 'none', color: '#3D4F63', cursor: 'pointer', fontSize: '18px', lineHeight: 1, padding: '4px 6px', borderRadius: '6px', flexShrink: 0, transition: 'color 0.15s' }}
        onMouseEnter={e => (e.currentTarget.style.color = '#EF4444')}
        onMouseLeave={e => (e.currentTarget.style.color = '#3D4F63')}>
        ×
      </button>
    </div>
  )
}
