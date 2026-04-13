// app/controllers/CartController.ts

import type { HttpContext } from '@adonisjs/core/http'
import Cart from '#models/Cart'
import CartItem from '#models/CartItem'
import Product from '#models/Product'
import User from '#models/user'
import redis from '@adonisjs/redis/services/main'

export default class CartController {

  // Durées de cache (en secondes)
  private readonly CACHE_TTL = {
    CART: 1800,        // 30 minutes
    PRODUCT: 3600,      // 1 heure
    SESSION: 86400      // 24 heures
  }

  /**
   * 🔧 Générer une clé de cache pour un panier
   */
  private getCartCacheKey(userId: number | string): string {
    return `cart:user:${userId}`
  }

  /**
   * 🔧 Générer une clé pour le panier invité (session)
   */
  private getGuestCartKey(sessionId: string): string {
    return `cart:guest:${sessionId}`
  }

  /**
   * 🔧 Invalider le cache du panier
   */
  private async invalidateCartCache(userId: number | string): Promise<void> {
    await redis.del(this.getCartCacheKey(userId))
  }

  /**
   * 🔧 Mettre en cache un produit pour accès rapide
   */
  private async cacheProduct(product: Product): Promise<void> {
    const key = `product:${product.id}`
    await redis.set(
      key,
      JSON.stringify({
        id: product.id,
        name: product.name,
        price: product.price,
        stock: product.stock,
        image_url: product.image_url
      }),
      'EX',
      this.CACHE_TTL.PRODUCT
    )
  }

  /**
   * 🔧 Récupérer un produit (cache + DB)
   */
  private async getProduct(productId: number): Promise<Product | null> {
    const cacheKey = `product:${productId}`

    // Vérifier le cache
    const cached = await redis.get(cacheKey)
    if (cached) {
      const productData = JSON.parse(cached)
      const product = new Product()
      Object.assign(product, productData)
      return product
    }

    // Chercher en base
    const product = await Product.find(productId)
    if (product) {
      await this.cacheProduct(product)
    }

    return product
  }

  /**
   * 🔧 Invalider le cache d'un produit quand le stock change
   */
  private async invalidateProductCache(productId: number): Promise<void> {
    await redis.del(`product:${productId}`)
  }

  /**
   * 📦 Récupérer le panier depuis le cache ou la base
   */
  private async getCartWithCache(userId: number): Promise<Cart | null> {
    const cacheKey = this.getCartCacheKey(userId)

    // Vérifier le cache
    const cachedCart = await redis.get(cacheKey)
    if (cachedCart) {
      const cartData = JSON.parse(cachedCart)

      // Reconstruire l'objet Cart avec ses items
      const cart = new Cart()
      cart.id = cartData.id
      cart.user_id = cartData.user_id
      cart.created_at = cartData.created_at
      cart.updated_at = cartData.updated_at

      cart.items = cartData.items.map((itemData: any) => {
        const item = new CartItem()
        Object.assign(item, itemData)

        if (itemData.product) {
          const product = new Product()
          Object.assign(product, itemData.product)
          item.product = product
        }

        return item
      })

      return cart
    }

    // Chercher en base
    const cart = await Cart.query()
      .where('user_id', userId)
      .preload('items', (q) => q.preload('product'))
      .first()

    // Mettre en cache
    if (cart) {
      await redis.set(cacheKey, JSON.stringify(cart), 'EX', this.CACHE_TTL.CART)
    }

    return cart
  }

