import { Resend } from 'resend'
import { supabaseAdmin } from './supabase'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL!

const FROM = 'SumblerControl <noreply@sumblercontrol.com.br>'

function getResend() {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) throw new Error('RESEND_API_KEY não está configurada.')
  return new Resend(apiKey)
}

// Busca o link de download sempre do banco (admin pode atualizar)
async function getDownloadLink(): Promise<string> {
  const { data } = await supabaseAdmin
    .from('config_site')
    .select('link_download')
    .eq('id', 1)
    .single()
  return data?.link_download || process.env.DOWNLOAD_LINK || ''
}

// ── E-mail de confirmação de cadastro ───────────────────────
export async function sendConfirmationEmail(email: string, name: string, token: string) {
  const confirmUrl = `${SITE_URL}/confirmar-email?token=${token}`
  await getResend().emails.send({
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
  const DOWNLOAD_LINK = await getDownloadLink()
  await getResend().emails.send({
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
  const DOWNLOAD_LINK = await getDownloadLink()
  await getResend().emails.send({
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

// ── E-mail com a key após ativação ───────────────────────────
export async function sendLicensaEmail(email: string, name: string, key: string) {
  await getResend().emails.send({
    from: FROM,
    to: email,
    subject: `🔑 Sua licença SumblerControl — ${key}`,
    html: `
      <div style="background:#090F1A;color:#F1F5FA;font-family:Inter,sans-serif;padding:40px;max-width:600px;margin:0 auto;border-radius:12px;">
        <h1 style="color:#3B82F6;font-size:22px;margin-bottom:8px;">Sua licença foi ativada!</h1>
        <p style="color:#647489;margin-bottom:24px;">Olá, ${name}! Guarde este e-mail — você precisará da key para ativar o software.</p>
        <div style="background:#111826;border:1px solid #1E2939;border-radius:10px;padding:20px;margin-bottom:24px;text-align:center;">
          <p style="color:#647489;font-size:12px;margin-bottom:8px;">Sua Key de Licença</p>
          <p style="font-family:monospace;font-size:20px;font-weight:800;color:#3B82F6;letter-spacing:0.1em;">${key}</p>
        </div>
        <p style="color:#647489;font-size:14px;line-height:1.7;margin-bottom:8px;"><strong style="color:#F1F5FA;">Como usar:</strong></p>
        <ol style="color:#647489;font-size:14px;line-height:2;padding-left:20px;">
          <li>Abra o <strong style="color:#F1F5FA;">SumblerControl.exe</strong></li>
          <li>Selecione <strong style="color:#F1F5FA;">"Key"</strong></li>
          <li>Digite a key acima e clique <strong style="color:#F1F5FA;">Entrar</strong></li>
        </ol>
        <div style="background:rgba(251,191,36,0.1);border:1px solid rgba(251,191,36,0.3);border-radius:8px;padding:14px;margin-top:24px;">
          <p style="color:#FBBF24;font-size:13px;">⚠️ Para trocar de PC, entre em contato com o suporte. A licença só funciona no primeiro PC onde foi ativada.</p>
        </div>
        <hr style="border:none;border-top:1px solid #1E2939;margin:24px 0;">
        <p style="color:#647489;font-size:12px;">SumblerControl — Mais FPS. Menos Gargalo.</p>
      </div>
    `
  })
}

// ── E-mail de reset de HWID pelo admin ───────────────────────
export async function sendHwidResetEmail(email: string, name: string) {
  await getResend().emails.send({
    from: FROM,
    to: email,
    subject: '🔄 HWID resetado — SumblerControl',
    html: `
      <div style="background:#090F1A;color:#F1F5FA;font-family:Inter,sans-serif;padding:40px;max-width:600px;margin:0 auto;border-radius:12px;">
        <h1 style="color:#3B82F6;font-size:22px;margin-bottom:8px;">HWID Resetado</h1>
        <p style="color:#647489;margin-bottom:24px;">Olá, ${name}! Seu HWID foi resetado pelo suporte.</p>
        <p style="color:#647489;font-size:14px;line-height:1.7;">Você pode agora ativar sua licença em um novo PC. Basta abrir o SumblerControl.exe e fazer login normalmente — o novo PC será registrado automaticamente.</p>
        <hr style="border:none;border-top:1px solid #1E2939;margin:24px 0;">
        <p style="color:#647489;font-size:12px;">SumblerControl — Mais FPS. Menos Gargalo.</p>
      </div>
    `
  })
}
