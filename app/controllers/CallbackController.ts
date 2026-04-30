// app/controllers/CallbackController.ts - VERSION CORRIGÉE
import type { HttpContext } from '@adonisjs/core/http'
import Order from '#models/Order'
import OrderItem from '#models/OrderItem'
import OrderTracking from '#models/order_tracking'
import User from '#models/user'
import Product from '#models/Product'
import Wallet from '#models/wallet'
import { DateTime } from 'luxon'

const CALLBACK_URL_CODE = '9ZOXW'

export default class CallbackController {

  async handle({ request, response }: HttpContext) {
    console.log('📞 ========== CALLBACK MYPVIT REÇU ==========')
    
    try {
      const data = request.body()
      console.log('📦 Données brutes:', JSON.stringify(data, null, 2))

      // ✅ Récupérer toutes les variations possibles de champs
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

      const status = data.status || data.transactionStatus || 'UNKNOWN'
      const operator = data.operator || data.operator_name || ''
      const code = data.code || data.status_code || ''
      const message = data.message || data.error_message || ''
      const amount = data.amount || data.total_amount || 0

      console.log('🔍 Paramètres extraits:')
      console.log('   refId:', refId)
      console.log('   txId:', txId)
      console.log('   status:', status)
      console.log('   operator:', operator)
      console.log('   amount:', amount)

      // ==================== RECHERCHE DE LA COMMANDE ====================
      let order: Order | null = null

      // Méthode 1 : payment_reference_id = refId
      if (refId) {
        order = await Order.query()
          .where('payment_reference_id', refId)
          .first()
        if (order) console.log('✅ Trouvée via payment_reference_id = refId')
      }

      // Méthode 2 : payment_reference_id = txId
      if (!order && txId) {
        order = await Order.query()
          .where('payment_reference_id', txId)
          .first()
        if (order) console.log('✅ Trouvée via payment_reference_id = txId')
      }

      // Méthode 3 : Recherche dans OrderTracking
      if (!order) {
        const searchTerm = refId || txId
        if (searchTerm) {
          const tracking = await OrderTracking.query()
            .where('description', 'like', `%${searchTerm}%`)
            .first()
          
          if (tracking) {
            order = await Order.find(tracking.order_id)
            if (order) console.log('✅ Trouvée via OrderTracking.description')
          }
        }
      }

      // Méthode 4 : Recherche dans les commandes récentes en pending_payment
      if (!order) {
        const recentOrders = await Order.query()
          .where('status', 'pending_payment')
          .orderBy('created_at', 'desc')
          .limit(50)

        for (const o of recentOrders) {
          // Vérifier si le numéro de téléphone correspond
          const phone = o.customer_phone?.replace(/\D/g, '')
          const dataPhone = data.customer_account_number?.replace(/\D/g, '')
          
          if (phone && dataPhone && phone.includes(dataPhone.slice(-8))) {
            order = o
            console.log('✅ Trouvée via correspondance téléphone')
            break
          }
          
          // Vérifier si le montant correspond
          if (Math.abs(Number(o.total) - Number(amount)) < 100) {
            order = o
            console.log('✅ Trouvée via correspondance montant')
            break
          }
        }
      }

      // ==================== TRAITEMENT DE LA COMMANDE ====================
      if (order) {
        console.log(`📦 Commande: ${order.order_number} (ID: ${order.id})`)
        console.log(`   Statut avant: ${order.status}`)
        console.log(`   Payment ref avant: ${order.payment_reference_id || 'aucune'}`)

        // ✅ Mettre à jour la référence de paiement si elle n'existe pas
        if (!order.payment_reference_id && refId) {
          order.payment_reference_id = refId
          console.log('📝 payment_reference_id mis à jour:', refId)
        }

        // ✅ Mettre à jour le statut selon le callback
        if (status === 'SUCCESS') {
          // ========== PAIEMENT RÉUSSI ==========
          order.status = 'paid'
          order.payment_status = 'SUCCESS'
          order.payment_completed_at = DateTime.now()
          order.payment_transaction_id = txId || refId
          order.payment_operator_simple = operator || order.payment_operator_simple
          order.payment_amount = amount || order.payment_amount
          await order.save()

          console.log('💰 Statut mis à jour: paid')

          // Tracking
          await OrderTracking.create({
            order_id: order.id,
            status: 'paid',
            description: `✅ Paiement confirmé - ${operator || 'Mobile Money'} - ${txId || refId} - ${amount} FCFA`,
            tracked_at: DateTime.now(),
          })

          // Mettre à jour le stock
          await this.updateProductStock(order.id)

          // Créditer admin et vendeurs
          await this.creditAdmin(order.total)
          await this.creditSellers(order.id)

          // Mettre à jour GuestOrder si nécessaire
          await this.updateGuestOrder(order)

          console.log('✅ [Callback] Traitement SUCCESS terminé')

        } else if (status === 'FAILED' || status === 'CANCELLED') {
          // ========== PAIEMENT ÉCHOUÉ ==========
          order.status = 'payment_failed'
          order.payment_status = 'FAILED'
          order.payment_error_message = `Code: ${code} - ${message || 'Échec du paiement'}`
          await order.save()

          console.log('❌ Statut mis à jour: payment_failed')

          // Tracking
          await OrderTracking.create({
            order_id: order.id,
            status: 'payment_failed',
            description: `❌ Échec (${code}) - ${operator || 'N/A'} - ${txId || refId} - ${message || ''}`,
            tracked_at: DateTime.now(),
          })

          // Restaurer le stock
          await this.restoreProductStock(order.id)

          // Mettre à jour GuestOrder
          await this.updateGuestOrder(order)

          console.log('❌ [Callback] Traitement FAILED terminé')

        } else if (status === 'PENDING') {
          // ========== PAIEMENT EN ATTENTE ==========
          // Ne pas changer le statut, juste ajouter un tracking
          await OrderTracking.create({
            order_id: order.id,
            status: 'pending_payment',
            description: `⏳ En attente - ${operator || 'N/A'} - ${txId || refId}`,
            tracked_at: DateTime.now(),
          })

          console.log('⏳ [Callback] Paiement toujours en attente')
        }

      } else {
        // ========== COMMANDE NON TROUVÉE ==========
        console.log('⚠️ [Callback] AUCUNE commande trouvée !')
        console.log('   refId:', refId)
        console.log('   txId:', txId)
        console.log('   status:', status)

        // Afficher les 10 dernières commandes pour debug
        const recentOrders = await Order.query()
          .orderBy('created_at', 'desc')
          .limit(10)

        console.log('📋 10 dernières commandes:')
        for (const o of recentOrders) {
          console.log(`   ${o.order_number} | ref: ${o.payment_reference_id || 'N/A'} | status: ${o.status} | total: ${o.total} | phone: ${o.customer_phone}`)
        }

        await this.saveOrphanCallback(data)
      }

      // ✅ Toujours renvoyer 200 à Mypvit pour éviter les retries
      return response.status(200).json({
        responseCode: 200,
        transactionId: txId || refId || 'unknown',
        message: 'Callback traité'
      })

    } catch (error: any) {
      console.error('❌ [Callback] Erreur:', error.message)
      console.error('❌ Stack:', error.stack)

      // Même en cas d'erreur, renvoyer 200
      return response.status(200).json({
        responseCode: 200,
        transactionId: 'error',
        message: 'Callback traité avec erreur'
      })
    }
  }

