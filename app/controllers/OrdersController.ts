// app/controllers/OrdersController.ts
import type { HttpContext } from '@adonisjs/core/http'
import Order from '#models/Order'
import OrderItem from '#models/OrderItem'
import OrderTracking from '#models/order_tracking'
import Cart from '#models/Cart'
import CartItem from '#models/CartItem'
import User from '#models/user'
import Product from '#models/Product'
import Wallet from '#models/wallet'
import axios from 'axios'
import { DateTime } from 'luxon'

function isValidUuid(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)
}

interface PaymentInfo {
  reference_id: string
  x_secret: string
  status: string
  amount: number
  operator_simple: string
  transaction_type: string
  check_status_url: string
  code_url: string
}

export default class OrdersController {

  // ========== PROXY CHECK-STATUS POUR LE FRONT ==========
  async giveAllWithoutId({ params, response }: HttpContext) {
    const { referenceId } = params

    if (!referenceId) {
      return response.status(400).json({
        success: false,
        message: 'referenceId est requis'
      })
    }

    console.log(`📡 [giveAllWithoutId] Proxy check-status pour: ${referenceId}`)

    try {
      const apiResponse = await axios.get(
        `https://apist.onrender.com/api/check-status/${referenceId}`,
        { timeout: 10000 }
      )
      return response.status(200).json(apiResponse.data)

    } catch (error: any) {
      return response.status(200).json({
        success: false,
        reference_id: referenceId,
        status: 'SERVICE_UNAVAILABLE',
        is_success: false,
        is_pending: false,
        is_failed: true,
        last_update: new Date().toISOString(),
        error_message: error.message,
      })
    }
  }

  // ========== TOUTES LES COMMANDES (ADMIN) ==========
  public async allOrders({ response }: HttpContext) {
    const orders = await Order.query()
      .preload('items')
      .preload('tracking')
      .orderBy('created_at', 'desc')

    return response.ok({
      success: true,
      data: orders,
    })
  }

