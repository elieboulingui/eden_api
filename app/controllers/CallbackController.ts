// app/controllers/CallbackController.ts - CORRIGÉ FINAL
import type { HttpContext } from '@adonisjs/core/http'
import Order from '#models/Order'
import OrderItem from '#models/OrderItem'
import OrderTracking from '#models/order_tracking'
import User from '#models/user'
import Product from '#models/Product'
import Wallet from '#models/wallet'
import { DateTime } from 'luxon'

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

      // ==================== RECHERCHE ====================
      let order: Order | null = null

      if (refId) {
        order = await Order.query().where('payment_reference_id', refId).first()
      }

      if (!order && txId) {
        order = await Order.query().where('payment_reference_id', txId).first()
      }

      if (!order) {
        const searchTerm = refId || txId
        if (searchTerm) {
          const tracking = await OrderTracking.query()
            .where('description', 'like', `%${searchTerm}%`)
            .first()

          if (tracking) {
            order = await Order.find(tracking.order_id)
          }
        }
      }

      // ==================== TRAITEMENT ====================
      if (order) {

        console.log(`📦 Commande: ${order.order_number}`)

        // 🔒 éviter double traitement
        if (order.payment_status === 'paid') {
          console.log('⚠️ Déjà payé → skip')
          return response.ok({ message: 'Déjà traité' })
        }

        order.payment_status = status
        order.payment_transaction_id = txId || refId
        order.payment_operator_simple = operator
        order.payment_amount = amount

        if (status === 'paid') {
          order.status = 'paid'
          order.payment_completed_at = DateTime.now()

          await order.save()

          await OrderTracking.create({
            order_id: order.id,
            status: 'paid',
            description: `✅ Paiement confirmé ${amount} FCFA`,
            tracked_at: DateTime.now(),
          })

          // ✅ Décrémenter le stock SEULEMENT quand le paiement est confirmé
          await this.updateProductStock(order.id)
          
          // ✅ Créditer les vendeurs et l'admin
          await this.creditAdmin(order.total)
          await this.creditSellers(order.id)

        } else if (status === 'failed') {
          order.status = 'payment_failed'
          order.payment_error_message = `${code} - ${message}`

          await order.save()

          await OrderTracking.create({
            order_id: order.id,
            status: 'payment_failed',
            description: `❌ Paiement échoué`,
            tracked_at: DateTime.now(),
          })

          // ✅ Pas besoin de restaurer le stock (jamais décrémenté avant)
          // await this.restoreProductStock(order.id) ← SUPPRIMÉ

        } else {
          // pending
          await OrderTracking.create({
            order_id: order.id,
            status: 'pending_payment',
            description: `⏳ En attente`,
            tracked_at: DateTime.now(),
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

      return response.ok({
        responseCode: 200
      })
    }
  }

  // ==================== STOCK (appelé UNIQUEMENT par le callback) ====================
  private async updateProductStock(orderId: string) {
    const items = await OrderItem.query().where('order_id', orderId)

    for (const item of items) {
      const product = await Product.find(item.product_id)
      if (product) {
        product.stock = Math.max(0, product.stock - item.quantity)
        if (product.stock === 0) product.isArchived = true
        await product.save()
      }
    }
  }

  // ❌ SUPPRIMER - Plus nécessaire car le stock n'est jamais décrémenté avant le callback
  // private async restoreProductStock(orderId: string) {
  //   const items = await OrderItem.query().where('order_id', orderId)
  //   for (const item of items) {
  //     const product = await Product.find(item.product_id)
  //     if (product) {
  //       product.stock += item.quantity
  //       product.isArchived = false
  //       await product.save()
  //     }
  //   }
  // }

  // ==================== WALLET ====================
  private async creditAdmin(total: number) {
    const admins = await User.query().whereIn('role', ['admin', 'superadmin'])

    for (const admin of admins) {
      let wallet = await Wallet.findBy('user_id', admin.id)
      const fee = total * 0.005

      if (wallet) {
        wallet.balance += fee
        await wallet.save()
      } else {
        await Wallet.create({
          user_id: admin.id,
          balance: fee,
          currency: 'XAF',
          status: 'active'
        })
      }
    }
  }

  private async creditSellers(orderId: string) {
    const items = await OrderItem.query().where('order_id', orderId)
    const map = new Map<string, number>()

    for (const item of items) {
      const product = await Product.find(item.product_id)
      if (product?.user_id) {
        map.set(
          product.user_id,
          (map.get(product.user_id) || 0) + Number(item.subtotal)
        )
      }
    } 

    for (const [sellerId, amount] of map.entries()) {
      let wallet = await Wallet.findBy('user_id', sellerId)

      if (wallet) {
        wallet.balance += amount
        await wallet.save()
      } else {
        await Wallet.create({
          user_id: sellerId,
          balance: amount,
          currency: 'XAF',
          status: 'active'
        })
      }
    }
  }
}
