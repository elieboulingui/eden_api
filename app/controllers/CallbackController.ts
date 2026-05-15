// app/controllers/CallbackController.ts - EMAIL CLIENT + DISTRIBUTION COMPLÈTE
import type { HttpContext } from '@adonisjs/core/http'
import Order from '#models/Order'
import OrderItem from '#models/OrderItem'
import OrderTracking from '#models/order_tracking'
import User from '#models/user'
import Product from '#models/Product'
import Wallet from '#models/wallet'
import { DateTime } from 'luxon'
import OrderEmailService from '../services/OrderEmailService.js'
import crypto from 'node:crypto'

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

      if (order) {

        console.log(`📦 Commande: ${order.order_number}`)

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

          // ============================================================
          // 🆕 DISTRIBUTION COMPLÈTE DE L'ARGENT
          // ============================================================
          await this.distributeMoney(order)

          // ✅ Email au CLIENT UNIQUEMENT
          try {
            await OrderEmailService.sendOrderConfirmation(order.id)
            console.log('📧 Email de confirmation envoyé au client')
          } catch (emailError: any) {
            console.error('❌ Erreur email client:', emailError.message)
          }

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

        } else {
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
      return response.ok({ responseCode: 200 })
    }
  }

  // ============================================================
  // 🆕 DISTRIBUTION COMPLÈTE DE L'ARGENT
  // ============================================================
  private async distributeMoney(order: Order) {
    console.log(`\n💼 ===== DISTRIBUTION FINANCIÈRE =====`)
    console.log(`📊 Commande: ${order.order_number}`)
    console.log(`💰 Total: ${order.total} XAF`)
    console.log(`📦 Sous-total: ${order.subtotal} XAF`)
    console.log(`🚚 Livraison: ${order.shipping_cost} XAF`)

    // 1. Récupérer les OrderItems
    const items = await OrderItem.query().where('order_id', order.id)
    
    // 2. Regrouper par marchand
    const merchantProducts = new Map<string, { productId: string; productName: string; price: number; quantity: number; subtotal: number }[]>()
    
    for (const item of items) {
      const product = await Product.find(item.product_id)
      if (!product?.user_id) continue

      if (!merchantProducts.has(product.user_id)) {
        merchantProducts.set(product.user_id, [])
      }

      merchantProducts.get(product.user_id)!.push({
        productId: product.id,
        productName: product.name,
        price: Number(item.price),
        quantity: item.quantity,
        subtotal: Number(item.subtotal)
      })

      // 🆕 Mise à jour du stock
      product.stock = Math.max(0, product.stock - item.quantity)
      if (product.stock === 0) product.isArchived = true
      await product.save()
    }

    const merchantIds = Array.from(merchantProducts.keys())
    console.log(`🏪 Marchands concernés: ${merchantIds.length}`)

    const ADMIN_COMMISSION_RATE = 0.03 // 3%

    // 3. Commission admin (3% du total)
    const adminCommission = order.total * ADMIN_COMMISSION_RATE
    console.log(`🏛️ Commission admin (3%): ${adminCommission} XAF`)
    await this.creditAdminWallet(adminCommission, `Commission 3% - Commande #${order.order_number}`)

    // 4. Distribuer le prix des produits aux marchands (après commission)
    const totalAfterCommission = order.total - adminCommission
    const commissionRatio = totalAfterCommission / order.total

    console.log(`\n📦 DISTRIBUTION AUX MARCHANDS:`)

    for (const merchantId of merchantIds) {
      const merchant = await User.findBy('id', merchantId)
      if (!merchant) continue

      const products = merchantProducts.get(merchantId) || []
      let merchantTotal = 0

      for (const product of products) {
        merchantTotal += product.subtotal
      }

      const merchantAmount = merchantTotal * commissionRatio

      console.log(`  👤 ${merchant.full_name}:`)
      console.log(`     - Produits: ${products.map(p => p.productName).join(', ')}`)
      console.log(`     - Montant produits: ${merchantTotal} XAF`)
      console.log(`     - Après commission: ${merchantAmount.toFixed(0)} XAF`)

      await this.creditWallet(merchant.id, merchantAmount, `Vente produits - Commande #${order.order_number}`)
    }

    // 5. Distribuer les frais de livraison
    if (order.shipping_cost > 0) {
      console.log(`\n🚚 FRAIS DE LIVRAISON: ${order.shipping_cost} XAF`)

      let needEdenLivreur = false

      for (const merchantId of merchantIds) {
        const merchant = await User.findBy('id', merchantId)

        if (merchant) {
          console.log(`  👤 ${merchant.full_name} | has_livreur: ${merchant.has_livreur}`)

          if (merchant.has_livreur) {
            // ✅ Le marchand a son propre livreur → lui envoyer les frais
            const deliveryShare = order.shipping_cost / merchantIds.length
            console.log(`  ✅ Livreur personnel → +${deliveryShare} XAF`)
            await this.creditWallet(merchant.id, deliveryShare, `Frais livraison (livreur personnel) - Commande #${order.order_number}`)
          } else {
            // ❌ Pas de livreur → il faut un livreur Eden
            needEdenLivreur = true
          }
        }
      }

      // Si au moins un marchand n'a pas de livreur → chercher/créer un edenlivreur
      if (needEdenLivreur) {
        console.log(`  🔍 Recherche d'un edenlivreur...`)

        let edenLivreur = await User.query()
          .where('role', 'edenlivreur')
          .where('is_verified', true)
          .first()

        // Si aucun edenlivreur trouvé → en créer un
        if (!edenLivreur) {
          console.log(`  ⚠️ Aucun edenlivreur trouvé → Création automatique...`)
          edenLivreur = await this.createEdenLivreur()
        } else {
          console.log(`  🛵 EdenLivreur trouvé: ${edenLivreur.full_name} (${edenLivreur.id})`)
        }

        // Envoyer les frais de livraison au edenlivreur
        await this.creditWallet(edenLivreur.id, order.shipping_cost, `Frais livraison - Commande #${order.order_number}`)

        // Mettre à jour la commande avec l'ID du livreur
        order.livreur_id = edenLivreur.id
        await order.save()

        await OrderTracking.create({
          order_id: order.id,
          status: 'paid',
          description: `🛵 Livreur Eden assigné: ${edenLivreur.full_name}`,
          tracked_at: DateTime.now(),
        })
      }
    }

    console.log(`\n✅ Distribution terminée`)
  }

  // 🆕 Créer un livreur Eden automatiquement
  private async createEdenLivreur(): Promise<User> {
    console.log('🆕 Création d\'un nouveau livreur Eden...')

    const livreurId = crypto.randomUUID()
    const email = `edenlivreur_${Date.now()}@edenmarket.com`
    const password = crypto.randomUUID()

    const livreur = await User.create({
      id: livreurId,
      full_name: `Livreur Eden ${Date.now().toString().slice(-6)}`,
      email: email,
      password: password,
      role: 'edenlivreur',
      is_verified: true,
      is_available: true,
      is_online: true,
      verification_status: 'approved',
      total_deliveries: 0,
      total_earnings: 0,
      rating: 0,
      total_ratings: 0,
      is_phone_verified: false,
      is_email_verified: false,
      certify_truth: true,
      accept_escrow: true,
    })

    console.log(`✅ Livreur Eden créé: ${livreur.full_name} (${livreur.id})`)

    // Créer son wallet
    await Wallet.create({
      user_id: livreur.id,
      balance: 0,
      currency: 'XAF',
      status: 'active',
    })

    console.log(`💼 Wallet créé pour ${livreur.full_name}`)

    return livreur
  }

  // 🆕 Crédite le wallet admin
  private async creditAdminWallet(amount: number, description: string): Promise<void> {
    try {
      const adminUser = await User.query()
        .where('role', 'superadmin')
        .orWhere('role', 'admin')
        .first()

      if (!adminUser) {
        console.log('⚠️ Aucun admin trouvé')
        return
      }

      let wallet = await Wallet.findBy('user_id', adminUser.id)

      if (!wallet) {
        wallet = await Wallet.create({
          user_id: adminUser.id,
          balance: 0,
          currency: 'XAF',
          status: 'active',
        })
        console.log(`💼 Wallet admin créé`)
      }

      const oldBalance = wallet.balance
      wallet.balance += amount
      await wallet.save()

      console.log(`💰 Wallet Admin: ${oldBalance} → ${wallet.balance} XAF (${description})`)
    } catch (error: any) {
      console.error(`🔴 Erreur crédit wallet admin:`, error.message)
    }
  }

  // 🆕 Crédite le wallet d'un utilisateur
  private async creditWallet(userId: string, amount: number, description: string): Promise<void> {
    try {
      let wallet = await Wallet.findBy('user_id', userId)

      if (!wallet) {
        wallet = await Wallet.create({
          user_id: userId,
          balance: 0,
          currency: 'XAF',
          status: 'active',
        })
        console.log(`  💼 Nouveau wallet créé pour ${userId}`)
      }

      const oldBalance = wallet.balance
      wallet.balance += amount
      await wallet.save()

      console.log(`  💰 Wallet ${userId}: ${oldBalance} → ${wallet.balance} XAF (${description})`)
    } catch (error: any) {
      console.error(`  🔴 Erreur crédit wallet ${userId}:`, error.message)
      throw error
    }
  }
}
