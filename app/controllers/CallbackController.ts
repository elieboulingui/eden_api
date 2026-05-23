// app/controllers/CallbackController.ts - VERSION FULL DEBUG LOGS
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
    console.log('\n🧠 ===== MAP PAYMENT STATUS =====')
    console.log('📥 Status brut reçu:', status)

    switch (status?.toUpperCase()) {
      case 'SUCCESS':
        console.log('✅ Status mappé → paid')
        return 'paid'

      case 'FAILED':
      case 'CANCELLED':
        console.log('❌ Status mappé → failed')
        return 'failed'

      case 'PENDING':
        console.log('⏳ Status mappé → pending')
        return 'pending'

      default:
        console.log('⚠️ Status inconnu → pending')
        return 'pending'
    }
  }

  async handle({ request, response }: HttpContext) {

    console.log('\n')
    console.log('🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀')
    console.log('📞 CALLBACK MYPVIT REÇU')
    console.log('🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀')

    try {

      const data = request.body()

      console.log('\n📥 BODY COMPLET REÇU:')
      console.log(JSON.stringify(data, null, 2))

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

      console.log('\n📊 ===== DONNÉES EXTRAITES =====')
      console.log('🧾 refId:', refId)
      console.log('💳 txId:', txId)
      console.log('📌 rawStatus:', rawStatus)
      console.log('📌 mappedStatus:', status)
      console.log('📱 operator:', operator)
      console.log('🔢 code:', code)
      console.log('💬 message:', message)
      console.log('💰 amount:', amount)

      let order: Order | null = null

      console.log('\n🔍 ===== RECHERCHE COMMANDE =====')

      if (refId) {
        console.log(`🔎 Recherche avec payment_reference_id = ${refId}`)

        order = await Order.query()
          .where('payment_reference_id', refId)
          .first()

        console.log('📦 Résultat recherche refId:', order ? order.id : 'Aucune commande')
      }

      if (!order && txId) {
        console.log(`🔎 Recherche avec txId = ${txId}`)

        order = await Order.query()
          .where('payment_reference_id', txId)
          .first()

        console.log('📦 Résultat recherche txId:', order ? order.id : 'Aucune commande')
      }

      if (!order) {

        console.log('🔍 Recherche dans OrderTracking...')

        const searchTerm = refId || txId

        if (searchTerm) {

          const tracking = await OrderTracking.query()
            .where('description', 'like', `%${searchTerm}%`)
            .first()

          console.log('📍 Tracking trouvé:', tracking ? tracking.id : 'Aucun')

          if (tracking) {

            order = await Order.find(tracking.order_id)

            console.log('📦 Commande retrouvée via tracking:', order?.id)
          }
        }
      }

      if (order) {

        console.log('\n✅ ===== COMMANDE TROUVÉE =====')
        console.log('🆔 ID:', order.id)
        console.log('🧾 Numéro:', order.order_number)
        console.log('📌 Status actuel:', order.status)
        console.log('💳 Payment status actuel:', order.payment_status)
        console.log('💰 Total:', order.total)

        if (order.payment_status === 'paid') {

          console.log('\n⚠️ ===== COMMANDE DÉJÀ PAYÉE =====')
          console.log('⛔ Skip du traitement')
          console.log('📦 Order:', order.order_number)

          return response.ok({
            message: 'Déjà traité'
          })
        }

        console.log('\n✏️ ===== MISE À JOUR COMMANDE =====')

        order.payment_status = status
        order.payment_transaction_id = txId || refId
        order.payment_operator_simple = operator
        order.payment_amount = amount

        console.log('📌 Nouveau payment_status:', status)
        console.log('💳 payment_transaction_id:', txId || refId)
        console.log('📱 payment_operator_simple:', operator)
        console.log('💰 payment_amount:', amount)

        if (status === 'paid') {

          console.log('\n💰 ===== PAIEMENT CONFIRMÉ =====')

          order.status = 'paid'
          order.payment_completed_at = DateTime.now()

          await order.save()

          console.log('✅ Commande sauvegardée')
          console.log('📌 Nouveau status:', order.status)
          console.log('🕒 payment_completed_at:', order.payment_completed_at)

          console.log('\n📝 Création tracking PAID...')

          await OrderTracking.create({
            order_id: order.id,
            status: 'paid',
            description: `✅ Paiement confirmé ${amount} FCFA`,
            tracked_at: DateTime.now(),
          })

          console.log('✅ Tracking créé')

          console.log('\n💼 ===== LANCEMENT DISTRIBUTION =====')

          await this.distributeMoney(order)

          console.log('✅ Distribution terminée')

          console.log('\n📧 ===== ENVOI EMAIL CLIENT =====')

          try {

            await OrderEmailService.sendOrderConfirmation(order.id)

            console.log('✅ Email envoyé avec succès')

          } catch (emailError: any) {

            console.error('❌ ERREUR EMAIL:')
            console.error(emailError)
          }

        } else if (status === 'failed') {

          console.log('\n❌ ===== PAIEMENT ÉCHOUÉ =====')

          order.status = 'payment_failed'
          order.payment_error_message = `${code} - ${message}`

          await order.save()

          console.log('✅ Commande mise à jour en payment_failed')

          await OrderTracking.create({
            order_id: order.id,
            status: 'payment_failed',
            description: `❌ Paiement échoué`,
            tracked_at: DateTime.now(),
          })

          console.log('✅ Tracking payment_failed créé')

        } else {

          console.log('\n⏳ ===== PAIEMENT EN ATTENTE =====')

          await OrderTracking.create({
            order_id: order.id,
            status: 'pending_payment',
            description: `⏳ En attente`,
            tracked_at: DateTime.now(),
          })

          console.log('✅ Tracking pending créé')
        }

      } else {

        console.log('\n❌ ===== COMMANDE INTROUVABLE =====')
        console.log('🧾 refId:', refId)
        console.log('💳 txId:', txId)
      }

      console.log('\n✅ ===== CALLBACK TERMINÉ =====')

      return response.ok({
        responseCode: 200,
        transactionId: txId || refId || 'unknown'
      })

    } catch (error: any) {

      console.error('\n💥 ===== ERREUR CALLBACK =====')
      console.error('❌ Message:', error.message)
      console.error('📌 Stack:', error.stack)
      console.error('📌 Error object:', error)

      return response.ok({
        responseCode: 200
      })
    }
  }

  // ============================================================
  // 💼 DISTRIBUTION ARGENT
  // ============================================================
  private async distributeMoney(order: Order) {

    console.log('\n')
    console.log('💼💼💼💼💼💼💼💼💼💼💼💼💼💼💼💼')
    console.log('💼 DISTRIBUTION FINANCIÈRE')
    console.log('💼💼💼💼💼💼💼💼💼💼💼💼💼💼💼💼')

    console.log('📦 Commande:', order.order_number)
    console.log('💰 Total:', order.total)
    console.log('📦 Sous-total:', order.subtotal)
    console.log('🚚 Livraison:', order.shipping_cost)

    console.log('\n📥 Récupération des OrderItems...')

    const items = await OrderItem.query().where('order_id', order.id)

    console.log(`📦 ${items.length} items trouvés`)

    const merchantProducts = new Map<
      string,
      {
        productId: string
        productName: string
        price: number
        quantity: number
        subtotal: number
      }[]
    >()

    console.log('\n🔄 ===== TRAITEMENT ITEMS =====')

    for (const item of items) {

      console.log('\n📦 ITEM:')
      console.log('🆔 item.id:', item.id)
      console.log('📦 product_id:', item.product_id)
      console.log('🔢 quantity:', item.quantity)
      console.log('💰 subtotal:', item.subtotal)

      const product = await Product.find(item.product_id)

      if (!product) {
        console.log('❌ Produit introuvable')
        continue
      }

      console.log('✅ Produit trouvé:', product.name)
      console.log('👤 user_id:', product.user_id)
      console.log('📦 stock actuel:', product.stock)

      if (!product.user_id) {
        console.log('⚠️ Produit sans user_id')
        continue
      }

      if (!merchantProducts.has(product.user_id)) {

        console.log(`🆕 Nouveau marchand détecté: ${product.user_id}`)

        merchantProducts.set(product.user_id, [])
      }

      merchantProducts.get(product.user_id)!.push({
        productId: product.id,
        productName: product.name,
        price: Number(item.price),
        quantity: item.quantity,
        subtotal: Number(item.subtotal)
      })

      console.log('✅ Produit ajouté au marchand')

      // UPDATE STOCK
      const oldStock = product.stock

      product.stock = Math.max(0, product.stock - item.quantity)

      console.log(`📦 Stock: ${oldStock} → ${product.stock}`)

      if (product.stock === 0) {

        console.log('⚠️ Produit en rupture → archivage')

        product.isArchived = true
      }

      await product.save()

      console.log('✅ Produit sauvegardé')
    }

    const merchantIds = Array.from(merchantProducts.keys())

    console.log('\n🏪 ===== MARCHANDS =====')
    console.log('📊 Nombre:', merchantIds.length)
    console.log('🆔 IDs:', merchantIds)

    const ADMIN_COMMISSION_RATE = 0.03

    console.log('\n🏛️ ===== COMMISSION ADMIN =====')

    const adminCommission = order.total * ADMIN_COMMISSION_RATE

    console.log('📊 Taux:', ADMIN_COMMISSION_RATE)
    console.log('💰 Commission calculée:', adminCommission)

    await this.creditAdminWallet(
      adminCommission,
      `Commission 3% - Commande #${order.order_number}`
    )

    const totalAfterCommission = order.total - adminCommission

    const commissionRatio = totalAfterCommission / order.total

    console.log('\n📊 ===== CALCULS =====')
    console.log('💰 Total après commission:', totalAfterCommission)
    console.log('📈 Ratio:', commissionRatio)

    console.log('\n📦 ===== DISTRIBUTION MARCHANDS =====')

    for (const merchantId of merchantIds) {

      console.log('\n👤 ===== MARCHAND =====')
      console.log('🆔 merchantId:', merchantId)

      const merchant = await User.findBy('id', merchantId)

      if (!merchant) {
        console.log('❌ Marchand introuvable')
        continue
      }

      console.log('✅ Marchand trouvé:', merchant.full_name)

      const products = merchantProducts.get(merchantId) || []

      let merchantTotal = 0

      for (const product of products) {

        console.log('\n📦 Produit marchand:')
        console.log('📛 Nom:', product.productName)
        console.log('💰 subtotal:', product.subtotal)

        merchantTotal += product.subtotal
      }

      console.log('💰 merchantTotal:', merchantTotal)

      const merchantAmount = merchantTotal * commissionRatio

      console.log('💵 merchantAmount:', merchantAmount)

      await this.creditWallet(
        merchant.id,
        merchantAmount,
        `Vente produits - Commande #${order.order_number}`
      )
    }

    if (order.shipping_cost > 0) {

      console.log('\n🚚 ===== LIVRAISON =====')
      console.log('💰 shipping_cost:', order.shipping_cost)

      let needEdenLivreur = false

      for (const merchantId of merchantIds) {

        const merchant = await User.findBy('id', merchantId)

        if (merchant) {

          console.log('\n👤 Merchant livraison:')
          console.log('📛 Nom:', merchant.full_name)
          console.log('🛵 has_livreur:', merchant.has_livreur)

          if (merchant.has_livreur) {

            const deliveryShare = order.shipping_cost / merchantIds.length

            console.log('✅ Livreur perso')
            console.log('💰 deliveryShare:', deliveryShare)

            await this.creditWallet(
              merchant.id,
              deliveryShare,
              `Frais livraison - Commande #${order.order_number}`
            )

          } else {

            console.log('⚠️ Pas de livreur perso')

            needEdenLivreur = true
          }
        }
      }

      if (needEdenLivreur) {

        console.log('\n🔍 ===== RECHERCHE EDENLIVREUR =====')

        let edenLivreur = await User.query()
          .where('role', 'edenlivreur')
          .where('is_verified', true)
          .first()

        if (!edenLivreur) {

          console.log('⚠️ Aucun edenlivreur → création')

          edenLivreur = await this.createEdenLivreur()

        } else {

          console.log('✅ Edenlivreur trouvé:')
          console.log('👤', edenLivreur.full_name)
          console.log('🆔', edenLivreur.id)
        }

        console.log('\n💸 Crédit livraison EdenLivreur')

        await this.creditWallet(
          edenLivreur.id,
          order.shipping_cost,
          `Frais livraison - Commande #${order.order_number}`
        )

        console.log('✅ Livraison créditée')

        order.livreur_id = edenLivreur.id

        await order.save()

        console.log('✅ Commande mise à jour avec livreur')

        await OrderTracking.create({
          order_id: order.id,
          status: 'paid',
          description: `🛵 Livreur Eden assigné: ${edenLivreur.full_name}`,
          tracked_at: DateTime.now(),
        })

        console.log('✅ Tracking livreur créé')
      }
    }

    console.log('\n✅ ===== DISTRIBUTION TERMINÉE =====')
  }

  private async createEdenLivreur(): Promise<User> {

    console.log('\n🆕 ===== CREATE EDENLIVREUR =====')

    const livreurId = crypto.randomUUID()

    const email = `edenlivreur_${Date.now()}@edenmarket.com`

    const password = crypto.randomUUID()

    console.log('🆔 livreurId:', livreurId)
    console.log('📧 email:', email)

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

    console.log('✅ Livreur créé')
    console.log('👤 full_name:', livreur.full_name)
    console.log('🆔 id:', livreur.id)

    console.log('\n💼 Création wallet livreur...')

    await Wallet.create({
      user_id: livreur.id,
      balance: 0,
      currency: 'XAF',
      status: 'active',
    })

    console.log('✅ Wallet créé')

    return livreur
  }

  private async creditAdminWallet(
    amount: number,
    description: string
  ): Promise<void> {

    try {

      console.log('\n🏛️ ===== CREDIT ADMIN WALLET =====')
      console.log('💰 amount:', amount)
      console.log('📝 description:', description)

      const adminUser = await User.query()
        .where('role', 'superadmin')
        .orWhere('role', 'admin')
        .first()

      if (!adminUser) {

        console.log('❌ Aucun admin trouvé')

        return
      }

      console.log('✅ Admin trouvé:', adminUser.full_name)

      let wallet = await Wallet.findBy('user_id', adminUser.id)

      if (!wallet) {

        console.log('⚠️ Wallet admin inexistant')

        wallet = await Wallet.create({
          user_id: adminUser.id,
          balance: 0,
          currency: 'XAF',
          status: 'active',
        })

        console.log('✅ Wallet admin créé')
      }

      const oldBalance = wallet.balance

      console.log('💰 Ancien solde:', oldBalance)

      wallet.balance += amount

      console.log('💰 Nouveau solde:', wallet.balance)

      await wallet.save()

      console.log('✅ Wallet admin sauvegardé')

    } catch (error: any) {

      console.error('\n💥 ERREUR CREDIT ADMIN')
      console.error(error)
    }
  }

  private async creditWallet(
    userId: string,
    amount: number,
    description: string
  ): Promise<void> {

    try {

      console.log('\n💳 ===== CREDIT WALLET =====')
      console.log('👤 userId:', userId)
      console.log('💰 amount:', amount)
      console.log('📝 description:', description)

      let wallet = await Wallet.findBy('user_id', userId)

      if (!wallet) {

        console.log('⚠️ Wallet inexistant')

        wallet = await Wallet.create({
          user_id: userId,
          balance: 0,
          currency: 'XAF',
          status: 'active',
        })

        console.log('✅ Nouveau wallet créé')
      }

      const oldBalance = wallet.balance

      console.log('💰 Ancien balance:', oldBalance)

      wallet.balance += amount

      console.log('💰 Nouvelle balance:', wallet.balance)

      await wallet.save()

      console.log('✅ Wallet sauvegardé')

    } catch (error: any) {

      console.error('\n💥 ERREUR CREDIT WALLET')
      console.error('👤 userId:', userId)
      console.error(error)

      throw error
    }
  }
}
