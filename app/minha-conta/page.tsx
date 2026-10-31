'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Pedido {
  id: string
  valor_final: number
  status: string
  criado_em: string
  pago_em: string | null
  link_download: string | null
}

interface Usuario {
  nome: string
  sobrenome: string
  email: string
  telefone: string
}

interface Licenca {
  id: string
  tipo: string | null
  key: string | null
  ativa: boolean
  expira_em: string
  diasRestantes: number
  pcRegistrado: boolean
  ultimoAcesso: string | null
}

export default function MinhaContaPage() {
  const router = useRouter()
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [licenca, setLicenca] = useState<Licenca | null>(null)
  const [loading, setLoading] = useState(true)
  const [copiado, setCopiado] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/minha-conta', { credentials: 'include' }),
      fetch('/api/minha-licenca', { credentials: 'include' }),
    ]).then(async ([contaRes, licRes]) => {
      if (contaRes.status === 401) { router.push('/login'); return }
      const contaData = await contaRes.json()
      const licData = await licRes.json()
      setUsuario(contaData.usuario)
      setPedidos(contaData.pedidos)
      setLicenca(licData.licenca)
    }).catch(() => router.push('/login'))
    .finally(() => setLoading(false))
  }, [router])

  function copiarKey() {
    if (!licenca?.key) return
    navigator.clipboard.writeText(licenca.key)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/')
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
        <button onClick={logout} style={{ padding: '6px 14px', background: 'transparent', border: '1px solid #243044', borderRadius: '6px', color: '#647489', fontSize: '13px', cursor: 'pointer' }}>
          Sair
        </button>
      </nav>

      <div style={{ maxWidth: '720px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: '800', marginBottom: '4px' }}>
            Olá, {usuario?.nome}!
          </h1>
          <p style={{ color: '#647489', fontSize: '14px' }}>{usuario?.email}</p>
        </div>

        {/* Dados da conta */}
        <div style={{ background: '#111826', border: '1px solid #1E2939', borderRadius: '12px', padding: '24px', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '16px', color: '#647489' }}>Dados da conta</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {[
              { label: 'Nome', value: `${usuario?.nome} ${usuario?.sobrenome}` },
              { label: 'E-mail', value: usuario?.email },
              { label: 'Telefone', value: usuario?.telefone },
            ].map(item => (
              <div key={item.label}>
                <p style={{ fontSize: '12px', color: '#647489', marginBottom: '4px' }}>{item.label}</p>
                <p style={{ fontSize: '14px' }}>{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Minha Licença */}
        <div style={{ background: '#111826', border: '1px solid #1E2939', borderRadius: '12px', padding: '24px', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '16px', color: '#647489' }}>🔑 Minha Licença</h2>
          {!licenca ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <p style={{ color: '#647489', fontSize: '14px', marginBottom: '12px' }}>Nenhuma licença ativa.</p>
              <Link href="/#preco" style={{ padding: '10px 20px', background: '#3B82F6', color: '#fff', borderRadius: '8px', textDecoration: 'none', fontSize: '14px', fontWeight: '600' }}>Assinar agora</Link>
            </div>
          ) : !licenca.tipo ? (
            // Licença sem tipo — usuário não escolheu ainda
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
                  <p style={{ fontSize: '14px' }}>{licenca.tipo === 'key' ? '🔑 Key' : '👤 Usuário e Senha'}</p>
                </div>
                <div>
                  <p style={{ fontSize: '12px', color: '#647489', marginBottom: '4px' }}>Status</p>
                  <span style={{ padding: '3px 8px', borderRadius: '999px', fontSize: '12px', background: licenca.ativa ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', color: licenca.ativa ? '#22C55E' : '#EF4444' }}>
                    {licenca.ativa ? '✅ Ativa' : '❌ Inativa'}
                  </span>
                </div>
                <div>
                  <p style={{ fontSize: '12px', color: '#647489', marginBottom: '4px' }}>Expira em</p>
                  <p style={{ fontSize: '14px' }}>{new Date(licenca.expira_em).toLocaleDateString('pt-BR')} <span style={{ color: licenca.diasRestantes <= 5 ? '#EF4444' : '#647489', fontSize: '12px' }}>({licenca.diasRestantes} dias)</span></p>
                </div>
                <div>
                  <p style={{ fontSize: '12px', color: '#647489', marginBottom: '4px' }}>PC registrado</p>
                  <p style={{ fontSize: '14px' }}>{licenca.pcRegistrado ? '✅ Sim' : '⏳ Aguardando ativação'}</p>
                </div>
              </div>
              {licenca.tipo === 'key' && licenca.key && (
                <div>
                  <p style={{ fontSize: '12px', color: '#647489', marginBottom: '6px' }}>Sua key</p>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <code style={{ flex: 1, padding: '8px 12px', background: '#151D2C', border: '1px solid #243044', borderRadius: '6px', fontFamily: 'monospace', fontSize: '14px', color: '#3B82F6', letterSpacing: '0.08em' }}>{licenca.key}</code>
                    <button onClick={copiarKey} style={{ padding: '8px 14px', background: copiado ? 'rgba(34,197,94,0.1)' : '#151D2C', border: `1px solid ${copiado ? '#22C55E' : '#243044'}`, borderRadius: '6px', color: copiado ? '#22C55E' : '#F1F5FA', fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      {copiado ? '✓ Copiado' : '📋 Copiar'}
                    </button>
                  </div>
                </div>
              )}
              {licenca.tipo === 'usuario_senha' && (
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

        {/* Histórico de pedidos */}
        <div style={{ background: '#111826', border: '1px solid #1E2939', borderRadius: '12px', padding: '24px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '16px', color: '#647489' }}>Meus pedidos</h2>
          {pedidos.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <p style={{ color: '#647489', fontSize: '14px', marginBottom: '16px' }}>Nenhum pedido encontrado.</p>
              <Link href="/#preco" style={{ padding: '10px 20px', background: '#3B82F6', color: '#fff', borderRadius: '8px', textDecoration: 'none', fontSize: '14px', fontWeight: '600' }}>
                Assinar agora
              </Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {pedidos.map(p => (
                <div key={p.id} style={{ background: '#151D2C', border: '1px solid #1E2939', borderRadius: '10px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <p style={{ fontFamily: 'monospace', fontSize: '13px', color: '#3B82F6', marginBottom: '4px' }}>
                      #{p.id.slice(0, 8).toUpperCase()}
                    </p>
                    <p style={{ fontSize: '13px', color: '#647489' }}>
                      {new Date(p.criado_em).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: '16px', fontWeight: '700' }}>R$ {p.valor_final.toFixed(2)}</p>
                  </div>
                  <div>
                    <span style={{ padding: '4px 10px', borderRadius: '999px', fontSize: '12px', background: p.status === 'pago' ? 'rgba(34,197,94,0.1)' : 'rgba(251,191,36,0.1)', color: p.status === 'pago' ? '#22C55E' : '#FBBF24' }}>
                      {p.status === 'pago' ? '✓ Pago' : '⏳ Pendente'}
                    </span>
                  </div>
                  {p.status === 'pago' && p.link_download && (
                    <a href={p.link_download} style={{ padding: '8px 16px', background: '#3B82F6', color: '#fff', borderRadius: '8px', textDecoration: 'none', fontSize: '13px', fontWeight: '600' }}>
                      ⬇️ Baixar
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
