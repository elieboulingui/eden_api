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
        const newQuantity = cartItem.quantity + quantity
        // ✅ Vérifier le stock pour la quantité totale
        if (product.stock < newQuantity) {
          return response.badRequest({ 
            success: false, 
            message: `Stock insuffisant. Maximum disponible: ${product.stock}` 
          })
        }
        cartItem.quantity = newQuantity
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

    } catch (error: any) {
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

    } catch (error: any) {
      return response.internalServerError({
        success: false,
        message: 'Erreur récupération panier',
        error: error.message
      })
    }
  }

  /**
   * Update cart (batch update)
   */
  public async update({ request, response }: HttpContext) {
    try {
      const { userId, items } = request.body()

      if (!userId) {
        return response.badRequest({ success: false, message: 'Utilisateur non identifié' })
      }

      const cart = await Cart.query().where('user_id', userId).first()
      if (!cart) {
        return response.notFound({ success: false, message: 'Panier non trouvé' })
      }

      // ✅ Vérifier le stock pour chaque item
      for (const item of items) {
        const product = await Product.find(item.product_id)
        if (!product) {
          return response.badRequest({ 
            success: false, 
            message: `Produit ${item.product_id} non trouvé` 
          })
        }
        if (product.stock < item.quantity) {
          return response.badRequest({ 
            success: false, 
            message: `Stock insuffisant pour ${product.name}. Maximum: ${product.stock}` 
          })
        }
      }

      // Supprimer tous les items existants
      await CartItem.query().where('cart_id', cart.id).delete()

      // Créer les nouveaux items
      for (const item of items) {
        await CartItem.create({
          cart_id: cart.id,
          product_id: item.product_id,
          quantity: item.quantity
        })
      }

      return response.ok({ 
        success: true, 
        message: 'Panier mis à jour avec succès' 
      })

    } catch (error: any) {
      return response.internalServerError({
        success: false,
        message: 'Erreur update',
        error: error.message
      })
    }
  }

  /**
   * Update single item quantity
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
        .preload('product')
        .first()

      if (!cartItem) {
        return response.notFound({ success: false, message: 'Produit non trouvé dans le panier' })
      }

      // ✅ Vérification du stock
      if (cartItem.product && quantity > cartItem.product.stock) {
        return response.badRequest({ 
          success: false, 
          message: `Stock insuffisant. Seulement ${cartItem.product.stock} unité(s) disponible(s).` 
        })
      }

      if (quantity <= 0) {
        await cartItem.delete()
        return response.ok({ 
          success: true, 
          message: 'Produit supprimé du panier',
          data: { deleted: true }
        })
      } else {
        cartItem.quantity = quantity
        await cartItem.save()
        return response.ok({ 
          success: true, 
          message: 'Quantité mise à jour',
          data: { quantity: cartItem.quantity }
        })
      }

    } catch (error: any) {
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

    } catch (error: any) {
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

    } catch (error: any) {
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

  public async updateItem(ctx: HttpContext) {
    return this.updateQuantity(ctx)
  }

  public async deleteItem(ctx: HttpContext) {
    return this.remove(ctx)
  }
}
