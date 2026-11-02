'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { usePathname } from 'next/navigation'

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface ChatMensagem {
  id: string
  nome: string
  mensagem: string
  criado_em: string
}

interface TicketForm {
  nome: string
  email: string
  assunto: string
  mensagem: string
}

interface MeuTicket {
  id: string
  assunto: string
  status: 'aberto' | 'em_andamento' | 'resolvido'
  criado_em: string
  encerrado_por: string | null
  ultima_mensagem: { remetente: string; mensagem: string; criado_em: string } | null
  mensagens_nao_lidas: number
}

interface TicketMensagem {
  id: string
  remetente: 'usuario' | 'admin'
  mensagem: string
  lida: boolean
  criado_em: string
}

interface TicketDetalhe {
  id: string
  assunto: string
  mensagem_original: string
  status: 'aberto' | 'em_andamento' | 'resolvido'
  encerrado_por: string | null
  criado_em: string
}

type ChatStatus = 'carregando' | 'visitante' | 'pendente' | 'expirado' | 'ativo'

// aba 'ticket' agora tem sub-views
type TicketView = 'lista' | 'novo' | 'conversa'

// ─── Constantes ───────────────────────────────────────────────────────────────

const ASSUNTOS = [
  'Problema técnico',
  'Pagamento',
  'Licença / Ativação',
  'Reset de HWID',
  'Reembolso',
  'Outro',
]

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

// ─── Componente ───────────────────────────────────────────────────────────────

