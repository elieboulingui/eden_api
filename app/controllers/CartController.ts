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

      if (!userId) {
        return response.badRequest({ success: false, message: 'Utilisateur non identifié' })
      }

      if (!productId) {
        return response.badRequest({ success: false, message: 'Produit non spécifié' })
      }

      const user = await User.find(userId)
      if (!user) {
        return response.badRequest({ success: false, message: 'Utilisateur non trouvé' })
      }

      const product = await Product.find(productId)
      if (!product) {
        return response.badRequest({ success: false, message: 'Produit non trouvé' })
      }

      if (product.stock < quantity) {
        return response.badRequest({ success: false, message: 'Stock insuffisant' })
      }

      let cart = await Cart.query().where('user_id', userId).first()

      if (!cart) {
        cart = await Cart.create({ user_id: userId })
      }

      let cartItem = await CartItem.query()
        .where('cart_id', cart.id)
        .where('product_id', productId)
        .first()

      if (cartItem) {
        cartItem.quantity += quantity
        await cartItem.save()
      } else {
        cartItem = await CartItem.create({
          cart_id: cart.id,
          product_id: productId,
          quantity
        })
      }

      await cart.load('items', (q) => q.preload('product'))

      return response.ok({
        success: true,
        message: 'Produit ajouté au panier',
        data: { cart, cartItem }
      })

    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Erreur ajout panier',
        error: error.message
      })
    }
  }

  /**
   * Get cart
   */
  public async getCart({ params, request, response }: HttpContext) {
    try {
      const userId = params.userId || request.input('userId')

      if (!userId) {
        return response.badRequest({ success: false, message: 'Utilisateur non identifié' })
      }

      const cart = await Cart.query()
        .where('user_id', userId)
        .preload('items', (q) => q.preload('product'))
        .first()

      if (!cart) {
        return response.ok({ success: true, data: { items: [], total: 0 } })
      }

      let total = 0
      for (const item of cart.items) {
        if (item.product) {
          total += item.product.price * item.quantity
        }
      }

      return response.ok({
        success: true,
        data: { id: cart.id, items: cart.items, total }
      })

    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Erreur récupération panier',
        error: error.message
      })
    }
  }

  /**
   * Update quantity
   */
  public async updateQuantity({ request, response }: HttpContext) {
    try {
      const { userId, productId, quantity } = request.body()

      if (!userId || !productId || quantity === undefined) {
        return response.badRequest({ success: false, message: 'Données manquantes' })
      }

      const cart = await Cart.query().where('user_id', userId).first()
      if (!cart) {
        return response.notFound({ success: false, message: 'Panier non trouvé' })
      }

      const cartItem = await CartItem.query()
        .where('cart_id', cart.id)
        .where('product_id', productId)
        .first()

      if (!cartItem) {
        return response.notFound({ success: false, message: 'Produit non trouvé dans le panier' })
      }

      if (quantity <= 0) {
        await cartItem.delete()
      } else {
        cartItem.quantity = quantity
        await cartItem.save()
      }

      return response.ok({ success: true, message: 'Quantité mise à jour' })

    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Erreur update',
        error: error.message
      })
    }
  }

  /**
   * Remove item
   */
  public async remove({ request, response }: HttpContext) {
    try {
      const { userId, productId } = request.body()

      if (!userId || !productId) {
        return response.badRequest({ success: false, message: 'Données manquantes' })
      }

      const cart = await Cart.query().where('user_id', userId).first()
      if (!cart) {
        return response.notFound({ success: false, message: 'Panier non trouvé' })
      }

      await CartItem.query()
        .where('cart_id', cart.id)
        .where('product_id', productId)
        .delete()

      return response.ok({ success: true, message: 'Produit supprimé' })

    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Erreur suppression',
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
        return response.badRequest({ success: false, message: 'Utilisateur requis' })
      }

      const cart = await Cart.query().where('user_id', userId).first()

      if (cart) {
        await CartItem.query().where('cart_id', cart.id).delete()
      }

      return response.ok({ success: true, message: 'Panier vidé' })

    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Erreur clear cart',
        error: error.message
      })
    }
  }

  // ================= ALIAS POUR ROUTES =================

  public async show(ctx: HttpContext) {
    return this.getCart(ctx)
  }

  public async update(ctx: HttpContext) {
    return this.updateQuantity(ctx)
  }

  public async deleteItem(ctx: HttpContext) {
    return this.remove(ctx)
  }
}