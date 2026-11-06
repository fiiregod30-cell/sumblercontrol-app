'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface ChatMensagem {
  id: string
  nome: string
  mensagem: string
  criado_em: string
  avatar_url?: string | null
}

type ChatStatus = 'carregando' | 'visitante' | 'pendente' | 'expirado' | 'ativo'

// ─── Constantes ───────────────────────────────────────────────────────────────

const ASSUNTOS = [
  'Problema técnico',
  'Pagamento',
  'Licença / Ativação',
  'Reset de HWID',
  'Reembolso',
  'Outro',
]

// ─── Componente ───────────────────────────────────────────────────────────────

export default function SupportWidget() {
  const pathname = usePathname()
  const router = useRouter()

  // Estado geral
  const [aberto, setAberto] = useState(false)
  const [aba, setAba] = useState<'chat' | 'ticket'>('chat')
  const [discordUrl, setDiscordUrl] = useState('')
  const [chatStatus, setChatStatus] = useState<ChatStatus>('carregando')
  const [usuarioLogado, setUsuarioLogado] = useState(false)

  // Badge de notificações persistido
  const [totalNaoLidas, setTotalNaoLidas] = useState(0)
  const notifPollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Chat público
  const [mensagens, setMensagens] = useState<ChatMensagem[]>([])
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erroChat, setErroChat] = useState('')
  const chatEndRef = useRef<HTMLDivElement>(null)
  const chatPollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Formulário de ticket
  const [assunto, setAssunto] = useState(ASSUNTOS[0])
  const [mensagemTicket, setMensagemTicket] = useState('')
  const [ticketEnviando, setTicketEnviando] = useState(false)
  const [ticketMsg, setTicketMsg] = useState('')
  const [ticketSucesso, setTicketSucesso] = useState(false)
  const [ticketId, setTicketId] = useState<string | null>(null)
  // Cooldown: segundos restantes + intervalo do contador
  const [cooldownSeg, setCooldownSeg] = useState(0)
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // Duplicado: id do ticket existente com mesmo assunto
  const [ticketDuplicadoId, setTicketDuplicadoId] = useState<string | null>(null)

  // ── Inicialização ────────────────────────────────────────────────────────────

  useEffect(() => {
    verificarStatus()
    fetch('/api/config-publica')
      .then(r => r.json())
      .then(d => { if (d.discordUrl) setDiscordUrl(d.discordUrl) })
      .catch(() => {})
  }, [])

  useEffect(() => { verificarStatus() }, [pathname])

  // Polling de notificações (sempre ativo, mesmo com widget fechado)
  useEffect(() => {
    if (usuarioLogado) {
      pollarNotificacoes()
      notifPollingRef.current = setInterval(pollarNotificacoes, 10_000)
    }
    return () => { if (notifPollingRef.current) clearInterval(notifPollingRef.current) }
  }, [usuarioLogado])

  // Polling do chat público — só quando aberto na aba chat
  useEffect(() => {
    if (aberto && aba === 'chat') {
      carregarMensagens()
      chatPollingRef.current = setInterval(carregarMensagens, 5000)
    } else {
      if (chatPollingRef.current) clearInterval(chatPollingRef.current)
    }
    return () => { if (chatPollingRef.current) clearInterval(chatPollingRef.current) }
  }, [aberto, aba])

  // Recarrega mensagens imediatamente quando avatar é atualizado
  useEffect(() => {
    function onAvatarAtualizado() { carregarMensagens() }
    window.addEventListener('avatar-atualizado', onAvatarAtualizado)
    return () => window.removeEventListener('avatar-atualizado', onAvatarAtualizado)
  }, [])

  // Scroll automático no chat
  useEffect(() => {
    if (aberto && aba === 'chat')
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }, [mensagens, aberto, aba])

  // ── Funções ──────────────────────────────────────────────────────────────────

  async function verificarStatus() {
    try {
      const meRes = await fetch('/api/auth/me', { credentials: 'include' })
      const d = await meRes.json()

      if (!d.logado) {
        setChatStatus('visitante')
        setUsuarioLogado(false)
        return
      }

      setUsuarioLogado(true)

      const [licData, contaData] = await Promise.all([
        fetch('/api/minha-licenca', { credentials: 'include' }).then(r => r.json()),
        fetch('/api/minha-conta', { credentials: 'include' }).then(r => r.json()),
      ])

      const licenca = licData.licenca
      const pedidos = contaData?.pedidos ?? []
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
    try {
      const r = await fetch('/api/notificacoes', { credentials: 'include' })
      if (!r.ok) return
      const d = await r.json()
      setTotalNaoLidas(d.total_nao_lidas || 0)
    } catch {}
  }

  // Chat público
  async function carregarMensagens() {
    try {
      const r = await fetch('/api/chat/mensagens')
      const d = await r.json()
      setMensagens(d.mensagens || [])
    } catch {}
  }

  async function enviarMensagem() {
    if (!texto.trim() || enviando) return
    setEnviando(true)
    setErroChat('')
    const msg = texto.trim()
    setTexto('')

    try {
      const r = await fetch('/api/chat/mensagens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ mensagem: msg }),
      })

      if (!r.ok) {
        const err = await r.json()
        setErroChat(err.error || 'Erro ao enviar.')
        setTexto(msg)
        setEnviando(false)
        return
      }

      await carregarMensagens()

      fetch('/api/bot/responder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto: msg }),
      }).then(async res => {
        const data = await res.json()
        if (data.resposta) setTimeout(carregarMensagens, 2500)
      }).catch(() => {})
    } catch {
      setErroChat('Erro de conexão.')
      setTexto(msg)
    }

    setEnviando(false)
  }

  // Ticket
  async function enviarTicket() {
    if (ticketEnviando) return
    if (!mensagemTicket.trim() || !assunto) { setTicketMsg('Preencha todos os campos.'); return }
    setTicketEnviando(true)
    setTicketMsg('')
    setTicketDuplicadoId(null)

    try {
      const r = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ assunto, mensagem: mensagemTicket }),
      })
      const d = await r.json()
      if (!r.ok) {
        if (d.authRequired) {
          router.push('/login')
          return
        }
        // Cooldown: inicia contador regressivo
        if (d.cooldown && d.restanteSeg) {
          setCooldownSeg(d.restanteSeg)
          if (cooldownRef.current) clearInterval(cooldownRef.current)
          cooldownRef.current = setInterval(() => {
            setCooldownSeg(prev => {
              if (prev <= 1) {
                if (cooldownRef.current) clearInterval(cooldownRef.current)
                return 0
              }
              return prev - 1
            })
          }, 1000)
          setTicketEnviando(false)
          return
        }
        // Duplicado: mostra link para o ticket existente
        if (d.duplicado && d.ticketId) {
          setTicketDuplicadoId(d.ticketId)
          setTicketEnviando(false)
          return
        }
        setTicketMsg(d.error || 'Erro ao enviar ticket.')
        setTicketEnviando(false)
        return
      }
      setTicketSucesso(true)
      setTicketId(d.ticketId || null)
      setTicketMsg(d.mensagem)
      setMensagemTicket('')
      setAssunto(ASSUNTOS[0])
    } catch {
      setTicketMsg('Erro ao enviar. Tente novamente.')
    }
    setTicketEnviando(false)
  }

  function abrirWidget() {
    setAberto(true)
    // Zera badge ao abrir
    if (usuarioLogado) {
      setTotalNaoLidas(0)
      fetch('/api/notificacoes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({}),
      }).catch(() => {})
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
              <button key={a} onClick={() => setAba(a)} style={{ flex: 1, padding: '10px', background: 'none', border: 'none', borderBottom: aba === a ? '2px solid #3B82F6' : '2px solid transparent', color: aba === a ? '#3B82F6' : '#647489', fontSize: '13px', fontWeight: aba === a ? '700' : '500', cursor: 'pointer', transition: 'all 0.15s' }}>
                {a === 'chat' ? '💬 Chat' : '🎫 Ticket'}
              </button>
            ))}
            {discordUrl && (
              <a href={discordUrl} target="_blank" rel="noopener noreferrer" style={{ flex: 1, padding: '10px', background: 'none', border: 'none', borderBottom: '2px solid transparent', color: '#647489', fontSize: '13px', fontWeight: '500', textDecoration: 'none', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                🎮 Discord
              </a>
            )}
          </div>

          {/* ── ABA CHAT ─────────────────────────────────────────────────────── */}
          {aba === 'chat' && (
            <>
              <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {mensagens.length === 0 && (
                  <div style={{ textAlign: 'center', color: '#647489', fontSize: '13px', padding: '32px 0' }}>
                    <div style={{ fontSize: '32px', marginBottom: '8px' }}>💬</div>
                    Nenhuma mensagem ainda.
                  </div>
                )}
                {mensagens.map(m => {
                  const isBot = m.nome.includes('SumblerBot') || m.nome === 'SumblerControl'
                  return (
                    <div key={m.id} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {/* Cabeçalho da mensagem: avatar + nome */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingLeft: '2px' }}>
                        {m.avatar_url ? (
                          <img src={m.avatar_url} alt={m.nome} style={{ width: '20px', height: '20px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                        ) : (
                          <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: isBot ? 'rgba(59,130,246,0.3)' : '#1E2939', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: '700', color: isBot ? '#3B82F6' : '#647489', flexShrink: 0 }}>
                            {m.nome.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <span style={{ fontSize: '11px', color: isBot ? '#3B82F6' : '#647489', fontWeight: isBot ? '600' : '400' }}>
                          {m.nome}
                        </span>
                      </div>
                      {/* Bolha */}
                      <div style={{ maxWidth: '85%', marginLeft: '26px', padding: '8px 12px', borderRadius: '2px 12px 12px 12px', background: isBot ? 'rgba(59,130,246,0.12)' : '#1E2939', color: '#F1F5FA', fontSize: '13px', lineHeight: 1.5, border: isBot ? '1px solid rgba(59,130,246,0.25)' : 'none', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
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
                      Apenas clientes podem participar do chat. Abra um ticket para falar com nossa equipe.
                    </p>
                    <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                      <a href="/login" style={{ flex: 1, padding: '8px', background: 'transparent', border: '1px solid #243044', borderRadius: '8px', color: '#647489', fontSize: '12px', fontWeight: '600', textDecoration: 'none', textAlign: 'center' }}>Entrar</a>
                      <button onClick={() => setAba('ticket')} style={{ flex: 1, padding: '8px', background: '#3B82F6', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>🎫 Abrir Ticket</button>
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
                      <Link href="/minha-conta" style={{ flex: 1, padding: '8px', background: '#FBBF24', border: 'none', borderRadius: '8px', color: '#000', fontSize: '12px', fontWeight: '700', textDecoration: 'none', textAlign: 'center' }}>Ver pedido</Link>
                      <button onClick={() => setAba('ticket')} style={{ flex: 1, padding: '8px', background: 'transparent', border: '1px solid #243044', borderRadius: '8px', color: '#647489', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>🎫 Ticket</button>
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
                      <Link href="/#preco" style={{ flex: 1, padding: '8px', background: '#3B82F6', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '12px', fontWeight: '600', textDecoration: 'none', textAlign: 'center' }}>Renovar agora</Link>
                      <button onClick={() => setAba('ticket')} style={{ flex: 1, padding: '8px', background: 'transparent', border: '1px solid #243044', borderRadius: '8px', color: '#647489', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>🎫 Ticket</button>
                    </div>
                  </div>
                )}
                {podeEscrever && (
                  <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {erroChat && <p style={{ fontSize: '11px', color: '#EF4444', margin: 0, textAlign: 'center' }}>{erroChat}</p>}
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        value={texto}
                        onChange={e => setTexto(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarMensagem() } }}
                        placeholder="Digite sua mensagem..."
                        maxLength={500}
                        style={{ flex: 1, padding: '8px 12px', background: '#0D1424', border: '1px solid #1E2939', borderRadius: '8px', color: '#F1F5FA', fontSize: '13px', outline: 'none' }}
                      />
                      <button onClick={enviarMensagem} disabled={enviando || !texto.trim()} style={{ padding: '8px 14px', background: enviando || !texto.trim() ? '#1E2939' : '#3B82F6', border: 'none', borderRadius: '8px', color: '#fff', cursor: enviando || !texto.trim() ? 'not-allowed' : 'pointer', fontSize: '16px', transition: 'background 0.15s' }}>
                        {enviando ? '...' : '➤'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── ABA TICKET ───────────────────────────────────────────────────── */}
          {aba === 'ticket' && (
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>

              {/* Visitante — não logado */}
              {!usuarioLogado && chatStatus !== 'carregando' && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '14px', padding: '16px', textAlign: 'center' }}>
                  <div style={{ fontSize: '36px' }}>🎫</div>
                  <p style={{ fontSize: '14px', fontWeight: '700', color: '#F1F5FA', margin: 0 }}>Faça login para abrir um ticket</p>
                  <p style={{ fontSize: '13px', color: '#647489', margin: 0, lineHeight: 1.6 }}>
                    Você precisa ter uma conta para abrir tickets e acompanhar as respostas.
                  </p>
                  <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                    <a href="/login" style={{ flex: 1, padding: '9px', background: 'transparent', border: '1px solid #243044', borderRadius: '8px', color: '#F1F5FA', fontSize: '13px', fontWeight: '600', textDecoration: 'none', textAlign: 'center' }}>
                      Entrar
                    </a>
                    <a href="/registro" style={{ flex: 1, padding: '9px', background: '#3B82F6', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '13px', fontWeight: '600', textDecoration: 'none', textAlign: 'center' }}>
                      Criar conta
                    </a>
                  </div>
                </div>
              )}

              {/* Usuário logado — formulário */}
              {usuarioLogado && !ticketSucesso && (
                <>
                  {/* Cooldown ativo — contador regressivo */}
                  {cooldownSeg > 0 ? (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '14px', padding: '16px', textAlign: 'center' }}>
                      <div style={{ fontSize: '36px' }}>⏳</div>
                      <p style={{ fontSize: '14px', fontWeight: '700', color: '#FBBF24', margin: 0 }}>
                        Aguarde para criar o próximo ticket
                      </p>
                      <div style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: '10px', padding: '14px 20px' }}>
                        <p style={{ fontSize: '28px', fontWeight: '900', color: '#FBBF24', margin: '0 0 4px', fontVariantNumeric: 'tabular-nums' }}>
                          {Math.floor(cooldownSeg / 60).toString().padStart(2, '0')}:{(cooldownSeg % 60).toString().padStart(2, '0')}
                        </p>
                        <p style={{ fontSize: '12px', color: '#647489', margin: 0 }}>minutos restantes</p>
                      </div>
                      <p style={{ fontSize: '12px', color: '#647489', margin: 0, lineHeight: 1.6 }}>
                        Para evitar spam, existe um intervalo de 15 minutos entre a criação de tickets.
                      </p>
                    </div>
                  ) : ticketDuplicadoId ? (
                    /* Duplicado — ticket com mesmo assunto já existe */
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '14px', padding: '16px', textAlign: 'center' }}>
                      <div style={{ fontSize: '36px' }}>🔁</div>
                      <p style={{ fontSize: '14px', fontWeight: '700', color: '#F1F5FA', margin: 0 }}>
                        Ticket já existe
                      </p>
                      <p style={{ fontSize: '13px', color: '#647489', margin: 0, lineHeight: 1.6 }}>
                        Você já tem um ticket aberto com esse assunto. Acesse-o para continuar a conversa.
                      </p>
                      <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                        <button
                          onClick={() => { setTicketDuplicadoId(null); setTicketMsg('') }}
                          style={{ flex: 1, padding: '9px', background: 'transparent', border: '1px solid #243044', borderRadius: '8px', color: '#647489', fontSize: '13px', cursor: 'pointer' }}>
                          Voltar
                        </button>
                        <a
                          href={`/notificacoes/${ticketDuplicadoId}`}
                          style={{ flex: 1, padding: '9px', background: '#3B82F6', borderRadius: '8px', color: '#fff', fontSize: '13px', fontWeight: '600', textDecoration: 'none', textAlign: 'center' }}>
                          Ver ticket →
                        </a>
                      </div>
                    </div>
                  ) : (
                    <>
                    <p style={{ fontSize: '12px', color: '#647489', margin: 0 }}>Fale com nossa equipe. Respondemos em até 24h.</p>

                  <select
                    value={assunto}
                    onChange={e => setAssunto(e.target.value)}
                    style={{ ...inputStyle, cursor: 'pointer' }}>
                    {ASSUNTOS.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>

                  <textarea
                    value={mensagemTicket}
                    onChange={e => setMensagemTicket(e.target.value)}
                    placeholder="Descreva sua dúvida ou problema..."
                    maxLength={2000}
                    rows={6}
                    style={{ ...inputStyle, resize: 'none', lineHeight: 1.5 }}
                  />

                  {ticketMsg && <p style={{ fontSize: '12px', color: '#EF4444', margin: 0 }}>{ticketMsg}</p>}

                  <button onClick={enviarTicket} disabled={ticketEnviando} style={{ padding: '10px', background: ticketEnviando ? '#1E2939' : '#3B82F6', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '13px', fontWeight: '700', cursor: ticketEnviando ? 'not-allowed' : 'pointer' }}>
                    {ticketEnviando ? 'Enviando...' : '🎫 Enviar Ticket'}
                  </button>

                  {/* Link para ver tickets anteriores */}
                  <Link href="/notificacoes" style={{ fontSize: '12px', color: '#647489', textAlign: 'center', textDecoration: 'none', marginTop: '4px' }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#3B82F6')}
                    onMouseLeave={e => (e.currentTarget.style.color = '#647489')}>
                    🔔 Ver meus tickets e notificações →
                  </Link>
                  </>
                )}
                </>
              )}

              {/* Sucesso */}
              {ticketSucesso && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '14px', padding: '16px', textAlign: 'center' }}>
                  <div style={{ fontSize: '40px' }}>✅</div>
                  <p style={{ color: '#22C55E', fontWeight: '700', fontSize: '14px', margin: 0 }}>Ticket enviado!</p>
                  <p style={{ color: '#647489', fontSize: '13px', margin: 0, lineHeight: 1.6 }}>{ticketMsg}</p>
                  <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                    <button
                      onClick={() => { setTicketSucesso(false); setTicketMsg(''); setTicketId(null) }}
                      style={{ flex: 1, padding: '9px', background: 'transparent', border: '1px solid #243044', borderRadius: '8px', color: '#F1F5FA', fontSize: '13px', cursor: 'pointer' }}>
                      Novo ticket
                    </button>
                    {ticketId && (
                      <a
                        href={`/notificacoes/${ticketId}`}
                        style={{ flex: 1, padding: '9px', background: '#3B82F6', borderRadius: '8px', color: '#fff', fontSize: '13px', fontWeight: '600', textDecoration: 'none', textAlign: 'center' }}>
                        Ver conversa →
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Botão flutuante */}
      <button
        onClick={aberto ? () => setAberto(false) : abrirWidget}
        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 20px', background: aberto ? '#1E2939' : '#3B82F6', border: 'none', borderRadius: '999px', color: '#fff', fontSize: '14px', fontWeight: '700', cursor: 'pointer', boxShadow: '0 8px 24px rgba(59,130,246,0.4)', transition: 'all 0.2s' }}>
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
