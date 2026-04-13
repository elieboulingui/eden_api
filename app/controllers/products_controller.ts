// app/controllers/products_controller.ts
import type { HttpContext } from '@adonisjs/core/http'
import Product from '#models/Product'
import redis from '@adonisjs/redis/services/main'

export default class ProductsController {

  // Durées de cache (en secondes)
  private readonly CACHE_TTL = {
    LIST: 600,         // 10 minutes
    PRODUCT: 1800,     // 30 minutes
    CATEGORIES: 3600,  // 1 heure
    SEARCH: 300        // 5 minutes
  }

  /**
   * 🔧 Générer une clé de cache pour la liste des produits
   */
  private getListCacheKey(page: number = 1, limit: number = 50, filters: any = {}): string {
    const filterString = JSON.stringify(filters)
    return `products:list:${page}:${limit}:${filterString}`
  }

  /**
   * 🔧 Générer une clé de cache pour un produit
   */
  private getProductCacheKey(productId: number): string {
    return `product:${productId}`
  }

  /**
   * 🔧 Invalider tous les caches liés aux produits
   */
  private async invalidateProductCaches(productId?: number, category?: string): Promise<void> {
    // Supprimer le cache du produit spécifique
    if (productId) {
      await redis.del(this.getProductCacheKey(productId))
    }

    // Supprimer les caches de liste
    const listKeys = await redis.keys('products:list:*')
    if (listKeys.length > 0) {
      await redis.del(...listKeys)
    }

    // Supprimer le cache des catégories
    await redis.del('products:categories')

    // Supprimer les caches de recherche
    const searchKeys = await redis.keys('products:search:*')
    if (searchKeys.length > 0) {
      await redis.del(...searchKeys)
    }

    // Supprimer les statistiques
    await redis.del('products:stats')
  }

  /**
   * 🔧 Mettre en cache un produit
   */
  private async cacheProduct(product: Product): Promise<void> {
    const key = this.getProductCacheKey(product.id)
    await redis.set(key, JSON.stringify(product), 'EX', this.CACHE_TTL.PRODUCT)
  }

  /**
   * 🔧 Récupérer un produit (cache + DB)
   */
  private async getProductWithCache(productId: number): Promise<Product | null> {
    const cacheKey = this.getProductCacheKey(productId)

    // Vérifier le cache
    const cached = await redis.get(cacheKey)
    if (cached) {
      const productData = JSON.parse(cached)
      const product = new Product()
      Object.assign(product, productData)

      // Reconstruire la relation user si présente
      if (productData.user) {
        product.user = productData.user
      }

      return product
    }

    // Chercher en base
    const product = await Product.query()
      .where('id', productId)
      .preload('user', (query) => {
        query.select(['id', 'full_name', 'country'])
      })
      .first()

    if (product) {
      await this.cacheProduct(product)
    }

    return product
  }

