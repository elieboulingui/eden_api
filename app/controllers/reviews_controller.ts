import type { HttpContext } from '@adonisjs/core/http'
import Review from '#models/review'
import Product from '#models/Product'
import redis from '@adonisjs/redis/services/main'

export default class ReviewsController {

  // Durées de cache (en secondes)
  private readonly CACHE_TTL = {
    PRODUCT_REVIEWS: 600,    // 10 minutes
    MERCHANT_REVIEWS: 600,   // 10 minutes
    REVIEW: 1800,            // 30 minutes
    STATS: 300,              // 5 minutes
    USER_REVIEWS: 600        // 10 minutes
  }

  /**
   * 🔧 Générer une clé de cache pour les avis d'un produit
   */
  private getProductReviewsCacheKey(productId: number): string {
    return `reviews:product:${productId}`
  }

  /**
   * 🔧 Générer une clé de cache pour la moyenne d'un produit
   */
  private getProductRatingCacheKey(productId: number): string {
    return `reviews:product:${productId}:rating`
  }

  /**
   * 🔧 Générer une clé de cache pour les avis d'un marchand
   */
  private getMerchantReviewsCacheKey(merchantId: number): string {
    return `reviews:merchant:${merchantId}`
  }

  /**
   * 🔧 Générer une clé de cache pour un avis
   */
  private getReviewCacheKey(reviewId: number): string {
    return `review:${reviewId}`
  }

  /**
   * 🔧 Invalider les caches liés à un produit
   */
  private async invalidateProductCaches(productId: number, merchantId?: number): Promise<void> {
    await redis.del(this.getProductReviewsCacheKey(productId))
    await redis.del(this.getProductRatingCacheKey(productId))

    if (merchantId) {
      await redis.del(this.getMerchantReviewsCacheKey(merchantId))
    }

    // Invalider les listes admin
    const adminKeys = await redis.keys('reviews:admin:*')
    if (adminKeys.length > 0) {
      await redis.del(...adminKeys)
    }
  }

  /**
   * 🔧 Recalculer et mettre en cache la moyenne d'un produit
   */
  private async updateProductAverageRating(productId: number): Promise<number> {
    const avgResult = await Review.query()
      .where('product_id', productId)
      .where('status', 'approved')
      .avg('rating as average')
      .count('* as total')

    const average = avgResult[0]?.$extras?.average
      ? Number.parseFloat(avgResult[0].$extras.average)
      : 0

    const total = parseInt(avgResult[0]?.$extras?.total) || 0

    const roundedAvg = Math.round(average * 10) / 10

    // Mettre en cache
    const cacheData = JSON.stringify({ average: roundedAvg, total })
    await redis.set(this.getProductRatingCacheKey(productId), cacheData, 'EX', this.CACHE_TTL.PRODUCT_REVIEWS)

    // Mettre à jour le classement des produits les mieux notés
    if (total >= 3) {
      await redis.zadd('reviews:top_rated_products', roundedAvg, productId.toString())
    }

    return roundedAvg
  }