  // ==================== MISE À JOUR DU STOCK ====================
  private async updateProductStock(orderId: string): Promise<void> {
    try {
      const items = await OrderItem.query().where('order_id', orderId)

      if (items.length === 0) {
        console.log('⚠️ [Stock] Aucun item pour la commande:', orderId)
        return
      }

      let updated = 0
      let archived = 0

      for (const item of items) {
        const product = await Product.findBy('id', item.product_id)
        if (product) {
          const oldStock = product.stock
          product.stock = Math.max(0, oldStock - item.quantity)
          
          if (product.stock === 0) {
            product.isArchived = true
            archived++
          }
          
          await product.save()
          updated++
          console.log(`📦 ${product.name}: ${oldStock} → ${product.stock} ${product.isArchived ? '(ARCHIVÉ)' : ''}`)
        }
      }

      console.log(`✅ [Stock] ${updated} produit(s) mis à jour, ${archived} archivé(s)`)
    } catch (error: any) {
      console.error('❌ [Stock] Erreur:', error.message)
    }
  }

  // ==================== RESTAURER LE STOCK (si échec) ====================
  private async restoreProductStock(orderId: string): Promise<void> {
    try {
      const items = await OrderItem.query().where('order_id', orderId)

      for (const item of items) {
        const product = await Product.findBy('id', item.product_id)
        if (product) {
          product.stock += item.quantity
          if (product.isArchived && product.stock > 0) {
            product.isArchived = false
          }
          await product.save()
          console.log(`🔄 Stock restauré: ${product.name} → ${product.stock}`)
        }
      }
    } catch (error: any) {
      console.error('❌ [Restore Stock] Erreur:', error.message)
    }
  }

