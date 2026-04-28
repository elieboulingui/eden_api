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
      console.log('📦', JSON.stringify(data))

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
          // ✅ PHASE 1 : Mise à jour du statut de la commande
          order.status = 'paid'
          order.payment_completed_at = DateTime.now()
          order.payment_status = 'SUCCESS'
          order.payment_transaction_id = txId
          order.payment_operator_simple = data.operator || null
          await order.save()

          // ✅ PHASE 2 : Créer l'événement de suivi
          await OrderTracking.create({
            order_id: order.id,
            status: 'paid',
            description: `✅ Payé - ${data.operator || 'Mobile Money'} - ${txId}`,
            tracked_at: DateTime.now(),
          })

          // ✅ PHASE 3 : Décrémenter le stock + archiver si stock = 0
          await this.updateProductStock(order.id)

          // ✅ PHASE 4 : Créditer l'admin (0.5%)
          await this.creditAdmin(order.total)

          // ✅ PHASE 5 : Créditer les vendeurs/marchants
          await this.creditSellers(order.id)

          // ✅ PHASE 6 (NOUVEAU) : Mettre à jour la GuestOrder si c'est une commande invité
          await this.updateGuestOrder(order)

          console.log('✅ [Callback] TOUT EST FAIT : Payé + Stock MAJ + Crédits!')

        } else if (data.status === 'FAILED' || data.status === 'CANCELLED') {
          // ❌ Paiement échoué
          order.status = 'payment_failed'
          order.payment_error_message = `Code: ${data.code || 'UNKNOWN'} - ${data.message || 'Échec du paiement'}`
          order.payment_status = 'FAILED'
          await order.save()

          await OrderTracking.create({
            order_id: order.id,
            status: 'payment_failed',
            description: `❌ Échec (${data.code || 'N/A'}) - ${data.operator || 'N/A'} - ${txId}`,
            tracked_at: DateTime.now(),
          })

          // ✅ (NOUVEAU) Mettre à jour la GuestOrder
          await this.updateGuestOrder(order)

          console.log('❌ [Callback] ÉCHEC du paiement')

        } else if (data.status === 'PENDING') {
          // ⏳ Paiement en attente
          await OrderTracking.create({
            order_id: order.id,
            status: 'pending_payment',
            description: `⏳ En attente - ${data.operator || 'N/A'} - ${txId}`,
            tracked_at: DateTime.now(),
          })

          console.log('⏳ [Callback] Paiement en attente')
        }

      } else {
        console.log('⚠️ [Callback] Commande non trouvée pour refId:', refId, 'txId:', txId)

        // ✅ (NOUVEAU) Sauvegarder le callback orphelin pour debug
        await this.saveOrphanCallback(data)
      }

      return response.status(200).json({
        responseCode: data.code || 200,
        transactionId: txId || 'unknown',
        message: 'Callback traité avec succès'
      })

    } catch (error: any) {
      console.error('❌ [Callback] Erreur:', error.message)
      console.error('❌ Stack:', error.stack)

      return response.status(500).json({
        responseCode: 500,
        transactionId: request.body().transactionId || 'unknown',
        message: 'Erreur interne lors du traitement du callback'
      })
    }
  }

  // ==================== MISE À JOUR DU STOCK + ARCHIVAGE ====================
  private async updateProductStock(orderId: string): Promise<void> {
    try {
      console.log('📦 [Stock] Mise à jour pour la commande:', orderId)

      const items = await OrderItem.query().where('order_id', orderId)

      if (items.length === 0) {
        console.log('⚠️ [Stock] Aucun item trouvé pour cette commande')
        return
      }

      let totalUpdated = 0
      let totalArchived = 0

      for (const item of items) {
        const product = await Product.findBy('id', item.product_id)

        if (product) {
          const stockAvant = product.stock
          const quantiteAchetee = item.quantity
          const nouveauStock = Math.max(0, stockAvant - quantiteAchetee)

          // Mise à jour du stock
          product.stock = nouveauStock

          // ✅ Si stock = 0, on archive le produit
          if (nouveauStock === 0) {
            product.isArchived = true
            totalArchived++
            console.log(`📦 [Stock] ARCHIVAGE: "${product.name}" - Stock épuisé (${stockAvant} → 0)`)
          }

          await product.save()
          totalUpdated++

          console.log(
            `📦 [Stock] ${product.name}: ${stockAvant} → ${nouveauStock} (-${quantiteAchetee}) ` +
            `[${nouveauStock === 0 ? 'ARCHIVÉ' : 'Actif'}]`
          )
        } else {
          console.log(`⚠️ [Stock] Produit ${item.product_id} non trouvé en BDD`)
        }
      }

      console.log(`✅ [Stock] ${totalUpdated} produit(s) mis à jour, ${totalArchived} archivé(s)`)

    } catch (error: any) {
      console.error('❌ [Stock] Erreur:', error.message)
    }
  }

  // ==================== CRÉDITER ADMIN (0.5%) ====================
  private async creditAdmin(totalAmount: number): Promise<void> {
    try {
      const admins = await User.query()
        .where('role', 'admin')
        .orWhere('role', 'superadmin')

      if (admins.length === 0) {
        console.log('⚠️ [Crédit Admin] Aucun admin trouvé')
        return
      }

      const adminFee = totalAmount * 0.005

      for (const admin of admins) {
        const wallet = await Wallet.findBy('user_id', admin.id)

        if (wallet) {
          const currentBalance = parseFloat(String(wallet.balance)) || 0
          wallet.balance = currentBalance + adminFee
          await wallet.save()
          console.log(`✅ [Crédit Admin] ${admin.email}: ${currentBalance} + ${adminFee} = ${wallet.balance} FCFA`)
        } else {
          await Wallet.create({
            user_id: admin.id,
            balance: adminFee,
            currency: 'XAF',
            status: 'active'
          })
          console.log(`✅ [Crédit Admin] ${admin.email}: nouveau wallet ${adminFee} FCFA`)
        }
      }
    } catch (error: any) {
      console.error('❌ [Crédit Admin] Erreur:', error.message)
    }
  }

  // ==================== CRÉDITER LES VENDEURS (MARCHANTS) ====================
  private async creditSellers(orderId: string): Promise<void> {
    try {
      console.log('💰 [Crédit Vendeurs] Commande:', orderId)

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
        console.log('⚠️ [Crédit Vendeurs] Aucun vendeur à créditer')
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
          console.log(`✅ [Crédit Vendeurs] ${sellerName}: ${currentBalance} + ${amount} = ${wallet.balance} FCFA`)
        } else {
          await Wallet.create({
            user_id: sellerId,
            balance: amount,
            currency: 'XAF',
            status: 'active'
          })
          console.log(`✅ [Crédit Vendeurs] ${sellerName}: nouveau wallet ${amount} FCFA`)
        }
      }

      console.log(`✅ [Crédit Vendeurs] ${sellerSales.size} vendeur(s) crédité(s)`)

    } catch (error: any) {
      console.error('❌ [Crédit Vendeurs] Erreur:', error.message)
    }
  }

  // ==================== (NOUVEAU) METTRE À JOUR LA COMMANDE INVITÉ ====================
  private async updateGuestOrder(order: Order): Promise<void> {
    try {
      if (order.guestOrderId) {
        const GuestOrder = (await import('#models/GuestOrder')).default
        const guestOrder = await GuestOrder.find(order.guestOrderId)

        if (guestOrder) {
          guestOrder.status = order.status === 'paid' ? 'paid' : 'payment_failed'
          guestOrder.orderId = order.id
          await guestOrder.save()
          console.log(`✅ [GuestOrder] ${guestOrder.id} → ${guestOrder.status}`)
        }
      }
    } catch (error: any) {
      console.error('❌ [GuestOrder] Erreur:', error.message)
    }
  }

  // ==================== (NOUVEAU) SAUVEGARDER LES CALLBACKS ORPHELINS ====================
  private async saveOrphanCallback(data: any): Promise<void> {
    try {
      console.log('💾 [Callback Orphelin] Sauvegarde pour debug:', JSON.stringify(data))

      // Créer un fichier de log ou une entrée en base de données
      // selon vos besoins. Pour l'instant, on log juste dans la console.

      // Si vous voulez sauvegarder en base, créez un modèle CallbackLog :
      // await CallbackLog.create({
      //   transaction_id: data.transactionId,
      //   reference_id: data.merchantReferenceId,
      //   status: data.status,
      //   raw_data: JSON.stringify(data),
      //   processed: false
      // })

    } catch (error: any) {
      console.error('❌ [Callback Orphelin] Erreur sauvegarde:', error.message)
    }
  }

  // ==================== (NOUVEAU) VÉRIFIER L'INTÉGRITÉ DE LA COMMANDE ====================


  // ==================== (NOUVEAU) MÉTHODE DE RETRY MANUEL ====================
  public async retryFailedCallback({ params, response }: HttpContext) {
    try {
      const { orderId } = params
      const order = await Order.find(orderId)

      if (!order) {
        return response.status(404).json({
          success: false,
          message: 'Commande non trouvée'
        })
      }

      console.log('🔄 [Retry] Retraitement commande:', order.order_number)

      if (order.payment_status === 'SUCCESS' && order.status !== 'paid') {
        // Mettre à jour le statut
        order.status = 'paid'
        order.payment_completed_at = DateTime.now()
        await order.save()

        // Mettre à jour le stock
        await this.updateProductStock(order.id)

        // Créditer
        await this.creditAdmin(order.total)
        await this.creditSellers(order.id)

        return response.status(200).json({
          success: true,
          message: 'Commande retraitée avec succès'
        })
      }

      return response.status(400).json({
        success: false,
        message: 'La commande ne nécessite pas de retraitement'
      })

    } catch (error: any) {
      console.error('❌ [Retry] Erreur:', error.message)
      return response.status(500).json({
        success: false,
        message: 'Erreur lors du retraitement'
      })
    }
  }
}
