// app/controllers/OrdersController.ts
import type { HttpContext } from '@adonisjs/core/http'
import Order from '#models/Order'
import OrderItem from '#models/OrderItem'
import OrderTracking from '#models/order_tracking'
import Cart from '#models/Cart'
import CartItem from '#models/CartItem'
import User from '#models/user'
import Product from '#models/Product'
import axios from 'axios'
import { DateTime } from 'luxon'

// Helper : vérifie si une chaîne est un UUID valide
function isValidUuid(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)
}

export default class OrdersController {
  async store({ request, response }: HttpContext) {
    console.log('🔵 ========== DEBUT CREATION COMMANDE ==========')

    try {
      console.log('🔵 Récupération des données de la requête...')
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
      ])

      console.log('📦 Données reçues:', { userId, customerAccountNumber, deliveryMethod, deliveryPrice })

      // ========== VALIDATION ==========
      if (!userId) {
        return response.status(400).json({ success: false, message: 'userId est requis' })
      }

      if (!customerAccountNumber) {
        return response.status(400).json({ success: false, message: 'customerAccountNumber est requis (numéro de téléphone)' })
      }

      // ========== ÉTAPE 1: APPELER L'API KYC ==========
      console.log('🔵 🌐 APPEL API KYC...')
      const kycUrl = `https://187e-41-158-102-190.ngrok-free.app/api/mypvit/kyc/marchant?customerAccountNumber=${customerAccountNumber}`

      let operator = 'non renseigné'
      let fullName = customerNameFallback || 'non renseigné'
      let accountNumber = customerAccountNumber

      try {
        const kycResponse = await axios.get(kycUrl, { timeout: 10000 })
        if (kycResponse.data.success && kycResponse.data.data) {
          const kycData = kycResponse.data.data
          operator = kycData.detected_operator || kycData.operator || 'non renseigné'
          fullName = kycData.full_name || customerNameFallback || 'non renseigné'
          accountNumber = kycData.customer_account_number || customerAccountNumber
          console.log('✅ KYC OK - opérateur:', operator, '| nom:', fullName)
        } else {
          console.log('🟡 KYC success=false, fallback sur données frontend')
        }
      } catch (kycError: any) {
        console.log('🟡 KYC injoignable (status', kycError?.response?.status ?? 'inconnu', '), fallback sur données frontend')
      }

      // ========== ÉTAPE 2: RECHERCHE DE L'UTILISATEUR ==========
      // ✅ FIX : on ne cherche en DB que si userId est un vrai UUID
      //          sinon (guest-xxx) on passe null sans crasher PostgreSQL
      let user: User | null = null
      const isGuest = !isValidUuid(userId)

      if (isGuest) {
        console.log('👤 Utilisateur invité (guest), pas de recherche en DB')
      } else {
        console.log('🔵 Recherche de l\'utilisateur avec UUID:', userId)
        user = await User.findBy('id', userId)
        console.log('👤 Utilisateur trouvé:', user ? { id: user.id, email: user.email } : 'Introuvable')
      }

      // ========== ÉTAPE 3: RÉCUPÉRATION DU PANIER ==========
      // ✅ FIX : les guests n'ont pas de panier en DB → on renvoie une erreur claire
      console.log('🔵 Récupération du panier de l\'utilisateur...')

      if (isGuest) {
        console.log('❌ Utilisateur invité : aucun panier en DB')
        return response.status(400).json({
          success: false,
          message: 'Les commandes en mode invité ne sont pas supportées. Veuillez vous connecter.',
        })
      }

      const cart = await Cart.query()
        .where('user_id', userId)
        .preload('items')
        .first()

      console.log('🛒 Panier trouvé:', cart ? { id: cart.id, itemsCount: cart.items.length } : 'Aucun')

      if (!cart || cart.items.length === 0) {
        console.log('❌ Panier vide ou inexistant')
        return response.status(400).json({ success: false, message: 'Votre panier est vide' })
      }

      // ========== ÉTAPE 4: CALCUL DU TOTAL ==========
      console.log('🔵 Calcul du total et récupération des produits...')
      let subtotal = 0
      const orderItems: any[] = []

