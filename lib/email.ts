import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = 'SumblerControl <noreply@sumblercontrol.com>'
const DOWNLOAD_LINK = process.env.DOWNLOAD_LINK!

// ── E-mail de boas-vindas após registro ──────────────────────
export async function sendWelcomeEmail(email: string, name: string) {
  await resend.emails.send({
    from: FROM,
    to: email,
    subject: 'Bem-vindo ao SumblerControl!',
    html: `
      <div style="background:#090F1A;color:#F1F5FA;font-family:Inter,sans-serif;padding:40px;max-width:600px;margin:0 auto;border-radius:12px;">
        <h1 style="color:#3B82F6;font-size:24px;margin-bottom:16px;">Bem-vindo, ${name}!</h1>
        <p style="color:#647489;line-height:1.7;">Sua conta foi criada com sucesso. Agora você pode fazer login e assinar o plano para ter acesso completo ao SumblerControl.</p>
        <div style="margin:32px 0;">
          <a href="${process.env.NEXT_PUBLIC_SITE_URL}/login" style="background:#3B82F6;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;">Fazer Login</a>
        </div>
        <p style="color:#647489;font-size:13px;">Se você não criou esta conta, ignore este e-mail.</p>
      </div>
    `
  })
}

// ── E-mail de entrega após pagamento confirmado ──────────────
export async function sendDownloadEmail(email: string, name: string, pedidoId: string) {
  await resend.emails.send({
    from: FROM,
    to: email,
    subject: '✅ Pagamento confirmado — Seu download está pronto!',
    html: `
      <div style="background:#090F1A;color:#F1F5FA;font-family:Inter,sans-serif;padding:40px;max-width:600px;margin:0 auto;border-radius:12px;">
        <div style="text-align:center;margin-bottom:32px;">
          <div style="width:64px;height:64px;background:rgba(34,197,94,0.15);border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:32px;">✅</div>
        </div>
        <h1 style="color:#22C55E;font-size:24px;margin-bottom:8px;">Pagamento confirmado!</h1>
        <p style="color:#647489;margin-bottom:24px;">Olá, ${name}. Seu pagamento foi processado com sucesso. Clique no botão abaixo para baixar o SumblerControl.</p>
        <div style="background:#111826;border:1px solid #1E2939;border-radius:8px;padding:20px;margin-bottom:24px;">
          <p style="color:#647489;font-size:13px;margin-bottom:8px;">Pedido #${pedidoId.slice(0, 8).toUpperCase()}</p>
          <p style="color:#F1F5FA;font-weight:600;">SumblerControl — Plano Mensal</p>
        </div>
        <div style="margin:32px 0;text-align:center;">
          <a href="${DOWNLOAD_LINK}" style="background:#3B82F6;color:#fff;padding:16px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:16px;">⬇️ Baixar SumblerControl</a>
        </div>
        <p style="color:#647489;font-size:13px;line-height:1.6;">O link de download também está disponível na sua <a href="${process.env.NEXT_PUBLIC_SITE_URL}/minha-conta" style="color:#3B82F6;">área de conta</a>. Guarde este e-mail para referência futura.</p>
        <hr style="border:none;border-top:1px solid #1E2939;margin:24px 0;">
        <p style="color:#647489;font-size:12px;">SumblerControl — Mais FPS. Menos Gargalo. Performance Real.</p>
      </div>
    `
  })
}

// ── E-mail de reenvio manual (admin) ─────────────────────────
export async function sendDownloadEmailManual(email: string, name: string) {
  await resend.emails.send({
    from: FROM,
    to: email,
    subject: '📦 SumblerControl — Link de download',
    html: `
      <div style="background:#090F1A;color:#F1F5FA;font-family:Inter,sans-serif;padding:40px;max-width:600px;margin:0 auto;border-radius:12px;">
        <h1 style="color:#3B82F6;font-size:24px;margin-bottom:16px;">Olá, ${name}!</h1>
        <p style="color:#647489;margin-bottom:24px;">Aqui está o seu link de download do SumblerControl.</p>
        <div style="margin:32px 0;text-align:center;">
          <a href="${DOWNLOAD_LINK}" style="background:#3B82F6;color:#fff;padding:16px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:16px;">⬇️ Baixar SumblerControl</a>
        </div>
      </div>
    `
  })
}
