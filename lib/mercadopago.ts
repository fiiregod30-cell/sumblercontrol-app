import { MercadoPagoConfig, Payment } from 'mercadopago'

// Inicializa o client do Mercado Pago com o Access Token
const mp = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN!,
  options: { timeout: 5000 }
})

export const paymentClient = new Payment(mp)

// ── Criar pagamento PIX ──────────────────────────────────────
export interface CreatePixPaymentParams {
  amount: number
  email: string
  firstName: string
  lastName: string
  description: string
  externalRef: string // ID do pedido no nosso banco
}

export async function createPixPayment(params: CreatePixPaymentParams) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || ''
  const payment = await paymentClient.create({
    body: {
      transaction_amount: params.amount,
      description: params.description,
      payment_method_id: 'pix',
      payer: {
        email: params.email,
        first_name: params.firstName,
        last_name: params.lastName,
      },
      external_reference: params.externalRef,
      date_of_expiration: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 min
      notification_url: `${siteUrl}/api/webhook`, // garante que o MP sempre chama o webhook correto
    }
  })

  const txData = payment.point_of_interaction?.transaction_data

  return {
    id: payment.id?.toString() || '',
    status: payment.status || 'pending',
    qrCode: txData?.qr_code || '',
    qrCodeBase64: txData?.qr_code_base64 || '',
  }
}

// ── Consultar status do pagamento ────────────────────────────
export async function getPaymentStatus(paymentId: string) {
  const payment = await paymentClient.get({ id: parseInt(paymentId) })
  return payment.status
}
