// app/controllers/CallbackController.ts - EMAIL CLIENT UNIQUEMENT (pas vendeur)
import type { HttpContext } from '@adonisjs/core/http'
import Order from '#models/Order'
import OrderItem from '#models/OrderItem'
import OrderTracking from '#models/order_tracking'
import User from '#models/user'
import Product from '#models/Product'
import Wallet from '#models/wallet'
import { DateTime } from 'luxon'
import OrderEmailService from '../services/OrderEmailService.js'

export default class CallbackController {

  private mapPaymentStatus(status: string): string {
    switch (status?.toUpperCase()) {
      case 'SUCCESS': return 'paid'
      case 'FAILED':
      case 'CANCELLED': return 'failed'
      case 'PENDING': return 'pending'
      default: return 'pending'
    }
  }

  async handle({ request, response }: HttpContext) {
    console.log('📞 ========== CALLBACK MYPVIT REÇU ==========')

    try {
      const data = request.body()

      const refId = data.merchantReferenceId
        || data.merchant_reference_id
        || data.reference_id
        || data.referenceId
        || data.reference
        || ''

      const txId = data.transactionId
        || data.transaction_id
        || data.id
        || ''

      const rawStatus = data.status || data.transactionStatus || 'UNKNOWN'
      const status = this.mapPaymentStatus(rawStatus)

      const operator = data.operator || data.operator_name || ''
      const code = data.code || data.status_code || ''
      const message = data.message || data.error_message || ''
      const amount = data.amount || data.total_amount || 0

      console.log('🔍 Status reçu:', rawStatus, '→ mappé en:', status)

      let order: Order | null = null

      if (refId) {
        order = await Order.query().where('paymentReferenceId', refId).first()
      }

      if (!order && txId) {
        order = await Order.query().where('paymentReferenceId', txId).first()
      }

      if (!order) {
        const searchTerm = refId || txId
        if (searchTerm) {
          const tracking = await OrderTracking.query()
            .where('description', 'like', `%${searchTerm}%`)
            .first()

          if (tracking) {
            order = await Order.find(tracking.orderId)
          }
        }
      }

      if (order) {

        console.log(`📦 Commande: ${order.orderNumber}`)

        if (order.paymentStatus === 'paid') {
          console.log('⚠️ Déjà payé → skip')
          return response.ok({ message: 'Déjà traité' })
        }

        order.paymentStatus = status
        order.paymentTransactionId = txId || refId
        order.paymentOperatorSimple = operator
        order.paymentAmount = amount

        if (status === 'paid') {
          order.status = 'paid'
          order.paymentCompletedAt = DateTime.now()
          await order.save()

          await OrderTracking.create({
            orderId: order.id,
            status: 'paid',
            description: `✅ Paiement confirmé ${amount} FCFA`,
            trackedAt: DateTime.now(),
          })

          await this.updateProductStock(order.id)
          await this.creditAdmin(order.total)
          await this.creditSellers(order.id)

          // ✅ Email au CLIENT UNIQUEMENT
          try {
            await OrderEmailService.sendOrderConfirmation(order.id)
            console.log('📧 Email de confirmation envoyé au client')
          } catch (emailError: any) {
            console.error('❌ Erreur email client:', emailError.message)
          }

        } else if (status === 'failed') {
          order.status = 'payment_failed'
          order.paymentErrorMessage = `${code} - ${message}`
          await order.save()

          await OrderTracking.create({
            orderId: order.id,
            status: 'payment_failed',
            description: `❌ Paiement échoué`,
            trackedAt: DateTime.now(),
          })

        } else {
          await OrderTracking.create({
            orderId: order.id,
            status: 'pending_payment',
            description: `⏳ En attente`,
            trackedAt: DateTime.now(),
          })
        }

      } else {
        console.log('❌ Commande non trouvée')
      }

      return response.ok({
        responseCode: 200,
        transactionId: txId || refId || 'unknown'
      })

    } catch (error: any) {
      console.error('❌ Erreur:', error.message)
      return response.ok({ responseCode: 200 })
    }
  }

  private async updateProductStock(orderId: string) {
    const items = await OrderItem.query().where('orderId', orderId)  // ✅ CORRIGÉ: order_id → orderId
    for (const item of items) {
      const product = await Product.find(item.productId)  // ✅ CORRIGÉ: product_id → productId
      if (product) {
        product.stock = Math.max(0, product.stock - item.quantity)
        if (product.stock === 0) product.isArchived = true
        await product.save()
      }
    }
  }

  private async creditAdmin(total: number) {
    const admins = await User.query().whereIn('role', ['admin', 'superadmin'])
    for (const admin of admins) {
      let wallet = await Wallet.query().where('userId', admin.id).first()  // ✅ CORRIGÉ: user_id → userId
      const fee = total * 0.005
      if (wallet) {
        wallet.balance += fee
        await wallet.save()
      } else {
        await Wallet.create({ 
          userId: admin.id,  // ✅ CORRIGÉ: user_id → userId
          balance: fee, 
          currency: 'XAF', 
          status: 'active' 
        })
      }
    }
  }

  private async creditSellers(orderId: string) {
    const items = await OrderItem.query().where('orderId', orderId)  // ✅ CORRIGÉ: order_id → orderId
    const map = new Map<string, number>()

    for (const item of items) {
      const product = await Product.find(item.productId)  // ✅ CORRIGÉ: product_id → productId
      if (product?.userId) {  // ✅ CORRIGÉ: user_id → userId
        map.set(product.userId, (map.get(product.userId) || 0) + Number(item.subtotal))
      }
    }

    for (const [sellerId, amount] of map.entries()) {
      let wallet = await Wallet.query().where('userId', sellerId).first()  // ✅ CORRIGÉ: user_id → userId
      if (wallet) {
        wallet.balance += amount
        await wallet.save()
      } else {
        await Wallet.create({ 
          userId: sellerId,  // ✅ CORRIGÉ: user_id → userId
          balance: amount, 
          currency: 'XAF', 
          status: 'active' 
        })
      }
    }
  }
}
