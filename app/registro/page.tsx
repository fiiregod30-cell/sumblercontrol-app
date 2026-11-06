'use client'
import { useState } from 'react'
import Link from 'next/link'

export default function RegistroPage() {
  const [form, setForm] = useState({ nome: '', sobrenome: '', username: '', telefone: '', email: '', senha: '', confirmarSenha: '' })
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [emailEnviado, setEmailEnviado] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    if (form.senha !== form.confirmarSenha) { setErro('As senhas não coincidem'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/registro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: form.nome, sobrenome: form.sobrenome, username: form.username, telefone: form.telefone, email: form.email, senha: form.senha })
      })
      const data = await res.json()
      if (!res.ok && res.status !== 200) { setErro(data.error || 'Erro ao criar conta'); return }
      // Sucesso — mostra tela de confirmação pendente
      setEmailEnviado(form.email)
      setEnviado(true)
    } catch { setErro('Erro de conexão') } finally { setLoading(false) }
  }

  // Tela de confirmação pendente
  if (enviado) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', background: '#090F1A' }}>
        <div style={{ width: '100%', maxWidth: '440px', textAlign: 'center' }}>
          <div style={{ width: '72px', height: '72px', background: 'rgba(59,130,246,0.12)', border: '2px solid rgba(59,130,246,0.4)', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px', fontSize: '32px' }}>📧</div>
          <h1 style={{ fontSize: '24px', fontWeight: '800', marginBottom: '12px' }}>Confirme seu e-mail</h1>
          <p style={{ color: '#647489', fontSize: '15px', lineHeight: 1.7, marginBottom: '8px' }}>
            Enviamos um link de confirmação para:
          </p>
          <p style={{ color: '#3B82F6', fontWeight: '600', fontSize: '15px', marginBottom: '24px' }}>{emailEnviado}</p>
          <div style={{ background: '#111826', border: '1px solid #1E2939', borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
            <p style={{ color: '#647489', fontSize: '13px', lineHeight: 1.7 }}>
              Abra o e-mail e clique em <strong style={{ color: '#F1F5FA' }}>&quot;Confirmar meu e-mail&quot;</strong> para ativar sua conta. O link é válido por 24 horas.
            </p>
          </div>
          {/* Aviso spam expandido */}
          <div style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: '12px', padding: '16px', marginBottom: '20px', textAlign: 'left' }}>
            <p style={{ color: '#FBBF24', fontWeight: '700', fontSize: '13px', marginBottom: '10px' }}>⚠️ NÃO ENCONTROU O E-MAIL?</p>
            <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <li style={{ color: '#647489', fontSize: '13px' }}>✓ Verifique a pasta <strong style={{ color: '#F1F5FA' }}>SPAM / Lixo Eletrônico</strong></li>
              <li style={{ color: '#647489', fontSize: '13px' }}>✓ Procure por <strong style={{ color: '#F1F5FA' }}>&quot;SumblerControl&quot;</strong></li>
              <li style={{ color: '#647489', fontSize: '13px' }}>✓ Marque como <strong style={{ color: '#F1F5FA' }}>&quot;Não é spam&quot;</strong> para receber futuros e-mails normalmente</li>
            </ul>
          </div>
          <p style={{ color: '#647489', fontSize: '13px' }}>
            Não recebeu?{' '}
            <button
              onClick={async () => {
                await fetch('/api/auth/reenviar-confirmacao', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: emailEnviado }) })
                alert('E-mail reenviado! Verifique sua caixa de entrada.')
              }}
              style={{ color: '#3B82F6', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', textDecoration: 'underline' }}
            >
              Reenviar e-mail
            </button>
          </p>
          <p style={{ marginTop: '20px' }}>
            <Link href="/login" style={{ color: '#647489', fontSize: '13px', textDecoration: 'none' }}>← Ir para o login</Link>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', background: '#090F1A' }}>
      <div style={{ width: '100%', maxWidth: '440px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ width: '48px', height: '48px', background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: '12px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="#3B82F6" strokeWidth="2"/><circle cx="12" cy="12" r="4" stroke="#3B82F6" strokeWidth="2"/></svg>
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: '800', marginBottom: '6px' }}>Criar conta</h1>
          <p style={{ color: '#647489', fontSize: '14px' }}>Crie sua conta para acessar o SumblerControl</p>
        </div>

        <form onSubmit={handleSubmit} style={{ background: '#111826', border: '1px solid #1E2939', borderRadius: '16px', padding: '32px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', color: '#647489', marginBottom: '6px' }}>Nome</label>
              <input value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} placeholder="João" required style={inputStyle} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', color: '#647489', marginBottom: '6px' }}>Sobrenome</label>
              <input value={form.sobrenome} onChange={e => setForm(p => ({ ...p, sobrenome: e.target.value }))} placeholder="Silva" required style={inputStyle} />
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '13px', color: '#647489', marginBottom: '6px' }}>Nome de usuário</label>
            <input value={form.username} onChange={e => setForm(p => ({ ...p, username: e.target.value.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase() }))} placeholder="joaosilva" required style={inputStyle} />
            <p style={{ fontSize: '11px', color: '#647489', marginTop: '4px' }}>Letras, números e _ apenas. Usado para login.</p>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '13px', color: '#647489', marginBottom: '6px' }}>Telefone</label>
            <input value={form.telefone} onChange={e => setForm(p => ({ ...p, telefone: e.target.value }))} placeholder="(11) 99999-9999" required style={inputStyle} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '13px', color: '#647489', marginBottom: '6px' }}>E-mail</label>
            <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="seu@email.com" required style={inputStyle} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '13px', color: '#647489', marginBottom: '6px' }}>Senha</label>
            <input type="password" value={form.senha} onChange={e => setForm(p => ({ ...p, senha: e.target.value }))} placeholder="Mínimo 8 caracteres" required style={inputStyle} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '13px', color: '#647489', marginBottom: '6px' }}>Confirmar senha</label>
            <input type="password" value={form.confirmarSenha} onChange={e => setForm(p => ({ ...p, confirmarSenha: e.target.value }))} placeholder="Repita a senha" required style={inputStyle} />
          </div>
          {erro && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '12px', fontSize: '13px', color: '#EF4444' }}>{erro}</div>}
          {/* Aviso spam */}
          <div style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: '8px', padding: '10px 14px' }}>
            <p style={{ fontSize: '12px', color: '#FBBF24', lineHeight: 1.6 }}>
              ⚠️ O e-mail de confirmação pode chegar na pasta <strong>SPAM</strong> ou <strong>Lixo Eletrônico</strong>. Verifique lá se não encontrar na caixa de entrada.
            </p>
          </div>
          <button type="submit" disabled={loading} style={btnStyle}>
            {loading ? 'Criando conta...' : 'Criar conta'}
          </button>
          <p style={{ textAlign: 'center', fontSize: '13px', color: '#647489' }}>
            Já tem conta?{' '}
            <Link href="/login" style={{ color: '#3B82F6', textDecoration: 'none' }}>Fazer login</Link>
          </p>
        </form>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px', background: '#151D2C', border: '1px solid #1E2939',
  borderRadius: '8px', color: '#F1F5FA', fontSize: '14px', outline: 'none',
}
const btnStyle: React.CSSProperties = {
  width: '100%', padding: '12px', background: '#3B82F6', color: '#fff',
  border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: '600', cursor: 'pointer',
}