  /**
   * 📋 Récupérer tous les avis d'un produit (avec cache)
   */
  async getProductReviews({ params, request, response }: HttpContext) {
    try {
      const productId = params.productId
      const page = request.input('page', 1)
      const limit = request.input('limit', 20)
      const sort = request.input('sort', 'recent') // recent, helpful, highest, lowest
      const filterRating = request.input('rating')

      const cacheKey = `${this.getProductReviewsCacheKey(productId)}:${page}:${limit}:${sort}:${filterRating || 'all'}`

      // 🔍 Vérifier le cache
      const cached = await redis.get(cacheKey)
      if (cached) {
        const data = JSON.parse(cached)
        return response.ok({
          success: true,
          source: 'cache',
          ...data
        })
      }

      // Construire la requête
      let query = Review.query()
        .where('product_id', productId)
        .where('status', 'approved')
        .preload('user', (q) => q.select('id', 'full_name', 'email', 'avatar'))

      // Filtrer par note
      if (filterRating) {
        query = query.where('rating', parseInt(filterRating))
      }

      // Appliquer le tri
      switch (sort) {
        case 'helpful':
          query = query.orderBy('helpful_count', 'desc').orderBy('created_at', 'desc')
          break
        case 'highest':
          query = query.orderBy('rating', 'desc').orderBy('created_at', 'desc')
          break
        case 'lowest':
          query = query.orderBy('rating', 'asc').orderBy('created_at', 'desc')
          break
        default:
          query = query.orderBy('created_at', 'desc')
      }

      const reviews = await query.paginate(page, limit)

      // Récupérer ou calculer la moyenne
      let ratingData = await redis.get(this.getProductRatingCacheKey(productId))
      let averageRating: number
      let totalReviews: number

      if (ratingData) {
        const parsed = JSON.parse(ratingData)
        averageRating = parsed.average
        totalReviews = parsed.total
      } else {
        averageRating = await this.updateProductAverageRating(productId)
        const total = await Review.query()
          .where('product_id', productId)
          .where('status', 'approved')
          .count('* as total')
        totalReviews = parseInt(total[0].$extras.total) || 0
      }

      // Ajouter les votes utiles depuis Redis
      const reviewsWithHelpful = await Promise.all(
        reviews.all().map(async (r) => {
          const helpfulCount = await redis.get(`review:helpful:${r.id}`) || r.helpful_count.toString()
          return {
            ...r.toJSON(),
            helpful_count: parseInt(helpfulCount)
          }
        })
      )

      const responseData = {
        data: reviewsWithHelpful,
        meta: {
          ...reviews.getMeta(),
          averageRating,
          totalReviews
        }
      }

      // 💾 Mettre en cache
      await redis.set(cacheKey, JSON.stringify(responseData), 'EX', this.CACHE_TTL.PRODUCT_REVIEWS)

      return response.ok({
        success: true,
        source: 'database',
        ...responseData
      })

    } catch (error: any) {
      console.error('❌ Erreur getProductReviews:', error)
      return response.internalServerError({
        success: false,
        message: 'Erreur lors de la récupération des avis',
        error: error.message
      })
    }
  }

  /**
   * 🏪 Récupérer tous les avis d'un marchand (avec cache)
   */
  async getMerchantReviews({ params, request, response }: HttpContext) {
    try {
      const merchantId = params.merchantId
      const page = request.input('page', 1)
      const limit = request.input('limit', 20)
      const sort = request.input('sort', 'recent')

      const cacheKey = `${this.getMerchantReviewsCacheKey(merchantId)}:${page}:${limit}:${sort}`

      // 🔍 Vérifier le cache
      const cached = await redis.get(cacheKey)
      if (cached) {
        return response.ok({
          success: true,
          source: 'cache',
          ...JSON.parse(cached)
        })
      }

      let query = Review.query()
        .where('merchant_id', merchantId)
        .where('status', 'approved')
        .preload('user', (q) => q.select('id', 'full_name', 'email', 'avatar'))
        .preload('product', (q) => q.select('id', 'name', 'image_url', 'price'))

      switch (sort) {
        case 'highest':
          query = query.orderBy('rating', 'desc')
          break
        case 'lowest':
          query = query.orderBy('rating', 'asc')
          break
        default:
          query = query.orderBy('created_at', 'desc')
      }

      const reviews = await query.paginate(page, limit)

      // Calculer la moyenne
      const avgResult = await Review.query()
        .where('merchant_id', merchantId)
        .where('status', 'approved')
        .avg('rating as average')
        .count('* as total')

      const averageRating = avgResult[0]?.$extras?.average
        ? Number.parseFloat(avgResult[0].$extras.average)
        : 0
      const totalReviews = parseInt(avgResult[0]?.$extras?.total) || 0

      const responseData = {
        data: reviews.all(),
        meta: {
          ...reviews.getMeta(),
          averageRating: Math.round(averageRating * 10) / 10,
          totalReviews
        }
      }

      // 💾 Mettre en cache
      await redis.set(cacheKey, JSON.stringify(responseData), 'EX', this.CACHE_TTL.MERCHANT_REVIEWS)

      return response.ok({
        success: true,
        source: 'database',
        ...responseData
      })

    } catch (error: any) {
      console.error('❌ Erreur getMerchantReviews:', error)
      return response.internalServerError({
        success: false,
        message: 'Erreur lors de la récupération des avis du marchand',
        error: error.message
      })
    }
  }