export default function SupportWidget() {
  const pathname = usePathname()

  // Estado geral do widget
  const [aberto, setAberto] = useState(false)
  const [aba, setAba] = useState<'chat' | 'ticket'>('chat')
  const [discordUrl, setDiscordUrl] = useState('')
  const [chatStatus, setChatStatus] = useState<ChatStatus>('carregando')
  const [usuarioLogado, setUsuarioLogado] = useState(false)
  const [usuarioId, setUsuarioId] = useState<string | null>(null)

  // Notificações persistidas
  const [totalNaoLidas, setTotalNaoLidas] = useState(0)
  const notifPollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Chat público
  const [chatMensagens, setChatMensagens] = useState<ChatMensagem[]>([])
  const [chatTexto, setChatTexto] = useState('')
  const [chatEnviando, setChatEnviando] = useState(false)
  const [chatErro, setChatErro] = useState('')
  const chatEndRef = useRef<HTMLDivElement>(null)
  const chatPollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const chatMsgCountRef = useRef(0)

  // Aba ticket
  const [ticketView, setTicketView] = useState<TicketView>('lista')
  const [meusTickets, setMeusTickets] = useState<MeuTicket[]>([])
  const [ticketForm, setTicketForm] = useState<TicketForm>({ nome: '', email: '', assunto: ASSUNTOS[0], mensagem: '' })
  const [ticketEnviando, setTicketEnviando] = useState(false)
  const [ticketMsg, setTicketMsg] = useState('')

  // Conversa de ticket
  const [ticketAberto, setTicketAberto] = useState<TicketDetalhe | null>(null)
  const [conversaMensagens, setConversaMensagens] = useState<TicketMensagem[]>([])
  const [conversaTexto, setConversaTexto] = useState('')
  const [conversaEnviando, setConversaEnviando] = useState(false)
  const [conversaErro, setConversaErro] = useState('')
  const [confirmandoFechar, setConfirmandoFechar] = useState(false)
  const conversaEndRef = useRef<HTMLDivElement>(null)
  const conversaPollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Inicialização ────────────────────────────────────────────────────────────

  useEffect(() => {
    verificarStatus()
    fetch('/api/config-publica')
      .then(r => r.json())
      .then(d => { if (d.discordUrl) setDiscordUrl(d.discordUrl) })
      .catch(() => {})
  }, [])

  useEffect(() => { verificarStatus() }, [pathname])

  // Polling de notificações — sempre ativo para usuários logados (mesmo widget fechado)
  useEffect(() => {
    pollarNotificacoes()
    notifPollingRef.current = setInterval(pollarNotificacoes, 10_000)
    return () => { if (notifPollingRef.current) clearInterval(notifPollingRef.current) }
  }, [usuarioLogado])

  // Polling do chat público — só quando widget aberto na aba chat
  useEffect(() => {
    if (aberto && aba === 'chat') {
      carregarChatMensagens()
      chatPollingRef.current = setInterval(carregarChatMensagens, 5000)
    } else {
      if (chatPollingRef.current) clearInterval(chatPollingRef.current)
    }
    return () => { if (chatPollingRef.current) clearInterval(chatPollingRef.current) }
  }, [aberto, aba])

  // Polling da conversa de ticket — só quando em conversa aberta
  useEffect(() => {
    if (aberto && aba === 'ticket' && ticketView === 'conversa' && ticketAberto) {
      conversaPollingRef.current = setInterval(() => carregarConversa(ticketAberto.id), 5000)
    } else {
      if (conversaPollingRef.current) clearInterval(conversaPollingRef.current)
    }
    return () => { if (conversaPollingRef.current) clearInterval(conversaPollingRef.current) }
  }, [aberto, aba, ticketView, ticketAberto])

  // Scroll automático
  useEffect(() => {
    if (aberto && aba === 'chat')
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }, [chatMensagens, aberto, aba])

  useEffect(() => {
    if (aberto && aba === 'ticket' && ticketView === 'conversa')
      setTimeout(() => conversaEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }, [conversaMensagens, aberto, aba, ticketView])

  // ── Funções ──────────────────────────────────────────────────────────────────

  async function verificarStatus() {
    try {
      const meRes = await fetch('/api/auth/me', { credentials: 'include' })
      const d = await meRes.json()

      if (!d.logado) {
        setChatStatus('visitante')
        setUsuarioLogado(false)
        setUsuarioId(null)
        return
      }

      setUsuarioLogado(true)
      setTicketForm(f => ({ ...f, nome: d.nomeCompleto || '', email: d.email || '' }))

      // Busca o id do usuário
      const meIdRes = await fetch('/api/auth/me', { credentials: 'include' })
      const meIdData = await meIdRes.json()
      // O /api/auth/me não retorna id — buscamos via minha-conta
      const contaRes = await fetch('/api/minha-conta', { credentials: 'include' })
      const contaData = await contaRes.json()
      const pedidos = contaData?.pedidos ?? []

      const [licData] = await Promise.all([
        fetch('/api/minha-licenca', { credentials: 'include' }).then(r => r.json()),
      ])

      const licenca = licData.licenca
      const licencaAtiva = licenca?.ativa && new Date(licenca.expira_em) > new Date()
      const temPedidoPago = pedidos.some((p: { status: string }) => p.status === 'pago')
      const temPedidoPendente = pedidos.some((p: { status: string }) => p.status === 'pendente')

      if (licencaAtiva || temPedidoPago) { setChatStatus('ativo'); return }
      if (temPedidoPendente) { setChatStatus('pendente'); return }
      if (licenca && !licencaAtiva) { setChatStatus('expirado'); return }
      setChatStatus('visitante')
    } catch {
      setChatStatus('visitante')
    }
  }

  async function pollarNotificacoes() {
    if (!usuarioLogado) return
    try {
      const r = await fetch('/api/notificacoes', { credentials: 'include' })
      if (!r.ok) return
      const d = await r.json()
      setTotalNaoLidas(d.total_nao_lidas || 0)
    } catch {}
  }

  async function marcarNotificacoesLidas() {
    if (!usuarioLogado) return
    try {
      await fetch('/api/notificacoes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({}),
      })
      setTotalNaoLidas(0)
    } catch {}
  }

  // Chat público
  async function carregarChatMensagens() {
    try {
      const r = await fetch('/api/chat/mensagens')
      const d = await r.json()
      const novas = d.mensagens as ChatMensagem[]
      setChatMensagens(novas)
      chatMsgCountRef.current = novas.length
    } catch {}
  }

  async function enviarChatMensagem() {
    if (!chatTexto.trim() || chatEnviando) return
    setChatEnviando(true)
    setChatErro('')
    const texto = chatTexto.trim()
    setChatTexto('')

    try {
      const r = await fetch('/api/chat/mensagens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ mensagem: texto }),
      })

      if (!r.ok) {
        const err = await r.json()
        setChatErro(err.error || 'Erro ao enviar.')
        setChatTexto(texto)
        setChatEnviando(false)
        return
      }

      await carregarChatMensagens()

      fetch('/api/bot/responder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto }),
      }).then(async res => {
        const data = await res.json()
        if (data.resposta) setTimeout(carregarChatMensagens, 2500)
      }).catch(() => {})
    } catch {
      setChatErro('Erro de conexão.')
      setChatTexto(texto)
    }

    setChatEnviando(false)
  }

  // Tickets do usuário
  async function carregarMeusTickets() {
    try {
      const r = await fetch('/api/tickets/meus', { credentials: 'include' })
      if (!r.ok) return
      const d = await r.json()
      setMeusTickets(d.tickets || [])
    } catch {}
  }

  async function enviarTicket() {
    if (ticketEnviando) return
    const { nome, email, assunto, mensagem } = ticketForm
    if (!nome || !email || !assunto || !mensagem) { setTicketMsg('Preencha todos os campos.'); return }
    setTicketEnviando(true)
    setTicketMsg('')
    try {
      const r = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome, email, assunto, mensagem }),
      })
      const d = await r.json()
      if (!r.ok) { setTicketMsg(d.error || 'Erro ao enviar ticket.'); setTicketEnviando(false); return }
      setTicketMsg(d.mensagem)
      setTicketForm(f => ({ ...f, assunto: ASSUNTOS[0], mensagem: '' }))
      // Volta para lista após sucesso
      setTimeout(() => {
        setTicketView('lista')
        setTicketMsg('')
        carregarMeusTickets()
      }, 2000)
    } catch { setTicketMsg('Erro ao enviar. Tente novamente.') }
    setTicketEnviando(false)
  }

  // Conversa
  const carregarConversa = useCallback(async (id: string) => {
    try {
      const r = await fetch(`/api/tickets/${id}/mensagens`, { credentials: 'include' })
      if (!r.ok) return
      const d = await r.json()
      setTicketAberto(d.ticket)
      setConversaMensagens(d.mensagens || [])
      // Atualiza contador de não lidas na lista
      setMeusTickets(prev => prev.map(t =>
        t.id === id ? { ...t, mensagens_nao_lidas: 0 } : t
      ))
    } catch {}
  }, [])

  async function abrirConversa(ticket: MeuTicket) {
    setTicketView('conversa')
    setConversaTexto('')
    setConversaErro('')
    setConfirmandoFechar(false)
    setTicketAberto(null)
    setConversaMensagens([])
    await carregarConversa(ticket.id)
  }

  async function enviarConversaMensagem() {
    if (!conversaTexto.trim() || conversaEnviando || !ticketAberto) return
    setConversaEnviando(true)
    setConversaErro('')
    const texto = conversaTexto.trim()
    setConversaTexto('')

    try {
      const r = await fetch(`/api/tickets/${ticketAberto.id}/mensagens`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ mensagem: texto }),
      })

      if (!r.ok) {
        const err = await r.json()
        setConversaErro(err.error || 'Erro ao enviar.')
        setConversaTexto(texto)
        setConversaEnviando(false)
        return
      }

      await carregarConversa(ticketAberto.id)
    } catch {
      setConversaErro('Erro de conexão.')
      setConversaTexto(texto)
    }

    setConversaEnviando(false)
  }

  async function fecharTicket() {
    if (!ticketAberto) return
    try {
      const r = await fetch(`/api/tickets/${ticketAberto.id}/fechar`, {
        method: 'POST',
        credentials: 'include',
      })
      if (r.ok) {
        setConfirmandoFechar(false)
        await carregarConversa(ticketAberto.id)
        await carregarMeusTickets()
      }
    } catch {}
  }

  function abrirWidget() {
    setAberto(true)
    marcarNotificacoesLidas()
    if (usuarioLogado && aba === 'ticket') {
      carregarMeusTickets()
    }
  }

  function mudarAba(novaAba: 'chat' | 'ticket') {
    setAba(novaAba)
    if (novaAba === 'ticket') {
      setTicketView('lista')
      if (usuarioLogado) carregarMeusTickets()
    }
  }

  const podeEscrever = chatStatus === 'ativo'

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999, fontFamily: 'Inter, sans-serif' }}>
      {aberto && (
        <div style={{ width: '340px', height: '500px', background: '#111826', border: '1px solid #1E2939', borderRadius: '16px', boxShadow: '0 24px 64px rgba(0,0,0,0.6)', display: 'flex', flexDirection: 'column', overflow: 'hidden', marginBottom: '12px' }}>

          {/* Header */}
          <div style={{ background: '#0D1424', borderBottom: '1px solid #1E2939', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '8px', height: '8px', background: '#22C55E', borderRadius: '50%', boxShadow: '0 0 6px #22C55E' }} />
              <span style={{ fontWeight: '700', fontSize: '14px', color: '#F1F5FA' }}>Suporte SumblerControl</span>
            </div>
            <button onClick={() => setAberto(false)} style={{ background: 'none', border: 'none', color: '#647489', cursor: 'pointer', fontSize: '18px', lineHeight: 1, padding: '2px 6px' }}>×</button>
          </div>

          {/* Abas */}
          <div style={{ display: 'flex', borderBottom: '1px solid #1E2939', flexShrink: 0 }}>
            {(['chat', 'ticket'] as const).map(a => (
              <button key={a} onClick={() => mudarAba(a)} style={{ flex: 1, padding: '10px', background: 'none', border: 'none', borderBottom: aba === a ? '2px solid #3B82F6' : '2px solid transparent', color: aba === a ? '#3B82F6' : '#647489', fontSize: '13px', fontWeight: aba === a ? '700' : '500', cursor: 'pointer', transition: 'all 0.15s', position: 'relative' }}>
                {a === 'chat' ? '💬 Chat' : (
                  <span style={{ position: 'relative' }}>
                    🎫 Ticket
                    {a === 'ticket' && totalNaoLidas > 0 && aba !== 'ticket' && (
                      <span style={{ position: 'absolute', top: '-6px', right: '-10px', background: '#EF4444', borderRadius: '999px', padding: '1px 5px', fontSize: '10px', fontWeight: '800', color: '#fff' }}>
                        {totalNaoLidas}
                      </span>
                    )}
                  </span>
                )}
              </button>
            ))}
            {discordUrl && (
              <a href={discordUrl} target="_blank" rel="noopener noreferrer" style={{ flex: 1, padding: '10px', background: 'none', border: 'none', borderBottom: '2px solid transparent', color: '#647489', fontSize: '13px', fontWeight: '500', textDecoration: 'none', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                🎮 Discord
              </a>
            )}
          </div>

          {/* ── ABA CHAT ── */}
          {aba === 'chat' && (
            <>
              <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {chatMensagens.length === 0 && (
                  <div style={{ textAlign: 'center', color: '#647489', fontSize: '13px', padding: '32px 0' }}>
                    <div style={{ fontSize: '32px', marginBottom: '8px' }}>💬</div>
                    Nenhuma mensagem ainda.
                  </div>
                )}
                {chatMensagens.map(m => {
                  const isBot = m.nome.includes('SumblerBot')
                  return (
                    <div key={m.id} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontSize: '11px', color: isBot ? '#3B82F6' : '#647489', paddingLeft: '4px', fontWeight: isBot ? '600' : '400' }}>
                        {m.nome}
                      </span>
                      <div style={{ maxWidth: '85%', padding: '8px 12px', borderRadius: '12px 12px 12px 2px', background: isBot ? 'rgba(59,130,246,0.12)' : '#1E2939', color: '#F1F5FA', fontSize: '13px', lineHeight: 1.5, border: isBot ? '1px solid rgba(59,130,246,0.25)' : 'none', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {m.mensagem.replace(/\*\*(.*?)\*\*/g, '$1')}
                      </div>
                    </div>
                  )
                })}
                <div ref={chatEndRef} />
              </div>

              <div style={{ borderTop: '1px solid #1E2939', flexShrink: 0 }}>
                {(chatStatus === 'visitante' || chatStatus === 'carregando') && (
                  <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                    <div style={{ fontSize: '28px' }}>🔒</div>
                    <p style={{ fontSize: '12px', color: '#CBD5E1', textAlign: 'center', lineHeight: 1.6, margin: 0 }}>
                      Apenas clientes podem participar do chat. Crie um ticket para falar com nossa equipe.
                    </p>
                    <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                      <a href="/login" style={{ flex: 1, padding: '8px', background: 'transparent', border: '1px solid #243044', borderRadius: '8px', color: '#647489', fontSize: '12px', fontWeight: '600', textDecoration: 'none', textAlign: 'center' }}>Entrar</a>
                      <button onClick={() => mudarAba('ticket')} style={{ flex: 1, padding: '8px', background: '#3B82F6', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>🎫 Abrir Ticket</button>
                    </div>
                  </div>
                )}
                {chatStatus === 'pendente' && (
                  <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                    <div style={{ fontSize: '28px' }}>⏳</div>
                    <p style={{ fontSize: '12px', color: '#FBBF24', textAlign: 'center', lineHeight: 1.6, margin: 0 }}>
                      Você tem um pagamento pendente. Finalize para participar do chat.
                    </p>
                    <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                      <a href="/minha-conta" style={{ flex: 1, padding: '8px', background: '#FBBF24', border: 'none', borderRadius: '8px', color: '#000', fontSize: '12px', fontWeight: '700', textDecoration: 'none', textAlign: 'center' }}>Ver pedido</a>
                      <button onClick={() => mudarAba('ticket')} style={{ flex: 1, padding: '8px', background: 'transparent', border: '1px solid #243044', borderRadius: '8px', color: '#647489', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>🎫 Ticket</button>
                    </div>
                  </div>
                )}
                {chatStatus === 'expirado' && (
                  <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                    <div style={{ fontSize: '28px' }}>🔒</div>
                    <p style={{ fontSize: '12px', color: '#EF4444', textAlign: 'center', lineHeight: 1.6, margin: 0 }}>
                      Sua licença expirou. Renove para voltar ao chat.
                    </p>
                    <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                      <a href="/#preco" style={{ flex: 1, padding: '8px', background: '#3B82F6', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '12px', fontWeight: '600', textDecoration: 'none', textAlign: 'center' }}>Renovar agora</a>
                      <button onClick={() => mudarAba('ticket')} style={{ flex: 1, padding: '8px', background: 'transparent', border: '1px solid #243044', borderRadius: '8px', color: '#647489', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>🎫 Ticket</button>
                    </div>
                  </div>
                )}
                {podeEscrever && (
                  <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {chatErro && <p style={{ fontSize: '11px', color: '#EF4444', margin: 0, textAlign: 'center' }}>{chatErro}</p>}
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        value={chatTexto}
                        onChange={e => setChatTexto(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarChatMensagem() } }}
                        placeholder="Digite sua mensagem..."
                        maxLength={500}
                        style={{ flex: 1, padding: '8px 12px', background: '#0D1424', border: '1px solid #1E2939', borderRadius: '8px', color: '#F1F5FA', fontSize: '13px', outline: 'none' }}
                      />
                      <button onClick={enviarChatMensagem} disabled={chatEnviando || !chatTexto.trim()} style={{ padding: '8px 14px', background: chatEnviando || !chatTexto.trim() ? '#1E2939' : '#3B82F6', border: 'none', borderRadius: '8px', color: '#fff', cursor: chatEnviando || !chatTexto.trim() ? 'not-allowed' : 'pointer', fontSize: '16px', transition: 'background 0.15s' }}>
                        {chatEnviando ? '...' : '➤'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── ABA TICKET ── */}
          {aba === 'ticket' && (
            <>
              {/* ── Lista de tickets (usuário logado) ── */}
              {ticketView === 'lista' && usuarioLogado && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1E2939', flexShrink: 0 }}>
                    <span style={{ fontSize: '13px', fontWeight: '700', color: '#F1F5FA' }}>Meus Tickets</span>
                    <button onClick={() => setTicketView('novo')} style={{ padding: '5px 10px', background: '#3B82F6', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>+ Novo</button>
                  </div>
                  <div style={{ flex: 1, overflowY: 'auto' }}>
                    {meusTickets.length === 0 ? (
                      <div style={{ padding: '32px 16px', textAlign: 'center' }}>
                        <div style={{ fontSize: '32px', marginBottom: '8px' }}>🎫</div>
                        <p style={{ color: '#647489', fontSize: '13px', marginBottom: '12px' }}>Nenhum ticket aberto ainda.</p>
                        <button onClick={() => setTicketView('novo')} style={{ padding: '8px 16px', background: '#3B82F6', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '13px', cursor: 'pointer' }}>Abrir ticket</button>
                      </div>
                    ) : (
                      meusTickets.map(t => (
                        <button key={t.id} onClick={() => abrirConversa(t)} style={{ width: '100%', padding: '12px 16px', background: 'none', border: 'none', borderBottom: '1px solid #1E2939', cursor: 'pointer', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '13px', fontWeight: '600', color: '#F1F5FA' }}>{t.assunto}</span>
                            <span style={{ fontSize: '10px', fontWeight: '700', padding: '2px 7px', borderRadius: '999px', background: `${STATUS_COLOR[t.status]}18`, color: STATUS_COLOR[t.status] }}>
                              {STATUS_LABEL[t.status]}
                            </span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '11px', color: '#647489', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {t.ultima_mensagem
                                ? `${t.ultima_mensagem.remetente === 'admin' ? '🛡 ' : ''}${t.ultima_mensagem.mensagem}`
                                : 'Nenhuma mensagem ainda'}
                            </span>
                            {t.mensagens_nao_lidas > 0 && (
                              <span style={{ background: '#EF4444', borderRadius: '999px', padding: '1px 6px', fontSize: '10px', fontWeight: '800', color: '#fff', flexShrink: 0 }}>
                                {t.mensagens_nao_lidas}
                              </span>
                            )}
                          </div>
                          <span style={{ fontSize: '10px', color: '#3D4F63' }}>
                            {new Date(t.criado_em).toLocaleDateString('pt-BR')}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* ── Formulário novo ticket ── */}
              {(ticketView === 'novo' || (!usuarioLogado)) && (
                <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {usuarioLogado && (
                    <button onClick={() => setTicketView('lista')} style={{ background: 'none', border: 'none', color: '#647489', cursor: 'pointer', fontSize: '12px', textAlign: 'left', padding: 0, marginBottom: '4px' }}>
                      ← Voltar
                    </button>
                  )}
                  {ticketMsg ? (
                    <div style={{ textAlign: 'center', padding: '24px 16px' }}>
                      <div style={{ fontSize: '36px', marginBottom: '10px' }}>✅</div>
                      <p style={{ color: '#22C55E', fontWeight: '700', fontSize: '14px' }}>{ticketMsg}</p>
                    </div>
                  ) : (
                    <>
                      <p style={{ fontSize: '12px', color: '#647489', margin: 0 }}>Fale com nossa equipe. Respondemos em até 24h.</p>
                      <input value={ticketForm.nome} onChange={e => setTicketForm(f => ({ ...f, nome: e.target.value }))} placeholder="Seu nome" style={inputStyle} />
                      <input value={ticketForm.email} onChange={e => setTicketForm(f => ({ ...f, email: e.target.value }))} placeholder="Seu e-mail" type="email" style={inputStyle} />
                      <select value={ticketForm.assunto} onChange={e => setTicketForm(f => ({ ...f, assunto: e.target.value }))} style={{ ...inputStyle, cursor: 'pointer' }}>
                        {ASSUNTOS.map(a => <option key={a} value={a}>{a}</option>)}
                      </select>
                      <textarea value={ticketForm.mensagem} onChange={e => setTicketForm(f => ({ ...f, mensagem: e.target.value }))} placeholder="Descreva sua dúvida ou problema..." maxLength={2000} rows={4} style={{ ...inputStyle, resize: 'none', lineHeight: 1.5 }} />
                      <button onClick={enviarTicket} disabled={ticketEnviando} style={{ padding: '10px', background: ticketEnviando ? '#1E2939' : '#3B82F6', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '13px', fontWeight: '700', cursor: ticketEnviando ? 'not-allowed' : 'pointer' }}>
                        {ticketEnviando ? 'Enviando...' : '🎫 Enviar Ticket'}
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* ── Conversa do ticket ── */}
              {ticketView === 'conversa' && usuarioLogado && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  {/* Sub-header */}
                  <div style={{ padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1E2939', flexShrink: 0, gap: '8px' }}>
                    <button onClick={() => { setTicketView('lista'); setTicketAberto(null); carregarMeusTickets() }} style={{ background: 'none', border: 'none', color: '#647489', cursor: 'pointer', fontSize: '13px', padding: 0, flexShrink: 0 }}>←</button>
                    <span style={{ fontSize: '12px', fontWeight: '700', color: '#F1F5FA', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {ticketAberto?.assunto || '...'}
                    </span>
                    {ticketAberto && (
                      <span style={{ fontSize: '10px', fontWeight: '700', padding: '2px 7px', borderRadius: '999px', background: `${STATUS_COLOR[ticketAberto.status]}18`, color: STATUS_COLOR[ticketAberto.status], flexShrink: 0 }}>
                        {STATUS_LABEL[ticketAberto.status]}
                      </span>
                    )}
                  </div>

                  {/* Histórico */}
                  <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {!ticketAberto && (
                      <div style={{ textAlign: 'center', color: '#647489', fontSize: '13px', padding: '24px' }}>Carregando...</div>
                    )}
                    {conversaMensagens.map(m => {
                      const isAdmin = m.remetente === 'admin'
                      return (
                        <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isAdmin ? 'flex-start' : 'flex-end', gap: '3px' }}>
                          <span style={{ fontSize: '10px', color: isAdmin ? '#3B82F6' : '#647489', paddingLeft: '4px', paddingRight: '4px' }}>
                            {isAdmin ? '🛡 Suporte' : 'Você'} · {new Date(m.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <div style={{ maxWidth: '80%', padding: '8px 12px', borderRadius: isAdmin ? '2px 12px 12px 12px' : '12px 2px 12px 12px', background: isAdmin ? 'rgba(59,130,246,0.12)' : '#1E2939', color: '#F1F5FA', fontSize: '13px', lineHeight: 1.5, border: isAdmin ? '1px solid rgba(59,130,246,0.2)' : 'none', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                            {m.mensagem}
                          </div>
                        </div>
                      )
                    })}
                    <div ref={conversaEndRef} />
                  </div>

                  {/* Input ou mensagem de resolvido */}
                  <div style={{ borderTop: '1px solid #1E2939', flexShrink: 0, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {ticketAberto?.status === 'resolvido' ? (
                      <div style={{ textAlign: 'center', padding: '8px' }}>
                        <p style={{ fontSize: '12px', color: '#22C55E', fontWeight: '600', margin: '0 0 8px' }}>✅ Ticket resolvido</p>
                        <button onClick={() => setTicketView('novo')} style={{ padding: '6px 14px', background: '#3B82F6', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '12px', cursor: 'pointer' }}>Abrir novo ticket</button>
                      </div>
                    ) : (
                      <>
                        {conversaErro && <p style={{ fontSize: '11px', color: '#EF4444', margin: 0, textAlign: 'center' }}>{conversaErro}</p>}

                        {/* Modal de confirmação */}
                        {confirmandoFechar ? (
                          <div style={{ background: '#151D2C', border: '1px solid #243044', borderRadius: '8px', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <p style={{ fontSize: '12px', color: '#CBD5E1', margin: 0, textAlign: 'center' }}>Seu problema foi resolvido? Isso encerrará o ticket.</p>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button onClick={() => setConfirmandoFechar(false)} style={{ flex: 1, padding: '7px', background: 'transparent', border: '1px solid #243044', borderRadius: '6px', color: '#647489', fontSize: '12px', cursor: 'pointer' }}>Não</button>
                              <button onClick={fecharTicket} style={{ flex: 1, padding: '7px', background: '#22C55E', border: 'none', borderRadius: '6px', color: '#000', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>Sim, fechar</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <input
                                value={conversaTexto}
                                onChange={e => setConversaTexto(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarConversaMensagem() } }}
                                placeholder="Escreva sua mensagem..."
                                maxLength={2000}
                                style={{ flex: 1, padding: '8px 12px', background: '#0D1424', border: '1px solid #1E2939', borderRadius: '8px', color: '#F1F5FA', fontSize: '13px', outline: 'none' }}
                              />
                              <button onClick={enviarConversaMensagem} disabled={conversaEnviando || !conversaTexto.trim()} style={{ padding: '8px 14px', background: conversaEnviando || !conversaTexto.trim() ? '#1E2939' : '#3B82F6', border: 'none', borderRadius: '8px', color: '#fff', cursor: conversaEnviando || !conversaTexto.trim() ? 'not-allowed' : 'pointer', fontSize: '16px' }}>
                                {conversaEnviando ? '...' : '➤'}
                              </button>
                            </div>
                            <button onClick={() => setConfirmandoFechar(true)} style={{ padding: '6px', background: 'transparent', border: '1px solid #243044', borderRadius: '6px', color: '#647489', fontSize: '11px', cursor: 'pointer' }}>
                              ✅ Problema resolvido? Fechar ticket
                            </button>
                          </>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Botão flutuante */}
      <button
        onClick={aberto ? () => setAberto(false) : abrirWidget}
        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 20px', background: aberto ? '#1E2939' : '#3B82F6', border: 'none', borderRadius: '999px', color: '#fff', fontSize: '14px', fontWeight: '700', cursor: 'pointer', boxShadow: '0 8px 24px rgba(59,130,246,0.4)', transition: 'all 0.2s' }}
      >
        {aberto ? (
          <span style={{ fontSize: '16px' }}>✕</span>
        ) : (
          <>
            <span>💬</span>
            <span>Suporte</span>
            {totalNaoLidas > 0 && (
              <span style={{ background: '#EF4444', borderRadius: '999px', padding: '1px 6px', fontSize: '11px', fontWeight: '800' }}>
                {totalNaoLidas}
              </span>
            )}
          </>
        )}
      </button>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', background: '#0D1424', border: '1px solid #1E2939',
  borderRadius: '8px', color: '#F1F5FA', fontSize: '13px', outline: 'none', boxSizing: 'border-box',
}