  // ==================== CRÉDITER ADMIN ====================
  private async creditAdmin(totalAmount: number): Promise<void> {
    try {
      const admins = await User.query()
        .where('role', 'admin')
        .orWhere('role', 'superadmin')

      if (admins.length === 0) return

      const adminFee = Number(totalAmount) * 0.005

      for (const admin of admins) {
        let wallet = await Wallet.findBy('user_id', admin.id)
        if (wallet) {
          wallet.balance = Number(wallet.balance) + adminFee
          await wallet.save()
          console.log(`💰 Admin: ${admin.email} +${adminFee} FCFA`)
        } else {
          await Wallet.create({
            user_id: admin.id,
            balance: adminFee,
            currency: 'XAF',
            status: 'active'
          })
          console.log(`💰 Admin (nouveau): ${admin.email} +${adminFee} FCFA`)
        }
      }
    } catch (error: any) {
      console.error('❌ [Crédit Admin] Erreur:', error.message)
    }
  }

  // ==================== CRÉDITER LES VENDEURS ====================
  private async creditSellers(orderId: string): Promise<void> {
    try {
      const items = await OrderItem.query().where('order_id', orderId)
      const sellerSales = new Map<string, number>()

      for (const item of items) {
        const product = await Product.findBy('id', item.product_id)
        if (product?.user_id) {
          const current = sellerSales.get(product.user_id) || 0
          sellerSales.set(product.user_id, current + Number(item.subtotal || 0))
        }
      }

      for (const [sellerId, amount] of sellerSales.entries()) {
        const seller = await User.findBy('id', sellerId)
        const sellerName = seller?.full_name || seller?.email || sellerId

        let wallet = await Wallet.findBy('user_id', sellerId)
        if (wallet) {
          wallet.balance = Number(wallet.balance) + amount
          await wallet.save()
          console.log(`💰 Vendeur: ${sellerName} +${amount} FCFA`)
        } else {
          await Wallet.create({
            user_id: sellerId,
            balance: amount,
            currency: 'XAF',
            status: 'active'
          })
          console.log(`💰 Vendeur (nouveau): ${sellerName} +${amount} FCFA`)
        }
      }

      console.log(`✅ [Crédit Vendeurs] ${sellerSales.size} vendeur(s) crédité(s)`)
    } catch (error: any) {
      console.error('❌ [Crédit Vendeurs] Erreur:', error.message)
    }
  }

  // ==================== METTRE À JOUR GUEST ORDER ====================
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

  // ==================== SAUVEGARDER CALLBACK ORPHELIN ====================
  private async saveOrphanCallback(data: any): Promise<void> {
    try {
      console.log('💾 [Callback Orphelin] Données:')
      console.log(JSON.stringify(data, null, 2))
    } catch (error: any) {
      console.error('❌ [Orphelin] Erreur:', error.message)
    }
  }

  // ==================== RETRY MANUEL ====================
  public async retryFailedCallback({ params, response }: HttpContext) {
    try {
      const { orderId } = params
      const order = await Order.find(orderId)

      if (!order) {
        return response.status(404).json({ success: false, message: 'Commande non trouvée' })
      }

      if (order.payment_status === 'SUCCESS' && order.status !== 'paid') {
        order.status = 'paid'
        order.payment_completed_at = DateTime.now()
        await order.save()

        await this.updateProductStock(order.id)
        await this.creditAdmin(order.total)
        await this.creditSellers(order.id)

        return response.status(200).json({ success: true, message: 'Commande retraitée' })
      }

      return response.status(400).json({ success: false, message: 'Pas de retraitement nécessaire' })
    } catch (error: any) {
      return response.status(500).json({ success: false, message: error.message })
    }
  }
}