  /**
   * 📊 Récupérer tous les avis (admin) avec cache
   */
  async index({ request, response }: HttpContext) {
    try {
      const userId = request.input('userId')
      const page = request.input('page', 1)
      const limit = request.input('limit', 20)
      const status = request.input('status')
      const isAdmin = request.input('isAdmin') === 'true'

      if (!isAdmin && !userId) {
        return response.badRequest({
          success: false,
          message: 'userId requis'
        })
      }

      const cacheKey = `reviews:admin:${page}:${limit}:${status || 'all'}:${userId || 'all'}`

      // Cache seulement pour les admins
      if (isAdmin) {
        const cached = await redis.get(cacheKey)
        if (cached) {
          return response.ok({
            success: true,
            source: 'cache',
            data: JSON.parse(cached)
          })
        }
      }

      const query = Review.query()
        .preload('user', (q) => q.select('id', 'full_name', 'email', 'avatar'))
        .preload('product', (q) => q.select('id', 'name', 'image_url'))
        .orderBy('created_at', 'desc')

      if (!isAdmin && userId) {
        query.where('user_id', userId)
      }

      if (status) {
        query.where('status', status)
      }

      const reviews = await query.paginate(page, limit)

      if (isAdmin) {
        await redis.set(cacheKey, JSON.stringify(reviews), 'EX', 300) // 5 min pour admin
      }

      return response.ok({
        success: true,
        data: reviews
      })

    } catch (error: any) {
      console.error('❌ Erreur index:', error)
      return response.internalServerError({
        success: false,
        message: 'Erreur lors de la récupération des avis',
        error: error.message
      })
    }
  }

  /**
   * 📖 Récupérer un avis spécifique (avec cache)
   */
  async show({ params, response }: HttpContext) {
    try {
      const cacheKey = this.getReviewCacheKey(params.id)

      const cached = await redis.get(cacheKey)
      if (cached) {
        const review = JSON.parse(cached)
        const helpfulCount = await redis.get(`review:helpful:${params.id}`) || review.helpful_count
        return response.ok({
          success: true,
          source: 'cache',
          data: { ...review, helpful_count: parseInt(helpfulCount) }
        })
      }

      const review = await Review.find(params.id)

      if (!review) {
        return response.notFound({
          success: false,
          message: 'Avis non trouvé'
        })
      }

      await review.load('user', (q) => q.select('id', 'full_name', 'email', 'avatar'))
      await review.load('product', (q) => q.select('id', 'name', 'image_url', 'price'))

      await redis.set(cacheKey, JSON.stringify(review), 'EX', this.CACHE_TTL.REVIEW)

      return response.ok({
        success: true,
        source: 'database',
        data: review
      })

    } catch (error: any) {
      console.error('❌ Erreur show:', error)
      return response.internalServerError({
        success: false,
        message: 'Erreur lors de la récupération de l\'avis',
        error: error.message
      })
    }
  }

