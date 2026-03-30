// app/controllers/OrdersController.ts
import type { HttpContext } from '@adonisjs/core/http'
import Order from '#models/Order'
import OrderItem from '#models/OrderItem'
import Product from '#models/Product'
import User from '#models/user'
import Cart from '#models/Cart'
import CartItem from '#models/CartItem'

export default class OrdersController {
  /**
   * Helper pour résoudre l'ID utilisateur (UUID string)
   */
  private async resolveUserId(userIdentifier: string | number): Promise<string | null> {
    console.log('🔍 [Resolve] Tentative pour User:', userIdentifier)

    const user = await User.find(userIdentifier)
    if (user) {
      console.log('✅ [Resolve] User trouvé:', user.id)
      return user.id
    }

    console.error('❌ [Resolve] Utilisateur introuvable pour:', userIdentifier)
    return null
  }

  /**
   * Créer une commande à partir du panier
   */
  public async createFromCart({ request, response }: HttpContext) {
    const { userId, shippingAddress, paymentMethod, notes } = request.body()
    console.log('🔵 [Orders.createFromCart] - userId:', userId)

    const resolvedUserId = await this.resolveUserId(userId)
    if (!resolvedUserId) {
      return response.badRequest({ success: false, message: 'Utilisateur non trouvé' })
    }

    // Récupérer le panier de l'utilisateur
    const cart = await Cart.query()
      .where('user_id', resolvedUserId)
      .preload('items')
      .first()

    if (!cart || cart.items.length === 0) {
      return response.badRequest({ success: false, message: 'Panier vide' })
    }

    // Enrichir les items avec les détails des produits
    const itemsWithProducts = await this.enrichCartItems(cart.items)

    // Calculer le montant total
    let totalAmount = 0
    for (const item of itemsWithProducts) {
      if (item.product) {
        totalAmount += item.product.price * item.quantity
      }
    }

    // Créer la commande
    const order = await Order.create({
      user_id: resolvedUserId,
      total_amount: totalAmount,
      status: 'pending', // Statut initial
      shipping_address: shippingAddress,
      payment_method: paymentMethod,
      notes: notes,
    })

    // Créer les items de la commande
    for (const item of itemsWithProducts) {
      if (item.product) {
        await OrderItem.create({
          order_id: order.id,
          product_id: item.product_id,
          quantity: item.quantity,
          price: item.product.price,
        })

        // Mettre à jour le stock du produit
        const product = await Product.find(item.product_id)
        if (product) {
          product.stock -= item.quantity
          await product.save()
        }
      }
    }

    // Vider le panier après la création de la commande
    await CartItem.query().where('cart_id', cart.id).delete()

    return response.status(201).json({
      success: true,
      message: 'Commande créée avec succès',
      data: order,
    })
  }

  /**
   * Récupérer toutes les commandes d'un utilisateur
   */
  public async getUserOrders({ request, response }: HttpContext) {
    const { userId } = request.body()
    const resolvedUserId = await this.resolveUserId(userId)

    if (!resolvedUserId) {
      return response.notFound({ success: false, message: 'User non trouvé' })
    }

    const orders = await Order.query()
      .where('user_id', resolvedUserId)
      .preload('items', (itemsQuery) => {
        itemsQuery.preload('product')
      })
      .orderBy('created_at', 'desc')

    // Enrichir les commandes avec les détails des produits
    const enrichedOrders = await Promise.all(
      orders.map(async (order) => {
        const enrichedItems = await this.enrichOrderItems(order.items)
        return {
          ...order.toJSON(),
          items: enrichedItems,
        }
      })
    )

    return response.json({
      success: true,
      data: enrichedOrders,
    })
  }

  /**
   * Récupérer une commande spécifique
   */
  public async show({ params, response }: HttpContext) {
    const order = await Order.find(params.id)

    if (!order) {
      return response.notFound({ success: false, message: 'Commande non trouvée' })
    }

    await order.load('items', (itemsQuery) => {
      itemsQuery.preload('product')
    })

    const enrichedItems = await this.enrichOrderItems(order.items)

    return response.json({
      success: true,
      data: {
        ...order.toJSON(),
        items: enrichedItems,
      },
    })
  }

  /**
   * Mettre à jour le statut d'une commande
   */
  public async updateStatus({ request, params, response }: HttpContext) {
    const { status } = request.body()
    const order = await Order.find(params.id)

    if (!order) {
      return response.notFound({ success: false, message: 'Commande non trouvée' })
    }

    // Vérifier que le statut est valide
    const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled']
    if (!validStatuses.includes(status)) {
      return response.badRequest({
        success: false,
        message: `Statut invalide. Les statuts valides sont: ${validStatuses.join(', ')}`,
      })
    }

    order.status = status as 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled'
    await order.save()

    return response.json({
      success: true,
      message: 'Statut de la commande mis à jour',
      data: order,
    })
  }

  /**
   * Annuler une commande
   */
  public async cancel({ params, response }: HttpContext) {
    const order = await Order.find(params.id)

    if (!order) {
      return response.notFound({ success: false, message: 'Commande non trouvée' })
    }

    if (order.status !== 'pending' && order.status !== 'processing') {
      return response.badRequest({
        success: false,
        message: 'Seules les commandes en attente ou en traitement peuvent être annulées',
      })
    }

    order.status = 'cancelled'
    await order.save()

    // Restaurer le stock des produits
    await order.load('items')
    for (const item of order.items) {
      const product = await Product.find(item.product_id)
      if (product) {
        product.stock += item.quantity
        await product.save()
      }
    }

    return response.json({
      success: true,
      message: 'Commande annulée avec succès',
      data: order,
    })
  }

  /**
   * Helper pour enrichir les items du panier avec les détails des produits
   */
  private async enrichCartItems(items: CartItem[]) {
    return await Promise.all(
      items.map(async (item) => {
        const product = await Product.find(item.product_id)
        return {
          id: item.id,
          product_id: item.product_id,
          quantity: item.quantity,
          product: product
            ? {
                id: product.id,
                name: product.name,
                price: product.price,
                image: product.imageUrl, // Correction: imageUrl au lieu de image_url
              }
            : null,
        }
      })
    )
  }

  /**
   * Helper pour enrichir les items de commande avec les détails des produits
   */
  private async enrichOrderItems(items: OrderItem[]) {
    return await Promise.all(
      items.map(async (item) => {
        const product = item.product || (await Product.find(item.product_id))
        return {
          id: item.id,
          product_id: item.product_id,
          quantity: item.quantity,
          price: item.price,
          product: product
            ? {
                id: product.id,
                name: product.name,
                price: product.price,
                image: product.imageUrl, // Correction: imageUrl au lieu de image_url
              }
            : null,
        }
      })
    )
  }
}
