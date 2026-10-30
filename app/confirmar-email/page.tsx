'use client'
import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'

function ConfirmarContent() {
  const params = useSearchParams()
  const router = useRouter()
  const token = params.get('token')
  const [status, setStatus] = useState<'loading' | 'ok' | 'erro'>('loading')
  const [msg, setMsg] = useState('')

  useEffect(() => {
    if (!token) { setStatus('erro'); setMsg('Token inválido.'); return }

    fetch(`/api/auth/confirmar-email?token=${token}`)
      .then(res => {
        if (res.redirected) {
          const url = new URL(res.url)
          if (url.searchParams.get('confirmado')) {
            setStatus('ok')
            setTimeout(() => router.push('/login?confirmado=true'), 2000)
          } else {
            const erro = url.searchParams.get('erro')
            setStatus('erro')
            if (erro === 'token-expirado') setMsg('Link expirado. Faça o cadastro novamente para receber um novo link.')
            else if (erro === 'token-usado') setMsg('Este link já foi utilizado. Faça login normalmente.')
            else setMsg('Link inválido ou expirado.')
          }
        }
      })
      .catch(() => { setStatus('erro'); setMsg('Erro de conexão.') })
  }, [token, router])

  return (
    <div style={{ minHeight: '100vh', background: '#090F1A', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ textAlign: 'center', maxWidth: '400px' }}>
        {status === 'loading' && (
          <>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏳</div>
            <h2 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '8px' }}>Confirmando seu e-mail...</h2>
            <p style={{ color: '#647489', fontSize: '14px' }}>Aguarde um momento.</p>
          </>
        )}
        {status === 'ok' && (
          <>
            <div style={{ width: '72px', height: '72px', background: 'rgba(34,197,94,0.15)', border: '2px solid #22C55E', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px', fontSize: '32px' }}>✅</div>
            <h2 style={{ fontSize: '22px', fontWeight: '800', marginBottom: '8px', color: '#22C55E' }}>E-mail confirmado!</h2>
            <p style={{ color: '#647489', fontSize: '14px' }}>Redirecionando para o login...</p>
          </>
        )}
        {status === 'erro' && (
          <>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>❌</div>
            <h2 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '8px', color: '#EF4444' }}>Erro na confirmação</h2>
            <p style={{ color: '#647489', fontSize: '14px', marginBottom: '24px' }}>{msg}</p>
            <a href="/registro" style={{ display: 'inline-block', padding: '12px 24px', background: '#3B82F6', color: '#fff', borderRadius: '8px', textDecoration: 'none', fontSize: '14px', fontWeight: '600' }}>
              Voltar ao cadastro
            </a>
          </>
        )}
      </div>
    </div>
  )
}

export default function ConfirmarEmailPage() {
  return <Suspense><ConfirmarContent /></Suspense>
}
