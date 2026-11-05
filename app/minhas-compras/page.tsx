'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Compra {
  id: string
  valor_final: number
  status: string
  criado_em: string
  pago_em: string | null
  link_download: string | null
  plano: string | null
}

interface SolicitacaoReembolso {
  pedido_id: string
  status: 'em_analise' | 'liberado_manual' | 'negado' | 'reembolsado' | 'contestado'
  nota_revisao?: string | null
}

interface VersaoAtual {
  id: string
  numero: string
  link: string
  notas: string | null
  publicadaEm: string
}

interface LicencaAtiva {
  id: string
  tipo: string | null
  key: string | null
  ativa: boolean
  expira_em: string
  diasRestantes: number
  pcRegistrado: boolean
}

interface LicencaInfo {
  tipo: string | null
  key: string | null
  ativa: boolean
  expira_em: string
  diasRestantes: number
  pcRegistrado: boolean
  ultimoAcesso: string | null
  pedidoId: string | null
}

export default function MinhasComprasPage() {
  const router = useRouter()
  const [compras, setCompras] = useState<Compra[]>([])
  const [nomeCompleto, setNomeCompleto] = useState('')
  const [licencaAtiva, setLicencaAtiva] = useState<LicencaInfo | null>(null)
  const [licencasPorPedido, setLicencasPorPedido] = useState<Record<string, LicencaAtiva>>({})
  const [loading, setLoading] = useState(true)
  const [copiado, setCopiado] = useState(false)
  const [copiadoPedido, setCopiadoPedido] = useState<string | null>(null)
  const [versaoAtual, setVersaoAtual] = useState<VersaoAtual | null>(null)
  const [versoesBaixadas, setVersoesBaixadas] = useState<Set<string>>(new Set())
  const [solicitacoesReembolso, setSolicitacoesReembolso] = useState<Record<string, SolicitacaoReembolso>>({})
  const [reembolsoAberto, setReembolsoAberto] = useState<string | null>(null)
  const [motivosReembolso, setMotivosReembolso] = useState<Record<string, string>>({})
  const [mensagensReembolso, setMensagensReembolso] = useState<Record<string, string>>({})
  const [reembolsoLoading, setReembolsoLoading] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        if (!d.logado) { router.push('/login'); return }
        setNomeCompleto(d.nomeCompleto)
      })

    fetch('/api/minha-conta', { credentials: 'include' })
      .then(r => { if (r.status === 401) { router.push('/login'); return null } return r.json() })
      .then(d => { if (!d) return; setCompras(d.pedidos.filter((p: { status: string }) => p.status === 'pago' || p.status === 'cancelado')) })
      .finally(() => setLoading(false))

    fetch('/api/reembolsos', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        const mapeadas = Object.fromEntries(
          (d.solicitacoes || []).map((solicitacao: SolicitacaoReembolso) => [solicitacao.pedido_id, solicitacao])
        )
        setSolicitacoesReembolso(mapeadas)
      })
      .catch(() => {})

    fetch('/api/minha-licenca', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d.licenca) setLicencaAtiva(d.licenca) })
      .catch(() => {})

    fetch('/api/minhas-licencas', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d.licencas) setLicencasPorPedido(d.licencas) })
      .catch(() => {})

    fetch('/api/versao-atual')
      .then(r => r.json())
      .then(d => { if (d.versao) setVersaoAtual(d.versao) })
      .catch(() => {})
  }, [router])

  function copiarKey() {
    fetch('/api/minha-licenca/revelar-key', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        if (d.key) {
          navigator.clipboard.writeText(d.key)
          setCopiado(true)
          setTimeout(() => setCopiado(false), 2000)
        }
      })
      .catch(() => {})
  }

  function copiarKeyPedido(keyMascarada: string, pedidoId: string) {
    navigator.clipboard.writeText(keyMascarada)
    setCopiadoPedido(pedidoId)
    setTimeout(() => setCopiadoPedido(null), 2000)
  }

  function registrarDownload() {
    if (!versaoAtual) return
    fetch('/api/download/registrar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ versaoId: versaoAtual.id }),
    }).then(() => setVersoesBaixadas(prev => new Set([...prev, versaoAtual.id])))
  }

  async function solicitarReembolso(pedidoId: string) {
    setMensagensReembolso(current => ({ ...current, [pedidoId]: '' }))
    setReembolsoLoading(pedidoId)
    try {
      const res = await fetch('/api/reembolsos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ pedidoId, motivo: motivosReembolso[pedidoId] || '' }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMensagensReembolso(current => ({ ...current, [pedidoId]: data.error || 'Não foi possível enviar a solicitação.' }))
        return
      }
      const solicitacao: SolicitacaoReembolso = { pedido_id: pedidoId, status: data.solicitacao.status }
      setSolicitacoesReembolso(current => ({ ...current, [pedidoId]: solicitacao }))
      setReembolsoAberto(null)
      setMensagensReembolso(current => ({ ...current, [pedidoId]: 'Solicitação enviada para análise.' }))
    } catch {
      setMensagensReembolso(current => ({ ...current, [pedidoId]: 'Falha de comunicação. Tente novamente.' }))
    } finally {
      setReembolsoLoading(null)
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#090F1A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#647489' }}>Carregando...</p>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#090F1A', color: '#F1F5FA', padding: '80px 24px 40px' }}>
      {/* Nav */}
      <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, background: 'rgba(9,15,26,0.9)', backdropFilter: 'blur(16px)', borderBottom: '1px solid #1E2939', height: '64px', display: 'flex', alignItems: 'center', padding: '0 24px', justifyContent: 'space-between' }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none', color: '#F1F5FA', fontWeight: '700' }}>
          <div style={{ width: '30px', height: '30px', borderRadius: '6px', overflow: 'hidden', flexShrink: 0 }}>
            <img src="/assets/logomarca.png" alt="SumblerControl" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          SumblerControl
        </Link>
        <Link href="/minha-conta" style={{ padding: '6px 14px', background: 'transparent', border: '1px solid #243044', borderRadius: '6px', color: '#647489', fontSize: '13px', textDecoration: 'none' }}>
          Minha Conta
        </Link>
      </nav>

      <div style={{ maxWidth: '720px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: '800', marginBottom: '4px' }}>📦 Minhas Compras</h1>
          {nomeCompleto && <p style={{ color: '#647489', fontSize: '14px' }}>{nomeCompleto}</p>}
        </div>

        {/* ── Seu Acesso ── */}
        <div style={{ background: '#111826', border: '1px solid #1E2939', borderRadius: '12px', padding: '24px', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '16px', color: '#647489' }}>⚡ Seu Acesso</h2>

          {/* Estado 1: sem compra ativa */}
          {!licencaAtiva ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '28px 0' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '26px' }}>🔒</div>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontWeight: '700', fontSize: '15px', marginBottom: '6px' }}>Você ainda não tem acesso ativo</p>
                <p style={{ color: '#647489', fontSize: '13px' }}>Escolha um plano e comece a usar agora mesmo.</p>
              </div>
              <Link href="/#preco" style={{ padding: '11px 28px', background: '#3B82F6', color: '#fff', borderRadius: '8px', textDecoration: 'none', fontSize: '14px', fontWeight: '700' }}>Ver planos</Link>
            </div>

          /* Estado 2: comprou mas não configurou o acesso */
          ) : !licencaAtiva.tipo ? (
            <div style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: '10px', padding: '20px', textAlign: 'center' }}>
              <p style={{ fontSize: '22px', marginBottom: '8px' }}>⚠️</p>
              <p style={{ color: '#FBBF24', fontWeight: '700', marginBottom: '6px' }}>Complete sua ativação</p>
              <p style={{ color: '#647489', fontSize: '13px', marginBottom: '16px' }}>Você já tem acesso pago mas ainda não configurou o método de login no software.</p>
              <Link href="/obrigado" style={{ padding: '10px 24px', background: '#3B82F6', color: '#fff', borderRadius: '8px', textDecoration: 'none', fontSize: '14px', fontWeight: '600' }}>Configurar agora</Link>
            </div>

          /* Estado 3: acesso ativo com tudo configurado */
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <p style={{ fontSize: '12px', color: '#647489', marginBottom: '4px' }}>Tipo</p>
                  <p style={{ fontSize: '14px' }}>{licencaAtiva.tipo === 'key' ? '🔑 Key' : '👤 Usuário e Senha'}</p>
                </div>
                <div>
                  <p style={{ fontSize: '12px', color: '#647489', marginBottom: '4px' }}>Status</p>
                  <span style={{ padding: '3px 8px', borderRadius: '999px', fontSize: '12px', background: licencaAtiva.ativa ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', color: licencaAtiva.ativa ? '#22C55E' : '#EF4444' }}>
                    {licencaAtiva.ativa ? '✅ Ativa' : '❌ Inativa'}
                  </span>
                </div>
                <div>
                  <p style={{ fontSize: '12px', color: '#647489', marginBottom: '4px' }}>Expira em</p>
                  <p style={{ fontSize: '14px' }}>
                    {new Date(licencaAtiva.expira_em).toLocaleDateString('pt-BR')}
                    <span style={{ color: licencaAtiva.diasRestantes <= 5 ? '#EF4444' : '#647489', fontSize: '12px' }}> ({licencaAtiva.diasRestantes} dias)</span>
                  </p>
                </div>
                <div>
                  <p style={{ fontSize: '12px', color: '#647489', marginBottom: '4px' }}>PC registrado</p>
                  <p style={{ fontSize: '14px' }}>{licencaAtiva.pcRegistrado ? '✅ Sim' : '⏳ Aguardando ativação'}</p>
                </div>
              </div>

              {licencaAtiva.tipo === 'key' && licencaAtiva.key && (
                <div>
                  <p style={{ fontSize: '12px', color: '#647489', marginBottom: '6px' }}>Sua key</p>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <code style={{ flex: 1, padding: '8px 12px', background: '#151D2C', border: '1px solid #243044', borderRadius: '6px', fontFamily: 'monospace', fontSize: '14px', color: '#3B82F6', letterSpacing: '0.08em' }}>{licencaAtiva.key}</code>
                    <button onClick={copiarKey} style={{ padding: '8px 14px', background: copiado ? 'rgba(34,197,94,0.1)' : '#151D2C', border: `1px solid ${copiado ? '#22C55E' : '#243044'}`, borderRadius: '6px', color: copiado ? '#22C55E' : '#F1F5FA', fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      {copiado ? '✓ Copiado' : '📋 Copiar'}
                    </button>
                  </div>
                </div>
              )}

              {licencaAtiva.tipo === 'usuario_senha' && (
                <div style={{ background: '#151D2C', border: '1px solid #243044', borderRadius: '8px', padding: '12px' }}>
                  <p style={{ fontSize: '13px', color: '#647489' }}>Use o mesmo usuário e senha do site para fazer login no software.</p>
                </div>
              )}

              <div style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.15)', borderRadius: '8px', padding: '10px 12px' }}>
                <p style={{ fontSize: '12px', color: '#FBBF24' }}>⚠️ Para trocar de PC, entre em contato com o suporte.</p>
              </div>

              {/* Botão de download — versão atual */}
              {versaoAtual && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#151D2C', border: '1px solid #243044', borderRadius: '10px', padding: '14px 16px', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <p style={{ fontSize: '13px', fontWeight: '600', marginBottom: '2px' }}>SumblerControl v{versaoAtual.numero}</p>
                    {versaoAtual.notas && <p style={{ fontSize: '11px', color: '#647489', marginBottom: '2px' }}>{versaoAtual.notas}</p>}
                    <p style={{ fontSize: '11px', color: '#647489' }}>Publicado em {new Date(versaoAtual.publicadaEm).toLocaleDateString('pt-BR')}</p>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                    {!versoesBaixadas.has(versaoAtual.id) && (
                      <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '999px', background: 'rgba(251,191,36,0.15)', color: '#FBBF24', fontWeight: '600' }}>
                        🆕 Nova versão disponível
                      </span>
                    )}
                    <a
                      href={versaoAtual.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={registrarDownload}
                      style={{ padding: '10px 20px', background: '#3B82F6', color: '#fff', borderRadius: '8px', textDecoration: 'none', fontSize: '14px', fontWeight: '700', whiteSpace: 'nowrap' }}
                    >
                      ⬇️ Baixar v{versaoAtual.numero}
                    </a>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Histórico de Compras ── */}
        <h2 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '16px', color: '#647489' }}>Histórico de compras</h2>

        {compras.length === 0 ? (
          <div style={{ background: '#111826', border: '1px solid #1E2939', borderRadius: '12px', padding: '48px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📭</div>
            <h2 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>Nenhuma compra encontrada</h2>
            <p style={{ color: '#647489', fontSize: '14px', marginBottom: '24px' }}>Você ainda não realizou nenhuma compra.</p>
            <Link href="/#preco" style={{ padding: '12px 24px', background: '#3B82F6', color: '#fff', borderRadius: '8px', textDecoration: 'none', fontSize: '14px', fontWeight: '600' }}>Ver planos</Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {compras.map(c => {
              const diasPorPlano: Record<string, number> = { mensal: 30, semestral: 180, anual: 360 }
              const dias = diasPorPlano[c.plano || 'mensal'] ?? 30
              const planoLabel = c.plano === 'semestral' ? 'Plano Semestral' : c.plano === 'anual' ? 'Plano Anual' : 'Plano Mensal'
              const lic = licencasPorPedido[c.id]

              return (
                <div key={c.id} style={{ background: '#111826', border: '1px solid #1E2939', borderRadius: '12px', padding: '20px 24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                    <div>
                      <p style={{ fontFamily: 'monospace', fontSize: '13px', color: '#3B82F6', marginBottom: '4px' }}>#{c.id.slice(0, 8).toUpperCase()}</p>
                      <p style={{ fontSize: '13px', color: '#647489' }}>SumblerControl — {planoLabel}</p>
                      <p style={{ fontSize: '12px', color: '#647489', marginTop: '2px' }}>
                        {c.pago_em ? new Date(c.pago_em).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }) : new Date(c.criado_em).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: '18px', fontWeight: '800' }}>R$ {c.valor_final.toFixed(2)}</p>
                      <span style={{ padding: '3px 8px', borderRadius: '999px', fontSize: '12px', background: c.status === 'pago' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', color: c.status === 'pago' ? '#22C55E' : '#EF4444' }}>
                        {c.status === 'pago' ? '✓ Pago' : 'Pagamento revertido'}
                      </span>
                    </div>
                  </div>

                  {/* Rodapé — licença deste pedido */}
                  <div style={{ marginTop: '12px', borderTop: '1px solid #1E2939', paddingTop: '10px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '11px', color: '#647489' }}>Acesso:</span>

                    {!lic ? (
                      <Link href="/obrigado" style={{ fontSize: '12px', color: '#FBBF24', textDecoration: 'none' }}>⚠️ Configurar acesso →</Link>
                    ) : lic.tipo === 'key' && lic.key ? (
                      <>
                        <span style={{ fontSize: '12px', color: '#3B82F6', fontFamily: 'monospace', background: 'rgba(59,130,246,0.08)', padding: '2px 8px', borderRadius: '4px' }}>
                          🔑 {lic.key}
                        </span>
                        <button
                          onClick={() => copiarKeyPedido(lic.key!, c.id)}
                          style={{ fontSize: '11px', padding: '2px 8px', background: copiadoPedido === c.id ? 'rgba(34,197,94,0.1)' : '#151D2C', border: `1px solid ${copiadoPedido === c.id ? '#22C55E' : '#243044'}`, borderRadius: '4px', color: copiadoPedido === c.id ? '#22C55E' : '#647489', cursor: 'pointer' }}>
                          {copiadoPedido === c.id ? '✓' : '📋'}
                        </button>
                      </>
                    ) : lic.tipo === 'usuario_senha' ? (
                      <span style={{ fontSize: '12px', color: '#22C55E', background: 'rgba(34,197,94,0.08)', padding: '2px 8px', borderRadius: '4px' }}>👤 Usuário e Senha</span>
                    ) : (
                      <Link href="/obrigado" style={{ fontSize: '12px', color: '#FBBF24', textDecoration: 'none' }}>⚠️ Configurar acesso →</Link>
                    )}

                    {lic?.tipo && (
                      <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: lic.pcRegistrado ? 'rgba(34,197,94,0.08)' : 'rgba(251,191,36,0.08)', color: lic.pcRegistrado ? '#22C55E' : '#FBBF24' }}>
                        {lic.pcRegistrado ? '✅ Ativado' : '⏳ Aguardando ativação'}
                      </span>
                    )}

                    <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: 'rgba(59,130,246,0.08)', color: '#3B82F6' }}>
                      ⏱ {dias} dias de acesso
                    </span>
                  </div>

                  <div style={{ marginTop: '14px', borderTop: '1px solid #1E2939', paddingTop: '12px' }}>
                    {solicitacoesReembolso[c.id] ? (
                      <>
                        <p style={{ color: '#FBBF24', fontSize: '12px' }}>
                          Solicitação: {
                            solicitacoesReembolso[c.id].status === 'em_analise' ? 'em análise; a validação de acesso fica pausada enquanto ela é revisada.' :
                            solicitacoesReembolso[c.id].status === 'liberado_manual' ? 'autorizada para processamento manual; aguarde o resultado do provedor de pagamento.' :
                            solicitacoesReembolso[c.id].status === 'negado' ? 'não autorizada pelo site.' :
                            solicitacoesReembolso[c.id].status === 'reembolsado' ? 'reembolso confirmado pelo provedor.' :
                            'pagamento revertido ou contestado.'
                          }
                        </p>
                        {solicitacoesReembolso[c.id].nota_revisao && (
                          <p style={{ color: '#94A3B8', fontSize: '12px', marginTop: '5px' }}>Nota: {solicitacoesReembolso[c.id].nota_revisao}</p>
                        )}
                      </>
                    ) : c.status === 'pago' ? (
                      <>
                        <button
                          onClick={() => setReembolsoAberto(reembolsoAberto === c.id ? null : c.id)}
                          style={{ padding: '7px 10px', background: '#151D2C', border: '1px solid #243044', borderRadius: '6px', color: '#94A3B8', fontSize: '12px', cursor: 'pointer' }}
                        >
                          Solicitar análise de reembolso
                        </button>
                        {reembolsoAberto === c.id && (
                          <div style={{ marginTop: '10px' }}>
                            <label htmlFor={`motivo-reembolso-${c.id}`} style={{ display: 'block', color: '#94A3B8', fontSize: '12px', marginBottom: '6px' }}>
                              Explique o motivo (10 a 2000 caracteres)
                            </label>
                            <textarea
                              id={`motivo-reembolso-${c.id}`}
                              value={motivosReembolso[c.id] || ''}
                              onChange={e => setMotivosReembolso(current => ({ ...current, [c.id]: e.target.value }))}
                              maxLength={2000}
                              style={{ width: '100%', minHeight: '80px', padding: '10px', background: '#0D1420', border: '1px solid #243044', borderRadius: '6px', color: '#F1F5FA', resize: 'vertical' }}
                            />
                            <p style={{ color: '#647489', fontSize: '11px', margin: '6px 0 10px' }}>
                              O envio inicia uma análise e não realiza estorno automático. A decisão e o processamento devem observar os direitos aplicáveis ao consumidor.
                            </p>
                            <button
                              onClick={() => solicitarReembolso(c.id)}
                              disabled={reembolsoLoading === c.id}
                              style={{ padding: '8px 12px', background: '#3B82F6', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '12px', fontWeight: '600', cursor: reembolsoLoading === c.id ? 'wait' : 'pointer', opacity: reembolsoLoading === c.id ? 0.7 : 1 }}
                            >
                              {reembolsoLoading === c.id ? 'Enviando...' : 'Enviar solicitação'}
                            </button>
                          </div>
                        )}
                      </>
                    ) : null}
                    {mensagensReembolso[c.id] && <p role="status" style={{ color: '#94A3B8', fontSize: '12px', marginTop: '7px' }}>{mensagensReembolso[c.id]}</p>}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
