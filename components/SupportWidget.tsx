'use client'
import { useState, useEffect, useRef } from 'react'

interface Mensagem {
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

// Prioridade: ativo > pendente > expirado > visitante
type ChatStatus = 'carregando' | 'visitante' | 'pendente' | 'expirado' | 'ativo'

const ASSUNTOS = [
  'Problema técnico',
  'Pagamento',
  'Licença / Ativação',
  'Reset de HWID',
  'Reembolso',
  'Outro',
]

export default function SupportWidget() {
  const [aberto, setAberto] = useState(false)
  const [aba, setAba] = useState<'chat' | 'ticket'>('chat')
  const [mensagens, setMensagens] = useState<Mensagem[]>([])
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [chatStatus, setChatStatus] = useState<ChatStatus>('carregando')
  const [ticketForm, setTicketForm] = useState<TicketForm>({ nome: '', email: '', assunto: ASSUNTOS[0], mensagem: '' })
  const [ticketEnviando, setTicketEnviando] = useState(false)
  const [ticketMsg, setTicketMsg] = useState('')
  const [ticketSucesso, setTicketSucesso] = useState(false)
  const [discordUrl, setDiscordUrl] = useState('')
  const [notificacao, setNotificacao] = useState(0)
  const [erroEnvio, setErroEnvio] = useState('')
  const chatEndRef = useRef<HTMLDivElement>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const msgCountRef = useRef(0)

  useEffect(() => {
    verificarStatus()
    fetch('/api/config-publica')
      .then(r => r.json())
      .then(d => { if (d.discordUrl) setDiscordUrl(d.discordUrl) })
      .catch(() => {})
  }, [])

  // Re-verifica ao abrir — captura login recente
  useEffect(() => {
    if (aberto) {
      verificarStatus()
      carregarMensagens()
      pollingRef.current = setInterval(carregarMensagens, 5000)
    } else {
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
    return () => { if (pollingRef.current) clearInterval(pollingRef.current) }
  }, [aberto])

  useEffect(() => {
    if (aberto && aba === 'chat') {
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    }
  }, [mensagens, aberto, aba])

  async function verificarStatus() {
    try {
      const meRes = await fetch('/api/auth/me', { credentials: 'include' })
      const d = await meRes.json()

      if (!d.logado) { setChatStatus('visitante'); return }

      setTicketForm(f => ({ ...f, nome: d.nomeCompleto || '', email: d.email || '' }))

      const [licData, contaData] = await Promise.all([
        fetch('/api/minha-licenca', { credentials: 'include' }).then(r => r.json()),
        fetch('/api/minha-conta', { credentials: 'include' }).then(r => r.json()),
      ])

      const licenca = licData.licenca
      const pedidos = contaData?.pedidos ?? []

      const licencaAtiva = licenca?.ativa && new Date(licenca.expira_em) > new Date()
      const temPedidoPago = pedidos.some((p: { status: string }) => p.status === 'pago')
      const temPedidoPendente = pedidos.some((p: { status: string }) => p.status === 'pendente')

      // Prioridade: ativo primeiro
      if (licencaAtiva || temPedidoPago) {
        setChatStatus('ativo')
        return
      }

      // Tem pedido pendente mas nunca pagou ainda
      if (temPedidoPendente) {
        setChatStatus('pendente')
        return
      }

      // Já comprou antes mas expirou e não renovou
      if (licenca && !licencaAtiva) {
        setChatStatus('expirado')
        return
      }

      // Nunca comprou nada
      setChatStatus('visitante')

    } catch {
      setChatStatus('visitante')
    }
  }

  async function carregarMensagens() {
    try {
      const r = await fetch('/api/chat/mensagens')
      const d = await r.json()
      const novas = d.mensagens as Mensagem[]
      if (!aberto && novas.length > msgCountRef.current) {
        setNotificacao(n => n + (novas.length - msgCountRef.current))
      }
      msgCountRef.current = novas.length
      setMensagens(novas)
    } catch {}
  }

  async function enviarMensagem() {
    if (!texto.trim() || enviando) return
    setEnviando(true)
    setErroEnvio('')
    const textoEnviado = texto.trim()
    setTexto('')

    try {
      const r = await fetch('/api/chat/mensagens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ mensagem: textoEnviado }),
      })

      if (!r.ok) {
        const err = await r.json()
        setErroEnvio(err.error || 'Erro ao enviar.')
        setTexto(textoEnviado)
        setEnviando(false)
        return
      }

      await carregarMensagens()

      // Bot responde após 2s e salva no banco
      fetch('/api/bot/responder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto: textoEnviado }),
      }).then(async (botRes) => {
        const botData = await botRes.json()
        if (botData.resposta) setTimeout(carregarMensagens, 2500)
      }).catch(() => {})

    } catch {
      setErroEnvio('Erro de conexão. Tente novamente.')
      setTexto(textoEnviado)
    }

    setEnviando(false)
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
      if (!r.ok) setTicketMsg(d.error || 'Erro ao enviar ticket.')
      else { setTicketSucesso(true); setTicketMsg(d.mensagem); setTicketForm(f => ({ ...f, assunto: ASSUNTOS[0], mensagem: '' })) }
    } catch { setTicketMsg('Erro ao enviar. Tente novamente.') }
    setTicketEnviando(false)
  }

  function abrirWidget() { setAberto(true); setNotificacao(0) }
  const podeEscrever = chatStatus === 'ativo'

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

          {/* ABA CHAT */}
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

                {/* VISITANTE — nunca comprou ou não logado */}
                {(chatStatus === 'visitante' || chatStatus === 'carregando') && (
                  <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                    <div style={{ fontSize: '28px' }}>🔒</div>
                    <p style={{ fontSize: '12px', color: '#CBD5E1', textAlign: 'center', lineHeight: 1.6, margin: 0 }}>
                      Apenas clientes podem participar do chat. Crie um ticket para falar com nossa equipe.
                    </p>
                    <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                      <a href="/login" style={{ flex: 1, padding: '8px', background: 'transparent', border: '1px solid #243044', borderRadius: '8px', color: '#647489', fontSize: '12px', fontWeight: '600', textDecoration: 'none', textAlign: 'center' }}>
                        Entrar
                      </a>
                      <button onClick={() => setAba('ticket')} style={{ flex: 1, padding: '8px', background: '#3B82F6', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
                        🎫 Abrir Ticket
                      </button>
                    </div>
                  </div>
                )}

                {/* PENDENTE — criou pedido mas não pagou */}
                {chatStatus === 'pendente' && (
                  <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                    <div style={{ fontSize: '28px' }}>⏳</div>
                    <p style={{ fontSize: '12px', color: '#FBBF24', textAlign: 'center', lineHeight: 1.6, margin: 0 }}>
                      Você tem um pagamento pendente. Finalize o pagamento para participar do chat.
                    </p>
                    <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                      <a href="/minha-conta" style={{ flex: 1, padding: '8px', background: '#FBBF24', border: 'none', borderRadius: '8px', color: '#000', fontSize: '12px', fontWeight: '700', textDecoration: 'none', textAlign: 'center' }}>
                        Ver pedido
                      </a>
                      <button onClick={() => setAba('ticket')} style={{ flex: 1, padding: '8px', background: 'transparent', border: '1px solid #243044', borderRadius: '8px', color: '#647489', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
                        🎫 Ticket
                      </button>
                    </div>
                  </div>
                )}

                {/* EXPIRADO — já foi cliente mas não renovou */}
                {chatStatus === 'expirado' && (
                  <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                    <div style={{ fontSize: '28px' }}>🔒</div>
                    <p style={{ fontSize: '12px', color: '#EF4444', textAlign: 'center', lineHeight: 1.6, margin: 0 }}>
                      Sua licença expirou. Renove para voltar a participar do chat.
                    </p>
                    <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                      <a href="/#preco" style={{ flex: 1, padding: '8px', background: '#3B82F6', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '12px', fontWeight: '600', textDecoration: 'none', textAlign: 'center' }}>
                        Renovar agora
                      </a>
                      <button onClick={() => setAba('ticket')} style={{ flex: 1, padding: '8px', background: 'transparent', border: '1px solid #243044', borderRadius: '8px', color: '#647489', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
                        🎫 Ticket
                      </button>
                    </div>
                  </div>
                )}

                {/* ATIVO — licença ativa ou pedido pago */}
                {podeEscrever && (
                  <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {erroEnvio && <p style={{ fontSize: '11px', color: '#EF4444', margin: 0, textAlign: 'center' }}>{erroEnvio}</p>}
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

          {/* ABA TICKET */}
          {aba === 'ticket' && (
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {ticketSucesso ? (
                <div style={{ textAlign: 'center', padding: '32px 16px' }}>
                  <div style={{ fontSize: '40px', marginBottom: '12px' }}>✅</div>
                  <p style={{ color: '#22C55E', fontWeight: '700', fontSize: '14px', marginBottom: '8px' }}>Ticket enviado!</p>
                  <p style={{ color: '#647489', fontSize: '13px', marginBottom: '16px' }}>{ticketMsg}</p>
                  <button onClick={() => { setTicketSucesso(false); setTicketMsg('') }} style={{ padding: '8px 16px', background: '#3B82F6', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '13px', cursor: 'pointer' }}>
                    Novo ticket
                  </button>
                </div>
              ) : (
                <>
                  <p style={{ fontSize: '12px', color: '#647489', margin: 0 }}>Fale com nossa equipe. Respondemos por e-mail em até 24h.</p>
                  <input value={ticketForm.nome} onChange={e => setTicketForm(f => ({ ...f, nome: e.target.value }))} placeholder="Seu nome" style={inputStyle} />
                  <input value={ticketForm.email} onChange={e => setTicketForm(f => ({ ...f, email: e.target.value }))} placeholder="Seu e-mail" type="email" style={inputStyle} />
                  <select value={ticketForm.assunto} onChange={e => setTicketForm(f => ({ ...f, assunto: e.target.value }))} style={{ ...inputStyle, cursor: 'pointer' }}>
                    {ASSUNTOS.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                  <textarea value={ticketForm.mensagem} onChange={e => setTicketForm(f => ({ ...f, mensagem: e.target.value }))} placeholder="Descreva sua dúvida ou problema..." maxLength={2000} rows={4} style={{ ...inputStyle, resize: 'none', lineHeight: 1.5 }} />
                  {ticketMsg && !ticketSucesso && <p style={{ fontSize: '12px', color: '#EF4444', margin: 0 }}>{ticketMsg}</p>}
                  <button onClick={enviarTicket} disabled={ticketEnviando} style={{ padding: '10px', background: ticketEnviando ? '#1E2939' : '#3B82F6', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '13px', fontWeight: '700', cursor: ticketEnviando ? 'not-allowed' : 'pointer' }}>
                    {ticketEnviando ? 'Enviando...' : '🎫 Enviar Ticket'}
                  </button>
                </>
              )}
            </div>
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
            {notificacao > 0 && (
              <span style={{ background: '#EF4444', borderRadius: '999px', padding: '1px 6px', fontSize: '11px', fontWeight: '800' }}>
                {notificacao}
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