  /**
   * ➕ Créer un nouvel avis (avec rate limiting)
   */
  async store({ request, response }: HttpContext) {
    try {
      const clientIp = request.ip()
      const { userId, product_id, rating, title, comment } = request.only([
        'userId', 'product_id', 'rating', 'title', 'comment'
      ])

      // Validation
      if (!userId) {
        return response.badRequest({
          success: false,
          message: 'L\'ID de l\'utilisateur est requis'
        })
      }

      if (!product_id || !rating) {
        return response.badRequest({
          success: false,
          message: 'L\'ID du produit et la note sont requis'
        })
      }

      if (rating < 1 || rating > 5) {
        return response.badRequest({
          success: false,
          message: 'La note doit être comprise entre 1 et 5'
        })
      }

      // 🔒 Rate limiting : Max 5 avis par IP en 1 heure
      const rateLimitKey = `reviews:rate:${clientIp}`
      const attempts = await redis.incr(rateLimitKey)

      if (attempts === 1) {
        await redis.expire(rateLimitKey, 3600)
      }

      if (attempts > 5) {
        const ttl = await redis.ttl(rateLimitKey)
        const minutes = Math.ceil(ttl / 60)
        return response.status(429).json({
          success: false,
          message: `Limite d'avis atteinte. Réessayez dans ${minutes} minute${minutes > 1 ? 's' : ''}.`
        })
      }

      // Vérifier si le produit existe (avec cache)
      const productCacheKey = `product:${product_id}`
      let product = await redis.get(productCacheKey)

      if (product) {
        product = JSON.parse(product)
      } else {
        product = await Product.find(product_id)
        if (product) {
          await redis.set(productCacheKey, JSON.stringify(product), 'EX', 3600)
        }
      }

      if (!product) {
        return response.notFound({
          success: false,
          message: 'Produit non trouvé'
        })
      }

      // Vérifier si l'utilisateur a déjà donné un avis
      const existingKey = `review:exists:${userId}:${product_id}`
      const existing = await redis.get(existingKey)

      if (existing) {
        return response.badRequest({
          success: false,
          message: 'Vous avez déjà donné votre avis sur ce produit'
        })
      }

      const existingReview = await Review.query()
        .where('user_id', userId)
        .where('product_id', product_id)
        .first()

      if (existingReview) {
        await redis.set(existingKey, existingReview.id.toString(), 'EX', 86400 * 30)
        return response.badRequest({
          success: false,
          message: 'Vous avez déjà donné votre avis sur ce produit'
        })
      }

      // Vérifier si achat vérifié (à implémenter avec un service de commandes)
      const isVerifiedPurchase = await this.checkVerifiedPurchase(userId, product_id)

      // Créer l'avis
      const review = await Review.create({
        user_id: userId,
        product_id: product_id,
        merchant_id: product.user_id || null,
        rating: rating,
        title: title || null,
        comment: comment || null,
        status: 'approved', // ou 'pending' selon la politique
        is_verified_purchase: isVerifiedPurchase,
        helpful_count: 0,
        ip_address: clientIp
      })

      // Marquer comme existant
      await redis.set(existingKey, review.id.toString(), 'EX', 86400 * 30)

      // 🗑️ Invalider les caches
      await this.invalidateProductCaches(product_id, product.user_id)

      // Mettre à jour la moyenne
      await this.updateProductAverageRating(product_id)

      // 📊 Statistiques
      const today = new Date().toISOString().split('T')[0]
      await redis.incr(`reviews:daily:${today}`)
      await redis.hincrby('reviews:by_rating', rating.toString(), 1)

      await review.load('user', (q) => q.select('id', 'full_name', 'email', 'avatar'))

      return response.created({
        success: true,
        data: review,
        message: 'Avis créé avec succès'
      })

    } catch (error: any) {
      console.error('❌ Erreur store:', error)
      return response.internalServerError({
        success: false,
        message: 'Erreur lors de la création de l\'avis',
        error: error.message
      })
    }
  }

  /**
   * 🔄 Mettre à jour un avis
   */
  async update({ params, request, response }: HttpContext) {
    try {
      const { id } = params
      const { userId, rating, title, comment, isAdmin } = request.only([
        'userId', 'rating', 'title', 'comment', 'isAdmin'
      ])

      const review = await Review.find(id)

      if (!review) {
        return response.notFound({
          success: false,
          message: 'Avis non trouvé'
        })
      }

      if (review.user_id !== userId && !isAdmin) {
        return response.forbidden({
          success: false,
          message: 'Vous n\'êtes pas autorisé à modifier cet avis'
        })
      }

      const oldRating = review.rating

      if (rating !== undefined) {
        if (rating < 1 || rating > 5) {
          return response.badRequest({
            success: false,
            message: 'La note doit être comprise entre 1 et 5'
          })
        }
        review.rating = rating
      }

      if (title !== undefined) review.title = title
      if (comment !== undefined) review.comment = comment

      await review.save()

      // 🗑️ Invalider les caches
      await this.invalidateProductCaches(review.product_id, review.merchant_id)
      await redis.del(this.getReviewCacheKey(id))

      // Mettre à jour la moyenne
      await this.updateProductAverageRating(review.product_id)

      // Mettre à jour les stats de notes
      if (oldRating !== review.rating) {
        await redis.hincrby('reviews:by_rating', oldRating.toString(), -1)
        await redis.hincrby('reviews:by_rating', review.rating.toString(), 1)
      }

      return response.ok({
        success: true,
        data: review,
        message: 'Avis mis à jour avec succès'
      })

    } catch (error: any) {
      console.error('❌ Erreur update:', error)
      return response.internalServerError({
        success: false,
        message: 'Erreur lors de la mise à jour de l\'avis',
        error: error.message
      })
    }
  }

