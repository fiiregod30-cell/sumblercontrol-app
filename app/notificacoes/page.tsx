'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import NavBar from '@/components/NavBar'

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Ticket {
  id: string
  assunto: string
  status: 'aberto' | 'em_andamento' | 'resolvido'
  criado_em: string
  respondido_em: string | null
  encerrado_por: string | null
  ultima_mensagem: { remetente: string; mensagem: string; criado_em: string } | null
  mensagens_nao_lidas: number
}

interface Notificacao {
  id: string
  ticket_id: string | null
  tipo: 'ticket_resposta' | 'ticket_resolvido' | 'ticket_reaberto'
  titulo: string
  lida: boolean
  criado_em: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  aberto: '#EF4444',
  em_andamento: '#FBBF24',
  resolvido: '#22C55E',
}
const STATUS_BG: Record<string, string> = {
  aberto: 'rgba(239,68,68,0.1)',
  em_andamento: 'rgba(251,191,36,0.1)',
  resolvido: 'rgba(34,197,94,0.1)',
}
const STATUS_LABEL: Record<string, string> = {
  aberto: 'Aberto',
  em_andamento: 'Em andamento',
  resolvido: 'Resolvido',
}
const STATUS_ICONE: Record<string, string> = {
  aberto: '🔴',
  em_andamento: '🟡',
  resolvido: '🟢',
}
const NOTIF_ICONE: Record<string, string> = {
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

type FiltroTicket = 'todos' | 'aberto' | 'em_andamento' | 'resolvido'
type AbaView = 'tickets' | 'notificacoes'

// ─── Página ───────────────────────────────────────────────────────────────────

export default function SuportePage() {
  const router = useRouter()

  const [aba, setAba] = useState<AbaView>('tickets')
  const [loading, setLoading] = useState(true)

  // Tickets
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [filtro, setFiltro] = useState<FiltroTicket>('todos')

  // Notificações
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([])
  const [totalNaoLidas, setTotalNaoLidas] = useState(0)
  const [removendoIds, setRemovendoIds] = useState<Set<string>>(new Set())
  const [limpando, setLimpando] = useState(false)

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Carga inicial ──────────────────────────────────────────────────────────

  const carregarTudo = useCallback(async (silencioso = false) => {
    try {
      const [ticketsRes, notifRes] = await Promise.all([
        fetch('/api/tickets/meus', { credentials: 'include' }),
        fetch('/api/notificacoes', { credentials: 'include' }),
      ])

      if (ticketsRes.status === 401 || notifRes.status === 401) {
        router.push('/login')
        return
      }

      const [ticketsData, notifData] = await Promise.all([
        ticketsRes.json(),
        notifRes.json(),
      ])

      setTickets(ticketsData.tickets || [])
      setNotificacoes(notifData.notificacoes || [])
      setTotalNaoLidas(notifData.total_nao_lidas || 0)
    } catch {}
    if (!silencioso) setLoading(false)
  }, [router])

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (!d.logado) router.push('/login') })
      .catch(() => router.push('/login'))

    carregarTudo()

    // Polling de 5s — atualiza tickets e notificações em tempo real
    pollingRef.current = setInterval(() => carregarTudo(true), 5_000)
    return () => { if (pollingRef.current) clearInterval(pollingRef.current) }
  }, [carregarTudo, router])

  // Marca notificações como lidas ao entrar na página
  useEffect(() => {
    fetch('/api/notificacoes', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({}),
    }).catch(() => {})
  }, [])

  // ── Ações de notificação ───────────────────────────────────────────────────

  async function removerNotif(id: string) {
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

  async function limparNotifs() {
    if (!confirm('Remover todas as notificações?')) return
    setLimpando(true)
    await fetch('/api/notificacoes', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({}),
    })
    setNotificacoes([])
    setTotalNaoLidas(0)
    setLimpando(false)
  }

  // ── Tickets filtrados ──────────────────────────────────────────────────────

  const ticketsFiltrados = filtro === 'todos'
    ? tickets
    : tickets.filter(t => t.status === filtro)

  const contagem = {
    todos: tickets.length,
    aberto: tickets.filter(t => t.status === 'aberto').length,
    em_andamento: tickets.filter(t => t.status === 'em_andamento').length,
    resolvido: tickets.filter(t => t.status === 'resolvido').length,
  }

  const naoLidas = notificacoes.filter(n => !n.lida)
  const lidas = notificacoes.filter(n => n.lida)
  const ticketsComNovaMensagem = tickets.filter(t => t.mensagens_nao_lidas > 0).length

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100vh', background: '#090F1A', color: '#F1F5FA', fontFamily: 'Inter, sans-serif' }}>
      <NavBar />

      <div style={{ maxWidth: '760px', margin: '0 auto', padding: '96px 24px 64px' }}>

        {/* Cabeçalho */}
        <div style={{ marginBottom: '28px' }}>
          <h1 style={{ fontSize: '26px', fontWeight: '900', margin: '0 0 6px' }}>Central de Suporte</h1>
          <p style={{ color: '#647489', fontSize: '14px', margin: 0 }}>
            Acompanhe seus tickets e notificações em um só lugar.
          </p>
        </div>

        {/* Abas principais */}
        <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid #1E2939', marginBottom: '28px' }}>
          {([
            { id: 'notificacoes' as AbaView, label: '🔔 Notificações', badge: totalNaoLidas },
            { id: 'tickets' as AbaView, label: '🎫 Meus Tickets', badge: ticketsComNovaMensagem },
          ]).map(item => (
            <button
              key={item.id}
              onClick={() => setAba(item.id)}
              style={{
                padding: '10px 18px',
                background: 'none',
                border: 'none',
                borderBottom: aba === item.id ? '2px solid #3B82F6' : '2px solid transparent',
                color: aba === item.id ? '#F1F5FA' : '#647489',
                fontSize: '14px',
                fontWeight: aba === item.id ? '700' : '500',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '-1px',
              }}>
              {item.label}
              {item.badge > 0 && (
                <span style={{ background: '#EF4444', color: '#fff', borderRadius: '999px', padding: '1px 7px', fontSize: '11px', fontWeight: '800' }}>
                  {item.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {loading && (
          <div style={{ textAlign: 'center', padding: '64px', color: '#647489' }}>Carregando...</div>
        )}

        {/* ── ABA: MEUS TICKETS ── */}
        {!loading && aba === 'tickets' && (
          <div>
            {/* Barra de filtros + botão novo ticket */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
              {(['todos', 'aberto', 'em_andamento', 'resolvido'] as FiltroTicket[]).map(f => (
                <button
                  key={f}
                  onClick={() => setFiltro(f)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '999px',
                    border: filtro === f
                      ? `1px solid ${f === 'todos' ? '#3B82F6' : STATUS_COLOR[f]}`
                      : '1px solid #1E2939',
                    background: filtro === f
                      ? (f === 'todos' ? 'rgba(59,130,246,0.12)' : STATUS_BG[f])
                      : 'transparent',
                    color: filtro === f
                      ? (f === 'todos' ? '#3B82F6' : STATUS_COLOR[f])
                      : '#647489',
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}>
                  {f === 'todos' ? 'Todos' : STATUS_LABEL[f]}
                  <span style={{ marginLeft: '5px', opacity: 0.7 }}>({contagem[f]})</span>
                </button>
              ))}
              <Link
                href="/"
                style={{ marginLeft: 'auto', padding: '6px 16px', background: '#3B82F6', borderRadius: '999px', color: '#fff', fontSize: '12px', fontWeight: '700', textDecoration: 'none' }}>
                + Novo ticket
              </Link>
            </div>

            {/* Lista de tickets */}
            {ticketsFiltrados.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '64px 24px' }}>
                <div style={{ fontSize: '40px', marginBottom: '14px' }}>
                  {filtro === 'todos' ? '🎫' : STATUS_ICONE[filtro]}
                </div>
                <p style={{ fontSize: '16px', fontWeight: '700', marginBottom: '8px' }}>
                  {filtro === 'todos' ? 'Nenhum ticket ainda' : `Nenhum ticket ${STATUS_LABEL[filtro].toLowerCase()}`}
                </p>
                <p style={{ color: '#647489', fontSize: '14px', marginBottom: '20px' }}>
                  {filtro === 'todos'
                    ? 'Abra um ticket pelo widget de suporte no canto inferior direito.'
                    : 'Tente outro filtro.'}
                </p>
                {filtro !== 'todos' && (
                  <button
                    onClick={() => setFiltro('todos')}
                    style={{ padding: '8px 18px', background: 'transparent', border: '1px solid #243044', borderRadius: '8px', color: '#647489', fontSize: '13px', cursor: 'pointer' }}>
                    Ver todos
                  </button>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {ticketsFiltrados.map(t => (
                  <TicketCard key={t.id} ticket={t} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── ABA: NOTIFICAÇÕES ── */}
        {!loading && aba === 'notificacoes' && (
          <div>
            {notificacoes.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
                <button
                  onClick={limparNotifs}
                  disabled={limpando}
                  style={{ padding: '7px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '8px', color: '#EF4444', fontSize: '13px', fontWeight: '600', cursor: limpando ? 'not-allowed' : 'pointer' }}>
                  {limpando ? 'Limpando...' : '🗑 Limpar notificações'}
                </button>
              </div>
            )}

            {notificacoes.length === 0 && (
              <div style={{ textAlign: 'center', padding: '64px 24px' }}>
                <div style={{ fontSize: '40px', marginBottom: '14px' }}>🔔</div>
                <p style={{ fontSize: '16px', fontWeight: '700', marginBottom: '8px' }}>Nenhuma notificação</p>
                <p style={{ color: '#647489', fontSize: '14px' }}>
                  Quando respondermos seu ticket, você verá aqui.
                </p>
              </div>
            )}

            {/* Não lidas */}
            {naoLidas.length > 0 && (
              <div style={{ marginBottom: '24px' }}>
                <p style={{ fontSize: '11px', fontWeight: '700', color: '#3B82F6', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>
                  Não lidas
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {naoLidas.map(n => (
                    <NotifCard key={n.id} n={n} removendo={removendoIds.has(n.id)} onRemover={() => removerNotif(n.id)} />
                  ))}
                </div>
              </div>
            )}

            {/* Lidas */}
            {lidas.length > 0 && (
              <div>
                {naoLidas.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '8px 0 16px' }}>
                    <div style={{ flex: 1, height: '1px', background: '#1E2939' }} />
                    <span style={{ fontSize: '11px', color: '#3D4F63', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>Anteriores</span>
                    <div style={{ flex: 1, height: '1px', background: '#1E2939' }} />
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {lidas.map(n => (
                    <NotifCard key={n.id} n={n} removendo={removendoIds.has(n.id)} onRemover={() => removerNotif(n.id)} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Card de Ticket ───────────────────────────────────────────────────────────

function TicketCard({ ticket: t }: { ticket: Ticket }) {
  const router = useRouter()

  return (
    <button
      onClick={() => router.push(`/notificacoes/${t.id}`)}
      style={{
        width: '100%',
        background: t.mensagens_nao_lidas > 0 ? 'rgba(59,130,246,0.05)' : '#111826',
        border: `1px solid ${t.mensagens_nao_lidas > 0 ? 'rgba(59,130,246,0.25)' : '#1E2939'}`,
        borderRadius: '12px',
        padding: '16px 18px',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'all 0.15s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'rgba(59,130,246,0.4)'
        e.currentTarget.style.background = 'rgba(59,130,246,0.07)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = t.mensagens_nao_lidas > 0 ? 'rgba(59,130,246,0.25)' : '#1E2939'
        e.currentTarget.style.background = t.mensagens_nao_lidas > 0 ? 'rgba(59,130,246,0.05)' : '#111826'
      }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
        {/* Esquerda */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '14px', fontWeight: t.mensagens_nao_lidas > 0 ? '700' : '600', color: '#F1F5FA' }}>
              {t.assunto}
            </span>
            <span style={{ padding: '2px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: '600', background: STATUS_BG[t.status], color: STATUS_COLOR[t.status] }}>
              {STATUS_ICONE[t.status]} {STATUS_LABEL[t.status]}
            </span>
          </div>

          <p style={{ fontSize: '13px', color: '#647489', margin: '0 0 6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '500px' }}>
            {t.ultima_mensagem ? (
              <>
                <span style={{ color: t.ultima_mensagem.remetente === 'admin' ? '#3B82F6' : '#94A3B8', fontWeight: '500' }}>
                  {t.ultima_mensagem.remetente === 'admin' ? '🛡 Suporte: ' : 'Você: '}
                </span>
                {t.ultima_mensagem.mensagem}
              </>
            ) : (
              <span style={{ fontStyle: 'italic' }}>Sem mensagens ainda</span>
            )}
          </p>

          <span style={{ fontSize: '11px', color: '#3D4F63' }}>
            Aberto em {new Date(t.criado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
            {t.respondido_em && <> · Última resposta {tempoRelativo(t.respondido_em)}</>}
          </span>
        </div>

        {/* Direita */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px', flexShrink: 0 }}>
          {t.mensagens_nao_lidas > 0 && (
            <span style={{ background: '#EF4444', color: '#fff', borderRadius: '999px', padding: '2px 8px', fontSize: '11px', fontWeight: '800' }}>
              {t.mensagens_nao_lidas} nova{t.mensagens_nao_lidas > 1 ? 's' : ''}
            </span>
          )}
          <span style={{ fontSize: '18px', color: '#3B82F6' }}>→</span>
        </div>
      </div>
    </button>
  )
}

// ─── Card de Notificação ──────────────────────────────────────────────────────

function NotifCard({ n, removendo, onRemover }: {
  n: Notificacao
  removendo: boolean
  onRemover: () => void
}) {
  const router = useRouter()

  return (
    <div style={{
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
      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: n.lida ? 'transparent' : '#3B82F6', flexShrink: 0, boxShadow: n.lida ? 'none' : '0 0 6px rgba(59,130,246,0.6)' }} />
      <span style={{ fontSize: '20px', flexShrink: 0 }}>{NOTIF_ICONE[n.tipo] || '🔔'}</span>
      <button
        onClick={() => { if (n.ticket_id) router.push(`/notificacoes/${n.ticket_id}`) }}
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
      <button
        onClick={e => { e.stopPropagation(); onRemover() }}
        disabled={removendo}
        title="Remover"
        style={{ background: 'none', border: 'none', color: '#3D4F63', cursor: 'pointer', fontSize: '18px', lineHeight: 1, padding: '4px 6px', borderRadius: '6px', flexShrink: 0 }}
        onMouseEnter={e => (e.currentTarget.style.color = '#EF4444')}
        onMouseLeave={e => (e.currentTarget.style.color = '#3D4F63')}>
        ×
      </button>
    </div>
  )
}
