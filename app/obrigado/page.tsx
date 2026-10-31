'use client'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Suspense, useEffect, useState } from 'react'

function ObrigadoContent() {
  const params = useSearchParams()
  const pedidoId = params.get('pedido') || ''
  const [downloadLink, setDownloadLink] = useState('')

  useEffect(() => {
    fetch('/api/config-publica')
      .then(r => r.json())
      .then(d => { /* link vem do pedido, não da config */ })
      .catch(() => {})

    // Busca o link de download do pedido específico
    if (pedidoId) {
      fetch(`/api/pagamento/status?pedidoId=${pedidoId}`)
        .then(r => r.json())
        .then(d => { if (d.linkDownload) setDownloadLink(d.linkDownload) })
        .catch(() => {})
    }
  }, [pedidoId])

  return (
    <div style={{ minHeight: '100vh', background: '#090F1A', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '480px', textAlign: 'center' }}>
        <div style={{ width: '80px', height: '80px', background: 'rgba(34,197,94,0.15)', border: '2px solid #22C55E', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px', fontSize: '36px' }}>✅</div>
        <h1 style={{ fontSize: '28px', fontWeight: '900', marginBottom: '12px' }}>Pagamento confirmado!</h1>
        <p style={{ color: '#647489', fontSize: '16px', marginBottom: '8px' }}>Seu acesso ao SumblerControl está liberado.</p>
        <p style={{ color: '#647489', fontSize: '14px', marginBottom: '32px' }}>O link de download também foi enviado para o seu e-mail.</p>

        {pedidoId && (
          <div style={{ background: '#111826', border: '1px solid #1E2939', borderRadius: '10px', padding: '14px', marginBottom: '24px' }}>
            <p style={{ color: '#647489', fontSize: '12px', marginBottom: '4px' }}>Pedido</p>
            <p style={{ fontFamily: 'monospace', fontSize: '14px', color: '#3B82F6' }}>#{pedidoId.slice(0, 8).toUpperCase()}</p>
          </div>
        )}

        <a
          href={downloadLink || '#'}
          onClick={e => { if (!downloadLink) { e.preventDefault(); alert('Aguarde, carregando o link...') } }}
          style={{ display: 'block', width: '100%', padding: '16px', background: downloadLink ? '#3B82F6' : '#243044', color: '#fff', borderRadius: '10px', textDecoration: 'none', fontWeight: '700', fontSize: '16px', marginBottom: '12px', cursor: downloadLink ? 'pointer' : 'not-allowed' }}>
          {downloadLink ? '⬇️ Baixar SumblerControl' : '⏳ Carregando link...'}
        </a>
        <Link href="/minha-conta" style={{ display: 'block', padding: '14px', background: '#111826', border: '1px solid #1E2939', color: '#F1F5FA', borderRadius: '10px', textDecoration: 'none', fontSize: '14px' }}>
          Ir para minha conta
        </Link>
      </div>
    </div>
  )
}

export default function ObrigadoPage() {
  return <Suspense><ObrigadoContent /></Suspense>
}