  // ========== CRÉATION DE COMMANDE ==========
  async store({ request, response }: HttpContext) {
    console.log('🔵 ========== DEBUT CREATION COMMANDE ==========')

    try {
      const {
        userId,
        customerAccountNumber,
        shippingAddress,
        billingAddress,
        notes,
        deliveryMethod = 'standard',
        deliveryPrice = 2500,
        customerName: customerNameFallback,
        customerEmail: customerEmailFallback,
        mobileOperatorCode,
        mobileOperatorName,
      } = request.only([
        'userId',
        'customerAccountNumber',
        'shippingAddress',
        'billingAddress',
        'notes',
        'deliveryMethod',
        'deliveryPrice',
        'paymentApiKeyPublic',
        'paymentApiKeySecret',
        'customerName',
        'customerEmail',
        'mobileOperatorCode',
        'mobileOperatorName',
      ])

      // ========== VALIDATION ==========
      if (!userId) {
        return response.status(400).json({ success: false, message: 'userId est requis' })
      }
      if (!customerAccountNumber) {
        return response.status(400).json({ success: false, message: 'customerAccountNumber est requis' })
      }

      // ========== ÉTAPE 1: KYC ==========
      console.log('🔵 Appel API KYC...')
      const kycUrl = `https://apist.onrender.com/api/mypvit/kyc/marchant?customerAccountNumber=${customerAccountNumber}`

      let operator = mobileOperatorName || mobileOperatorCode || 'non renseigné'
      let fullName = customerNameFallback || 'non renseigné'
      let accountNumber = customerAccountNumber

      try {
        const kycResponse = await axios.get(kycUrl, { timeout: 10000 })
        if (kycResponse.data.success && kycResponse.data.data) {
          const kycData = kycResponse.data.data
          operator = mobileOperatorName || mobileOperatorCode || kycData.detected_operator || kycData.operator || 'non renseigné'
          fullName = kycData.full_name || customerNameFallback || 'non renseigné'
          accountNumber = kycData.customer_account_number || customerAccountNumber
          console.log('✅ KYC OK - opérateur:', operator, '| nom:', fullName)
        } else {
          console.log('🟡 KYC success=false, fallback sur données frontend')
        }
      } catch (kycError: any) {
        console.log('🟡 KYC injoignable, fallback sur données frontend')
        operator = mobileOperatorName || mobileOperatorCode || 'non renseigné'
      }

      // ========== ÉTAPE 2: UTILISATEUR ==========
      const isGuest = !isValidUuid(userId)

      if (isGuest) {
        return response.status(400).json({
          success: false,
          message: 'Les commandes en mode invité ne sont pas supportées. Veuillez vous connecter.',
        })
      }

      const user = await User.findBy('id', userId)
      console.log('👤 Utilisateur:', user ? user.email : 'Introuvable')

      // ========== ÉTAPE 3: PANIER ==========
      const cart = await Cart.query()
        .where('user_id', userId)
        .preload('items')
        .first()

      if (!cart || cart.items.length === 0) {
        return response.status(400).json({ success: false, message: 'Votre panier est vide' })
      }

      // ========== ÉTAPE 4: CALCUL TOTAL ==========
      let subtotal = 0
      const orderItems: any[] = []
      const sellerSales: Map<string, { sellerId: string; amount: number; products: any[] }> = new Map()

      for (const cartItem of cart.items) {
        if (!cartItem.product_id) continue

        const product = await Product.findBy('id', cartItem.product_id)
        if (!product) {
          return response.status(400).json({
            success: false,
            message: `Produit avec UUID ${cartItem.product_id} non trouvé`,
          })
        }

        const itemTotal = product.price * cartItem.quantity
        subtotal += itemTotal

        const sellerId = product.user_id
        if (!sellerSales.has(sellerId)) {
          sellerSales.set(sellerId, { sellerId, amount: 0, products: [] })
        }

        const sellerData = sellerSales.get(sellerId)!
        sellerData.amount += itemTotal
        sellerData.products.push({
          product_id: product.id,
          product_name: product.name,
          quantity: cartItem.quantity,
          price: product.price,
          subtotal: itemTotal,
        })

        orderItems.push({
          product_id: product.id,
          productName: product.name,
          productDescription: product.description,
          price: product.price,
          quantity: cartItem.quantity,
          category: product.category,
          image: product.image_url,
          subtotal: itemTotal,
          seller_id: sellerId,
        })

        console.log(`✅ Item: ${product.name} x ${cartItem.quantity} = ${itemTotal}`)
      }

      if (orderItems.length === 0) {
        return response.status(400).json({ success: false, message: 'Aucun produit valide dans le panier' })
      }

      const total = subtotal + deliveryPrice
      console.log(`🔵 Total: ${subtotal} + ${deliveryPrice} = ${total}`)

      // ========== ÉTAPE 5: PAIEMENT ==========
      let paymentResult: any = null
      let paymentInfo: PaymentInfo | null = null
      let paymentSuccess = false

      try {
        console.log('🔵 Appel API paiement...')

        const paymentBody: Record<string, any> = {
          amount: total,
          customer_account_number: accountNumber,
          payment_api_key_public: "pk_1773325888803_dt8diavuh3h",
          payment_api_key_secret: "sk_1773325888803_qt015a3cr5",
        }

        if (mobileOperatorCode) {
          paymentBody.operator_code = mobileOperatorCode
          console.log(`✅ Opérateur code: ${mobileOperatorCode} | nom: ${mobileOperatorName}`)
        }

        const paymentResponse = await axios.post(
          'https://apist.onrender.com/api/payment',
          paymentBody,
          {
            headers: { 'Content-Type': 'application/json' },
            timeout: 180000,
          }
        )

        paymentResult = paymentResponse.data
        console.log('✅ Réponse paiement:', JSON.stringify(paymentResult, null, 2))

        if (paymentResult.success && paymentResult.data) {

          // ✅ referenceId DYNAMIQUE depuis la réponse /api/payment
          const referenceId = paymentResult.data.reference_id

          if (!referenceId) {
            return response.status(400).json({
              success: false,
              message: '❌ referenceId absent dans la réponse du service de paiement',
            })
          }

          console.log(`🔑 referenceId reçu: ${referenceId}`)
          console.log('🔍 Polling infini du statut — sans limite de temps...')

          let attemptCount = 0

          // ✅ Boucle infinie — attend le temps qu'il faut, pas de timeout
          while (true) {
            attemptCount++

            try {
              const statusResponse = await axios.get(
                `https://apist.onrender.com/api/check-status/${referenceId}`,
                { timeout: 10000 }
              )

              const statusData = statusResponse.data

              if (attemptCount % 10 === 0) {
                console.log(`📡 Tentative #${attemptCount} - statut: ${statusData.status}`)
              }

              // Paiement confirmé ✅
              if (statusData.is_success === true) {
                console.log(`✅ PAIEMENT CONFIRMÉ après ${attemptCount} tentatives`)
                paymentSuccess = true
                paymentInfo = {
                  reference_id: referenceId,
                  x_secret: paymentResult.data.x_secret || '',
                  status: statusData.status,
                  amount: statusData.amount,
                  operator_simple: mobileOperatorName || paymentResult.data.operator_simple,
                  transaction_type: paymentResult.data.transaction_type,
                  check_status_url: paymentResult.data.check_status_url,
                  code_url: paymentResult.data.code_url || '',
                }
                break
              }

              // Paiement échoué ❌
              if (statusData.is_failed === true) {
                console.log(`❌ Paiement échoué après ${attemptCount} tentatives: ${statusData.status}`)
                paymentSuccess = false
                break
              }

              // is_pending → on continue à attendre

            } catch (pollError: any) {
              if (attemptCount % 20 === 0) {
                console.error(`⚠️ Erreur polling #${attemptCount}:`, pollError.message)
              }
            }

            // 3 secondes entre chaque vérification
            await new Promise(resolve => setTimeout(resolve, 3000))
          }

          if (!paymentSuccess) {
            return response.status(400).json({
              success: false,
              message: '❌ Paiement échoué ou refusé.',
              payment_status: 'failed',
              attempts: attemptCount,
            })
          }

        } else {
          return response.status(400).json({
            success: false,
            message: paymentResult.message || '❌ Échec de l\'initiation du paiement',
            payment_status: 'failed',
          })
        }

      } catch (paymentErr: any) {
        console.error('❌ Erreur paiement:', paymentErr.message)
        return response.status(500).json({
          success: false,
          message: '❌ Erreur lors du traitement du paiement',
          error: paymentErr.message,
        })
      }

      // ========== ÉTAPE 6: CRÉATION DE LA COMMANDE ==========
      console.log('💰 PAIEMENT CONFIRMÉ - CRÉATION DE LA COMMANDE...')

      const orderNumber = `CMD-${Date.now()}-${Math.floor(Math.random() * 1000)}`

      const order = await Order.create({
        user_id: userId,
        order_number: orderNumber,
        status: 'paid',
        total,
        subtotal,
        shipping_cost: deliveryPrice,
        delivery_method: deliveryMethod,
        customer_name: fullName,
        customer_phone: accountNumber,
        payment_method: operator,
        customer_email: user?.email || customerEmailFallback || 'non-renseigné@email.com',
        shipping_address: shippingAddress || 'non renseigné',
        billing_address: billingAddress || shippingAddress || 'non renseigné',
        notes: notes || null,
      })

      console.log(`✅ Commande créée: ${order.order_number}`)

      // ========== ÉTAPE 7: ITEMS + STOCK ==========
      for (const item of orderItems) {
        await OrderItem.create({
          order_id: order.id,
          product_id: item.product_id,
          product_name: item.productName,
          product_description: item.productDescription,
          price: item.price,
          quantity: item.quantity,
          category: typeof item.category === 'string' ? item.category : null,
          image: item.image,
          subtotal: item.subtotal,
        })

        const product = await Product.findBy('id', item.product_id)
        if (product) {
          product.stock = product.stock - item.quantity
          await product.save()
          console.log(`📦 Stock mis à jour: ${item.productName} → ${product.stock}`)
        }
      }

      // ========== ÉTAPE 8: TRACKING ==========
      await OrderTracking.create({
        order_id: order.id,
        status: 'paid',
        description: `Paiement effectué avec succès - Réf: ${paymentInfo?.reference_id} - Montant: ${total} FCFA`,
        tracked_at: DateTime.now(),
      })

      // ========== ÉTAPE 9: VIDER LE PANIER ==========
      await CartItem.query().where('cart_id', cart.id).delete()
      console.log('✅ Panier vidé')

      // ========== ÉTAPE 10: PRÉLÈVEMENT SUPERADMIN 0.5% ==========
      const superAdminFee = total * 0.005
      console.log(`💰 Prélèvement superadmin: ${superAdminFee} FCFA`)

      try {
        const superAdmin = await User.query().where('role', 'superadmin').first()

        if (superAdmin) {
          let superAdminWallet = await Wallet.query().where('user_id', superAdmin.id).first()

          if (!superAdminWallet) {
            superAdminWallet = await Wallet.create({
              user_id: superAdmin.id,
              balance: 0,
              currency: 'XAF',
              status: 'active',
            })
          }

          superAdminWallet.balance = (superAdminWallet.balance || 0) + superAdminFee
          await superAdminWallet.save()
          console.log(`✅ Superadmin crédité: ${superAdminFee} FCFA`)
        } else {
          console.log('⚠️ Superadmin non trouvé')
        }
      } catch (walletError: any) {
        console.error('❌ Erreur wallet superadmin:', walletError.message)
      }

      // ========== ÉTAPE 11: CRÉDITER LES VENDEURS ==========
      console.log('💰 CRÉDIT DES VENDEURS...')
      const sellerCredits: any[] = []

      for (const [sellerId, saleData] of sellerSales.entries()) {
        try {
          let sellerWallet = await Wallet.query().where('user_id', sellerId).first()

          if (!sellerWallet) {
            sellerWallet = await Wallet.create({
              user_id: sellerId,
              balance: 0,
              currency: 'XAF',
              status: 'active',
            })
          }

          const previousBalance = sellerWallet.balance || 0
          sellerWallet.balance = previousBalance + saleData.amount
          await sellerWallet.save()

          sellerCredits.push({
            seller_id: sellerId,
            amount: saleData.amount,
            products_count: saleData.products.length,
            previous_balance: previousBalance,
            new_balance: sellerWallet.balance,
          })

          console.log(`✅ Vendeur ${sellerId} crédité: ${saleData.amount} FCFA`)
        } catch (sellerError: any) {
          console.error(`❌ Erreur crédit vendeur ${sellerId}:`, sellerError.message)
        }
      }

      await order.load('items')
      console.log('🟢 ========== COMMANDE CRÉÉE AVEC SUCCÈS ==========')

      return response.status(201).json({
        success: true,
        message: '✅ Commande créée avec succès !',
        data: {
          orderId: order.id,
          orderNumber: order.order_number,
          total: order.total,
          status: order.status,
          customerName: order.customer_name,
          customerPhone: order.customer_phone,
          paymentMethod: order.payment_method,
          estimatedDelivery: order.estimated_delivery,
          itemsCount: order.items.length,
          admin_fee: superAdminFee,
          seller_credits: sellerCredits,
          payment: paymentInfo ? {
            success: true,
            reference_id: paymentInfo.reference_id,
            status: paymentInfo.status,
            operator: paymentInfo.operator_simple,
            amount: paymentInfo.amount,
          } : null,
        },
      })

    } catch (error: any) {
      console.error('🔴 ========== ERREUR CRÉATION COMMANDE ==========')
      console.error('🔴 Message:', error.message)
      console.error('🔴 Stack:', error.stack)
      return response.status(500).json({
        success: false,
        message: '❌ Erreur lors de la création de la commande',
        error: error.message,
      })
    }
  }

