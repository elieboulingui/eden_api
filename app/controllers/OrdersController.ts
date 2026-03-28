// app/controllers/OrdersController.ts
import type { HttpContext } from '@adonisjs/core/http'
import Order from '#models/Order'
import OrderItem from '#models/OrderItem'
import OrderTracking from '#models/order_tracking'
import Cart from '#models/Cart'
import CartItem from '#models/CartItem'
import User from '#models/user'
import Product from '#models/Product'  // Majuscule

import { DateTime } from 'luxon'

export default class OrdersController {
  /**
   * Créer une commande à partir du panier
   * POST /api/orders
   */
  async store({ request, response }: HttpContext) {
    console.log('🔵 ========== DEBUT CREATION COMMANDE ==========')
    
    try {
      console.log('🔵 Récupération des données de la requête...')
      const { 
        userId,
        shippingAddress, 
        billingAddress, 
        paymentMethod, 
        notes,
        customerPhone,
        deliveryMethod = 'standard',
        deliveryPrice = 2500,
        customerName,
        customerEmail
      } = request.only([
        'userId',
        'shippingAddress', 
        'billingAddress', 
        'paymentMethod', 
        'notes',
        'customerPhone',
        'deliveryMethod',
        'deliveryPrice',
        'customerName',
        'customerEmail'
      ])

      console.log('📦 Données reçues:', { userId, shippingAddress, paymentMethod, customerPhone, deliveryMethod, deliveryPrice })

      if (!userId) {
        console.log('❌ ERREUR: userId manquant')
        return response.status(400).json({
          success: false,
          message: 'userId est requis'
        })
      }

      console.log('🔵 Recherche de l\'utilisateur avec UUID:', userId)
      const user = await User.findBy('uuid', userId)
      console.log('👤 Utilisateur trouvé:', user ? { uuid: user.uuid, full_name: user.full_name, email: user.email } : 'Aucun')
      
      console.log('🔵 Récupération du panier de l\'utilisateur...')
      const cart = await Cart.query()
        .where('user_id', userId)
        .preload('items')
        .first()

      console.log('🛒 Panier trouvé:', cart ? { id: cart.id, itemsCount: cart.items.length } : 'Aucun')

      if (!cart || cart.items.length === 0) {
        console.log('❌ ERREUR: Panier vide')
        return response.status(400).json({
          success: false,
          message: 'Votre panier est vide'
        })
      }

      // Calculer le total et récupérer les détails des produits
      console.log('🔵 Calcul du total et récupération des produits...')
      let subtotal = 0
      const orderItems = []

      for (const cartItem of cart.items) {
        console.log(`🔵 Traitement du produit ID: ${cartItem.product_id}, quantité: ${cartItem.quantity}`)
        const product = await Product.find(cartItem.product_id)
        
        if (!product) {
          console.log(`❌ ERREUR: Produit avec ID ${cartItem.product_id} non trouvé`)
          return response.status(400).json({
            success: false,
            message: `Produit avec ID ${cartItem.product_id} non trouvé`
          })
        }

        console.log(`📦 Produit trouvé: ${product.name}, prix: ${product.price}`)
        const itemTotal = product.price * cartItem.quantity
        subtotal += itemTotal
        
        orderItems.push({
          productId: product.id,
          productName: product.name,
          productDescription: product.description,
          price: product.price,
          quantity: cartItem.quantity,
          category: product.category,
          image: product.image_url,  // Changé: image -> image_url
          subtotal: itemTotal
        })
        console.log(`✅ Item ajouté: ${product.name} x ${cartItem.quantity} = ${itemTotal}`)
      }

      const total = subtotal + deliveryPrice
      const orderNumber = `CMD-${Date.now()}-${Math.floor(Math.random() * 1000)}`
      console.log(`🔵 Total calculé: subtotal=${subtotal}, delivery=${deliveryPrice}, total=${total}`)
      console.log(`🔵 Numéro de commande généré: ${orderNumber}`)

      // Créer la commande - utiliser snake_case
      console.log('🔵 Création de la commande...')
      const order = await Order.create({
        user_id: userId,  // Changé: userId -> user_id
        order_number: orderNumber,  // Changé: orderNumber -> order_number
        status: 'pending',
        total: total,
        subtotal: subtotal,
        shipping_cost: deliveryPrice,  // Changé: shippingCost -> shipping_cost
        delivery_method: deliveryMethod,  // Changé: deliveryMethod -> delivery_method
        customer_name: customerName || (user ? user.full_name : null),  // Changé: customerName -> customer_name
        customer_email: customerEmail || (user ? user.email : null),  // Changé: customerEmail -> customer_email
        customer_phone: customerPhone,  // Changé: customerPhone -> customer_phone
        shipping_address: shippingAddress,  // Changé: shippingAddress -> shipping_address
        billing_address: billingAddress || shippingAddress,  // Changé: billingAddress -> billing_address
        payment_method: paymentMethod,  // Changé: paymentMethod -> payment_method
        notes: notes || null
      })
      console.log(`✅ Commande créée avec ID: ${order.id}, numéro: ${order.order_number}`)

      // Créer les items de commande - utiliser snake_case
      console.log('🔵 Création des items de commande...')
      for (const item of orderItems) {
        await OrderItem.create({
          order_id: order.id,  // Changé: orderId -> order_id
          product_id: Number(item.productId),
          product_name: item.productName,
          product_description: item.productDescription,
          price: item.price,
          quantity: item.quantity,
          category: typeof item.category === 'string' ? item.category : null,  // S'assurer que c'est une string
          image: item.image,
          subtotal: item.subtotal
        })
        console.log(`✅ Item créé: ${item.productName} x ${item.quantity}`)
      }

      // Ajouter l'événement de suivi initial - utiliser snake_case
      console.log('🔵 Ajout de l\'événement de suivi initial...')
      await OrderTracking.create({
        order_id: order.id,  // Changé: orderId -> order_id
        status: 'pending',
        description: 'Commande confirmée et en attente de traitement',
        tracked_at: DateTime.now()  // Changé: trackedAt -> tracked_at
      })
      console.log('✅ Événement de suivi ajouté')

      // Vider le panier après commande
      console.log('🔵 Vidage du panier...')
      await CartItem.query().where('cart_id', cart.id).delete()
      console.log('✅ Panier vidé')

      // Recharger la commande avec les items
      console.log('🔵 Rechargement de la commande avec les items...')
      await order.load('items')
      console.log(`✅ Commande rechargée avec ${order.items.length} items`)

      console.log('🟢 ========== COMMANDE CREEE AVEC SUCCES ==========')
      // Réponse simplifiée
      return response.status(201).json({
        success: true,
        message: '✅ Commande créée avec succès !',
        data: {
          orderNumber: order.order_number,  // Changé: orderNumber -> order_number
          total: order.total,
          status: order.status,
          estimatedDelivery: order.estimated_delivery,  // Changé: estimatedDelivery -> estimated_delivery
          itemsCount: order.items.length
        }
      })
    } catch (error) {
      console.error('🔴 ========== ERREUR CREATION COMMANDE ==========')
      console.error('🔴 Message:', error.message)
      console.error('🔴 Stack:', error.stack)
      console.error('🔴 =============================================')
      return response.status(500).json({
        success: false,
        message: '❌ Erreur lors de la création de la commande',
        error: error.message
      })
    }
  }