  /**
   * ❌ Supprimer un avis
   */
  async destroy({ params, request, response }: HttpContext) {
    try {
      const { id } = params
      const { userId, isAdmin } = request.only(['userId', 'isAdmin'])

      const review = await Review.find(id)

      if (!review) {
        return response.notFound({
          success: false,
          message: 'Avis non trouvé'
        })
      }

      if (review.user_id !== userId && !isAdmin) {
        return response.forbidden({
          success: false,
          message: 'Vous n\'êtes pas autorisé à supprimer cet avis'
        })
      }

      const productId = review.product_id
      const merchantId = review.merchant_id
      const rating = review.rating

      await review.delete()

      // 🗑️ Invalider les caches
      await this.invalidateProductCaches(productId, merchantId)
      await redis.del(this.getReviewCacheKey(id))
      await redis.del(`review:exists:${review.user_id}:${productId}`)
      await redis.del(`review:helpful:${id}`)

      // Mettre à jour la moyenne
      await this.updateProductAverageRating(productId)

      // Mettre à jour les stats
      await redis.hincrby('reviews:by_rating', rating.toString(), -1)

      return response.ok({
        success: true,
        message: 'Avis supprimé avec succès'
      })

    } catch (error: any) {
      console.error('❌ Erreur destroy:', error)
      return response.internalServerError({
        success: false,
        message: 'Erreur lors de la suppression de l\'avis',
        error: error.message
      })
    }
  }

  /**
   * 👍 Voter pour un avis (utile) - optimisé avec Redis
   */
  async markHelpful({ params, request, response }: HttpContext) {
    try {
      const reviewId = params.id
      const userId = request.input('userId')
      const clientIp = request.ip()

      if (!userId) {
        return response.badRequest({
          success: false,
          message: 'userId requis'
        })
      }

      // Vérifier si l'utilisateur a déjà voté
      const voteKey = `review:helpful:voted:${reviewId}:${userId}`
      const hasVoted = await redis.get(voteKey)

      if (hasVoted) {
        return response.badRequest({
          success: false,
          message: 'Vous avez déjà voté pour cet avis'
        })
      }

      const review = await Review.find(reviewId)

      if (!review) {
        return response.notFound({
          success: false,
          message: 'Avis non trouvé'
        })
      }

      // Incrémenter dans Redis
      const newCount = await redis.incr(`review:helpful:${reviewId}`)
      await redis.set(voteKey, '1', 'EX', 86400 * 30) // 30 jours

      // Mettre à jour périodiquement en base (tous les 5 votes)
      if (newCount % 5 === 0) {
        review.helpful_count = newCount
        await review.save()
      }

      // Mettre à jour le classement des avis utiles
      await redis.zincrby('reviews:most_helpful', 1, reviewId.toString())

      // 🗑️ Invalider le cache de l'avis
      await redis.del(this.getReviewCacheKey(reviewId))

      return response.ok({
        success: true,
        message: 'Vote enregistré',
        helpful_count: newCount
      })

    } catch (error: any) {
      console.error('❌ Erreur markHelpful:', error)
      return response.internalServerError({
        success: false,
        message: 'Erreur lors du vote',
        error: error.message
      })
    }
  }

  /**
   * ✅ Approuver un avis (admin)
   */
  async approve({ params, response }: HttpContext) {
    try {
      const review = await Review.find(params.id)

      if (!review) {
        return response.notFound({
          success: false,
          message: 'Avis non trouvé'
        })
      }

      review.status = 'approved'
      await review.save()

      // Invalider les caches
      await this.invalidateProductCaches(review.product_id, review.merchant_id)
      await redis.del(this.getReviewCacheKey(params.id))

      // Mettre à jour la moyenne
      await this.updateProductAverageRating(review.product_id)
      await redis.hincrby('reviews:by_rating', review.rating.toString(), 1)

      return response.ok({
        success: true,
        message: 'Avis approuvé avec succès'
      })

    } catch (error: any) {
      console.error('❌ Erreur approve:', error)
      return response.internalServerError({
        success: false,
        message: 'Erreur lors de l\'approbation de l\'avis',
        error: error.message
      })
    }
  }

  /**
   * ❌ Rejeter un avis (admin)
   */
  async reject({ params, response }: HttpContext) {
    try {
      const review = await Review.find(params.id)

      if (!review) {
        return response.notFound({
          success: false,
          message: 'Avis non trouvé'
        })
      }

      review.status = 'rejected'
      await review.save()

      await redis.del(this.getReviewCacheKey(params.id))

      return response.ok({
        success: true,
        message: 'Avis rejeté'
      })

    } catch (error: any) {
      console.error('❌ Erreur reject:', error)
      return response.internalServerError({
        success: false,
        message: 'Erreur lors du rejet de l\'avis',
        error: error.message
      })
    }
  }

