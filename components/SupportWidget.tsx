'use client'
import { useState, useEffect, useRef } from 'react'

interface Mensagem {
  id: string
  nome: string
  mensagem: string
  criado_em: string
  isBot?: boolean
  isMeu?: boolean
}

interface TicketForm {
  nome: string
  email: string
  assunto: string
  mensagem: string
}

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
  const [podeEscrever, setPodeEscrever] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')
  const [ticketForm, setTicketForm] = useState<TicketForm>({ nome: '', email: '', assunto: ASSUNTOS[0], mensagem: '' })
  const [ticketEnviando, setTicketEnviando] = useState(false)
  const [ticketMsg, setTicketMsg] = useState('')
  const [ticketSucesso, setTicketSucesso] = useState(false)
  const [discordUrl, setDiscordUrl] = useState('')
  const [notificacao, setNotificacao] = useState(0)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Busca configurações (discord url) e status do usuário
  useEffect(() => {
    fetch('/api/config-publica')
      .then(r => r.json())
      .then(d => { if (d.discordUrl) setDiscordUrl(d.discordUrl) })
      .catch(() => {})

    fetch('/api/auth/me', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        if (d.logado) {
          // Verifica se tem licença ativa
          fetch('/api/minha-licenca', { credentials: 'include' })
            .then(r => r.json())
            .then(lic => {
              if (lic.licenca?.ativa && new Date(lic.licenca.expira_em) > new Date()) {
                setPodeEscrever(true)
                // Preenche ticket automaticamente
                setTicketForm(f => ({ ...f, nome: d.nomeCompleto || '', email: d.email || '' }))
              } else {
                setStatusMsg('Sua licença está expirada. Renove para participar do chat.')
                setTicketForm(f => ({ ...f, nome: d.nomeCompleto || '', email: d.email || '' }))
              }
            })
        }
      })
      .catch(() => {})
  }, [])

  // Carrega mensagens ao abrir
  useEffect(() => {
    if (aberto) {
      carregarMensagens()
      // Polling a cada 8 segundos
      pollingRef.current = setInterval(carregarMensagens, 8000)
    } else {
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
    return () => { if (pollingRef.current) clearInterval(pollingRef.current) }
  }, [aberto])

  // Scroll para o fim ao abrir ou novas mensagens
  useEffect(() => {
    if (aberto && aba === 'chat') {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [mensagens, aberto, aba])

  async function carregarMensagens() {
    try {
      const r = await fetch('/api/chat/mensagens')
      const d = await r.json()
      setMensagens(prev => {
        const novas = d.mensagens as Mensagem[]
        if (!aberto && novas.length > prev.length) {
          setNotificacao(novas.length - prev.length)
        }
        return novas
      })
    } catch {}
  }

  async function enviarMensagem() {
    if (!texto.trim() || enviando) return
    setEnviando(true)

    // Adiciona mensagem otimista
    const temp: Mensagem = {
      id: 'temp',
      nome: 'Você',
      mensagem: texto.trim(),
      criado_em: new Date().toISOString(),
      isMeu: true,
    }
    setMensagens(prev => [...prev, temp])
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
        setMensagens(prev => prev.filter(m => m.id !== 'temp'))
        setStatusMsg(err.error || 'Erro ao enviar.')
        setTexto(textoEnviado)
        setEnviando(false)
        return
      }

      // Tenta resposta do bot
      const botRes = await fetch('/api/bot/responder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto: textoEnviado }),
      })
      const botData = await botRes.json()

      if (botData.resposta) {
        const botMsg: Mensagem = {
          id: `bot-${Date.now()}`,
          nome: '🤖 SumblerBot',
          mensagem: botData.resposta,
          criado_em: new Date().toISOString(),
          isBot: true,
        }
        setMensagens(prev => [...prev.filter(m => m.id !== 'temp'), botMsg])
      } else {
        await carregarMensagens()
      }
    } catch {
      setMensagens(prev => prev.filter(m => m.id !== 'temp'))
      setTexto(textoEnviado)
    }

    setEnviando(false)
  }

  async function enviarTicket() {
    if (ticketEnviando) return
    const { nome, email, assunto, mensagem } = ticketForm
    if (!nome || !email || !assunto || !mensagem) {
      setTicketMsg('Preencha todos os campos.')
      return
    }
    setTicketEnviando(true)
    setTicketMsg('')

    try {
      const r = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome, email, assunto, mensagem }),
      })
      const d = await r.json()
      if (!r.ok) {
        setTicketMsg(d.error || 'Erro ao enviar ticket.')
      } else {
        setTicketSucesso(true)
        setTicketMsg(d.mensagem)
        setTicketForm(f => ({ ...f, assunto: ASSUNTOS[0], mensagem: '' }))
      }
    } catch {
      setTicketMsg('Erro ao enviar. Tente novamente.')
    }

    setTicketEnviando(false)
  }

  function abrirWidget() {
    setAberto(true)
    setNotificacao(0)
  }

  // ── RENDER ───────────────────────────────────────────────────
  return (
    <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999, fontFamily: 'Inter, sans-serif' }}>

      {/* Widget expandido */}
      {aberto && (
        <div style={{
          width: '340px',
          height: '480px',
          background: '#111826',
          border: '1px solid #1E2939',
          borderRadius: '16px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          marginBottom: '12px',
        }}>

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
              <button key={a} onClick={() => setAba(a)} style={{
                flex: 1,
                padding: '10px',
                background: 'none',
                border: 'none',
                borderBottom: aba === a ? '2px solid #3B82F6' : '2px solid transparent',
                color: aba === a ? '#3B82F6' : '#647489',
                fontSize: '13px',
                fontWeight: aba === a ? '700' : '500',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}>
                {a === 'chat' ? '💬 Chat' : '🎫 Abrir Ticket'}
              </button>
            ))}
            {discordUrl && (
              <a href={discordUrl} target="_blank" rel="noopener noreferrer" style={{
                flex: 1,
                padding: '10px',
                background: 'none',
                border: 'none',
                borderBottom: '2px solid transparent',
                color: '#647489',
                fontSize: '13px',
                fontWeight: '500',
                cursor: 'pointer',
                textDecoration: 'none',
                textAlign: 'center',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                🎮 Discord
              </a>
            )}
          </div>

          {/* ABA CHAT */}
          {aba === 'chat' && (
            <>
              {/* Mensagens */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {mensagens.length === 0 && (
                  <div style={{ textAlign: 'center', color: '#647489', fontSize: '13px', padding: '24px 0' }}>
                    <div style={{ fontSize: '32px', marginBottom: '8px' }}>💬</div>
                    Nenhuma mensagem ainda. Seja o primeiro!
                  </div>
                )}
                {mensagens.map(m => (
                  <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: m.isBot ? 'flex-start' : m.isMeu ? 'flex-end' : 'flex-start', gap: '2px' }}>
                    <span style={{ fontSize: '11px', color: '#647489', paddingLeft: '4px', paddingRight: '4px' }}>
                      {m.isBot ? m.nome : m.isMeu ? 'Você' : m.nome}
                    </span>
                    <div style={{
                      maxWidth: '80%',
                      padding: '8px 12px',
                      borderRadius: m.isMeu ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                      background: m.isBot ? 'rgba(59,130,246,0.12)' : m.isMeu ? '#3B82F6' : '#1E2939',
                      color: m.isMeu ? '#fff' : '#F1F5FA',
                      fontSize: '13px',
                      lineHeight: 1.5,
                      border: m.isBot ? '1px solid rgba(59,130,246,0.25)' : 'none',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}>
                      {m.mensagem.replace(/\*\*(.*?)\*\*/g, '$1')}
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>

              {/* Input */}
              <div style={{ borderTop: '1px solid #1E2939', padding: '12px', flexShrink: 0 }}>
                {statusMsg && !podeEscrever && (
                  <div style={{ fontSize: '12px', color: '#FBBF24', marginBottom: '8px', textAlign: 'center', padding: '6px 10px', background: 'rgba(251,191,36,0.08)', borderRadius: '6px' }}>
                    {statusMsg}
                  </div>
                )}
                {!podeEscrever && !statusMsg && (
                  <div style={{ fontSize: '12px', color: '#647489', marginBottom: '8px', textAlign: 'center', padding: '6px 10px', background: 'rgba(100,116,137,0.08)', borderRadius: '6px' }}>
                    <a href="/login" style={{ color: '#3B82F6', textDecoration: 'none' }}>Entre</a> ou <a href="/#preco" style={{ color: '#3B82F6', textDecoration: 'none' }}>assine</a> para participar do chat.
                  </div>
                )}
                {podeEscrever && (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      value={texto}
                      onChange={e => setTexto(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarMensagem() } }}
                      placeholder="Digite sua mensagem..."
                      maxLength={500}
                      style={{ flex: 1, padding: '8px 12px', background: '#0D1424', border: '1px solid #1E2939', borderRadius: '8px', color: '#F1F5FA', fontSize: '13px', outline: 'none' }}
                    />
                    <button
                      onClick={enviarMensagem}
                      disabled={enviando || !texto.trim()}
                      style={{ padding: '8px 14px', background: enviando || !texto.trim() ? '#1E2939' : '#3B82F6', border: 'none', borderRadius: '8px', color: '#fff', cursor: enviando || !texto.trim() ? 'not-allowed' : 'pointer', fontSize: '16px', transition: 'background 0.15s' }}>
                      {enviando ? '...' : '➤'}
                    </button>
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

                  <input value={ticketForm.nome} onChange={e => setTicketForm(f => ({ ...f, nome: e.target.value }))}
                    placeholder="Seu nome" style={inputStyle} />
                  <input value={ticketForm.email} onChange={e => setTicketForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="Seu e-mail" type="email" style={inputStyle} />

                  <select value={ticketForm.assunto} onChange={e => setTicketForm(f => ({ ...f, assunto: e.target.value }))}
                    style={{ ...inputStyle, cursor: 'pointer' }}>
                    {ASSUNTOS.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>

                  <textarea value={ticketForm.mensagem} onChange={e => setTicketForm(f => ({ ...f, mensagem: e.target.value }))}
                    placeholder="Descreva sua dúvida ou problema..." maxLength={2000} rows={4}
                    style={{ ...inputStyle, resize: 'none', lineHeight: 1.5 }} />

                  {ticketMsg && !ticketSucesso && (
                    <p style={{ fontSize: '12px', color: '#EF4444', margin: 0 }}>{ticketMsg}</p>
                  )}

                  <button onClick={enviarTicket} disabled={ticketEnviando} style={{
                    padding: '10px', background: ticketEnviando ? '#1E2939' : '#3B82F6',
                    border: 'none', borderRadius: '8px', color: '#fff', fontSize: '13px',
                    fontWeight: '700', cursor: ticketEnviando ? 'not-allowed' : 'pointer',
                  }}>
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
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '12px 20px',
          background: aberto ? '#1E2939' : '#3B82F6',
          border: 'none',
          borderRadius: '999px',
          color: '#fff',
          fontSize: '14px',
          fontWeight: '700',
          cursor: 'pointer',
          boxShadow: '0 8px 24px rgba(59,130,246,0.4)',
          transition: 'all 0.2s',
          marginLeft: 'auto',
        }}
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
  width: '100%',
  padding: '8px 12px',
  background: '#0D1424',
  border: '1px solid #1E2939',
  borderRadius: '8px',
  color: '#F1F5FA',
  fontSize: '13px',
  outline: 'none',
  boxSizing: 'border-box',
}