      for (const cartItem of cart.items) {
        if (!cartItem.product_id) {
          console.log(`⚠️ Item avec product_id null ignoré`)
          continue
        }

        const product = await Product.findBy('id', cartItem.product_id)

        if (!product) {
          console.log(`❌ Produit avec UUID ${cartItem.product_id} non trouvé`)
          return response.status(400).json({
            success: false,
            message: `Produit avec UUID ${cartItem.product_id} non trouvé`,
          })
        }

        const itemTotal = product.price * cartItem.quantity
        subtotal += itemTotal

        orderItems.push({
          product_id: product.id,
          productName: product.name,
          productDescription: product.description,
          price: product.price,
          quantity: cartItem.quantity,
          category: product.category,
          image: product.imageUrl,
          subtotal: itemTotal,
        })
        console.log(`✅ Item: ${product.name} x ${cartItem.quantity} = ${itemTotal}`)
      }

      if (orderItems.length === 0) {
        return response.status(400).json({ success: false, message: 'Aucun produit valide dans le panier' })
      }

      const total = subtotal + deliveryPrice
      const orderNumber = `CMD-${Date.now()}-${Math.floor(Math.random() * 1000)}`
      console.log(`🔵 Total: subtotal=${subtotal} + livraison=${deliveryPrice} = ${total}`)