  /**
   * 📋 Récupérer tous les produits (avec cache et pagination)
   */
  async index({ request, response }: HttpContext) {
    try {
      const page = request.input('page', 1)
      const limit = request.input('limit', 50)
      const category = request.input('category')
      const minPrice = request.input('min_price')
      const maxPrice = request.input('max_price')
      const origin = request.input('origin')
      const isNew = request.input('is_new')
      const isOnSale = request.input('is_on_sale')
      const sortBy = request.input('sort_by', 'created_at')
      const sortOrder = request.input('sort_order', 'desc')

      // Construire les filtres pour la clé de cache
      const filters = { category, minPrice, maxPrice, origin, isNew, isOnSale, sortBy, sortOrder }
      const cacheKey = this.getListCacheKey(page, limit, filters)

      // 🔍 Vérifier le cache
      const cachedData = await redis.get(cacheKey)
      if (cachedData) {
        const data = JSON.parse(cachedData)
        return response.status(200).json({
          success: true,
          source: 'cache',
          ...data
        })
      }

      // Construire la requête
      let query = Product.query().preload('user', (query) => {
        query.select(['id', 'full_name', 'country'])
      })

      // Appliquer les filtres
      if (category) {
        query = query.where('category', category)
      }

      if (minPrice) {
        query = query.where('price', '>=', parseFloat(minPrice))
      }

      if (maxPrice) {
        query = query.where('price', '<=', parseFloat(maxPrice))
      }

      if (origin) {
        query = query.where('origin', origin)
      }

      if (isNew !== undefined) {
        query = query.where('is_new', isNew === 'true' || isNew === true)
      }

      if (isOnSale !== undefined) {
        query = query.where('is_on_sale', isOnSale === 'true' || isOnSale === true)
      }

      // Appliquer le tri
      if (sortBy && ['price', 'created_at', 'name', 'stock'].includes(sortBy)) {
        query = query.orderBy(sortBy, sortOrder === 'asc' ? 'asc' : 'desc')
      }

      // Paginer les résultats
      const products = await query.paginate(page, limit)

      const responseData = {
        data: products.all(),
        meta: products.getMeta(),
        count: products.total
      }

      // 💾 Mettre en cache
      await redis.set(cacheKey, JSON.stringify(responseData), 'EX', this.CACHE_TTL.LIST)

      // 📊 Incrémenter le compteur de vues de la liste
      const today = new Date().toISOString().split('T')[0]
      await redis.incr(`products:views:list:${today}`)

      return response.status(200).json({
        success: true,
        source: 'database',
        ...responseData
      })

    } catch (error: any) {
      console.error('❌ Erreur index products:', error)
      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des produits',
        error: error.message
      })
    }
  }

  /**
   * 🔍 Recherche de produits (avec cache)
   */
  async search({ request, response }: HttpContext) {
    try {
      const query = request.input('q', '')
      const page = request.input('page', 1)
      const limit = request.input('limit', 20)

      if (!query || query.length < 2) {
        return response.status(400).json({
          success: false,
          message: 'La recherche doit contenir au moins 2 caractères'
        })
      }

      const cacheKey = `products:search:${encodeURIComponent(query)}:${page}:${limit}`

      // 🔍 Vérifier le cache
      const cached = await redis.get(cacheKey)
      if (cached) {
        return response.status(200).json({
          success: true,
          source: 'cache',
          ...JSON.parse(cached)
        })
      }

      // Recherche en base
      const products = await Product.query()
        .where((builder) => {
          builder
            .whereILike('name', `%${query}%`)
            .orWhereILike('description', `%${query}%`)
            .orWhereILike('category', `%${query}%`)
            .orWhereILike('origin', `%${query}%`)
        })
        .preload('user', (q) => {
          q.select(['id', 'full_name', 'country'])
        })
        .paginate(page, limit)

      const responseData = {
        data: products.all(),
        meta: products.getMeta(),
        count: products.total,
        query: query
      }

      // 💾 Mettre en cache
      await redis.set(cacheKey, JSON.stringify(responseData), 'EX', this.CACHE_TTL.SEARCH)

      // 📊 Logger la recherche populaire
      await redis.zincrby('products:popular_searches', 1, query.toLowerCase())

      return response.status(200).json({
        success: true,
        source: 'database',
        ...responseData
      })

    } catch (error: any) {
      console.error('❌ Erreur search products:', error)
      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la recherche',
        error: error.message
      })
    }
  }

  /**
   * 📖 Récupérer un produit (avec cache et gestion des vues)
   */
  async show({ params, response }: HttpContext) {
    try {
      const productId = parseInt(params.id)

      // Récupérer depuis le cache ou la base
      const product = await this.getProductWithCache(productId)

      if (!product) {
        return response.status(404).json({
          success: false,
          message: 'Produit non trouvé'
        })
      }

      // 📊 Gestion des vues avec Redis
      const viewsKey = `product:views:${productId}`
      const today = new Date().toISOString().split('T')[0]
      const dailyViewsKey = `product:daily_views:${productId}:${today}`

      // Incrémenter les vues
      const totalViews = await redis.incr(viewsKey)
      await redis.incr(dailyViewsKey)
      await redis.expire(dailyViewsKey, 86400 * 7) // 7 jours

      // Mettre à jour périodiquement en base (tous les 10 vues)
      if (totalViews % 10 === 0) {
        const dbProduct = await Product.find(productId)
        if (dbProduct) {
          dbProduct.views = totalViews
          await dbProduct.save()

          // Mettre à jour le cache
          await this.cacheProduct(dbProduct)
        }
      }

      // 📊 Enregistrer dans les produits populaires
      await redis.zincrby('products:popular', 1, productId.toString())

      // Ajouter les vues à la réponse
      const productWithViews = {
        ...product.toJSON(),
        views: totalViews,
        daily_views_today: parseInt(await redis.get(dailyViewsKey) || '0')
      }

      return response.status(200).json({
        success: true,
        data: productWithViews,
        source: 'database' // La source réelle est gérée dans getProductWithCache
      })

    } catch (error) {
      console.error('❌ Erreur show product:', error)
      return response.status(404).json({
        success: false,
        message: 'Produit non trouvé'
      })
    }
  }

  /**
   * ➕ Créer un produit
   */
  async store({ request, response }: HttpContext) {
    try {
      const clientIp = request.ip()

      // 🔒 Rate limiting : Max 10 créations par IP en 1 heure
      const rateLimitKey = `products:create:${clientIp}`
      const createAttempts = await redis.incr(rateLimitKey)

      if (createAttempts === 1) {
        await redis.expire(rateLimitKey, 3600) // 1 heure
      }

      if (createAttempts > 10) {
        return response.status(429).json({
          success: false,
          message: 'Limite de création de produits atteinte. Réessayez plus tard.'
        })
      }

      const data = request.only([
        'name', 'price', 'description', 'stock', 'user_id',
        'image_url', 'category', 'origin', 'weight',
        'packaging', 'conservation', 'is_new', 'is_on_sale'
      ])

      if (!data.user_id) {
        return response.status(400).json({
          success: false,
          message: 'L\'ID de l\'utilisateur est requis'
        })
      }

      const product = await Product.create(data)

      // Charger la relation user
      await product.load('user', (query) => {
        query.select(['id', 'full_name', 'country'])
      })

      // 🗑️ Invalider les caches
      await this.invalidateProductCaches(undefined, product.category)

      // 📊 Mettre à jour les statistiques
      await redis.incr('products:stats:total_created')
      await redis.hincrby('products:stats:by_category', product.category || 'uncategorized', 1)

      return response.status(201).json({
        success: true,
        message: 'Produit créé avec succès',
        data: product
      })

    } catch (error: any) {
      console.error('❌ Erreur store product:', error)
      return response.status(400).json({
        success: false,
        message: 'Erreur lors de la création du produit',
        error: error.message
      })
    }
  }

  /**
   * 🔄 Mettre à jour un produit
   */
  async update({ params, request, response }: HttpContext) {
    try {
      const product = await Product.findOrFail(params.id)
      const user_id = request.input('user_id')

      if (!user_id) {
        return response.status(400).json({
          success: false,
          message: 'L\'ID de l\'utilisateur est requis'
        })
      }

      if (product.user_id !== user_id) {
        return response.status(403).json({
          success: false,
          message: 'Vous n\'êtes pas autorisé à modifier ce produit'
        })
      }

      const oldCategory = product.category

      const data = request.only([
        'name', 'price', 'old_price', 'description', 'stock',
        'image_url', 'category', 'origin', 'weight',
        'packaging', 'conservation', 'is_new', 'is_on_sale'
      ])

      // 🔍 Vérifier les changements de stock pour notifications
      const oldStock = product.stock
      const newStock = data.stock

      product.merge(data)
      await product.save()

      // Charger la relation user
      await product.load('user', (query) => {
        query.select(['id', 'full_name', 'country'])
      })

      // 🗑️ Invalider les caches
      await this.invalidateProductCaches(product.id, product.category)
      if (oldCategory !== product.category) {
        await this.invalidateProductCaches(undefined, oldCategory)
      }

      // 📢 Notification si le stock passe de 0 à > 0 (produit de retour en stock)
      if (oldStock === 0 && newStock > 0) {
        const notificationKey = `product:back_in_stock:${product.id}`
        await redis.set(notificationKey, 'true', 'EX', 86400) // 24h
        // Ici on pourrait envoyer des notifications aux utilisateurs intéressés
      }

      return response.status(200).json({
        success: true,
        message: 'Produit mis à jour avec succès',
        data: product
      })

    } catch (error: any) {
      console.error('❌ Erreur update product:', error)
      return response.status(400).json({
        success: false,
        message: 'Erreur lors de la mise à jour du produit',
        error: error.message
      })
    }
  }

  /**
   * ❌ Supprimer un produit
   */
  async destroy({ params, request, response }: HttpContext) {
    try {
      const product = await Product.findOrFail(params.id)
      const user_id = request.input('user_id')

      if (!user_id) {
        return response.status(400).json({
          success: false,
          message: 'L\'ID de l\'utilisateur est requis'
        })
      }

      if (product.user_id !== user_id) {
        return response.status(403).json({
          success: false,
          message: 'Vous n\'êtes pas autorisé à supprimer ce produit'
        })
      }

      const productId = product.id
      const category = product.category

      await product.delete()

      // 🗑️ Invalider tous les caches
      await this.invalidateProductCaches(productId, category)

      // 🧹 Nettoyer les données Redis liées au produit
      await redis.del(`product:views:${productId}`)
      await redis.zrem('products:popular', productId.toString())

      const dailyViewsKeys = await redis.keys(`product:daily_views:${productId}:*`)
      if (dailyViewsKeys.length > 0) {
        await redis.del(...dailyViewsKeys)
      }

      // 📊 Mettre à jour les statistiques
      await redis.incr('products:stats:total_deleted')

      return response.status(200).json({
        success: true,
        message: 'Produit supprimé avec succès'
      })

    } catch (error: any) {
      console.error('❌ Erreur destroy product:', error)
      return response.status(400).json({
        success: false,
        message: 'Erreur lors de la suppression du produit',
        error: error.message
      })
    }
  }

  /**
   * 📊 Récupérer les catégories disponibles
   */
  async categories({ response }: HttpContext) {
    try {
      const cacheKey = 'products:categories'

      // Vérifier le cache
      const cached = await redis.get(cacheKey)
      if (cached) {
        return response.status(200).json({
          success: true,
          source: 'cache',
          data: JSON.parse(cached)
        })
      }

      // Récupérer les catégories distinctes
      const categories = await Product.query()
        .distinct('category')
        .whereNotNull('category')
        .select('category')

      const categoryList = categories.map(c => c.category).filter(Boolean)

      // Récupérer le compte par catégorie
      const countByCategory = await Product.query()
        .select('category')
        .count('* as total')
        .groupBy('category')

      const result = {
        categories: categoryList,
        counts: countByCategory.reduce((acc, curr) => {
          if (curr.category) {
            acc[curr.category] = parseInt(curr.$extras.total)
          }
          return acc
        }, {} as Record<string, number>)
      }

      // 💾 Mettre en cache
      await redis.set(cacheKey, JSON.stringify(result), 'EX', this.CACHE_TTL.CATEGORIES)

      return response.status(200).json({
        success: true,
        source: 'database',
        data: result
      })

    } catch (error: any) {
      console.error('❌ Erreur categories:', error)
      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des catégories',
        error: error.message
      })
    }
  }

  /**
   * 🔥 Récupérer les produits populaires
   */
  async popular({ request, response }: HttpContext) {
    try {
      const limit = request.input('limit', 10)
      const cacheKey = `products:popular:${limit}`

      // Vérifier le cache
      const cached = await redis.get(cacheKey)
      if (cached) {
        return response.status(200).json({
          success: true,
          source: 'cache',
          data: JSON.parse(cached)
        })
      }

      // Récupérer les IDs des produits populaires depuis Redis
      const popularIds = await redis.zrevrange('products:popular', 0, limit - 1)

      let products: Product[] = []

      if (popularIds.length > 0) {
        products = await Product.query()
          .whereIn('id', popularIds.map(id => parseInt(id)))
          .preload('user', (query) => {
            query.select(['id', 'full_name', 'country'])
          })
      }

      // Si pas assez de produits populaires, compléter avec les plus récents
      if (products.length < limit) {
        const recentProducts = await Product.query()
          .whereNotIn('id', products.map(p => p.id))
          .orderBy('created_at', 'desc')
          .limit(limit - products.length)
          .preload('user', (query) => {
            query.select(['id', 'full_name', 'country'])
          })

        products = [...products, ...recentProducts]
      }

      // Ajouter les vues depuis Redis
      const productsWithViews = await Promise.all(
        products.map(async (product) => {
          const views = await redis.get(`product:views:${product.id}`) || '0'
          return {
            ...product.toJSON(),
            views: parseInt(views)
          }
        })
      )

      // 💾 Mettre en cache
      await redis.set(cacheKey, JSON.stringify(productsWithViews), 'EX', 300) // 5 minutes

      return response.status(200).json({
        success: true,
        source: 'database',
        data: productsWithViews
      })

    } catch (error: any) {
      console.error('❌ Erreur popular products:', error)
      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des produits populaires',
        error: error.message
      })
    }
  }

  /**
   * 📊 Statistiques des produits (admin)
   */
  async stats({ response }: HttpContext) {
    try {
      const cacheKey = 'products:stats:global'

      // Vérifier le cache
      const cached = await redis.get(cacheKey)
      if (cached) {
        return response.status(200).json({
          success: true,
          source: 'cache',
          data: JSON.parse(cached)
        })
      }

      // Statistiques en temps réel
      const totalProducts = await Product.query().count('* as total')
      const totalStock = await Product.query().sum('stock as total')
      const avgPrice = await Product.query().avg('price as avg')

      const productsByCategory = await Product.query()
        .select('category')
        .count('* as total')
        .groupBy('category')

      const newProducts = await Product.query()
        .where('is_new', true)
        .count('* as total')

      const onSaleProducts = await Product.query()
        .where('is_on_sale', true)
        .count('* as total')

      // Récupérer les vues depuis Redis
      const popularProductIds = await redis.zrevrange('products:popular', 0, 4)
      const totalViews = popularProductIds.length > 0
        ? (await Promise.all(
          popularProductIds.map(id => redis.get(`product:views:${id}`))
        )).reduce((sum, views) => sum + parseInt(views || '0'), 0)
        : 0

      const stats = {
        total_products: parseInt(totalProducts[0].$extras.total) || 0,
        total_stock: parseInt(totalStock[0].$extras.total) || 0,
        average_price: parseFloat(avgPrice[0].$extras.avg) || 0,
        new_products: parseInt(newProducts[0].$extras.total) || 0,
        on_sale_products: parseInt(onSaleProducts[0].$extras.total) || 0,
        total_views: totalViews,
        products_by_category: productsByCategory.map(c => ({
          category: c.category,
          count: parseInt(c.$extras.total)
        })),
        total_created: parseInt(await redis.get('products:stats:total_created') || '0'),
        total_deleted: parseInt(await redis.get('products:stats:total_deleted') || '0'),
        timestamp: new Date().toISOString()
      }

      // 💾 Mettre en cache pour 5 minutes
      await redis.set(cacheKey, JSON.stringify(stats), 'EX', 300)

      return response.status(200).json({
        success: true,
        source: 'database',
        data: stats
      })

    } catch (error: any) {
      console.error('❌ Erreur stats products:', error)
      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des statistiques',
        error: error.message
      })
    }
  }

  /**
   * 🔍 Récupérer les recherches populaires
   */
  async popularSearches({ request, response }: HttpContext) {
    try {
      const limit = request.input('limit', 10)
      const searches = await redis.zrevrange('products:popular_searches', 0, limit - 1, 'WITHSCORES')

      const result = []
      for (let i = 0; i < searches.length; i += 2) {
        result.push({
          query: searches[i],
          count: parseInt(searches[i + 1])
        })
      }

      return response.status(200).json({
        success: true,
        data: result
      })

    } catch (error: any) {
      console.error('❌ Erreur popular searches:', error)
      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des recherches populaires',
        error: error.message
      })
    }
  }

  /**
   * 🔔 S'abonner aux notifications de retour en stock
   */
  async notifyWhenAvailable({ request, response }: HttpContext) {
    try {
      const { productId, email } = request.body()

      if (!productId || !email) {
        return response.status(400).json({
          success: false,
          message: 'productId et email sont requis'
        })
      }

      const product = await Product.find(productId)
      if (!product) {
        return response.status(404).json({
          success: false,
          message: 'Produit non trouvé'
        })
      }

      // Stocker la demande de notification
      const notifyKey = `product:notify:${productId}`
      await redis.sadd(notifyKey, email)
      await redis.expire(notifyKey, 86400 * 30) // 30 jours

      return response.status(200).json({
        success: true,
        message: 'Vous serez notifié quand le produit sera de retour en stock'
      })

    } catch (error: any) {
      console.error('❌ Erreur notify:', error)
      return response.status(500).json({
        success: false,
        message: 'Erreur lors de l\'inscription aux notifications',
        error: error.message
      })
    }
  }
}
