// app/controllers/CallbackController.ts - ADAPTÉ À VOTRE BASE DE DONNÉES ACTUELLE
import type { HttpContext } from '@adonisjs/core/http'
import Order from '#models/Order'
import OrderItem from '#models/OrderItem'
import OrderTracking from '#models/order_tracking'
import User from '#models/user'
import Product from '#models/Product'
import Wallet from '#models/wallet'
import { DateTime } from 'luxon'

export default class CallbackController {

  async handle({ request, response }: HttpContext) {
    console.log('📞 [Callback] MYPVIT')
    try {
      const data = request.body()
      console.log('📦', data.status, data.merchantReferenceId)

      const refId = data.merchantReferenceId
      const txId = data.transactionId

      let order = await Order.query()
        .where('payment_reference_id', refId)
        .orWhere('payment_reference_id', txId)
        .first()

      if (!order) {
        const tracking = await OrderTracking.query()
          .where('description', 'like', `%${refId}%`)
          .orWhere('description', 'like', `%${txId}%`)
          .first()
        if (tracking) order = await Order.find(tracking.order_id)
      }

      if (order) {
        console.log(`📦 Commande: ${order.order_number}`)

        if (data.status === 'SUCCESS') {
          order.status = 'paid'
          order.payment_completed_at = DateTime.now()
          await order.save()

          await OrderTracking.create({
            order_id: order.id,
            status: 'paid',
            description: `✅ Payé - ${data.operator} - ${txId}`,
            tracked_at: DateTime.now(),
          })

          // ✅ DÉCRÉMENTER LE STOCK + ARCHIVER SI STOCK = 0
          await this.updateProductStock(order.id)

          // ✅ Créditer admin (0.5%) + vendeurs
          await this.creditAdmin(order.total)
          await this.creditSellers(order.id)

          console.log('✅ PAYÉ + STOCK MAJ + CRÉDITS!')
        } else {
          order.status = 'payment_failed'
          order.payment_error_message = `Code: ${data.code}`
          await order.save()
          await OrderTracking.create({
            order_id: order.id,
            status: 'payment_failed',
            description: `❌ Échec (${data.code}) - ${txId}`,
            tracked_at: DateTime.now(),
          })
          console.log('❌ ÉCHEC')
        }
      } else {
        console.log('⚠️ Commande non trouvée:', refId, txId)
      }

      return response.status(200).json({
        responseCode: data.code || 200,
        transactionId: txId || 'unknown'
      })
    } catch (error: any) {
      console.error('❌ Erreur callback:', error.message)
      return response.status(500).json({
        responseCode: 500,
        transactionId: request.body().transactionId || 'unknown'
      })
    }
  }

  // ==================== MISE À JOUR DU STOCK + ARCHIVAGE ====================
  private async updateProductStock(orderId: string): Promise<void> {
    try {
      console.log('📦 Mise à jour du stock pour la commande:', orderId)

      const items = await OrderItem.query().where('order_id', orderId)

      for (const item of items) {
        const product = await Product.findBy('id', item.product_id)

        if (product) {
          const stockAvant = product.stock
          const quantiteAchetee = item.quantity
          const nouveauStock = Math.max(0, stockAvant - quantiteAchetee)

          // ✅ On utilise UNIQUEMENT les colonnes qui existent : stock et is_archived
          product.stock = nouveauStock

          // ✅ Si stock = 0, on archive
          if (nouveauStock === 0) {
            product.isArchived = true
            console.log(`📦 ARCHIVAGE: ${product.name} - Stock épuisé (${stockAvant} → 0)`)
          }

          // Sauvegarde sans utiliser sales ni status
          await product.save()

          console.log(
            `📦 ${product.name}: Stock ${stockAvant} → ${nouveauStock} (-${quantiteAchetee}), ` +
            `${nouveauStock === 0 ? 'ARCHIVÉ' : 'Actif'}`
          )
        } else {
          console.log(`⚠️ Produit ${item.product_id} non trouvé`)
        }
      }
    } catch (error: any) {
      console.error('❌ Erreur mise à jour stock:', error.message)
    }
  }

  // ==================== CRÉDITER ADMIN (0.5%) ====================
  private async creditAdmin(totalAmount: number): Promise<void> {
    try {
      const admins = await User.query()
        .where('role', 'admin')
        .orWhere('role', 'superadmin')

      if (admins.length === 0) {
        console.log('⚠️ Aucun admin trouvé')
        return
      }

      const adminFee = totalAmount * 0.005

      for (const admin of admins) {
        const wallet = await Wallet.findBy('user_id', admin.id)

        if (wallet) {
          const currentBalance = parseFloat(String(wallet.balance)) || 0
          wallet.balance = currentBalance + adminFee
          await wallet.save()
          console.log(`✅ Admin ${admin.email}: ${currentBalance} + ${adminFee} = ${wallet.balance} FCFA`)
        } else {
          await Wallet.create({
            user_id: admin.id,
            balance: adminFee,
            currency: 'XAF',
            status: 'active'
          })
          console.log(`✅ Admin ${admin.email}: nouveau wallet ${adminFee} FCFA`)
        }
      }
    } catch (error: any) {
      console.error('❌ Erreur crédit admin:', error.message)
    }
  }

  // ==================== CRÉDITER LES VENDEURS (MARCHANTS) ====================
  private async creditSellers(orderId: string): Promise<void> {
    try {
      console.log('💰 Crédit des vendeurs pour la commande:', orderId)

      const items = await OrderItem.query().where('order_id', orderId)
      const sellerSales = new Map<string, number>()

      for (const item of items) {
        const product = await Product.findBy('id', item.product_id)
        if (product && product.user_id) {
          const current = sellerSales.get(product.user_id) || 0
          sellerSales.set(product.user_id, current + Number(item.subtotal || 0))
        }
      }

      if (sellerSales.size === 0) {
        console.log('⚠️ Aucun vendeur à créditer')
        return
      }

      for (const [sellerId, amount] of sellerSales.entries()) {
        const seller = await User.findBy('id', sellerId)
        const sellerName = seller?.full_name || seller?.email || sellerId

        const wallet = await Wallet.findBy('user_id', sellerId)

        if (wallet) {
          const currentBalance = parseFloat(String(wallet.balance)) || 0
          wallet.balance = currentBalance + amount
          await wallet.save()
          console.log(`✅ Marchant ${sellerName}: ${currentBalance} + ${amount} = ${wallet.balance} FCFA`)
        } else {
          await Wallet.create({
            user_id: sellerId,
            balance: amount,
            currency: 'XAF',
            status: 'active'
          })
          console.log(`✅ Marchant ${sellerName}: nouveau wallet ${amount} FCFA`)
        }
      }

      console.log(`✅ ${sellerSales.size} vendeur(s) crédité(s)`)
    } catch (error: any) {
      console.error('❌ Erreur crédit vendeurs:', error.message)
    }
  }
}