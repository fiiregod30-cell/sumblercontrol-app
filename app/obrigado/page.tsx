'use client'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Suspense, useEffect, useState } from 'react'

interface LicencaInfo {
  tipo: string | null
  key: string | null
  ativa: boolean
  expira_em: string
  diasRestantes: number
}

type Etapa = 'carregando' | 'escolhendo' | 'key_gerada' | 'usuario_senha'

function ObrigadoContent() {
  const params = useSearchParams()
  const pedidoId = params.get('pedido') || ''

  const [etapa, setEtapa] = useState<Etapa>('carregando')
  const [licenca, setLicenca] = useState<LicencaInfo | null>(null)
  const [keyGerada, setKeyGerada] = useState('')
  const [downloadLink, setDownloadLink] = useState('')
  const [copiado, setCopiado] = useState(false)
  const [loadingEscolha, setLoadingEscolha] = useState(false)
  const [erroEscolha, setErroEscolha] = useState('')

  // Aguarda a licença ser criada pelo webhook (polling até 30s)
  async function aguardarLicenca(tentativas = 0): Promise<LicencaInfo | null> {
    if (tentativas >= 30) return null
    const res = await fetch('/api/minha-licenca', { credentials: 'include' })
    const data = await res.json()
    if (data.licenca) return data.licenca
    await new Promise(r => setTimeout(r, 1000))
    return aguardarLicenca(tentativas + 1)
  }

  useEffect(() => {
    async function init() {
      // Busca link de download
      if (pedidoId) {
        fetch(`/api/pagamento/status?pedidoId=${pedidoId}`)
          .then(r => r.json())
          .then(d => { if (d.linkDownload) setDownloadLink(d.linkDownload) })
          .catch(() => {})
      } else {
        // Sem pedidoId — busca o link do último pedido pago
        fetch('/api/minha-conta', { credentials: 'include' })
          .then(r => r.json())
          .then(d => {
            const pago = (d.pedidos || []).find((p: { status: string; link_download: string }) => p.status === 'pago' && p.link_download)
            if (pago) setDownloadLink(pago.link_download)
          })
          .catch(() => {})
      }

      // Aguarda webhook criar/atualizar a licença
      const lic = await aguardarLicenca()

      if (!lic) {
        // Timeout — webhook não processou em 30s. Mostra escolha mesmo assim.
        setEtapa('escolhendo')
        return
      }

      setLicenca(lic)

      // Opção B: SEMPRE mostra tela de escolha, independente de ter tipo ou não
      // tipo = null → primeira compra ou renovação
      // tipo != null → renovação que resetou tipo (webhook Opção B)
      setEtapa('escolhendo')
    }

    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedidoId])

  async function escolherTipo(tipo: string) {
    setErroEscolha('')
    setLoadingEscolha(true)
    try {
      const res = await fetch('/api/licenca/escolher-tipo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ tipo })
      })
      const data = await res.json()

      if (!res.ok) {
        setErroEscolha(data.error || 'Erro ao configurar acesso.')
        return
      }

      if (tipo === 'key' && data.key) {
        setKeyGerada(data.key)
        setEtapa('key_gerada')
      } else if (tipo === 'usuario_senha') {
        setEtapa('usuario_senha')
      }
    } catch {
      setErroEscolha('Erro de conexão. Tente novamente.')
    } finally {
      setLoadingEscolha(false)
    }
  }

  function copiarKey() {
    navigator.clipboard.writeText(keyGerada)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#090F1A', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '520px' }}>

        {/* Header — sempre visível */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ width: '72px', height: '72px', background: 'rgba(34,197,94,0.15)', border: '2px solid #22C55E', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px', fontSize: '32px' }}>✅</div>
          <h1 style={{ fontSize: '24px', fontWeight: '900', marginBottom: '8px' }}>Pagamento confirmado!</h1>
          <p style={{ color: '#647489', fontSize: '14px' }}>Seu acesso ao SumblerControl está liberado.</p>
          {pedidoId && (
            <p style={{ fontFamily: 'monospace', color: '#3B82F6', fontSize: '13px', marginTop: '6px' }}>
              Pedido #{pedidoId.slice(0, 8).toUpperCase()}
            </p>
          )}
        </div>

        {/* ETAPA: Carregando */}
        {etapa === 'carregando' && (
          <div style={{ background: '#111826', border: '1px solid #1E2939', borderRadius: '16px', padding: '32px', textAlign: 'center' }}>
            <div style={{ fontSize: '32px', marginBottom: '16px', animation: 'spin 1s linear infinite' }}>⏳</div>
            <p style={{ color: '#F1F5FA', fontWeight: '700', marginBottom: '8px' }}>Processando seu pagamento...</p>
            <p style={{ color: '#647489', fontSize: '13px' }}>Aguarde enquanto confirmamos sua licença.</p>
          </div>
        )}

        {/* ETAPA: Escolhendo método */}
        {etapa === 'escolhendo' && (
          <div style={{ background: '#111826', border: '1px solid rgba(59,130,246,0.3)', borderRadius: '16px', padding: '28px' }}>
            <h2 style={{ fontSize: '17px', fontWeight: '700', marginBottom: '8px', textAlign: 'center' }}>Como quer acessar o software?</h2>
            <p style={{ color: '#647489', fontSize: '13px', textAlign: 'center', marginBottom: '24px' }}>
              Escolha o método de autenticação para usar no SumblerControl.exe
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button
                onClick={() => escolherTipo('key')}
                disabled={loadingEscolha}
                style={{ padding: '16px', background: '#151D2C', border: '1px solid #243044', borderRadius: '10px', color: '#F1F5FA', cursor: loadingEscolha ? 'not-allowed' : 'pointer', textAlign: 'left', opacity: loadingEscolha ? 0.6 : 1 }}>
                <div style={{ fontSize: '20px', marginBottom: '6px' }}>🔑</div>
                <div style={{ fontWeight: '700', marginBottom: '4px' }}>Usar Key</div>
                <div style={{ fontSize: '13px', color: '#647489' }}>Receba uma chave no formato SC-XXXX-XXXX-XXXX-XXXX e use no app.</div>
              </button>
              <button
                onClick={() => escolherTipo('usuario_senha')}
                disabled={loadingEscolha}
                style={{ padding: '16px', background: '#151D2C', border: '1px solid #243044', borderRadius: '10px', color: '#F1F5FA', cursor: loadingEscolha ? 'not-allowed' : 'pointer', textAlign: 'left', opacity: loadingEscolha ? 0.6 : 1 }}>
                <div style={{ fontSize: '20px', marginBottom: '6px' }}>👤</div>
                <div style={{ fontWeight: '700', marginBottom: '4px' }}>Usar Usuário e Senha</div>
                <div style={{ fontSize: '13px', color: '#647489' }}>Use o mesmo login do site para acessar o software.</div>
              </button>
            </div>
            {loadingEscolha && (
              <p style={{ textAlign: 'center', color: '#647489', fontSize: '13px', marginTop: '12px' }}>Configurando...</p>
            )}
            {erroEscolha && (
              <div style={{ marginTop: '12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '10px', fontSize: '13px', color: '#EF4444', textAlign: 'center' }}>
                {erroEscolha}
              </div>
            )}
          </div>
        )}

        {/* ETAPA: Key gerada */}
        {etapa === 'key_gerada' && keyGerada && (
          <div style={{ background: '#111826', border: '1px solid rgba(59,130,246,0.3)', borderRadius: '16px', padding: '24px', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '16px', textAlign: 'center' }}>🔑 Sua Key de Licença</h2>
            <div style={{ background: '#151D2C', border: '1px solid #243044', borderRadius: '10px', padding: '16px', textAlign: 'center', marginBottom: '12px' }}>
              <p style={{ fontFamily: 'monospace', fontSize: '18px', fontWeight: '800', color: '#3B82F6', letterSpacing: '0.1em' }}>
                {keyGerada}
              </p>
            </div>
            <button
              onClick={copiarKey}
              style={{ width: '100%', padding: '10px', background: copiado ? 'rgba(34,197,94,0.1)' : '#151D2C', border: `1px solid ${copiado ? '#22C55E' : '#243044'}`, borderRadius: '8px', color: copiado ? '#22C55E' : '#F1F5FA', fontSize: '14px', fontWeight: '600', cursor: 'pointer', marginBottom: '12px' }}>
              {copiado ? '✓ Key copiada!' : '📋 Copiar key'}
            </button>
            <div style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: '8px', padding: '12px', marginBottom: '16px' }}>
              <p style={{ color: '#FBBF24', fontSize: '12px', lineHeight: 1.6 }}>
                ⚠️ Guarde esta key — ela também foi enviada para o seu e-mail. Para trocar de PC, contate o suporte.
              </p>
            </div>
            {/* Botão download só após escolher */}
            <a
              href={downloadLink || '#'}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => { if (!downloadLink) e.preventDefault() }}
              style={{ display: 'block', width: '100%', padding: '14px', background: downloadLink ? '#3B82F6' : '#243044', color: '#fff', borderRadius: '10px', textDecoration: 'none', fontWeight: '700', fontSize: '15px', textAlign: 'center', marginBottom: '10px', cursor: downloadLink ? 'pointer' : 'not-allowed' }}>
              {downloadLink ? '⬇️ Baixar SumblerControl' : '⏳ Carregando link...'}
            </a>
          </div>
        )}

        {/* ETAPA: Usuário e Senha */}
        {etapa === 'usuario_senha' && (
          <div style={{ background: '#111826', border: '1px solid rgba(59,130,246,0.3)', borderRadius: '16px', padding: '24px', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '12px', textAlign: 'center' }}>👤 Acesso por Usuário e Senha</h2>
            <p style={{ color: '#647489', fontSize: '14px', textAlign: 'center', lineHeight: 1.7, marginBottom: '12px' }}>
              Use o mesmo <strong style={{ color: '#F1F5FA' }}>usuário e senha</strong> do site para fazer login no SumblerControl.exe.
            </p>
            <div style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: '8px', padding: '12px', marginBottom: '16px' }}>
              <p style={{ color: '#FBBF24', fontSize: '12px', lineHeight: 1.6 }}>
                ⚠️ Para trocar de PC, contate o suporte.
              </p>
            </div>
            {/* Botão download só após escolher */}
            <a
              href={downloadLink || '#'}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => { if (!downloadLink) e.preventDefault() }}
              style={{ display: 'block', width: '100%', padding: '14px', background: downloadLink ? '#3B82F6' : '#243044', color: '#fff', borderRadius: '10px', textDecoration: 'none', fontWeight: '700', fontSize: '15px', textAlign: 'center', marginBottom: '10px', cursor: downloadLink ? 'pointer' : 'not-allowed' }}>
              {downloadLink ? '⬇️ Baixar SumblerControl' : '⏳ Carregando link...'}
            </a>
          </div>
        )}

        {/* Botão Ir para minha conta — sempre visível exceto no loading */}
        {etapa !== 'carregando' && (
          <Link href="/minha-conta" style={{ display: 'block', padding: '12px', background: '#111826', border: '1px solid #1E2939', color: '#647489', borderRadius: '10px', textDecoration: 'none', fontSize: '14px', textAlign: 'center' }}>
            Ir para minha conta
          </Link>
        )}
      </div>
    </div>
  )
}

export default function ObrigadoPage() {
  return <Suspense><ObrigadoContent /></Suspense>
}