      // ========== ÉTAPE 5: CRÉATION DE LA COMMANDE ==========
      const order = await Order.create({
        user_id: userId,
        order_number: orderNumber,
        status: 'pending',
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

      // ========== ÉTAPE 6: CRÉATION DES ITEMS ==========
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
        console.log(`✅ Item créé: ${item.productName} x ${item.quantity}`)
      }

      // ========== ÉTAPE 7: SUIVI INITIAL ==========
      await OrderTracking.create({
        order_id: order.id,
        status: 'pending',
        description: 'Commande confirmée et en attente de traitement',
        tracked_at: DateTime.now(),
      })

      // ========== ÉTAPE 8: VIDAGE DU PANIER ==========
      await CartItem.query().where('cart_id', cart.id).delete()
      console.log('✅ Panier vidé')

      // ========== ÉTAPE 9: APPEL API DE PAIEMENT ==========
      let paymentResult: any = null
      let paymentErrorMsg: string | null = null

      try {
        const paymentResponse = await axios.post(
          'http://localhost:3001/api/payment',
          {
            amount: total,
            customer_account_number: accountNumber,
            payment_api_key_public: "pk_1773325888803_dt8diavuh3h",
            payment_api_key_secret:"sk_1773325888803_qt015a3cr5",
          },
          { headers: { 'Content-Type': 'application/json' } }
        )

        paymentResult = paymentResponse.data
        console.log('✅ Réponse paiement:', JSON.stringify(paymentResult, null, 2))

        if (paymentResult.success) {
          order.status = 'pending'
          await order.save()
          await OrderTracking.create({
            order_id: order.id,
            status: 'paid',
            description: 'Paiement effectué avec succès',
            tracked_at: DateTime.now(),
          })
        } else {
          console.log('🟡 Paiement en attente ou échoué:', paymentResult.message)
        }
      } catch (paymentErr: any) {
        console.error('🟡 Erreur paiement (commande créée quand même):', paymentErr.message)
        paymentErrorMsg = paymentErr.message
      }

      // ========== ÉTAPE 10: RECHARGEMENT ==========
      await order.load('items')
      console.log('🟢 ========== COMMANDE CREEE AVEC SUCCES ==========')

      return response.status(201).json({
        success: true,
        message: '✅ Commande créée avec succès !',
        data: {
          orderNumber: order.order_number,
          total: order.total,
          status: order.status,
          customerName: order.customer_name,
          customerPhone: order.customer_phone,
          paymentMethod: order.payment_method,
          estimatedDelivery: order.estimated_delivery,
          itemsCount: order.items.length,
          payment: paymentResult
            ? {
              success: paymentResult.success,
              message: paymentResult.message,
              reference_id: paymentResult.data?.reference_id,
              status: paymentResult.data?.status,
            }
            : null,
          paymentError: paymentErrorMsg,
        },
      })
    } catch (error: any) {
      console.error('🔴 ========== ERREUR CREATION COMMANDE ==========')
      console.error('🔴 Message:', error.message)
      console.error('🔴 Stack:', error.stack)
      return response.status(500).json({
        success: false,
        message: '❌ Erreur lors de la création de la commande',
        error: error.message,
      })
    }
  }

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

      return response.status(200).json({ success: true, message: 'Commandes récupérées avec succès', data: orders })
    } catch (error: any) {
      return response.status(500).json({ success: false, message: 'Erreur lors de la récupération des commandes', error: error.message })
    }
  }

  async show({ params, response }: HttpContext) {
    try {
      const { orderId, userId } = params
      if (!userId || !orderId) {
        return response.status(400).json({ success: false, message: 'userId et orderId sont requis' })
      }

      const order = await Order.query()
        .where('id', orderId)
        .where('user_id', userId)
        .preload('items')
        .first()

      if (!order) {
        return response.status(404).json({ success: false, message: 'Commande non trouvée' })
      }

      return response.status(200).json({ success: true, message: 'Commande récupérée avec succès', data: order })
    } catch (error: any) {
      return response.status(500).json({ success: false, message: 'Erreur lors de la récupération de la commande', error: error.message })
    }
  }

  async updateStatus({ params, request, response }: HttpContext) {
    try {
      const { orderId } = params
      const { status, trackingNumber, estimatedDelivery, location, description } = request.only([
        'status', 'trackingNumber', 'estimatedDelivery', 'location', 'description',
      ])

      const order = await Order.find(orderId)
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

      order.status = status
      if (trackingNumber) order.tracking_number = trackingNumber
      if (estimatedDelivery) order.estimated_delivery = estimatedDelivery
      if (status === 'delivered') order.delivered_at = DateTime.now()
      await order.save()

      return response.status(200).json({ success: true, message: `✅ Statut mis à jour : ${status}`, data: order })
    } catch (error: any) {
      return response.status(500).json({ success: false, message: 'Erreur lors de la mise à jour du statut', error: error.message })
    }
  }

  async cancel({ params, request, response }: HttpContext) {
    try {
      const { orderId } = params
      const { userId } = request.only(['userId'])

      if (!userId) {
        return response.status(400).json({ success: false, message: 'userId est requis' })
      }

      const order = await Order.query().where('id', orderId).where('user_id', userId).first()
      if (!order) {
        return response.status(404).json({ success: false, message: 'Commande non trouvée' })
      }

      if (order.status !== 'pending') {
        return response.status(400).json({ success: false, message: 'Cette commande ne peut plus être annulée' })
      }

      order.status = 'cancelled'
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

  async invoice({ params, response }: HttpContext) {
    try {
      const { orderId, userId } = params
      if (!userId || !orderId) {
        return response.status(400).json({ success: false, message: 'userId et orderId sont requis' })
      }

      const order = await Order.query().where('id', orderId).where('user_id', userId).preload('items').first()
      if (!order) {
        return response.status(404).json({ success: false, message: 'Commande non trouvée' })
      }

      return response.status(200).json({
        success: true,
        message: 'Facture générée avec succès',
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

  async getTracking({ params, response }: HttpContext) {
    try {
      const { orderId, userId } = params
      if (!userId || !orderId) {
        return response.status(400).json({ success: false, message: 'userId et orderId sont requis' })
      }

      const order = await Order.query().where('id', orderId).where('user_id', userId).first()
      if (!order) {
        return response.status(404).json({ success: false, message: 'Commande non trouvée' })
      }

      const tracking = await OrderTracking.query().where('order_id', orderId).orderBy('tracked_at', 'asc')

      return response.status(200).json({ success: true, message: 'Suivi récupéré avec succès', data: tracking })
    } catch (error: any) {
      return response.status(500).json({ success: false, message: 'Erreur lors de la récupération du suivi', error: error.message })
    }
  }

  private getStatusDescription(status: string): string {
    const descriptions: Record<string, string> = {
      pending: 'Commande confirmée et en attente de traitement',
      processing: 'Votre commande est en cours de préparation',
      shipped: 'Votre commande a été expédiée',
      delivered: 'Votre commande a été livrée avec succès',
      paid: 'Paiement effectué avec succès',
      cancelled: 'Votre commande a été annulée',
    }
    return descriptions[status] || `Statut mis à jour: ${status}`
  }
}
