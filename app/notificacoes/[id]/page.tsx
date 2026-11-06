'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import NavBar from '@/components/NavBar'

interface TicketInfo {
  id: string
  assunto: string
  mensagem_original: string
  status: 'aberto' | 'em_andamento' | 'resolvido'
  encerrado_por: string | null
  criado_em: string
  nome: string
  email: string
}

interface Mensagem {
  id: string
  remetente: 'usuario' | 'admin'
  mensagem: string
  lida: boolean
  criado_em: string
}

const STATUS_COLOR: Record<string, string> = {
  aberto: '#EF4444',
  em_andamento: '#FBBF24',
  resolvido: '#22C55E',
}

const STATUS_LABEL: Record<string, string> = {
  aberto: 'Aberto',
  em_andamento: 'Em andamento',
  resolvido: 'Resolvido',
}

export default function TicketChatPage() {
  const router = useRouter()
  const params = useParams()
  const ticketId = params.id as string

  const [ticket, setTicket] = useState<TicketInfo | null>(null)
  const [mensagens, setMensagens] = useState<Mensagem[]>([])
  const [loading, setLoading] = useState(true)
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  const [confirmandoFechar, setConfirmandoFechar] = useState(false)
  const [fechando, setFechando] = useState(false)

  const endRef = useRef<HTMLDivElement>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const carregar = useCallback(async (silencioso = false) => {
    try {
      const r = await fetch(`/api/tickets/${ticketId}/mensagens`, { credentials: 'include' })
      if (r.status === 401) { router.push('/login'); return }
      if (r.status === 403 || r.status === 404) { router.push('/notificacoes'); return }
      const d = await r.json()
      setTicket(d.ticket)
      setMensagens(d.mensagens || [])
      if (!silencioso) setLoading(false)
    } catch {
      if (!silencioso) setLoading(false)
    }
  }, [ticketId, router])

  useEffect(() => {
    const initialLoad = window.setTimeout(() => { void carregar() }, 0)
    pollingRef.current = setInterval(() => carregar(true), 5000)
    return () => {
      window.clearTimeout(initialLoad)
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
  }, [carregar])

  // Scroll automático para última mensagem
  useEffect(() => {
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 60)
  }, [mensagens])

  async function enviar() {
    if (!texto.trim() || enviando) return
    setEnviando(true)
    setErro('')
    const msg = texto.trim()
    setTexto('')

    try {
      const r = await fetch(`/api/tickets/${ticketId}/mensagens`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ mensagem: msg }),
      })
      const d = await r.json()
      if (!r.ok) {
        setErro(d.error || 'Erro ao enviar.')
        setTexto(msg)
        setEnviando(false)
        return
      }
      await carregar(true)
    } catch {
      setErro('Erro de conexão. Tente novamente.')
      setTexto(msg)
    }

    setEnviando(false)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  async function fecharTicket() {
    setFechando(true)
    try {
      const r = await fetch(`/api/tickets/${ticketId}/fechar`, {
        method: 'POST',
        credentials: 'include',
      })
      if (r.ok) {
        setConfirmandoFechar(false)
        await carregar(true)
      }
    } catch {}
    setFechando(false)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      enviar()
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#090F1A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <NavBar />
        <p style={{ color: '#647489' }}>Carregando...</p>
      </div>
    )
  }

  if (!ticket) return null

  const resolvido = ticket.status === 'resolvido'

  return (
    <div style={{ minHeight: '100vh', background: '#090F1A', color: '#F1F5FA', fontFamily: 'Inter, sans-serif', display: 'flex', flexDirection: 'column' }}>
      <NavBar />

      {/* Container principal — altura total menos nav */}
      <div style={{ flex: 1, maxWidth: '760px', width: '100%', margin: '0 auto', padding: '84px 16px 0', display: 'flex', flexDirection: 'column', height: '100vh' }}>

        {/* Cabeçalho do ticket */}
        <div style={{ background: '#111826', border: '1px solid #1E2939', borderRadius: '12px 12px 0 0', padding: '16px 20px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
            <Link href="/notificacoes" style={{ color: '#647489', textDecoration: 'none', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              ← Notificações
            </Link>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
            <div>
              <h1 style={{ fontSize: '17px', fontWeight: '800', margin: '0 0 4px' }}>{ticket.assunto}</h1>
              <p style={{ fontSize: '12px', color: '#647489', margin: 0 }}>
                Aberto em {new Date(ticket.criado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
              </p>
            </div>
            <span style={{ padding: '4px 12px', borderRadius: '999px', fontSize: '12px', fontWeight: '700', background: `${STATUS_COLOR[ticket.status]}18`, color: STATUS_COLOR[ticket.status], flexShrink: 0 }}>
              {STATUS_LABEL[ticket.status]}
            </span>
          </div>
        </div>

        {/* Área de mensagens — scroll interno */}
        <div style={{ flex: 1, background: '#0D1424', border: '1px solid #1E2939', borderTop: 'none', overflowY: 'auto', padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: '16px', minHeight: 0 }}>

          {mensagens.length === 0 && (
            <div style={{ textAlign: 'center', color: '#647489', fontSize: '14px', padding: '32px' }}>
              Nenhuma mensagem ainda.
            </div>
          )}

          {mensagens.map((m, i) => {
            const isAdmin = m.remetente === 'admin'
            const prevMsg = i > 0 ? mensagens[i - 1] : null
            const showDate = !prevMsg || new Date(m.criado_em).toDateString() !== new Date(prevMsg.criado_em).toDateString()

            return (
              <div key={m.id}>
                {/* Separador de data */}
                {showDate && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '8px 0 16px' }}>
                    <div style={{ flex: 1, height: '1px', background: '#1E2939' }} />
                    <span style={{ fontSize: '11px', color: '#3D4F63', fontWeight: '600' }}>
                      {new Date(m.criado_em).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })}
                    </span>
                    <div style={{ flex: 1, height: '1px', background: '#1E2939' }} />
                  </div>
                )}

                {/* Bolha */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: isAdmin ? 'flex-start' : 'flex-end', gap: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {isAdmin && (
                      <div style={{ width: '22px', height: '22px', background: 'rgba(59,130,246,0.2)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', flexShrink: 0 }}>
                        🛡
                      </div>
                    )}
                    <span style={{ fontSize: '11px', color: isAdmin ? '#3B82F6' : '#647489', fontWeight: isAdmin ? '600' : '400' }}>
                      {isAdmin ? 'Suporte SumblerControl' : 'Você'}
                    </span>
                    <span style={{ fontSize: '10px', color: '#3D4F63' }}>
                      {new Date(m.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <div style={{
                    maxWidth: '75%',
                    padding: '10px 14px',
                    borderRadius: isAdmin ? '4px 16px 16px 16px' : '16px 4px 16px 16px',
                    background: isAdmin ? 'rgba(59,130,246,0.1)' : '#1E2939',
                    border: isAdmin ? '1px solid rgba(59,130,246,0.2)' : '1px solid #243044',
                    color: '#F1F5FA',
                    fontSize: '14px',
                    lineHeight: 1.6,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}>
                    {m.mensagem}
                  </div>
                </div>
              </div>
            )
          })}

          <div ref={endRef} />
        </div>

        {/* Rodapé — input ou encerrado */}
        <div style={{ background: '#111826', border: '1px solid #1E2939', borderTop: 'none', borderRadius: '0 0 12px 12px', padding: '14px 16px', flexShrink: 0, marginBottom: '24px' }}>
          {resolvido ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '8px' }}>
              <p style={{ fontSize: '14px', color: '#22C55E', fontWeight: '600', margin: 0 }}>
                ✅ Ticket resolvido
                {ticket.encerrado_por === 'usuario' ? ' por você' : ' pela equipe de suporte'}
              </p>
              <Link href="/notificacoes" style={{ fontSize: '13px', color: '#647489', textDecoration: 'none' }}>
                ← Voltar para notificações
              </Link>
            </div>
          ) : confirmandoFechar ? (
            <div style={{ background: '#151D2C', border: '1px solid #243044', borderRadius: '10px', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <p style={{ fontSize: '14px', color: '#CBD5E1', margin: 0, textAlign: 'center' }}>
                Seu problema foi resolvido? Isso encerrará o ticket permanentemente.
              </p>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => setConfirmandoFechar(false)} style={{ flex: 1, padding: '9px', background: 'transparent', border: '1px solid #243044', borderRadius: '8px', color: '#647489', fontSize: '13px', cursor: 'pointer', fontWeight: '600' }}>
                  Não, continuar
                </button>
                <button onClick={fecharTicket} disabled={fechando} style={{ flex: 1, padding: '9px', background: '#22C55E', border: 'none', borderRadius: '8px', color: '#000', fontSize: '13px', fontWeight: '700', cursor: fechando ? 'not-allowed' : 'pointer' }}>
                  {fechando ? 'Encerrando...' : 'Sim, encerrar ticket'}
                </button>
              </div>
            </div>
          ) : (
            <>
              {erro && <p style={{ fontSize: '12px', color: '#EF4444', margin: '0 0 8px', textAlign: 'center' }}>{erro}</p>}
              <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
                <textarea
                  ref={inputRef}
                  value={texto}
                  onChange={e => setTexto(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Escreva sua mensagem... (Enter para enviar, Shift+Enter para nova linha)"
                  maxLength={2000}
                  rows={2}
                  style={{ flex: 1, padding: '10px 14px', background: '#0D1424', border: '1px solid #1E2939', borderRadius: '10px', color: '#F1F5FA', fontSize: '14px', resize: 'none', outline: 'none', lineHeight: 1.5, fontFamily: 'Inter, sans-serif' }}
                />
                <button
                  onClick={enviar}
                  disabled={enviando || !texto.trim()}
                  style={{ padding: '10px 18px', background: enviando || !texto.trim() ? '#1E2939' : '#3B82F6', border: 'none', borderRadius: '10px', color: '#fff', fontSize: '20px', cursor: enviando || !texto.trim() ? 'not-allowed' : 'pointer', flexShrink: 0, transition: 'background 0.15s', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {enviando ? '⏳' : '➤'}
                </button>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button
                  onClick={() => setConfirmandoFechar(true)}
                  style={{ background: 'none', border: 'none', color: '#647489', fontSize: '12px', cursor: 'pointer', padding: '2px 4px' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#22C55E')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#647489')}>
                  ✅ Problema resolvido? Encerrar ticket
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