  /**
   * ➕ Add item to cart
   */
  public async add({ request, response }: HttpContext) {
    try {
      const clientIp = request.ip()
      const { userId, productId, quantity } = request.body()

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

      // 🔒 Rate limiting : Max 30 ajouts par IP en 5 minutes
      const rateLimitKey = `cart:rate:add:${clientIp}`
      const addAttempts = await redis.incr(rateLimitKey)

      if (addAttempts === 1) {
        await redis.expire(rateLimitKey, 300) // 5 minutes
      }

      if (addAttempts > 30) {
        return response.status(429).json({
          success: false,
          message: 'Trop de requêtes. Veuillez ralentir.'
        })
      }

      // Vérifier l'utilisateur (avec cache)
      const userCacheKey = `user:${userId}`
      let user = await redis.get(userCacheKey)

      if (user) {
        user = JSON.parse(user)
      } else {
        const userModel = await User.find(userId)
        if (!userModel) {
          return response.badRequest({
            success: false,
            message: 'Utilisateur non trouvé'
          })
        }
        user = {
          id: userModel.id,
          email: userModel.email,
          full_name: userModel.full_name
        }
        await redis.set(userCacheKey, JSON.stringify(user), 'EX', 3600)
      }

      // Récupérer le produit (avec cache)
      const product = await this.getProduct(productId)
      if (!product) {
        return response.badRequest({
          success: false,
          message: 'Produit non trouvé'
        })
      }

      // Vérifier le stock
      if (product.stock < quantity) {
        return response.badRequest({
          success: false,
          message: `Stock insuffisant. Disponible: ${product.stock}`
        })
      }

      // Récupérer ou créer le panier
      let cart = await Cart.query().where('user_id', userId).first()

      if (!cart) {
        cart = await Cart.create({ user_id: userId })
      }

      // Vérifier si le produit est déjà dans le panier
      let cartItem = await CartItem.query()
        .where('cart_id', cart.id)
        .where('product_id', productId)
        .first()

      if (cartItem) {
        const newQuantity = cartItem.quantity + quantity
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

      // 📊 Logger l'ajout pour analytics
      const analyticsKey = `cart:analytics:adds:${DateTime.now().toFormat('yyyy-MM-dd')}`
      await redis.incr(analyticsKey)
      await redis.expire(analyticsKey, 86400 * 30) // 30 jours

      // 🗑️ Invalider le cache du panier
      await this.invalidateCartCache(userId)

      // Recharger le panier avec les relations
      await cart.load('items', (q) => q.preload('product'))

      return response.ok({
        success: true,
        message: 'Produit ajouté au panier',
        data: {
          cart: {
            id: cart.id,
            items_count: cart.items.length
          },
          cartItem: {
            id: cartItem.id,
            product_id: cartItem.product_id,
            quantity: cartItem.quantity,
            product: {
              id: product.id,
              name: product.name,
              price: product.price
            }
          }
        }
      })

    } catch (error: any) {
      console.error('❌ Erreur add cart:', error)
      return response.internalServerError({
        success: false,
        message: 'Erreur ajout panier',
        error: error.message
      })
    }
  }

  /**
   * 🛒 Get cart
   */
  public async getCart({ params, request, response }: HttpContext) {
    try {
      const userId = params.userId || request.input('userId')

      if (!userId) {
        return response.badRequest({
          success: false,
          message: 'Utilisateur non identifié'
        })
      }

      // Récupérer depuis le cache ou la base
      const cart = await this.getCartWithCache(userId)

      if (!cart) {
        return response.ok({
          success: true,
          data: {
            items: [],
            total: 0,
            items_count: 0
          }
        })
      }

      // Calculer le total et vérifier la disponibilité des produits
      let total = 0
      const itemsWithAvailability = []

      for (const item of cart.items) {
        if (item.product) {
          total += item.product.price * item.quantity

          // Vérifier la disponibilité en temps réel
          const freshProduct = await this.getProduct(item.product.id)
          const isAvailable = freshProduct && freshProduct.stock >= item.quantity

          itemsWithAvailability.push({
            id: item.id,
            product_id: item.product.id,
            name: item.product.name,
            price: item.product.price,
            image_url: item.product.image_url,
            quantity: item.quantity,
            subtotal: item.product.price * item.quantity,
            available: isAvailable,
            max_available: freshProduct?.stock || 0
          })
        }
      }

      return response.ok({
        success: true,
        data: {
          id: cart.id,
          items: itemsWithAvailability,
          total,
          items_count: cart.items.length,
          updated_at: cart.updated_at
        }
      })

    } catch (error: any) {
      console.error('❌ Erreur getCart:', error)
      return response.internalServerError({
        success: false,
        message: 'Erreur récupération panier',
        error: error.message
      })
    }
  }

  /**
   * 🔄 Update cart (batch update)
   */
  public async update({ request, response }: HttpContext) {
    try {
      const { userId, items } = request.body()

      if (!userId) {
        return response.badRequest({
          success: false,
          message: 'Utilisateur non identifié'
        })
      }

      const cart = await Cart.query().where('user_id', userId).first()
      if (!cart) {
        return response.notFound({
          success: false,
          message: 'Panier non trouvé'
        })
      }

      // Vérifier le stock pour chaque item (avec cache)
      const stockErrors = []
      for (const item of items) {
        const product = await this.getProduct(item.product_id)
        if (!product) {
          stockErrors.push(`Produit ${item.product_id} non trouvé`)
        } else if (product.stock < item.quantity) {
          stockErrors.push(`Stock insuffisant pour ${product.name}. Maximum: ${product.stock}`)
        }
      }

      if (stockErrors.length > 0) {
        return response.badRequest({
          success: false,
          message: stockErrors.join('. '),
          errors: stockErrors
        })
      }

      // Supprimer tous les items existants
      await CartItem.query().where('cart_id', cart.id).delete()

      // Créer les nouveaux items
      const newItems = []
      for (const item of items) {
        const cartItem = await CartItem.create({
          cart_id: cart.id,
          product_id: item.product_id,
          quantity: item.quantity
        })
        newItems.push(cartItem)
      }

      // 🗑️ Invalider le cache
      await this.invalidateCartCache(userId)

      return response.ok({
        success: true,
        message: 'Panier mis à jour avec succès',
        data: {
          items_count: newItems.length
        }
      })

    } catch (error: any) {
      console.error('❌ Erreur update cart:', error)
      return response.internalServerError({
        success: false,
        message: 'Erreur mise à jour panier',
        error: error.message
      })
    }
  }

  /**
   * 🔢 Update single item quantity
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

      const cart = await Cart.query().where('user_id', userId).first()
      if (!cart) {
        return response.notFound({
          success: false,
          message: 'Panier non trouvé'
        })
      }

      const cartItem = await CartItem.query()
        .where('cart_id', cart.id)
        .where('product_id', productId)
        .preload('product')
        .first()

      if (!cartItem) {
        return response.notFound({
          success: false,
          message: 'Produit non trouvé dans le panier'
        })
      }

      // Vérification du stock (avec cache)
      const product = await this.getProduct(productId)
      if (product && quantity > product.stock) {
        return response.badRequest({
          success: false,
          message: `Stock insuffisant. Seulement ${product.stock} unité(s) disponible(s).`
        })
      }

      let deleted = false
      if (quantity <= 0) {
        await cartItem.delete()
        deleted = true
      } else {
        cartItem.quantity = quantity
        await cartItem.save()
      }

      // 🗑️ Invalider le cache
      await this.invalidateCartCache(userId)

      return response.ok({
        success: true,
        message: deleted ? 'Produit supprimé du panier' : 'Quantité mise à jour',
        data: {
          deleted,
          quantity: deleted ? 0 : cartItem.quantity
        }
      })

    } catch (error: any) {
      console.error('❌ Erreur updateQuantity:', error)
      return response.internalServerError({
        success: false,
        message: 'Erreur mise à jour quantité',
        error: error.message
      })
    }
  }

  /**
   * ❌ Remove item
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

      const cart = await Cart.query().where('user_id', userId).first()
      if (!cart) {
        return response.notFound({
          success: false,
          message: 'Panier non trouvé'
        })
      }

      const deleted = await CartItem.query()
        .where('cart_id', cart.id)
        .where('product_id', productId)
        .delete()

      // 🗑️ Invalider le cache
      await this.invalidateCartCache(userId)

      return response.ok({
        success: true,
        message: 'Produit supprimé du panier',
        data: { deleted: deleted > 0 }
      })

    } catch (error: any) {
      console.error('❌ Erreur remove cart:', error)
      return response.internalServerError({
        success: false,
        message: 'Erreur suppression',
        error: error.message
      })
    }
  }

  /**
   * 🧹 Clear cart
   */
  public async clear({ request, response }: HttpContext) {
    try {
      const { userId } = request.body()

      if (!userId) {
        return response.badRequest({
          success: false,
          message: 'Utilisateur requis'
        })
      }

      const cart = await Cart.query().where('user_id', userId).first()

      if (cart) {
        const deletedCount = await CartItem.query()
          .where('cart_id', cart.id)
          .delete()

        // 🗑️ Invalider le cache
        await this.invalidateCartCache(userId)

        return response.ok({
          success: true,
          message: 'Panier vidé avec succès',
          data: { items_removed: deletedCount }
        })
      }

      return response.ok({
        success: true,
        message: 'Panier déjà vide',
        data: { items_removed: 0 }
      })

    } catch (error: any) {
      console.error('❌ Erreur clear cart:', error)
      return response.internalServerError({
        success: false,
        message: 'Erreur vidage panier',
        error: error.message
      })
    }
  }

  /**
   * 📊 Récupérer les statistiques du panier (pour admin)
   */
  public async stats({ response }: HttpContext) {
    try {
      const cacheKey = 'cart:stats'

      // Vérifier le cache
      const cached = await redis.get(cacheKey)
      if (cached) {
        return response.ok({
          success: true,
          source: 'cache',
          data: JSON.parse(cached)
        })
      }

      // Statistiques en temps réel
      const totalCarts = await Cart.query().count('* as total')
      const totalItems = await CartItem.query().count('* as total')

      // Moyenne d'items par panier
      const avgItemsPerCart = await CartItem.query()
        .select(redis.raw('AVG(item_count) as avg'))
        .from(
          CartItem.query()
            .select('cart_id')
            .count('* as item_count')
            .groupBy('cart_id')
            .as('cart_counts')
        )
        .first()

      // Ajouts du jour
      const today = DateTime.now().toFormat('yyyy-MM-dd')
      const todayAdds = await redis.get(`cart:analytics:adds:${today}`) || '0'

      const stats = {
        total_carts: parseInt(totalCarts[0].$extras.total) || 0,
        total_items: parseInt(totalItems[0].$extras.total) || 0,
        avg_items_per_cart: parseFloat(avgItemsPerCart?.$extras.avg) || 0,
        today_adds: parseInt(todayAdds),
        timestamp: new Date().toISOString()
      }

      // Mettre en cache pour 5 minutes
      await redis.set(cacheKey, JSON.stringify(stats), 'EX', 300)

      return response.ok({
        success: true,
        source: 'database',
        data: stats
      })

    } catch (error: any) {
      console.error('❌ Erreur stats cart:', error)
      return response.internalServerError({
        success: false,
        message: 'Erreur récupération statistiques',
        error: error.message
      })
    }
  }

  /**
   * 🔄 Fusionner panier invité avec panier utilisateur (après connexion)
   */
  public async mergeGuestCart({ request, response }: HttpContext) {
    try {
      const { userId, guestSessionId } = request.body()

      if (!userId || !guestSessionId) {
        return response.badRequest({
          success: false,
          message: 'userId et guestSessionId requis'
        })
      }

      // Récupérer le panier invité depuis Redis
      const guestCartKey = this.getGuestCartKey(guestSessionId)
      const guestCartData = await redis.get(guestCartKey)

      if (!guestCartData) {
        return response.ok({
          success: true,
          message: 'Aucun panier invité à fusionner'
        })
      }

      const guestItems = JSON.parse(guestCartData)

      // Récupérer ou créer le panier utilisateur
      let userCart = await Cart.query().where('user_id', userId).first()
      if (!userCart) {
        userCart = await Cart.create({ user_id: userId })
      }

      // Fusionner les items
      for (const guestItem of guestItems) {
        const existingItem = await CartItem.query()
          .where('cart_id', userCart.id)
          .where('product_id', guestItem.product_id)
          .first()

        if (existingItem) {
          existingItem.quantity += guestItem.quantity
          await existingItem.save()
        } else {
          await CartItem.create({
            cart_id: userCart.id,
            product_id: guestItem.product_id,
            quantity: guestItem.quantity
          })
        }
      }

      // Supprimer le panier invité
      await redis.del(guestCartKey)

      // Invalider le cache du panier utilisateur
      await this.invalidateCartCache(userId)

      return response.ok({
        success: true,
        message: 'Panier invité fusionné avec succès',
        data: {
          items_merged: guestItems.length
        }
      })

    } catch (error: any) {
      console.error('❌ Erreur merge cart:', error)
      return response.internalServerError({
        success: false,
        message: 'Erreur fusion panier',
        error: error.message
      })
    }
  }

  /**
   * 💾 Sauvegarder un panier invité dans Redis
   */
  public async saveGuestCart({ request, response }: HttpContext) {
    try {
      const { sessionId, items } = request.body()

      if (!sessionId) {
        return response.badRequest({
          success: false,
          message: 'sessionId requis'
        })
      }

      const guestCartKey = this.getGuestCartKey(sessionId)

      await redis.set(
        guestCartKey,
        JSON.stringify(items || []),
        'EX',
        this.CACHE_TTL.SESSION
      )

      return response.ok({
        success: true,
        message: 'Panier invité sauvegardé'
      })

    } catch (error: any) {
      console.error('❌ Erreur saveGuestCart:', error)
      return response.internalServerError({
        success: false,
        message: 'Erreur sauvegarde panier invité',
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