  /**
   * 👤 Récupérer les avis d'un utilisateur (avec cache)
   */
  async myReviews({ params, request, response }: HttpContext) {
    try {
      const userId = params.userId
      const page = request.input('page', 1)
      const limit = request.input('limit', 20)

      const cacheKey = `reviews:user:${userId}:${page}:${limit}`

      const cached = await redis.get(cacheKey)
      if (cached) {
        return response.ok({
          success: true,
          source: 'cache',
          data: JSON.parse(cached)
        })
      }

      const reviews = await Review.query()
        .where('user_id', userId)
        .preload('product', (q) => q.select('id', 'name', 'image_url', 'price'))
        .orderBy('created_at', 'desc')
        .paginate(page, limit)

      await redis.set(cacheKey, JSON.stringify(reviews), 'EX', this.CACHE_TTL.USER_REVIEWS)

      return response.ok({
        success: true,
        source: 'database',
        data: reviews
      })

    } catch (error: any) {
      console.error('❌ Erreur myReviews:', error)
      return response.internalServerError({
        success: false,
        message: 'Erreur lors de la récupération de vos avis',
        error: error.message
      })
    }
  }

  /**
   * 📊 Statistiques des avis
   */
  async stats({ request, response }: HttpContext) {
    try {
      const productId = request.input('product_id')
      const cacheKey = productId ? `reviews:stats:${productId}` : 'reviews:stats:global'

      const cached = await redis.get(cacheKey)
      if (cached) {
        return response.ok({
          success: true,
          source: 'cache',
          data: JSON.parse(cached)
        })
      }

      let stats: any = {}

      if (productId) {
        // Stats pour un produit spécifique
        const ratingData = await redis.get(this.getProductRatingCacheKey(productId))
        if (ratingData) {
          stats = JSON.parse(ratingData)
        }

        const distribution = await Review.query()
          .where('product_id', productId)
          .where('status', 'approved')
          .select('rating')
          .count('* as count')
          .groupBy('rating')

        stats.distribution = distribution.reduce((acc, curr) => {
          acc[curr.rating] = parseInt(curr.$extras.count)
          return acc
        }, {} as Record<number, number>)

      } else {
        // Stats globales
        const total = await Review.query().count('* as total')
        const approved = await Review.query().where('status', 'approved').count('* as total')
        const pending = await Review.query().where('status', 'pending').count('* as total')

        const avgRating = await Review.query()
          .where('status', 'approved')
          .avg('rating as avg')

        const byRating = await redis.hgetall('reviews:by_rating')

        const mostHelpful = await redis.zrevrange('reviews:most_helpful', 0, 4)
        const topRatedProducts = await redis.zrevrange('reviews:top_rated_products', 0, 4)

        stats = {
          total_reviews: parseInt(total[0].$extras.total) || 0,
          approved_reviews: parseInt(approved[0].$extras.total) || 0,
          pending_reviews: parseInt(pending[0].$extras.total) || 0,
          average_rating: parseFloat(avgRating[0].$extras.avg) || 0,
          by_rating: byRating,
          most_helpful_reviews: mostHelpful,
          top_rated_products: topRatedProducts
        }
      }

      await redis.set(cacheKey, JSON.stringify(stats), 'EX', this.CACHE_TTL.STATS)

      return response.ok({
        success: true,
        source: 'database',
        data: stats
      })

    } catch (error: any) {
      console.error('❌ Erreur stats:', error)
      return response.internalServerError({
        success: false,
        message: 'Erreur lors de la récupération des statistiques',
        error: error.message
      })
    }
  }

  /**
   * 🔧 Vérifier si un achat est vérifié
   */
  private async checkVerifiedPurchase(userId: number, productId: number): Promise<boolean> {
    // À implémenter avec le service de commandes
    const cacheKey = `purchase:verified:${userId}:${productId}`
    const cached = await redis.get(cacheKey)

    if (cached !== null) {
      return cached === 'true'
    }

    // TODO: Vérifier dans la table des commandes
    return false
  }
}
