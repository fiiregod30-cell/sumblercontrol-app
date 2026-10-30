'use client'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'

function ObrigadoContent() {
  const params = useSearchParams()
  const pedidoId = params.get('pedido') || ''
  const downloadLink = process.env.NEXT_PUBLIC_DOWNLOAD_LINK

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

        <a href={downloadLink || '#'} style={{ display: 'block', width: '100%', padding: '16px', background: '#3B82F6', color: '#fff', borderRadius: '10px', textDecoration: 'none', fontWeight: '700', fontSize: '16px', marginBottom: '12px' }}>
          ⬇️ Baixar SumblerControl
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
