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
}

interface LicencaInfo {
  tipo: string | null
  key: string | null
}

export default function MinhasComprasPage() {
  const router = useRouter()
  const [compras, setCompras] = useState<Compra[]>([])
  const [nomeCompleto, setNomeCompleto] = useState('')
  const [licenca, setLicenca] = useState<LicencaInfo | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        if (!d.logado) { router.push('/login'); return }
        setNomeCompleto(d.nomeCompleto)
      })

    fetch('/api/minha-conta', { credentials: 'include' })
      .then(r => {
        if (r.status === 401) { router.push('/login'); return null }
        return r.json()
      })
      .then(d => {
        if (!d) return
        setCompras(d.pedidos.filter((p: { status: string }) => p.status === 'pago'))
      })
      .finally(() => setLoading(false))

    fetch('/api/minha-licenca', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d.licenca) setLicenca(d.licenca) })
      .catch(() => {})
  }, [router])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#090F1A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#647489' }}>Carregando...</p>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#090F1A', color: '#F1F5FA', padding: '80px 24px 40px' }}>
      {/* Nav simples */}
      <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, background: 'rgba(9,15,26,0.9)', backdropFilter: 'blur(16px)', borderBottom: '1px solid #1E2939', height: '64px', display: 'flex', alignItems: 'center', padding: '0 24px', justifyContent: 'space-between' }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none', color: '#F1F5FA', fontWeight: '700' }}>
          <div style={{ width: '30px', height: '30px', background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="#3B82F6" strokeWidth="2"/><circle cx="12" cy="12" r="4" stroke="#3B82F6" strokeWidth="2"/></svg>
          </div>
          SumblerControl
        </Link>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Link href="/minha-conta" style={{ padding: '6px 14px', background: 'transparent', border: '1px solid #243044', borderRadius: '6px', color: '#647489', fontSize: '13px', textDecoration: 'none' }}>
            Minha Conta
          </Link>
        </div>
      </nav>

      <div style={{ maxWidth: '720px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: '800', marginBottom: '4px' }}>
            📦 Minhas Compras
          </h1>
          {nomeCompleto && (
            <p style={{ color: '#647489', fontSize: '14px' }}>{nomeCompleto}</p>
          )}
        </div>

        {compras.length === 0 ? (
          <div style={{ background: '#111826', border: '1px solid #1E2939', borderRadius: '12px', padding: '48px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📭</div>
            <h2 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>Nenhuma compra encontrada</h2>
            <p style={{ color: '#647489', fontSize: '14px', marginBottom: '24px' }}>Você ainda não realizou nenhuma compra.</p>
            <Link href="/#preco" style={{ padding: '12px 24px', background: '#3B82F6', color: '#fff', borderRadius: '8px', textDecoration: 'none', fontSize: '14px', fontWeight: '600' }}>
              ⚡ Assinar agora
            </Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {compras.map(c => (
              <div key={c.id} style={{ background: '#111826', border: '1px solid #1E2939', borderRadius: '12px', padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                  <p style={{ fontFamily: 'monospace', fontSize: '13px', color: '#3B82F6', marginBottom: '4px' }}>
                    #{c.id.slice(0, 8).toUpperCase()}
                  </p>
                  <p style={{ fontSize: '13px', color: '#647489' }}>
                    SumblerControl — Plano Mensal
                  </p>
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
                {/* Info de acesso */}
                {licenca && (
                  <div style={{ marginTop: '12px', borderTop: '1px solid #1E2939', paddingTop: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '11px', color: '#647489' }}>Acesso:</span>
                    {licenca.tipo === 'key' ? (
                      <span style={{ fontSize: '12px', color: '#3B82F6', fontFamily: 'monospace', background: 'rgba(59,130,246,0.08)', padding: '2px 8px', borderRadius: '4px' }}>
                        🔑 {licenca.key || 'Key configurada'}
                      </span>
                    ) : licenca.tipo === 'usuario_senha' ? (
                      <span style={{ fontSize: '12px', color: '#22C55E', background: 'rgba(34,197,94,0.08)', padding: '2px 8px', borderRadius: '4px' }}>
                        👤 Usuário e Senha
                      </span>
                    ) : (
                      <Link href="/obrigado" style={{ fontSize: '12px', color: '#FBBF24', textDecoration: 'none' }}>
                        ⚠️ Configurar acesso →
                      </Link>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
