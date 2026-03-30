// app/controllers/CartController.ts

import type { HttpContext } from '@adonisjs/core/http'
import Cart from '#models/Cart'
import CartItem from '#models/CartItem'
import Product from '#models/Product'
import User from '#models/user'

export default class CartController {
  /**
   * Add item to cart
   */
  public async add({ request, response }: HttpContext) {
    try {
      const { userId, productId, quantity } = request.body()

      console.log('🛒 [Cart.add] Request:', { userId, productId, quantity })

      if (!userId) {
        return response.badRequest({
          success: false,
          message: 'Utilisateur non identifié'
        })
      }

      if (!productId) {
        return response.badRequest({
          success: false,
          message: 'Produit non spécifié'
        })
      }

      // Verify user exists
      const user = await User.find(userId)
      if (!user) {
        return response.badRequest({
          success: false,
          message: 'Utilisateur non trouvé'
        })
      }

      // Verify product exists and has stock
      const product = await Product.find(productId)
      if (!product) {
        return response.badRequest({
          success: false,
          message: 'Produit non trouvé'
        })
      }

      if (product.stock < quantity) {
        return response.badRequest({
          success: false,
          message: 'Stock insuffisant'
        })
      }

      // Find or create cart for user
      let cart = await Cart.query()
        .where('user_id', userId)
        .first()

      if (!cart) {
        cart = await Cart.create({
          user_id: userId
        })
      }

      // Check if product already in cart
      let cartItem = await CartItem.query()
        .where('cart_id', cart.id)
        .where('product_id', productId)
        .first()

      if (cartItem) {
        // Update quantity
        cartItem.quantity += quantity
        await cartItem.save()
      } else {
        // Add new item
        cartItem = await CartItem.create({
          cart_id: cart.id,
          product_id: productId,
          quantity: quantity
        })
      }

      // Get updated cart with items
      await cart.load('items', (itemsQuery) => {
        itemsQuery.preload('product')
      })

      return response.status(200).json({
        success: true,
        message: 'Produit ajouté au panier',
        data: {
          cart,
          cartItem
        }
      })

    } catch (error) {
      console.error('❌ [Cart.add] Error:', error)
      return response.status(500).json({
        success: false,
        message: 'Erreur lors de l\'ajout au panier',
        error: error.message
      })
    }
  }

  /**
   * Get cart for user
   */
  public async getCart({ request, response }: HttpContext) {
    try {
      const { userId } = request.body()

      if (!userId) {
        return response.badRequest({
          success: false,
          message: 'Utilisateur non identifié'
        })
      }

      const cart = await Cart.query()
        .where('user_id', userId)
        .preload('items', (itemsQuery) => {
          itemsQuery.preload('product')
        })
        .first()

      if (!cart) {
        return response.json({
          success: true,
          data: {
            items: [],
            total: 0
          }
        })
      }

      // Calculate total
      let total = 0
      for (const item of cart.items) {
        if (item.product) {
          total += item.product.price * item.quantity
        }
      }

      return response.json({
        success: true,
        data: {
          id: cart.id,
          items: cart.items,
          total
        }
      })

    } catch (error) {
      console.error('❌ [Cart.getCart] Error:', error)
      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération du panier',
        error: error.message
      })
    }
  }

  /**
   * Update cart item quantity
   */
  public async updateQuantity({ request, response }: HttpContext) {
    try {
      const { userId, productId, quantity } = request.body()

      if (!userId || !productId || quantity === undefined) {
        return response.badRequest({
          success: false,
          message: 'Données manquantes'
        })
      }

      const cart = await Cart.query()
        .where('user_id', userId)
        .first()

      if (!cart) {
        return response.notFound({
          success: false,
          message: 'Panier non trouvé'
        })
      }

      const cartItem = await CartItem.query()
        .where('cart_id', cart.id)
        .where('product_id', productId)
        .first()

      if (!cartItem) {
        return response.notFound({
          success: false,
          message: 'Produit non trouvé dans le panier'
        })
      }

      if (quantity <= 0) {
        await cartItem.delete()
      } else {
        cartItem.quantity = quantity
        await cartItem.save()
      }

      return response.json({
        success: true,
        message: 'Quantité mise à jour'
      })

    } catch (error) {
      console.error('❌ [Cart.updateQuantity] Error:', error)
      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la mise à jour',
        error: error.message
      })
    }
  }

  /**
   * Remove item from cart
   */
  public async remove({ request, response }: HttpContext) {
    try {
      const { userId, productId } = request.body()

      if (!userId || !productId) {
        return response.badRequest({
          success: false,
          message: 'Données manquantes'
        })
      }

      const cart = await Cart.query()
        .where('user_id', userId)
        .first()

      if (!cart) {
        return response.notFound({
          success: false,
          message: 'Panier non trouvé'
        })
      }

      await CartItem.query()
        .where('cart_id', cart.id)
        .where('product_id', productId)
        .delete()

      return response.json({
        success: true,
        message: 'Produit retiré du panier'
      })

    } catch (error) {
      console.error('❌ [Cart.remove] Error:', error)
      return response.status(500).json({
        success: false,
        message: 'Erreur lors du retrait',
        error: error.message
      })
    }
  }

  /**
   * Clear cart
   */
  public async clear({ request, response }: HttpContext) {
    try {
      const { userId } = request.body()

      if (!userId) {
        return response.badRequest({
          success: false,
          message: 'Utilisateur non identifié'
        })
      }

      const cart = await Cart.query()
        .where('user_id', userId)
        .first()

      if (cart) {
        await CartItem.query()
          .where('cart_id', cart.id)
          .delete()
      }

      return response.json({
        success: true,
        message: 'Panier vidé'
      })

    } catch (error) {
      console.error('❌ [Cart.clear] Error:', error)
      return response.status(500).json({
        success: false,
        message: 'Erreur lors du vidage du panier',
        error: error.message
      })
    }
  }
}