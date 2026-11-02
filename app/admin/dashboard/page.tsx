'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface Cupom {
  id: string; codigo: string; tipo: string; valor: number
  usos_maximos: number | null; usos_atuais: number; expira_em: string | null; ativo: boolean
}
interface Stats { usuarios: number; vendas: number; receita: number }
interface Config { preco: number; preco_semestral: number; preco_anual: number; imagem_url: string; link_download: string; produto_nome: string; discord_url?: string; bot_avatar_url?: string }
interface Licenca {
  id: string; tipo: string | null; key: string | null; ativa: boolean
  expira_em: string; hwid: string | null; statusHwid: string; ultimo_acesso: string | null
  usuarios: { nome: string; sobrenome: string; email: string }
}
interface IpSuspeito { ip: string; totalUsuarios: number }
interface IpBloqueado { id: string; ip: string; motivo: string; criado_em: string }
interface Ticket {
  id: string; nome: string; email: string; assunto: string
  status: 'aberto' | 'em_andamento' | 'resolvido'; criado_em: string
  respondido_em: string | null; mensagem?: string; resposta_admin?: string; usuario_id?: string
}
interface TicketMensagem {
  id: string; remetente: 'usuario' | 'admin'; mensagem: string; lida: boolean; criado_em: string
}

export default function AdminDashboard() {
  const router = useRouter()
  const [aba, setAba] = useState<'dashboard'|'cupons'|'usuarios'|'vendas'|'configuracoes'|'licencas'|'ips'|'tickets'|'chat'>('dashboard')
  const [stats, setStats] = useState<Stats>({ usuarios: 0, vendas: 0, receita: 0 })
  const [licencas, setLicencas] = useState<Licenca[]>([])
  const [ipSuspeitos, setIpSuspeitos] = useState<IpSuspeito[]>([])
  const [ipBloqueados, setIpBloqueados] = useState<IpBloqueado[]>([])
  const [novaLicencaUsuario, setNovaLicencaUsuario] = useState('')
  const [novaLicencaTipo, setNovaLicencaTipo] = useState('key')
  const [novaLicencaDias, setNovaLicencaDias] = useState('30')
  const [licencaMsg, setLicencaMsg] = useState('')
  const [cupons, setCupons] = useState<Cupom[]>([])
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [ticketFiltro, setTicketFiltro] = useState('todos')
  const [ticketAberto, setTicketAberto] = useState<Ticket | null>(null)
  const [ticketResposta, setTicketResposta] = useState('')
  const [ticketMsg, setTicketMsg] = useState('')
  // Conversa bidirecional
  const [ticketConversa, setTicketConversa] = useState<TicketMensagem[]>([])
  const [ticketConversaLoading, setTicketConversaLoading] = useState(false)
  const conversaEndRef = useRef<HTMLDivElement>(null)
  const conversaPollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [chatMensagens, setChatMensagens] = useState<{id:string;nome:string;mensagem:string;criado_em:string}[]>([])
  const [chatMsg, setChatMsg] = useState('')
  const [usuarios, setUsuarios] = useState<{id:string;nome:string;sobrenome:string;email:string;telefone:string;criado_em:string}[]>([])
  const [pedidos, setPedidos] = useState<{id:string;valor_original:number;valor_desconto:number;valor_final:number;status:string;criado_em:string;usuario_id:string;cupons:{codigo:string}|null}[]>([])
  const [novoCupom, setNovoCupom] = useState({ codigo: '', tipo: 'porcentagem', valor: '', usos_maximos: '', expira_em: '' })
  const [cupomMsg, setCupomMsg] = useState('')
  const [config, setConfig] = useState<Config>({ preco: 31.99, preco_semestral: 134.90, preco_anual: 289.90, imagem_url: '', link_download: '', produto_nome: 'SumblerControl' })
  const [configMsg, setConfigMsg] = useState('')
  const [configLoading, setConfigLoading] = useState(false)

  useEffect(() => { carregarDados() }, [aba])

  async function carregarDados() {
    try {
      if (aba === 'configuracoes') {
        const res = await fetch('/api/admin/config', { credentials: 'include' })
        if (res.status === 401) { router.push('/admin'); return }
        const data = await res.json()
        setConfig(data)
        return
      }
      if (aba === 'licencas') {
        const res = await fetch('/api/admin/licencas', { credentials: 'include' })
        if (res.status === 401) { router.push('/admin'); return }
        setLicencas(await res.json())
        return
      }
      if (aba === 'ips') {
        const res = await fetch('/api/admin/ips', { credentials: 'include' })
        if (res.status === 401) { router.push('/admin'); return }
        const data = await res.json()
        setIpSuspeitos(data.suspeitos || [])
        setIpBloqueados(data.bloqueados || [])
        return
      }
      if (aba === 'tickets') {
        const res = await fetch(`/api/tickets?status=${ticketFiltro}`, { credentials: 'include' })
        if (res.status === 401) { router.push('/admin'); return }
        const data = await res.json()
        setTickets(data.tickets || [])
        return
      }
      if (aba === 'chat') {
        const res = await fetch('/api/chat/mensagens', { credentials: 'include' })
        const data = await res.json()
        setChatMensagens(data.mensagens || [])
        return
      }
      const res = await fetch('/api/admin/dados?tipo=' + aba, { credentials: 'include' })
      if (res.status === 401) { router.push('/admin'); return }
      const data = await res.json()
      if (aba === 'dashboard') setStats(data)
      if (aba === 'cupons') setCupons(data)
      if (aba === 'usuarios') setUsuarios(data)
      if (aba === 'vendas') setPedidos(data)
    } catch { /* silencioso */ }
  }

  async function criarCupom(e: React.FormEvent) {
    e.preventDefault(); setCupomMsg('')
    const res = await fetch('/api/admin/cupons', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...novoCupom, valor: parseFloat(novoCupom.valor), usos_maximos: novoCupom.usos_maximos ? parseInt(novoCupom.usos_maximos) : null, expira_em: novoCupom.expira_em || null })
    })
    const data = await res.json()
    if (res.ok) { setCupomMsg('✓ Cupom criado com sucesso!'); setNovoCupom({ codigo: '', tipo: 'porcentagem', valor: '', usos_maximos: '', expira_em: '' }); carregarDados() }
    else setCupomMsg('✗ ' + data.error)
  }

  async function toggleCupom(id: string, ativo: boolean) {
    await fetch('/api/admin/cupons', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ativo: !ativo }) })
    carregarDados()
  }

  async function reenviarEmail(userId: string) {
    await fetch('/api/admin/reenviar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId }) })
    alert('E-mail reenviado!')
  }

  async function resetarHwid(licencaId: string) {
    if (!confirm('Resetar HWID? O usuário poderá ativar em um novo PC.')) return
    await fetch('/api/admin/licencas/resetar-hwid', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ licenca_id: licencaId }) })
    carregarDados()
  }

  async function toggleLicenca(licencaId: string, ativa: boolean) {
    await fetch('/api/admin/licencas/toggle', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ licenca_id: licencaId, ativa: !ativa }) })
    carregarDados()
  }

  async function renovarLicenca(licencaId: string) {
    await fetch('/api/admin/licencas/renovar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ licenca_id: licencaId, dias: 30 }) })
    carregarDados()
  }

  async function criarLicenca(e: React.FormEvent) {
    e.preventDefault(); setLicencaMsg('')
    const res = await fetch('/api/admin/licencas', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario_id: novaLicencaUsuario, tipo: novaLicencaTipo, dias: parseInt(novaLicencaDias) })
    })
    const data = await res.json()
    if (res.ok) { setLicencaMsg(`✓ Licença criada! Key: ${data.key || '—'}`); carregarDados() }
    else setLicencaMsg('✗ ' + data.error)
  }

  async function responderTicket() {
    if (!ticketAberto || !ticketResposta.trim()) return
    setTicketMsg('')
    // Usa o novo endpoint de mensagens para enviar via conversa
    const res = await fetch(`/api/tickets/${ticketAberto.id}/mensagens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ mensagem: ticketResposta.trim() }),
    })
    if (res.ok) {
      setTicketMsg('✓ Resposta enviada!')
      setTicketResposta('')
      setTicketAberto(prev => prev ? { ...prev, resposta_admin: ticketResposta, status: prev.status === 'aberto' ? 'em_andamento' : prev.status } : null)
      await carregarConversa(ticketAberto.id)
      carregarDados()
    } else {
      const err = await res.json()
      setTicketMsg('✗ ' + (err.error || 'Erro ao enviar resposta.'))
    }
  }

  const carregarConversa = useCallback(async (id: string) => {
    setTicketConversaLoading(true)
    try {
      const res = await fetch(`/api/tickets/${id}/mensagens`, { credentials: 'include' })
      if (!res.ok) return
      const data = await res.json()
      setTicketConversa(data.mensagens || [])
      setTimeout(() => conversaEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    } catch {}
    setTicketConversaLoading(false)
  }, [])

  // Inicia polling da conversa quando um ticket é aberto
  useEffect(() => {
    if (ticketAberto && aba === 'tickets') {
      carregarConversa(ticketAberto.id)
      conversaPollingRef.current = setInterval(() => carregarConversa(ticketAberto.id), 10_000)
    } else {
      if (conversaPollingRef.current) clearInterval(conversaPollingRef.current)
    }
    return () => { if (conversaPollingRef.current) clearInterval(conversaPollingRef.current) }
  }, [ticketAberto, aba, carregarConversa])

  async function deletarTicket(id: string, nome: string, assunto: string) {
    if (!confirm(`Excluir permanentemente o ticket "${assunto}" de ${nome}?\n\nEssa ação remove o ticket, todo o histórico de mensagens e as notificações do usuário. Não pode ser desfeita.`)) return
    const res = await fetch(`/api/tickets/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    if (res.ok) {
      setTicketAberto(null)
      setTicketConversa([])
      setTicketMsg('')
      carregarDados()
    } else {
      const err = await res.json()
      setTicketMsg('✗ ' + (err.error || 'Erro ao excluir ticket.'))
    }
  }

  async function mudarStatusTicket(id: string, status: string) {
    await fetch(`/api/tickets/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status }),
    })
    carregarDados()
    if (ticketAberto?.id === id) setTicketAberto(prev => prev ? { ...prev, status: status as Ticket['status'] } : null)
  }

  async function limparChat() {
    if (!confirm('Tem certeza que deseja apagar TODAS as mensagens do chat? Essa ação não pode ser desfeita.')) return
    const res = await fetch('/api/chat/limpar', { method: 'DELETE', credentials: 'include' })
    if (res.ok) { setChatMsg('✓ Chat limpo com sucesso!'); setChatMensagens([]) }
    else setChatMsg('✗ Erro ao limpar chat.')
  }

  async function banirIp(ip: string) {
    if (!confirm(`Banir IP ${ip}? Todas as licenças vinculadas serão desativadas.`)) return
    await fetch('/api/admin/ips/banir', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ip, motivo: 'Múltiplos usuários' }) })
    carregarDados()
  }

  async function desbloquearIp(ip: string) {
    await fetch('/api/admin/ips/desbloquear', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ip }) })
    carregarDados()
  }

  async function salvarConfig(e: React.FormEvent) {
    e.preventDefault(); setConfigMsg(''); setConfigLoading(true)
    const res = await fetch('/api/admin/config', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    })
    if (res.ok) setConfigMsg('✓ Configurações salvas com sucesso!')
    else setConfigMsg('✗ Erro ao salvar')
    setConfigLoading(false)
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/admin')
  }

  const abas = [
    { id: 'dashboard', label: '📊 Dashboard' },
    { id: 'cupons', label: '🏷️ Cupons' },
    { id: 'usuarios', label: '👥 Usuários' },
    { id: 'vendas', label: '💰 Vendas' },
    { id: 'licencas', label: '🔑 Licenças' },
    { id: 'ips', label: '🌐 IPs' },
    { id: 'tickets', label: '🎫 Tickets' },
    { id: 'chat', label: '💬 Chat' },
    { id: 'configuracoes', label: '⚙️ Configurações' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#090F1A', color: '#F1F5FA' }}>
      <div style={{ display: 'flex' }}>
        {/* Sidebar */}
        <div style={{ width: '220px', minHeight: '100vh', background: '#0D1420', borderRight: '1px solid #1E2939', padding: '24px 16px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ marginBottom: '32px' }}>
            <div style={{ fontSize: '16px', fontWeight: '800', color: '#FBBF24', marginBottom: '4px' }}>⚙️ Admin</div>
            <div style={{ fontSize: '12px', color: '#647489' }}>SumblerControl</div>
          </div>
          {abas.map(a => (
            <button key={a.id} onClick={() => setAba(a.id as typeof aba)} style={{ textAlign: 'left', padding: '10px 12px', borderRadius: '8px', border: 'none', background: aba === a.id ? 'rgba(59,130,246,0.15)' : 'transparent', color: aba === a.id ? '#3B82F6' : '#647489', fontSize: '14px', fontWeight: aba === a.id ? '600' : '400', cursor: 'pointer', marginBottom: '4px' }}>
              {a.label}
            </button>
          ))}
          <button onClick={logout} style={{ marginTop: 'auto', padding: '10px 12px', borderRadius: '8px', border: 'none', background: 'transparent', color: '#EF4444', fontSize: '14px', cursor: 'pointer', textAlign: 'left' }}>
            🚪 Sair
          </button>
        </div>

        {/* Conteúdo */}
        <div style={{ flex: 1, padding: '32px', overflowY: 'auto' }}>

          {/* Dashboard */}
          {aba === 'dashboard' && (
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '24px' }}>Dashboard</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '32px' }}>
                {[
                  { label: 'Usuários cadastrados', value: stats.usuarios, cor: '#3B82F6' },
                  { label: 'Vendas realizadas', value: stats.vendas, cor: '#22C55E' },
                  { label: 'Receita total', value: `R$ ${stats.receita.toFixed(2)}`, cor: '#FBBF24' },
                ].map(s => (
                  <div key={s.label} style={{ background: '#111826', border: '1px solid #1E2939', borderRadius: '12px', padding: '20px' }}>
                    <p style={{ color: '#647489', fontSize: '13px', marginBottom: '8px' }}>{s.label}</p>
                    <p style={{ fontSize: '28px', fontWeight: '800', color: s.cor }}>{s.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Cupons */}
          {aba === 'cupons' && (
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '24px' }}>Gerenciar Cupons</h2>
              <div style={{ background: '#111826', border: '1px solid #1E2939', borderRadius: '12px', padding: '24px', marginBottom: '24px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '16px' }}>Novo Cupom</h3>
                <form onSubmit={criarCupom} style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                  <div>
                    <label style={labelStyle}>Código</label>
                    <input value={novoCupom.codigo} onChange={e => setNovoCupom(p => ({ ...p, codigo: e.target.value.toUpperCase() }))} placeholder="EX: PROMO30" required style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Tipo</label>
                    <select value={novoCupom.tipo} onChange={e => setNovoCupom(p => ({ ...p, tipo: e.target.value }))} style={inputStyle}>
                      <option value="porcentagem">% Desconto</option>
                      <option value="reais">R$ Fixo</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Valor ({novoCupom.tipo === 'porcentagem' ? '%' : 'R$'})</label>
                    <input type="number" value={novoCupom.valor} onChange={e => setNovoCupom(p => ({ ...p, valor: e.target.value }))} placeholder={novoCupom.tipo === 'porcentagem' ? '30' : '10.00'} required style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Usos máximos (vazio = ilimitado)</label>
                    <input type="number" value={novoCupom.usos_maximos} onChange={e => setNovoCupom(p => ({ ...p, usos_maximos: e.target.value }))} placeholder="100" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Expira em (opcional)</label>
                    <input type="date" value={novoCupom.expira_em} onChange={e => setNovoCupom(p => ({ ...p, expira_em: e.target.value }))} style={inputStyle} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                    <button type="submit" style={{ width: '100%', padding: '10px', background: '#3B82F6', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>
                      Criar Cupom
                    </button>
                  </div>
                </form>
                {cupomMsg && <p style={{ marginTop: '12px', fontSize: '13px', color: cupomMsg.startsWith('✓') ? '#22C55E' : '#EF4444' }}>{cupomMsg}</p>}
              </div>
              <div style={{ background: '#111826', border: '1px solid #1E2939', borderRadius: '12px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr style={{ background: '#151D2C' }}>
                    {['Código', 'Tipo', 'Valor', 'Usos', 'Expira', 'Status', 'Ação'].map(h => (
                      <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', color: '#647489', fontWeight: '600' }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {cupons.map(c => (
                      <tr key={c.id} style={{ borderTop: '1px solid #1E2939' }}>
                        <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: '#3B82F6' }}>{c.codigo}</td>
                        <td style={{ padding: '12px 16px', fontSize: '13px', color: '#647489' }}>{c.tipo === 'porcentagem' ? '%' : 'R$'}</td>
                        <td style={{ padding: '12px 16px', fontSize: '13px' }}>{c.tipo === 'porcentagem' ? `${c.valor}%` : `R$ ${c.valor}`}</td>
                        <td style={{ padding: '12px 16px', fontSize: '13px' }}>{c.usos_atuais}/{c.usos_maximos ?? '∞'}</td>
                        <td style={{ padding: '12px 16px', fontSize: '13px', color: '#647489' }}>{c.expira_em ? new Date(c.expira_em).toLocaleDateString('pt-BR') : '—'}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ padding: '3px 8px', borderRadius: '999px', fontSize: '12px', background: c.ativo ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', color: c.ativo ? '#22C55E' : '#EF4444' }}>
                            {c.ativo ? 'Ativo' : 'Inativo'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <button onClick={() => toggleCupom(c.id, c.ativo)} style={{ padding: '4px 10px', background: '#151D2C', border: '1px solid #243044', borderRadius: '6px', color: '#F1F5FA', fontSize: '12px', cursor: 'pointer' }}>
                            {c.ativo ? 'Desativar' : 'Ativar'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Usuários */}
          {aba === 'usuarios' && (
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '24px' }}>Usuários ({usuarios.length})</h2>
              <div style={{ background: '#111826', border: '1px solid #1E2939', borderRadius: '12px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr style={{ background: '#151D2C' }}>
                    {['Nome', 'E-mail', 'Telefone', 'Cadastro', 'Ação'].map(h => (
                      <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', color: '#647489', fontWeight: '600' }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {usuarios.map(u => (
                      <tr key={u.id} style={{ borderTop: '1px solid #1E2939' }}>
                        <td style={{ padding: '12px 16px', fontSize: '14px' }}>{u.nome} {u.sobrenome}</td>
                        <td style={{ padding: '12px 16px', fontSize: '13px', color: '#647489' }}>{u.email}</td>
                        <td style={{ padding: '12px 16px', fontSize: '13px', color: '#647489' }}>{u.telefone}</td>
                        <td style={{ padding: '12px 16px', fontSize: '13px', color: '#647489' }}>{new Date(u.criado_em).toLocaleDateString('pt-BR')}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <button onClick={() => reenviarEmail(u.id)} style={{ padding: '4px 10px', background: '#151D2C', border: '1px solid #243044', borderRadius: '6px', color: '#F1F5FA', fontSize: '12px', cursor: 'pointer' }}>
                            Reenviar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Vendas */}
          {aba === 'vendas' && (
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '24px' }}>Vendas</h2>
              <div style={{ background: '#111826', border: '1px solid #1E2939', borderRadius: '12px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr style={{ background: '#151D2C' }}>
                    {['Pedido', 'Valor', 'Desconto', 'Cupom', 'Status', 'Data'].map(h => (
                      <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', color: '#647489', fontWeight: '600' }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {pedidos.map(p => (
                      <tr key={p.id} style={{ borderTop: '1px solid #1E2939' }}>
                        <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: '13px', color: '#3B82F6' }}>#{p.id.slice(0,8).toUpperCase()}</td>
                        <td style={{ padding: '12px 16px', fontSize: '14px', fontWeight: '600' }}>
                          R$ {p.valor_final.toFixed(2)}
                          {p.valor_original && p.valor_original > p.valor_final && (
                            <span style={{ fontSize: '11px', color: '#647489', marginLeft: '4px', textDecoration: 'line-through' }}>
                              R$ {p.valor_original.toFixed(2)}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: '13px' }}>
                          {p.valor_desconto > 0
                            ? <span style={{ color: '#22C55E' }}>-R$ {p.valor_desconto.toFixed(2)}</span>
                            : <span style={{ color: '#647489' }}>—</span>
                          }
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          {p.cupons?.codigo
                            ? <span style={{ fontFamily: 'monospace', fontSize: '12px', color: '#FBBF24', background: 'rgba(251,191,36,0.08)', padding: '2px 8px', borderRadius: '4px' }}>{p.cupons.codigo}</span>
                            : <span style={{ color: '#647489', fontSize: '12px' }}>—</span>
                          }
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ padding: '3px 8px', borderRadius: '999px', fontSize: '12px', background: p.status === 'pago' ? 'rgba(34,197,94,0.1)' : p.status === 'pendente' ? 'rgba(251,191,36,0.1)' : 'rgba(239,68,68,0.1)', color: p.status === 'pago' ? '#22C55E' : p.status === 'pendente' ? '#FBBF24' : '#EF4444' }}>
                            {p.status}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: '13px', color: '#647489' }}>{new Date(p.criado_em).toLocaleDateString('pt-BR')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Configurações */}
          {aba === 'configuracoes' && (
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '8px' }}>Configurações do Site</h2>
              <p style={{ color: '#647489', fontSize: '14px', marginBottom: '28px' }}>Alterações aplicadas em tempo real para todos os visitantes.</p>
              <form onSubmit={salvarConfig} style={{ background: '#111826', border: '1px solid #1E2939', borderRadius: '12px', padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '560px' }}>

                <div>
                  <label style={labelStyle}>Nome do produto</label>
                  <input value={config.produto_nome} onChange={e => setConfig(p => ({ ...p, produto_nome: e.target.value }))} placeholder="SumblerControl" style={inputStyle} />
                </div>

                <div>
                  <label style={labelStyle}>Preço Mensal (R$)</label>
                  <input
                    type="number" step="0.01" min="0.01"
                    value={config.preco}
                    onChange={e => setConfig(p => ({ ...p, preco: parseFloat(e.target.value) }))}
                    style={inputStyle}
                  />
                  <p style={{ fontSize: '12px', color: '#647489', marginTop: '4px' }}>Valor atual: R$ {config.preco.toFixed(2)}</p>
                </div>

                <div>
                  <label style={labelStyle}>Preço Semestral (R$)</label>
                  <input
                    type="number" step="0.01" min="0.01"
                    value={config.preco_semestral}
                    onChange={e => setConfig(p => ({ ...p, preco_semestral: parseFloat(e.target.value) }))}
                    style={inputStyle}
                  />
                  <p style={{ fontSize: '12px', color: '#647489', marginTop: '4px' }}>De R$ 197,90 → R$ {config.preco_semestral?.toFixed(2)}</p>
                </div>

                <div>
                  <label style={labelStyle}>Preço Anual (R$)</label>
                  <input
                    type="number" step="0.01" min="0.01"
                    value={config.preco_anual}
                    onChange={e => setConfig(p => ({ ...p, preco_anual: parseFloat(e.target.value) }))}
                    style={inputStyle}
                  />
                  <p style={{ fontSize: '12px', color: '#647489', marginTop: '4px' }}>De R$ 349,90 → R$ {config.preco_anual?.toFixed(2)}</p>
                </div>

                <div>
                  <label style={labelStyle}>Link de download do instalador</label>
                  <input value={config.link_download} onChange={e => setConfig(p => ({ ...p, link_download: e.target.value }))} placeholder="https://..." style={inputStyle} />
                  <p style={{ fontSize: '12px', color: '#647489', marginTop: '4px' }}>Link enviado por e-mail após pagamento.</p>
                </div>

                <div>
                  <label style={labelStyle}>URL da imagem do produto</label>
                  <input value={config.imagem_url} onChange={e => setConfig(p => ({ ...p, imagem_url: e.target.value }))} placeholder="https://... ou /assets/SumblerControl.png" style={inputStyle} />
                </div>

                <div>
                  <label style={labelStyle}>Link do Discord</label>
                  <input
                    value={(config as Config & { discord_url?: string }).discord_url || ''}
                    onChange={e => setConfig(p => ({ ...p, discord_url: e.target.value }))}
                    placeholder="https://discord.gg/..."
                    style={inputStyle}
                  />
                  <p style={{ fontSize: '12px', color: '#647489', marginTop: '4px' }}>Aparece no botão Discord do widget de suporte e na página principal.</p>
                </div>

                {/* Imagem do Bot */}
                <div>
                  <label style={labelStyle}>Imagem do Bot (URL)</label>
                  <input
                    value={config.bot_avatar_url || ''}
                    onChange={e => setConfig(p => ({ ...p, bot_avatar_url: e.target.value }))}
                    placeholder="https://... (URL pública da imagem)"
                    style={inputStyle}
                  />
                  <p style={{ fontSize: '12px', color: '#647489', marginTop: '4px' }}>Aparece ao lado das mensagens automáticas do bot no chat. Recomendado: 40x40px.</p>
                  {config.bot_avatar_url && (
                    <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <img src={config.bot_avatar_url} alt="Bot" style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #1E2939' }} />
                      <span style={{ fontSize: '12px', color: '#647489' }}>Preview da imagem do bot</span>
                    </div>
                  )}
                </div>

                {configMsg && (
                  <div style={{ background: configMsg.startsWith('✓') ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${configMsg.startsWith('✓') ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`, borderRadius: '8px', padding: '12px', fontSize: '13px', color: configMsg.startsWith('✓') ? '#22C55E' : '#EF4444' }}>
                    {configMsg}
                  </div>
                )}

                <button type="submit" disabled={configLoading} style={{ padding: '12px', background: '#3B82F6', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '700', cursor: 'pointer' }}>
                  {configLoading ? 'Salvando...' : '💾 Salvar Configurações'}
                </button>
              </form>
            </div>
          )}

          {/* Licenças */}
          {aba === 'licencas' && (
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '24px' }}>🔑 Licenças</h2>

              {/* Criar licença manual */}
              <div style={{ background: '#111826', border: '1px solid #1E2939', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '14px' }}>+ Nova Licença Manual</h3>
                <form onSubmit={criarLicenca} style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr) auto', gap: '10px', alignItems: 'flex-end' }}>
                  <div>
                    <label style={labelStyle}>ID do Usuário</label>
                    <input value={novaLicencaUsuario} onChange={e => setNovaLicencaUsuario(e.target.value)} placeholder="UUID do usuário" required style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Tipo</label>
                    <select value={novaLicencaTipo} onChange={e => setNovaLicencaTipo(e.target.value)} style={inputStyle}>
                      <option value="key">Key</option>
                      <option value="usuario_senha">Usuário e Senha</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Dias</label>
                    <input type="number" value={novaLicencaDias} onChange={e => setNovaLicencaDias(e.target.value)} min="1" style={inputStyle} />
                  </div>
                  <button type="submit" style={{ padding: '9px 16px', background: '#3B82F6', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    Criar
                  </button>
                </form>
                {licencaMsg && <p style={{ marginTop: '10px', fontSize: '13px', color: licencaMsg.startsWith('✓') ? '#22C55E' : '#EF4444' }}>{licencaMsg}</p>}
              </div>

              {/* Lista de licenças */}
              <div style={{ background: '#111826', border: '1px solid #1E2939', borderRadius: '12px', overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '900px' }}>
                  <thead><tr style={{ background: '#151D2C' }}>
                    {['Usuário', 'Tipo', 'Key', 'Expira', 'HWID', 'Status', 'Ações'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '11px', color: '#647489', fontWeight: '600' }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {licencas.map(l => {
                      const u = l.usuarios
                      const expirou = new Date(l.expira_em) < new Date()
                      return (
                        <tr key={l.id} style={{ borderTop: '1px solid #1E2939' }}>
                          <td style={{ padding: '10px 14px' }}>
                            <p style={{ fontSize: '13px', fontWeight: '600' }}>{u?.nome} {u?.sobrenome}</p>
                            <p style={{ fontSize: '11px', color: '#647489' }}>{u?.email}</p>
                          </td>
                          <td style={{ padding: '10px 14px', fontSize: '12px', color: '#647489' }}>
                            {!l.tipo ? '⏳ Pendente' : l.tipo === 'key' ? '🔑 Key' : '👤 U/S'}
                          </td>
                          <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: '11px', color: '#3B82F6' }}>
                            {l.key || '—'}
                          </td>
                          <td style={{ padding: '10px 14px', fontSize: '12px', color: expirou ? '#EF4444' : '#647489' }}>
                            {new Date(l.expira_em).toLocaleDateString('pt-BR')}
                            {expirou && <span style={{ marginLeft: '4px' }}>❌</span>}
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '999px', background: l.statusHwid === 'ativado' ? 'rgba(34,197,94,0.1)' : 'rgba(251,191,36,0.1)', color: l.statusHwid === 'ativado' ? '#22C55E' : '#FBBF24' }}>
                              {l.statusHwid === 'ativado' ? '✅ Ativado' : '⏳ Pendente'}
                            </span>
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '999px', background: l.ativa ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', color: l.ativa ? '#22C55E' : '#EF4444' }}>
                              {l.ativa ? 'Ativa' : 'Inativa'}
                            </span>
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                              {l.statusHwid === 'ativado' && (
                                <button onClick={() => resetarHwid(l.id)} style={btnAcaoStyle}>Reset HWID</button>
                              )}
                              <button onClick={() => toggleLicenca(l.id, l.ativa)} style={{ ...btnAcaoStyle, color: l.ativa ? '#EF4444' : '#22C55E' }}>
                                {l.ativa ? 'Desativar' : 'Ativar'}
                              </button>
                              <button onClick={() => renovarLicenca(l.id)} style={btnAcaoStyle}>+30d</button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                    {licencas.length === 0 && (
                      <tr><td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: '#647489', fontSize: '13px' }}>Nenhuma licença encontrada.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* IPs */}
          {aba === 'ips' && (
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '24px' }}>🌐 Monitoramento de IPs</h2>

              {/* Suspeitos */}
              <div style={{ background: '#111826', border: '1px solid #1E2939', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '14px', color: '#FBBF24' }}>⚠️ IPs Suspeitos (múltiplos usuários)</h3>
                {ipSuspeitos.length === 0 ? (
                  <p style={{ color: '#647489', fontSize: '13px' }}>Nenhum IP suspeito detectado.</p>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr style={{ background: '#151D2C' }}>
                      {['IP', 'Usuários distintos', 'Ações'].map(h => (
                        <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '11px', color: '#647489', fontWeight: '600' }}>{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {ipSuspeitos.map(s => (
                        <tr key={s.ip} style={{ borderTop: '1px solid #1E2939' }}>
                          <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: '13px' }}>{s.ip}</td>
                          <td style={{ padding: '10px 14px', fontSize: '13px', color: '#FBBF24' }}>{s.totalUsuarios} usuários</td>
                          <td style={{ padding: '10px 14px' }}>
                            <button onClick={() => banirIp(s.ip)} style={{ ...btnAcaoStyle, color: '#EF4444' }}>🚫 Banir IP</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Bloqueados */}
              <div style={{ background: '#111826', border: '1px solid #1E2939', borderRadius: '12px', padding: '20px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '14px', color: '#EF4444' }}>🚫 IPs Bloqueados</h3>
                {ipBloqueados.length === 0 ? (
                  <p style={{ color: '#647489', fontSize: '13px' }}>Nenhum IP bloqueado.</p>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr style={{ background: '#151D2C' }}>
                      {['IP', 'Motivo', 'Bloqueado em', 'Ações'].map(h => (
                        <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '11px', color: '#647489', fontWeight: '600' }}>{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {ipBloqueados.map(b => (
                        <tr key={b.id} style={{ borderTop: '1px solid #1E2939' }}>
                          <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: '13px' }}>{b.ip}</td>
                          <td style={{ padding: '10px 14px', fontSize: '13px', color: '#647489' }}>{b.motivo}</td>
                          <td style={{ padding: '10px 14px', fontSize: '13px', color: '#647489' }}>{new Date(b.criado_em).toLocaleDateString('pt-BR')}</td>
                          <td style={{ padding: '10px 14px' }}>
                            <button onClick={() => desbloquearIp(b.ip)} style={{ ...btnAcaoStyle, color: '#22C55E' }}>✅ Desbloquear</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* ── TICKETS ── */}
          {aba === 'tickets' && (
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '24px' }}>🎫 Tickets de Suporte</h2>

              {/* Filtros */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
                {['todos', 'aberto', 'em_andamento', 'resolvido'].map(f => (
                  <button key={f} onClick={() => { setTicketFiltro(f); setTicketAberto(null) }}
                    style={{ padding: '6px 14px', background: ticketFiltro === f ? '#3B82F6' : '#151D2C', border: '1px solid #243044', borderRadius: '999px', color: ticketFiltro === f ? '#fff' : '#647489', fontSize: '12px', fontWeight: '600', cursor: 'pointer', textTransform: 'capitalize' }}>
                    {f === 'todos' ? 'Todos' : f === 'aberto' ? '🔴 Aberto' : f === 'em_andamento' ? '🟡 Em andamento' : '✅ Resolvido'}
                  </button>
                ))}
                <button onClick={carregarDados} style={{ padding: '6px 14px', background: '#151D2C', border: '1px solid #243044', borderRadius: '999px', color: '#647489', fontSize: '12px', cursor: 'pointer' }}>🔄 Atualizar</button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: ticketAberto ? '1fr 1fr' : '1fr', gap: '16px' }}>
                {/* Lista */}
                <div style={{ background: '#111826', border: '1px solid #1E2939', borderRadius: '12px', overflow: 'hidden' }}>
                  {tickets.length === 0 ? (
                    <div style={{ padding: '32px', textAlign: 'center', color: '#647489', fontSize: '14px' }}>Nenhum ticket encontrado.</div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead><tr style={{ background: '#151D2C' }}>
                        {['Nome', 'Assunto', 'Status', 'Data', ''].map(h => (
                          <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '11px', color: '#647489', fontWeight: '600' }}>{h}</th>
                        ))}
                      </tr></thead>
                      <tbody>
                        {tickets.map(t => (
                          <tr key={t.id} onClick={() => { setTicketAberto(t); setTicketResposta(''); setTicketMsg(''); setTicketConversa([]) }}
                            style={{ borderTop: '1px solid #1E2939', cursor: 'pointer', background: ticketAberto?.id === t.id ? 'rgba(59,130,246,0.06)' : 'transparent' }}>
                            <td style={{ padding: '10px 14px', fontSize: '13px' }}>{t.nome}</td>
                            <td style={{ padding: '10px 14px', fontSize: '13px', color: '#647489' }}>{t.assunto}</td>
                            <td style={{ padding: '10px 14px' }}>
                              <span style={{ padding: '2px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: '600',
                                background: t.status === 'aberto' ? 'rgba(239,68,68,0.1)' : t.status === 'em_andamento' ? 'rgba(251,191,36,0.1)' : 'rgba(34,197,94,0.1)',
                                color: t.status === 'aberto' ? '#EF4444' : t.status === 'em_andamento' ? '#FBBF24' : '#22C55E' }}>
                                {t.status === 'aberto' ? 'Aberto' : t.status === 'em_andamento' ? 'Em andamento' : 'Resolvido'}
                              </span>
                            </td>
                            <td style={{ padding: '10px 14px', fontSize: '12px', color: '#647489' }}>{new Date(t.criado_em).toLocaleDateString('pt-BR')}</td>
                            <td style={{ padding: '10px 14px' }}>
                              <span style={{ fontSize: '16px', color: '#3B82F6' }}>→</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Detalhe do ticket */}
                {ticketAberto && (
                  <div style={{ background: '#111826', border: '1px solid #1E2939', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {/* Cabeçalho */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h3 style={{ fontSize: '15px', fontWeight: '700', margin: 0 }}>#{ticketAberto.id.slice(0,8).toUpperCase()}</h3>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                          onClick={() => deletarTicket(ticketAberto.id, ticketAberto.nome, ticketAberto.assunto)}
                          title="Excluir ticket permanentemente"
                          style={{ padding: '4px 10px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '6px', color: '#EF4444', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.16)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.08)')}>
                          🗑 Excluir
                        </button>
                        <button onClick={() => { setTicketAberto(null); setTicketConversa([]) }} style={{ background: 'none', border: 'none', color: '#647489', cursor: 'pointer', fontSize: '18px' }}>×</button>
                      </div>
                    </div>

                    {/* Metadados */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <div><p style={{ fontSize: '11px', color: '#647489', marginBottom: '2px' }}>Nome</p><p style={{ fontSize: '13px', margin: 0 }}>{ticketAberto.nome}</p></div>
                      <div><p style={{ fontSize: '11px', color: '#647489', marginBottom: '2px' }}>E-mail</p><p style={{ fontSize: '13px', margin: 0 }}>{ticketAberto.email}</p></div>
                      <div><p style={{ fontSize: '11px', color: '#647489', marginBottom: '2px' }}>Assunto</p><p style={{ fontSize: '13px', margin: 0 }}>{ticketAberto.assunto}</p></div>
                      <div><p style={{ fontSize: '11px', color: '#647489', marginBottom: '2px' }}>Status</p>
                        <select value={ticketAberto.status} onChange={e => mudarStatusTicket(ticketAberto.id, e.target.value)}
                          style={{ padding: '4px 8px', background: '#151D2C', border: '1px solid #243044', borderRadius: '6px', color: '#F1F5FA', fontSize: '12px', cursor: 'pointer' }}>
                          <option value="aberto">Aberto</option>
                          <option value="em_andamento">Em andamento</option>
                          <option value="resolvido">Resolvido</option>
                        </select>
                      </div>
                    </div>

                    {/* Conversa */}
                    <div>
                      <p style={{ fontSize: '11px', color: '#647489', marginBottom: '8px' }}>Conversa</p>
                      <div style={{ background: '#0D1424', border: '1px solid #1E2939', borderRadius: '8px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '280px', overflowY: 'auto' }}>
                        {ticketConversaLoading && ticketConversa.length === 0 && (
                          <p style={{ fontSize: '12px', color: '#647489', textAlign: 'center', margin: 0 }}>Carregando...</p>
                        )}
                        {!ticketConversaLoading && ticketConversa.length === 0 && (
                          <p style={{ fontSize: '12px', color: '#647489', textAlign: 'center', margin: 0 }}>Nenhuma mensagem ainda.</p>
                        )}
                        {ticketConversa.map(m => {
                          const isAdmin = m.remetente === 'admin'
                          return (
                            <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isAdmin ? 'flex-end' : 'flex-start', gap: '3px' }}>
                              <span style={{ fontSize: '10px', color: isAdmin ? '#3B82F6' : '#647489' }}>
                                {isAdmin ? '🛡 Você (admin)' : `👤 ${ticketAberto.nome}`} · {new Date(m.criado_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                              </span>
                              <div style={{ maxWidth: '85%', padding: '8px 12px', borderRadius: isAdmin ? '12px 2px 12px 12px' : '2px 12px 12px 12px', background: isAdmin ? 'rgba(59,130,246,0.12)' : '#1E2939', color: '#F1F5FA', fontSize: '13px', lineHeight: 1.5, border: isAdmin ? '1px solid rgba(59,130,246,0.2)' : 'none', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                {m.mensagem}
                              </div>
                            </div>
                          )
                        })}
                        <div ref={conversaEndRef} />
                      </div>
                    </div>

                    {/* Input de resposta */}
                    {ticketAberto.status !== 'resolvido' ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <textarea value={ticketResposta} onChange={e => setTicketResposta(e.target.value)} rows={3}
                          placeholder="Digite a resposta para o cliente..."
                          style={{ width: '100%', padding: '10px', background: '#151D2C', border: '1px solid #1E2939', borderRadius: '8px', color: '#F1F5FA', fontSize: '13px', resize: 'vertical', boxSizing: 'border-box', outline: 'none' }} />
                        {ticketMsg && <p style={{ fontSize: '12px', color: ticketMsg.startsWith('✓') ? '#22C55E' : '#EF4444', margin: 0 }}>{ticketMsg}</p>}
                        <button onClick={responderTicket} disabled={!ticketResposta.trim()} style={{ padding: '10px', background: !ticketResposta.trim() ? '#1E2939' : '#3B82F6', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '13px', fontWeight: '700', cursor: !ticketResposta.trim() ? 'not-allowed' : 'pointer' }}>
                          ➤ Enviar Resposta
                        </button>
                      </div>
                    ) : (
                      <div style={{ padding: '10px', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: '8px', textAlign: 'center' }}>
                        <p style={{ fontSize: '13px', color: '#22C55E', fontWeight: '600', margin: 0 }}>✅ Ticket resolvido</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── CHAT ── */}
          {aba === 'chat' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                <h2 style={{ fontSize: '20px', fontWeight: '800', margin: 0 }}>💬 Chat de Suporte</h2>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <button onClick={carregarDados} style={{ padding: '8px 14px', background: '#151D2C', border: '1px solid #243044', borderRadius: '8px', color: '#647489', fontSize: '13px', cursor: 'pointer' }}>🔄 Atualizar</button>
                  <button onClick={limparChat} style={{ padding: '8px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', color: '#EF4444', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>🗑️ Limpar Chat</button>
                </div>
              </div>
              {chatMsg && <p style={{ fontSize: '13px', color: chatMsg.startsWith('✓') ? '#22C55E' : '#EF4444', marginBottom: '16px' }}>{chatMsg}</p>}
              <div style={{ background: '#111826', border: '1px solid #1E2939', borderRadius: '12px', overflow: 'hidden' }}>
                {chatMensagens.length === 0 ? (
                  <div style={{ padding: '32px', textAlign: 'center', color: '#647489', fontSize: '14px' }}>Nenhuma mensagem no chat.</div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr style={{ background: '#151D2C' }}>
                      {['Usuário', 'Mensagem', 'Data/Hora'].map(h => (
                        <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '11px', color: '#647489', fontWeight: '600' }}>{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {chatMensagens.map(m => (
                        <tr key={m.id} style={{ borderTop: '1px solid #1E2939' }}>
                          <td style={{ padding: '10px 14px', fontSize: '13px', fontWeight: '600', whiteSpace: 'nowrap' }}>{m.nome}</td>
                          <td style={{ padding: '10px 14px', fontSize: '13px', color: '#CBD5E1', maxWidth: '400px', wordBreak: 'break-word' }}>{m.mensagem}</td>
                          <td style={{ padding: '10px 14px', fontSize: '12px', color: '#647489', whiteSpace: 'nowrap' }}>
                            {new Date(m.criado_em).toLocaleString('pt-BR')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', background: '#151D2C', border: '1px solid #1E2939',
  borderRadius: '8px', color: '#F1F5FA', fontSize: '13px', outline: 'none',
}
const labelStyle: React.CSSProperties = { display: 'block', fontSize: '12px', color: '#647489', marginBottom: '5px' }
const btnAcaoStyle: React.CSSProperties = {
  padding: '4px 10px', background: '#151D2C', border: '1px solid #243044',
  borderRadius: '6px', color: '#F1F5FA', fontSize: '11px', cursor: 'pointer', whiteSpace: 'nowrap'
}
