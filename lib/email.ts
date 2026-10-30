import nodemailer from 'nodemailer'

const DOWNLOAD_LINK = process.env.DOWNLOAD_LINK!
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL!

// Transporter Gmail via App Password
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
})

const FROM = `SumblerControl <${process.env.GMAIL_USER}>`

// ── E-mail de confirmação de cadastro ───────────────────────
export async function sendConfirmationEmail(email: string, name: string, token: string) {
  const confirmUrl = `${SITE_URL}/confirmar-email?token=${token}`
  await transporter.sendMail({
    from: FROM,
    to: email,
    subject: 'Confirme seu e-mail — SumblerControl',
    html: `
      <div style="background:#090F1A;color:#F1F5FA;font-family:Inter,sans-serif;padding:40px;max-width:600px;margin:0 auto;border-radius:12px;">
        <div style="text-align:center;margin-bottom:32px;">
          <div style="width:56px;height:56px;background:rgba(59,130,246,0.12);border:1px solid rgba(59,130,246,0.3);border-radius:12px;display:inline-flex;align-items:center;justify-content:center;font-size:28px;">📧</div>
        </div>
        <h1 style="color:#F1F5FA;font-size:22px;font-weight:800;margin-bottom:8px;text-align:center;">Confirme seu e-mail</h1>
        <p style="color:#647489;text-align:center;margin-bottom:32px;">Olá, ${name}! Clique no botão abaixo para confirmar seu e-mail e ativar sua conta.</p>
        <div style="text-align:center;margin-bottom:32px;">
          <a href="${confirmUrl}" style="background:#3B82F6;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;display:inline-block;">Confirmar meu e-mail</a>
        </div>
        <p style="color:#647489;font-size:13px;text-align:center;">Link válido por 24 horas. Se não criou esta conta, ignore este e-mail.</p>
        <hr style="border:none;border-top:1px solid #1E2939;margin:24px 0;">
        <p style="color:#647489;font-size:12px;text-align:center;">SumblerControl — Mais FPS. Menos Gargalo.</p>
      </div>
    `
  })
}

// ── E-mail de entrega após pagamento confirmado ──────────────
export async function sendDownloadEmail(email: string, name: string, pedidoId: string) {
  await transporter.sendMail({
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
        <p style="color:#647489;font-size:13px;line-height:1.6;">O link também está disponível na sua <a href="${SITE_URL}/minha-conta" style="color:#3B82F6;">área de conta</a>.</p>
        <hr style="border:none;border-top:1px solid #1E2939;margin:24px 0;">
        <p style="color:#647489;font-size:12px;">SumblerControl — Mais FPS. Menos Gargalo. Performance Real.</p>
      </div>
    `
  })
}

// ── E-mail de reenvio manual (admin) ─────────────────────────
export async function sendDownloadEmailManual(email: string, name: string) {
  await transporter.sendMail({
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
