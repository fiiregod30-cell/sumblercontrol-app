'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Compra {
  id: string
  valor_final: number
  criado_em: string
  pago_em: string | null
  link_download: string | null
  plano: string | null
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

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        if (!d.logado) { router.push('/login'); return }
        setNomeCompleto(d.nomeCompleto)
      })

    fetch('/api/minha-conta', { credentials: 'include' })
      .then(r => { if (r.status === 401) { router.push('/login'); return null } return r.json() })
      .then(d => { if (!d) return; setCompras(d.pedidos.filter((p: { status: string }) => p.status === 'pago')) })
      .finally(() => setLoading(false))

    // Licença ativa mais recente (para o bloco do topo)
    fetch('/api/minha-licenca', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d.licenca) setLicencaAtiva(d.licenca) })
      .catch(() => {})

    // Todas as licenças indexadas por pedido_id
    fetch('/api/minhas-licencas', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d.licencas) setLicencasPorPedido(d.licencas) })
      .catch(() => {})
  }, [router])

  function copiarKey() {
    if (!licencaAtiva?.key) return
    navigator.clipboard.writeText(licencaAtiva.key)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  function copiarKeyPedido(key: string, pedidoId: string) {
    navigator.clipboard.writeText(key)
    setCopiadoPedido(pedidoId)
    setTimeout(() => setCopiadoPedido(null), 2000)
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
          <div style={{ width: '30px', height: '30px', background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="#3B82F6" strokeWidth="2"/><circle cx="12" cy="12" r="4" stroke="#3B82F6" strokeWidth="2"/></svg>
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

        {/* ── Licença Ativa (mais recente) ── */}
        <div style={{ background: '#111826', border: '1px solid #1E2939', borderRadius: '12px', padding: '24px', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '16px', color: '#647489' }}>🔑 Licença Ativa</h2>

          {!licencaAtiva ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <p style={{ color: '#647489', fontSize: '14px', marginBottom: '12px' }}>Nenhuma licença ativa.</p>
              <Link href="/#preco" style={{ padding: '10px 20px', background: '#3B82F6', color: '#fff', borderRadius: '8px', textDecoration: 'none', fontSize: '14px', fontWeight: '600' }}>⚡ Assinar agora</Link>
            </div>
          ) : !licencaAtiva.tipo ? (
            <div style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: '10px', padding: '16px', textAlign: 'center' }}>
              <p style={{ color: '#FBBF24', fontWeight: '700', marginBottom: '8px' }}>⚠️ Complete sua ativação</p>
              <p style={{ color: '#647489', fontSize: '13px', marginBottom: '16px' }}>Você ainda não escolheu seu método de acesso ao software.</p>
              <Link href="/obrigado" style={{ padding: '10px 20px', background: '#3B82F6', color: '#fff', borderRadius: '8px', textDecoration: 'none', fontSize: '14px', fontWeight: '600' }}>Escolher método de acesso</Link>
            </div>
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
            <Link href="/#preco" style={{ padding: '12px 24px', background: '#3B82F6', color: '#fff', borderRadius: '8px', textDecoration: 'none', fontSize: '14px', fontWeight: '600' }}>⚡ Assinar agora</Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {compras.map(c => {
              const diasPorPlano: Record<string, number> = { mensal: 30, semestral: 180, anual: 360 }
              const dias = diasPorPlano[c.plano || 'mensal'] ?? 30
              const planoLabel = c.plano === 'semestral' ? 'Plano Semestral' : c.plano === 'anual' ? 'Plano Anual' : 'Plano Mensal'
              // Licença específica deste pedido
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ fontSize: '18px', fontWeight: '800' }}>R$ {c.valor_final.toFixed(2)}</p>
                        <span style={{ padding: '3px 8px', borderRadius: '999px', fontSize: '12px', background: 'rgba(34,197,94,0.1)', color: '#22C55E' }}>✓ Pago</span>
                      </div>
                      {c.link_download && (
                        <a href={c.link_download} target="_blank" rel="noopener noreferrer" style={{ padding: '10px 20px', background: '#3B82F6', color: '#fff', borderRadius: '8px', textDecoration: 'none', fontSize: '14px', fontWeight: '700', whiteSpace: 'nowrap' }}>
                          ⬇️ Baixar
                        </a>
                      )}
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
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
