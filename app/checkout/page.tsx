'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

export default function CheckoutPage() {
  const router = useRouter()
  const [cupom, setCupom] = useState('')
  const [cupomData, setCupomData] = useState<{ valido: boolean; desconto: number; precoFinal: number; mensagem: string; cupomId: string } | null>(null)
  const [cupomErro, setCupomErro] = useState('')
  const [cupomLoading, setCupomLoading] = useState(false)
  const [pedidoId, setPedidoId] = useState('')
  const [qrCode, setQrCode] = useState('')
  const [copiaCola, setCopiaCola] = useState('')
  const [precoBase, setPrecoBase] = useState(0)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [copiado, setCopiado] = useState(false)
  const [timer, setTimer] = useState(0)
  const [statusPago, setStatusPago] = useState(false)

  // Busca o preço atual do banco — considera o plano da URL
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search)
    const plano = searchParams.get('plano') || 'mensal'
    fetch('/api/config-publica')
      .then(r => r.json())
      .then(d => {
        let preco = d.preco
        if (plano === 'semestral') preco = d.precoSemestral
        if (plano === 'anual') preco = d.precoAnual
        setPrecoBase(preco)
      })
      .catch(() => { setPrecoBase(31.99) })
  }, [])

  // Polling de status do pagamento
  const checkStatus = useCallback(async () => {
    if (!pedidoId || statusPago) return
    try {
      const res = await fetch(`/api/pagamento/status?pedidoId=${pedidoId}`)
      const data = await res.json()
      if (data.status === 'pago') {
        setStatusPago(true)
        router.push(`/obrigado?pedido=${pedidoId}`)
      }
    } catch { /* silencioso */ }
  }, [pedidoId, statusPago, router])

  useEffect(() => {
    if (!pedidoId) return
    const interval = setInterval(checkStatus, 5000)
    return () => clearInterval(interval)
  }, [pedidoId, checkStatus])

  // Timer regressivo 30 minutos
  useEffect(() => {
    if (!pedidoId || timer <= 0) return
    const t = setInterval(() => setTimer(prev => prev - 1), 1000)
    return () => clearInterval(t)
  }, [pedidoId, timer])

  async function validarCupom() {
    if (!cupom.trim()) return
    setCupomErro(''); setCupomLoading(true)
    try {
      const plano = new URLSearchParams(window.location.search).get('plano') || 'mensal'
      const res = await fetch('/api/cupom/validar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo: cupom, plano })
      })
      const data = await res.json()
      if (!res.ok) { setCupomErro(data.error); setCupomData(null); return }
      setCupomData(data)
    } catch { setCupomErro('Erro ao validar cupom') } finally { setCupomLoading(false) }
  }

  async function gerarPix() {
    setErro(''); setLoading(true)
    try {
      const plano = new URLSearchParams(window.location.search).get('plano') || 'mensal'
      const res = await fetch('/api/pagamento/criar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cupomId: cupomData?.cupomId || null, plano })
      })
      const data = await res.json()
      if (res.status === 401) { router.push('/login'); return }
      if (!res.ok) { setErro(data.error || 'Erro ao gerar PIX'); return }
      setPedidoId(data.pedidoId)
      setQrCode(data.qrCode)
      setCopiaCola(data.copiaCola)
      setTimer(30 * 60) // 30 minutos
    } catch { setErro('Erro de conexão') } finally { setLoading(false) }
  }

  function copiarCodigo() {
    navigator.clipboard.writeText(copiaCola)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  const minutos = Math.floor(timer / 60).toString().padStart(2, '0')
  const segundos = (timer % 60).toString().padStart(2, '0')

  return (
    <div style={{ minHeight: '100vh', background: '#090F1A', padding: '40px 24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: '500px' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ width: '48px', height: '48px', background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: '12px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="#3B82F6" strokeWidth="2"/><circle cx="12" cy="12" r="4" stroke="#3B82F6" strokeWidth="2"/></svg>
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: '800', marginBottom: '6px' }}>Finalizar assinatura</h1>
          <p style={{ color: '#647489', fontSize: '14px' }}>SumblerControl — Plano Mensal</p>
        </div>

        <div style={{ background: '#111826', border: '1px solid #1E2939', borderRadius: '16px', padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Resumo do pedido */}
          <div style={{ background: '#151D2C', borderRadius: '10px', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ color: '#647489', fontSize: '14px' }}>SumblerControl Mensal</span>
              <span style={{ fontSize: '14px' }}>{precoBase > 0 ? `R$ ${precoBase.toFixed(2).replace('.', ',')}` : '...'}</span>
            </div>
            {cupomData?.valido && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: '#22C55E', fontSize: '14px' }}>Desconto ({cupomData.mensagem.split(' ')[0]})</span>
                <span style={{ color: '#22C55E', fontSize: '14px' }}>- R$ {cupomData.desconto.toFixed(2)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #1E2939', paddingTop: '8px', marginTop: '8px' }}>
              <span style={{ fontWeight: '700' }}>Total</span>
              <span style={{ fontWeight: '700', color: '#3B82F6', fontSize: '18px' }}>R$ {(cupomData?.precoFinal || precoBase || 0).toFixed(2)}</span>
            </div>
          </div>

          {/* Cupom */}
          {!qrCode && (
            <div>
              <label style={{ display: 'block', fontSize: '13px', color: '#647489', marginBottom: '6px' }}>Cupom de desconto (opcional)</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input value={cupom} onChange={e => setCupom(e.target.value.toUpperCase())} placeholder="CÓDIGO" style={{ ...inputStyle, flex: 1, letterSpacing: '0.05em' }} />
                <button onClick={validarCupom} disabled={cupomLoading} style={{ padding: '10px 16px', background: '#151D2C', border: '1px solid #243044', borderRadius: '8px', color: '#F1F5FA', fontSize: '13px', fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  {cupomLoading ? '...' : 'Aplicar'}
                </button>
              </div>
              {cupomErro && <p style={{ color: '#EF4444', fontSize: '12px', marginTop: '6px' }}>{cupomErro}</p>}
              {cupomData?.valido && <p style={{ color: '#22C55E', fontSize: '12px', marginTop: '6px' }}>✓ {cupomData.mensagem}</p>}
            </div>
          )}

          {/* QR Code */}
          {qrCode ? (
            <div style={{ textAlign: 'center' }}>
              {timer > 0 && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: '999px', padding: '4px 12px', marginBottom: '16px', fontSize: '13px', color: '#FBBF24' }}>
                  ⏱ Expira em {minutos}:{segundos}
                </div>
              )}
              <div style={{ background: '#fff', borderRadius: '12px', padding: '16px', display: 'inline-block', marginBottom: '16px' }}>
                <Image src={`data:image/png;base64,${qrCode}`} alt="QR Code PIX" width={200} height={200} />
              </div>
              <p style={{ color: '#647489', fontSize: '13px', marginBottom: '12px' }}>Abra o app do seu banco e escaneie o QR Code</p>
              <p style={{ fontSize: '13px', color: '#647489', marginBottom: '8px' }}>Ou copie o código PIX:</p>
              <button onClick={copiarCodigo} style={{ width: '100%', padding: '12px', background: copiado ? 'rgba(34,197,94,0.1)' : '#151D2C', border: `1px solid ${copiado ? '#22C55E' : '#243044'}`, borderRadius: '8px', color: copiado ? '#22C55E' : '#F1F5FA', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>
                {copiado ? '✓ Código copiado!' : '📋 Copiar código PIX'}
              </button>
              <p style={{ color: '#647489', fontSize: '12px', marginTop: '12px' }}>Aguardando confirmação do pagamento...</p>
            </div>
          ) : (
            <>
              {erro && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '12px', fontSize: '13px', color: '#EF4444' }}>{erro}</div>}
              <button onClick={gerarPix} disabled={loading} style={btnStyle}>
                {loading ? 'Gerando PIX...' : '⚡ Gerar QR Code PIX'}
              </button>
            </>
          )}
        </div>

        <p style={{ textAlign: 'center', marginTop: '16px', fontSize: '12px', color: '#647489' }}>
          🔒 Pagamento 100% seguro via Mercado Pago
        </p>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  padding: '10px 14px', background: '#151D2C', border: '1px solid #1E2939',
  borderRadius: '8px', color: '#F1F5FA', fontSize: '14px', outline: 'none',
}
const btnStyle: React.CSSProperties = {
  width: '100%', padding: '14px', background: '#3B82F6', color: '#fff',
  border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: '700', cursor: 'pointer',
}