  /**
   * Récupérer toutes les commandes d'un utilisateur
   * GET /api/orders/:userId
   */
  async index({ params, response }: HttpContext) {
    console.log('🔵 ========== RECUPERATION COMMANDES ==========')
    try {
      const { userId } = params
      console.log('📦 userId:', userId)

      if (!userId) {
        console.log('❌ ERREUR: userId manquant')
        return response.status(400).json({
          success: false,
          message: 'userId est requis'
        })
      }

      console.log('🔵 Recherche des commandes...')
      const orders = await Order.query()
        .where('user_id', userId)
        .preload('items')
        .orderBy('created_at', 'desc')

      console.log(`✅ ${orders.length} commandes trouvées`)
      console.log('🟢 ========== FIN RECUPERATION ==========')
      return response.status(200).json({
        success: true,
        message: 'Commandes récupérées avec succès',
        data: orders
      })
    } catch (error) {
      console.error('🔴 ERREUR:', error.message)
      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des commandes',
        error: error.message
      })
    }
  }

  /**
   * Récupérer une commande spécifique
   * GET /api/orders/:orderId/user/:userId
   */
  async show({ params, response }: HttpContext) {
    console.log('🔵 ========== RECUPERATION COMMANDE SPECIFIQUE ==========')
    try {
      const { orderId, userId } = params
      console.log('📦 orderId:', orderId)
      console.log('📦 userId:', userId)

      if (!userId || !orderId) {
        console.log('❌ ERREUR: userId ou orderId manquant')
        return response.status(400).json({
          success: false,
          message: 'userId et orderId sont requis'
        })
      }

      console.log('🔵 Recherche de la commande...')
      const order = await Order.query()
        .where('id', orderId)
        .where('user_id', userId)
        .preload('items')
        .first()

      if (!order) {
        console.log('❌ ERREUR: Commande non trouvée')
        return response.status(404).json({
          success: false,
          message: 'Commande non trouvée'
        })
      }

      console.log(`✅ Commande trouvée: ${order.order_number}`)
      console.log('🟢 ========== FIN RECUPERATION ==========')
      return response.status(200).json({
        success: true,
        message: 'Commande récupérée avec succès',
        data: order
      })
    } catch (error) {
      console.error('🔴 ERREUR:', error.message)
      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération de la commande',
        error: error.message
      })
    }
  }

  /**
   * Mettre à jour le statut d'une commande (admin uniquement)
   * PUT /api/orders/:orderId/status
   */
  async updateStatus({ params, request, response }: HttpContext) {
    console.log('🔵 ========== MISE A JOUR STATUT ==========')
    try {
      const { orderId } = params
      const { status, trackingNumber, estimatedDelivery, location, description } = request.only([
        'status', 'trackingNumber', 'estimatedDelivery', 'location', 'description'
      ])

      console.log('📦 orderId:', orderId)
      console.log('📦 Nouveau statut:', status)
      console.log('📦 trackingNumber:', trackingNumber)

      const order = await Order.find(orderId)

      if (!order) {
        console.log('❌ ERREUR: Commande non trouvée')
        return response.status(404).json({
          success: false,
          message: 'Commande non trouvée'
        })
      }

      console.log(`🔵 Ancien statut: ${order.status}`)

      // Ajouter un événement de suivi
      const eventDescription = description || this.getStatusDescription(status)
      console.log(`🔵 Ajout événement de suivi: ${status} - ${eventDescription}`)
      await OrderTracking.create({
        order_id: order.id,  // Changé: orderId -> order_id
        status: status,
        description: eventDescription,
        location: location || null,
        tracked_at: DateTime.now()  // Changé: trackedAt -> tracked_at
      })

      // Mettre à jour la commande
      order.status = status
      if (trackingNumber) order.tracking_number = trackingNumber  // Changé: trackingNumber -> tracking_number
      if (estimatedDelivery) order.estimated_delivery = estimatedDelivery  // Changé: estimatedDelivery -> estimated_delivery
      if (status === 'delivered') order.delivered_at = DateTime.now()  // Changé: deliveredAt -> delivered_at
      
      await order.save()
      console.log(`✅ Nouveau statut: ${order.status}`)

      console.log('🟢 ========== FIN MISE A JOUR ==========')
      return response.status(200).json({
        success: true,
        message: `✅ Statut de la commande mis à jour : ${status}`,
        data: order
      })
    } catch (error) {
      console.error('🔴 ERREUR:', error.message)
      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la mise à jour du statut',
        error: error.message
      })
    }
  }

  /**
   * Annuler une commande
   * POST /api/orders/:orderId/cancel
   */
  async cancel({ params, request, response }: HttpContext) {
    console.log('🔵 ========== ANNULATION COMMANDE ==========')
    try {
      const { orderId } = params
      const { userId } = request.only(['userId'])

      console.log('📦 orderId:', orderId)
      console.log('📦 userId:', userId)

      if (!userId) {
        console.log('❌ ERREUR: userId manquant')
        return response.status(400).json({
          success: false,
          message: 'userId est requis'
        })
      }

      const order = await Order.query()
        .where('id', orderId)
        .where('user_id', userId)
        .first()

      if (!order) {
        console.log('❌ ERREUR: Commande non trouvée')
        return response.status(404).json({
          success: false,
          message: 'Commande non trouvée'
        })
      }

      console.log(`🔵 Statut actuel: ${order.status}`)

      if (order.status !== 'pending') {
        console.log(`❌ ERREUR: Commande ne peut pas être annulée (statut: ${order.status})`)
        return response.status(400).json({
          success: false,
          message: 'Cette commande ne peut plus être annulée'
        })
      }

      order.status = 'cancelled'
      await order.save()
      console.log(`✅ Nouveau statut: ${order.status}`)

      // Ajouter un événement de suivi pour l'annulation
      console.log('🔵 Ajout événement d\'annulation...')
      await OrderTracking.create({
        order_id: order.id,  // Changé: orderId -> order_id
        status: 'cancelled',
        description: 'Commande annulée par le client',
        tracked_at: DateTime.now()  // Changé: trackedAt -> tracked_at
      })
      console.log('✅ Événement ajouté')

      console.log('🟢 ========== FIN ANNULATION ==========')
      return response.status(200).json({
        success: true,
        message: '✅ Commande annulée avec succès',
        data: order
      })
    } catch (error) {
      console.error('🔴 ERREUR:', error.message)
      return response.status(500).json({
        success: false,
        message: 'Erreur lors de l\'annulation de la commande',
        error: error.message
      })
    }
  }

  /**
   * Télécharger la facture
   * GET /api/orders/:orderId/invoice/:userId
   */
  async invoice({ params, response }: HttpContext) {
    console.log('🔵 ========== GENERATION FACTURE ==========')
    try {
      const { orderId, userId } = params
      console.log('📦 orderId:', orderId)
      console.log('📦 userId:', userId)

      if (!userId || !orderId) {
        console.log('❌ ERREUR: userId ou orderId manquant')
        return response.status(400).json({
          success: false,
          message: 'userId et orderId sont requis'
        })
      }

      const order = await Order.query()
        .where('id', orderId)
        .where('user_id', userId)
        .preload('items')
        .first()

      if (!order) {
        console.log('❌ ERREUR: Commande non trouvée')
        return response.status(404).json({
          success: false,
          message: 'Commande non trouvée'
        })
      }

      console.log(`✅ Facture générée pour la commande ${order.order_number}`)
      console.log('🟢 ========== FIN GENERATION ==========')
      return response.status(200).json({
        success: true,
        message: 'Facture générée avec succès',
        data: {
          order: {
            number: order.order_number,  // Changé: orderNumber -> order_number
            date: order.created_at,  // Changé: createdAt -> created_at
            status: order.status,
            subtotal: order.subtotal,
            shippingCost: order.shipping_cost,  // Changé: shippingCost -> shipping_cost
            total: order.total,
            deliveryMethod: order.delivery_method,  // Changé: deliveryMethod -> delivery_method
            customerName: order.customer_name,  // Changé: customerName -> customer_name
            customerEmail: order.customer_email,  // Changé: customerEmail -> customer_email
            customerPhone: order.customer_phone,  // Changé: customerPhone -> customer_phone
            shippingAddress: order.shipping_address,  // Changé: shippingAddress -> shipping_address
            billingAddress: order.billing_address,  // Changé: billingAddress -> billing_address
            paymentMethod: order.payment_method,  // Changé: paymentMethod -> payment_method
            trackingNumber: order.tracking_number,  // Changé: trackingNumber -> tracking_number
            estimatedDelivery: order.estimated_delivery,  // Changé: estimatedDelivery -> estimated_delivery
            deliveredAt: order.delivered_at,  // Changé: deliveredAt -> delivered_at
            notes: order.notes
          },
          items: order.items
        }
      })
    } catch (error) {
      console.error('🔴 ERREUR:', error.message)
      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la génération de la facture',
        error: error.message
      })
    }
  }

  /**
   * Récupérer le suivi d'une commande
   * GET /api/orders/:orderId/tracking/:userId
   */
  async getTracking({ params, response }: HttpContext) {
    console.log('🔵 ========== RECUPERATION SUIVI ==========')
    try {
      const { orderId, userId } = params
      console.log('📦 orderId:', orderId)
      console.log('📦 userId:', userId)

      if (!userId || !orderId) {
        console.log('❌ ERREUR: userId ou orderId manquant')
        return response.status(400).json({
          success: false,
          message: 'userId et orderId sont requis'
        })
      }

      const order = await Order.query()
        .where('id', orderId)
        .where('user_id', userId)
        .first()

      if (!order) {
        console.log('❌ ERREUR: Commande non trouvée')
        return response.status(404).json({
          success: false,
          message: 'Commande non trouvée'
        })
      }

      const tracking = await OrderTracking.query()
        .where('order_id', orderId)
        .orderBy('tracked_at', 'asc')  // Changé: trackedAt -> tracked_at

      console.log(`✅ ${tracking.length} événements de suivi trouvés`)
      console.log('🟢 ========== FIN RECUPERATION ==========')
      return response.status(200).json({
        success: true,
        message: 'Suivi récupéré avec succès',
        data: tracking
      })
    } catch (error) {
      console.error('🔴 ERREUR:', error.message)
      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération du suivi',
        error: error.message
      })
    }
  }

  /**
   * Méthode utilitaire pour obtenir la description du statut
   */
  private getStatusDescription(status: string): string {
    const descriptions: Record<string, string> = {
      pending: 'Commande confirmée et en attente de traitement',
      processing: 'Votre commande est en cours de préparation',
      shipped: 'Votre commande a été expédiée',
      delivered: 'Votre commande a été livrée avec succès',
      cancelled: 'Votre commande a été annulée'
    }
    return descriptions[status] || `Statut mis à jour: ${status}`
  }
}