  // ========== VÉRIFIER STATUT D'UNE TRANSACTION ==========
  async checkPaymentStatus({ params, response }: HttpContext) {
    try {
      const { referenceId } = params

      if (!referenceId) {
        return response.status(400).json({ success: false, message: 'referenceId est requis' })
      }

      const statusResponse = await axios.get(
        `https://apist.onrender.com/api/check-status/${referenceId}`,
        { timeout: 15000 }
      )

      return response.status(200).json({
        success: true,
        data: statusResponse.data,
      })

    } catch (error: any) {
      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la vérification du statut',
        error: error.message,
      })
    }
  }

  // ========== COMMANDES D'UN UTILISATEUR ==========
  async index({ params, response }: HttpContext) {
    try {
      const { userId } = params
      if (!userId) {
        return response.status(400).json({ success: false, message: 'userId est requis' })
      }

      const orders = await Order.query()
        .where('user_id', userId)
        .preload('items')
        .orderBy('created_at', 'desc')

      return response.status(200).json({ success: true, data: orders })
    } catch (error: any) {
      return response.status(500).json({ success: false, message: 'Erreur lors de la récupération des commandes', error: error.message })
    }
  }

  // ========== UNE COMMANDE SPÉCIFIQUE ==========
  async show({ params, response }: HttpContext) {
    try {
      const { orderId, userId } = params
      if (!userId || !orderId) {
        return response.status(400).json({ success: false, message: 'userId et orderId sont requis' })
      }

      let order: Order | null = null

      if (orderId.startsWith('CMD-')) {
        order = await Order.query()
          .where('order_number', orderId)
          .where('user_id', userId)
          .preload('items')
          .first()
      } else {
        order = await Order.query()
          .where('id', orderId)
          .where('user_id', userId)
          .preload('items')
          .first()
      }

      if (!order) {
        return response.status(404).json({ success: false, message: 'Commande non trouvée' })
      }

      return response.status(200).json({ success: true, data: order })
    } catch (error: any) {
      return response.status(500).json({ success: false, message: 'Erreur lors de la récupération de la commande', error: error.message })
    }
  }

  // ========== MISE À JOUR STATUT (ADMIN) ==========
  async updateStatus({ params, request, response }: HttpContext) {
    try {
      const { orderId } = params
      const { status, trackingNumber, estimatedDelivery, location, description } = request.only([
        'status', 'trackingNumber', 'estimatedDelivery', 'location', 'description',
      ])

      let order: Order | null = null

      if (orderId.startsWith('CMD-')) {
        order = await Order.findBy('order_number', orderId)
      } else {
        order = await Order.find(orderId)
      }

      if (!order) {
        return response.status(404).json({ success: false, message: 'Commande non trouvée' })
      }

      await OrderTracking.create({
        order_id: order.id,
        status,
        description: description || this.getStatusDescription(status),
        location: location || null,
        tracked_at: DateTime.now(),
      })

      order.status = status as typeof order.status
      if (trackingNumber) order.tracking_number = trackingNumber
      if (estimatedDelivery) order.estimated_delivery = estimatedDelivery
      if (status === 'delivered') order.delivered_at = DateTime.now()
      await order.save()

      return response.status(200).json({ success: true, message: `✅ Statut mis à jour : ${status}`, data: order })
    } catch (error: any) {
      return response.status(500).json({ success: false, message: 'Erreur lors de la mise à jour du statut', error: error.message })
    }
  }

  // ========== ANNULER UNE COMMANDE ==========
  async cancel({ params, request, response }: HttpContext) {
    try {
      const { orderId } = params
      const { userId } = request.only(['userId'])

      if (!userId) {
        return response.status(400).json({ success: false, message: 'userId est requis' })
      }

      let order: Order | null = null

      if (orderId.startsWith('CMD-')) {
        order = await Order.query()
          .where('order_number', orderId)
          .where('user_id', userId)
          .first()
      } else {
        order = await Order.query()
          .where('id', orderId)
          .where('user_id', userId)
          .first()
      }

      if (!order) {
        return response.status(404).json({ success: false, message: 'Commande non trouvée' })
      }

      const cancellableStatuses = ['pending', 'paid', 'pending_payment']
      if (!cancellableStatuses.includes(order.status)) {
        return response.status(400).json({
          success: false,
          message: 'Cette commande ne peut plus être annulée',
          current_status: order.status,
        })
      }

      order.status = 'cancelled' as typeof order.status
      await order.save()

      await OrderTracking.create({
        order_id: order.id,
        status: 'cancelled',
        description: 'Commande annulée par le client',
        tracked_at: DateTime.now(),
      })

      return response.status(200).json({ success: true, message: '✅ Commande annulée avec succès', data: order })
    } catch (error: any) {
      return response.status(500).json({ success: false, message: 'Erreur lors de l\'annulation', error: error.message })
    }
  }

  // ========== FACTURE ==========
  async invoice({ params, response }: HttpContext) {
    try {
      const { orderId, userId } = params
      if (!userId || !orderId) {
        return response.status(400).json({ success: false, message: 'userId et orderId sont requis' })
      }

      let order: Order | null = null

      if (orderId.startsWith('CMD-')) {
        order = await Order.query()
          .where('order_number', orderId)
          .where('user_id', userId)
          .preload('items')
          .first()
      } else {
        order = await Order.query()
          .where('id', orderId)
          .where('user_id', userId)
          .preload('items')
          .first()
      }

      if (!order) {
        return response.status(404).json({ success: false, message: 'Commande non trouvée' })
      }

      return response.status(200).json({
        success: true,
        data: {
          order: {
            number: order.order_number,
            date: order.created_at,
            status: order.status,
            subtotal: order.subtotal,
            shippingCost: order.shipping_cost,
            total: order.total,
            deliveryMethod: order.delivery_method,
            customerName: order.customer_name,
            customerEmail: order.customer_email,
            customerPhone: order.customer_phone,
            shippingAddress: order.shipping_address,
            billingAddress: order.billing_address,
            paymentMethod: order.payment_method,
            trackingNumber: order.tracking_number,
            estimatedDelivery: order.estimated_delivery,
            deliveredAt: order.delivered_at,
            notes: order.notes,
          },
          items: order.items,
        },
      })
    } catch (error: any) {
      return response.status(500).json({ success: false, message: 'Erreur lors de la génération de la facture', error: error.message })
    }
  }

  // ========== SUIVI D'UNE COMMANDE ==========
  async getTracking({ params, response }: HttpContext) {
    try {
      const { orderId, userId } = params
      if (!userId || !orderId) {
        return response.status(400).json({ success: false, message: 'userId et orderId sont requis' })
      }

      let order: Order | null = null

      if (orderId.startsWith('CMD-')) {
        order = await Order.query()
          .where('order_number', orderId)
          .where('user_id', userId)
          .first()
      } else {
        order = await Order.query()
          .where('id', orderId)
          .where('user_id', userId)
          .first()
      }

      if (!order) {
        return response.status(404).json({ success: false, message: 'Commande non trouvée' })
      }

      const tracking = await OrderTracking.query()
        .where('order_id', order.id)
        .orderBy('tracked_at', 'asc')

      return response.status(200).json({ success: true, data: tracking })
    } catch (error: any) {
      return response.status(500).json({ success: false, message: 'Erreur lors de la récupération du suivi', error: error.message })
    }
  }

  // ========== DESCRIPTIONS DES STATUTS ==========
  private getStatusDescription(status: string): string {
    const descriptions: Record<string, string> = {
      pending: 'Commande confirmée et en attente de traitement',
      processing: 'Votre commande est en cours de préparation',
      shipped: 'Votre commande a été expédiée',
      delivered: 'Votre commande a été livrée avec succès',
      paid: 'Paiement effectué avec succès',
      pending_payment: 'Paiement en attente de confirmation',
      payment_failed: 'Le paiement a échoué',
      cancelled: 'Votre commande a été annulée',
    }
    return descriptions[status] || `Statut mis à jour: ${status}`
  }
}
