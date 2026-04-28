import type { HttpContext } from '@adonisjs/core/http'
import PayPalService from '#services/paypal_service'
import Order from '#models/Order'

export default class PayPalController {
  private paypalService = new PayPalService()

  public async createPayment({ request, response }: HttpContext) {
    const { orderId, amount } = request.body()

    const result = await this.paypalService.createOrder(amount, 'EUR', orderId)

    if (result.success) {
      await Order.query().where('id', orderId).update({
        paypal_order_id: result.orderId
      })

      return response.json({
        success: true,
        approvalUrl: result.approvalUrl
      })
    }

    return response.status(400).json({ success: false, error: result.error })
  }

  public async success({ params, response }: HttpContext) {
    const { token } = params

    const result = await this.paypalService.captureOrder(token)

    if (result.success) {
      const order = await Order.findBy('paypal_order_id', token)
      if (order) {
        order.status = 'paid'
        order.payment_status = 'completed'
        await order.save()
      }

      return response.redirect('/payment-success')
    }

    return response.redirect('/payment-failed')
  }

  public async cancel({ response }: HttpContext) {
    return response.redirect('/payment-cancelled')
  }
}
