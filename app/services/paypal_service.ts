// app/services/paypal_service.ts
import env from '#start/env'
import paypal from '@paypal/checkout-server-sdk'

function environment() {
  const clientId = env.get('PAYPAL_CLIENT_ID')
  const clientSecret = env.get('PAYPAL_CLIENT_SECRET')

  if (env.get('PAYPAL_MODE') === 'live') {
    return new paypal.core.LiveEnvironment(clientId, clientSecret)
  }
  return new paypal.core.SandboxEnvironment(clientId, clientSecret)
}

function client() {
  return new paypal.core.PayPalHttpClient(environment())
}

export default class PayPalService {
  private client = client()

  async createOrder(amount: number, currency: string = 'EUR', reference: string) {
    const request = new paypal.orders.OrdersCreateRequest()
    request.requestBody({
      intent: 'CAPTURE',
      purchase_units: [{
        amount: {
          currency_code: currency,
          value: amount.toString()
        },
        reference_id: reference,
        description: `Commande ${reference}`
      }],
      application_context: {
        brand_name: 'AdminMarket',
        return_url: `${env.get('APP_URL')}/paypal/success`,
        cancel_url: `${env.get('APP_URL')}/paypal/cancel`
      }
    })

    try {
      const order = await this.client.execute(request)
      return {
        success: true,
        orderId: order.result.id,
        approvalUrl: order.result.links.find((link: any) => link.rel === 'approve').href
      }
    } catch (error: any) {
      console.error('PayPal error:', error)
      return { success: false, error: error.message }
    }
  }

  async captureOrder(orderId: string) {
    const request = new paypal.orders.OrdersCaptureRequest(orderId)
    request.requestBody({
      payment_source: {} as any
    })

    try {
      const capture = await this.client.execute(request)
      return { success: true, capture: capture.result }
    } catch (error: any) {
      console.error('Capture error:', error)
      return { success: false, error: error.message }
    }
  }
}
