import type { HttpContext } from '@adonisjs/core/http'
import Review from '#models/review'
import Product from '#models/Product'

export default class ReviewsController {
  /**
   * Récupérer tous les avis d'un produit
   * GET /api/reviews/product/:productId
   */
  async getProductReviews({ params, response }: HttpContext) {
    try {
      const productId = params.productId

      const reviews = await Review.query()
        .where('product_id', productId)
        .where('status', 'approved')
        .preload('user', (query) => {
          query.select('id', 'full_name', 'email', 'avatar')
        })
        .orderBy('created_at', 'desc')

      const avgResult = await Review.query()
        .where('product_id', productId)
        .where('status', 'approved')
        .avg('rating as average')

      const averageRating = avgResult[0]?.$extras?.average
        ? Number.parseFloat(avgResult[0].$extras.average)
        : 0

      const totalReviews = reviews.length

      return response.ok({
        success: true,
        data: reviews,
        meta: {
          averageRating: Math.round(averageRating * 10) / 10,
          totalReviews
        }
      })
    } catch (error: any) {
      console.error('Erreur getProductReviews:', error)
      return response.internalServerError({
        success: false,
        message: 'Erreur lors de la récupération des avis',
        error: error.message
      })
    }
  }

  /**
   * Récupérer tous les avis d'un marchand
   * GET /api/reviews/merchant/:merchantId
   */
  async getMerchantReviews({ params, response }: HttpContext) {
    try {
      const merchantId = params.merchantId

      const reviews = await Review.query()
        .where('merchant_id', merchantId)
        .where('status', 'approved')
        .preload('user', (query) => {
          query.select('id', 'full_name', 'email', 'avatar')
        })
        .preload('product', (query) => {
          query.select('id', 'name', 'image_url', 'price')
        })
        .orderBy('created_at', 'desc')

      const avgResult = await Review.query()
        .where('merchant_id', merchantId)
        .where('status', 'approved')
        .avg('rating as average')

      const averageRating = avgResult[0]?.$extras?.average
        ? Number.parseFloat(avgResult[0].$extras.average)
        : 0

      return response.ok({
        success: true,
        data: reviews,
        meta: {
          averageRating: Math.round(averageRating * 10) / 10,
          totalReviews: reviews.length
        }
      })
    } catch (error: any) {
      console.error('Erreur getMerchantReviews:', error)
      return response.internalServerError({
        success: false,
        message: 'Erreur lors de la récupération des avis du marchand',
        error: error.message
      })
    }
  }

  /**
   * Récupérer tous les avis (admin)
   * GET /api/reviews?userId=xxx
   */
  async index({ request, response }: HttpContext) {
    try {
      const userId = request.input('userId')
      const page = request.input('page', 1)
      const limit = request.input('limit', 20)
      const status = request.input('status')

      // Vérifier si l'utilisateur est admin (via un champ dans la requête ou autre)
      const isAdmin = request.input('isAdmin') === 'true'

      const query = Review.query()
        .preload('user', (q) => q.select('id', 'full_name', 'email', 'avatar'))
        .preload('product', (q) => q.select('id', 'name', 'image_url'))
        .orderBy('created_at', 'desc')

      if (!isAdmin) {
        // Si pas admin, filtrer par utilisateur
        if (userId) {
          query.where('user_id', userId)
        }
      }

      if (status) {
        query.where('status', status)
      }

      const reviews = await query.paginate(page, limit)

      return response.ok({
        success: true,
        data: reviews
      })
    } catch (error: any) {
      console.error('Erreur index:', error)
      return response.internalServerError({
        success: false,
        message: 'Erreur lors de la récupération des avis',
        error: error.message
      })
    }
  }

  /**
   * Récupérer un avis spécifique
   * GET /api/reviews/:id
   */
  async show({ params, response }: HttpContext) {
    try {
      const review = await Review.find(params.id)

      if (!review) {
        return response.notFound({
          success: false,
          message: 'Avis non trouvé'
        })
      }

      await review.load('user', (query) => {
        query.select('id', 'full_name', 'email', 'avatar')
      })
      await review.load('product', (query) => {
        query.select('id', 'name', 'image_url', 'price')
      })

      return response.ok({
        success: true,
        data: review
      })
    } catch (error: any) {
      console.error('Erreur show:', error)
      return response.internalServerError({
        success: false,
        message: 'Erreur lors de la récupération de l\'avis',
        error: error.message
      })
    }
  }

  /**
   * Créer un nouvel avis
   * POST /api/reviews
   * Body: { userId, product_id, rating, title?, comment? }
   */
  async store({ request, response }: HttpContext) {
    try {
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

      // Vérifier si le produit existe
      const product = await Product.find(product_id)
      if (!product) {
        return response.notFound({
          success: false,
          message: 'Produit non trouvé'
        })
      }

      // Vérifier si l'utilisateur a déjà donné un avis pour ce produit
      const existingReview = await Review.query()
        .where('user_id', userId)
        .where('product_id', product_id)
        .first()

      if (existingReview) {
        return response.badRequest({
          success: false,
          message: 'Vous avez déjà donné votre avis sur ce produit'
        })
      }

      // Créer l'avis
      const review = await Review.create({
        user_id: userId,
        product_id: product_id,
        merchant_id: product.user_id || null,
        rating: rating,
        title: title || null,
        comment: comment || null,
        status: 'approved',
        is_verified_purchase: false,
        helpful_count: 0,
      })

      await review.load('user', (query) => {
        query.select('id', 'full_name', 'email', 'avatar')
      })

      return response.created({
        success: true,
        data: review,
        message: 'Avis créé avec succès'
      })

    } catch (error: any) {
      console.error('Erreur store:', error)
      return response.internalServerError({
        success: false,
        message: 'Erreur lors de la création de l\'avis',
        error: error.message
      })
    }
  }

  /**
   * Mettre à jour un avis
   * PUT /api/reviews/:id
   * Body: { userId, rating?, title?, comment? }
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

      // Vérifier les permissions
      if (review.user_id !== userId && !isAdmin) {
        return response.forbidden({
          success: false,
          message: 'Vous n\'êtes pas autorisé à modifier cet avis'
        })
      }

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

      return response.ok({
        success: true,
        data: review,
        message: 'Avis mis à jour avec succès'
      })
    } catch (error: any) {
      console.error('Erreur update:', error)
      return response.internalServerError({
        success: false,
        message: 'Erreur lors de la mise à jour de l\'avis',
        error: error.message
      })
    }
  }

  /**
   * Supprimer un avis
   * DELETE /api/reviews/:id
   * Body: { userId, isAdmin? }
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

      // Vérifier les permissions
      if (review.user_id !== userId && !isAdmin) {
        return response.forbidden({
          success: false,
          message: 'Vous n\'êtes pas autorisé à supprimer cet avis'
        })
      }

      await review.delete()

      return response.ok({
        success: true,
        message: 'Avis supprimé avec succès'
      })
    } catch (error: any) {
      console.error('Erreur destroy:', error)
      return response.internalServerError({
        success: false,
        message: 'Erreur lors de la suppression de l\'avis',
        error: error.message
      })
    }
  }

  /**
   * Voter pour un avis (utile)
   * POST /api/reviews/:id/helpful
   */
  async markHelpful({ params, response }: HttpContext) {
    try {
      const review = await Review.find(params.id)

      if (!review) {
        return response.notFound({
          success: false,
          message: 'Avis non trouvé'
        })
      }

      review.helpful_count = (review.helpful_count || 0) + 1
      await review.save()

      return response.ok({
        success: true,
        message: 'Vote enregistré',
        helpful_count: review.helpful_count
      })
    } catch (error: any) {
      console.error('Erreur markHelpful:', error)
      return response.internalServerError({
        success: false,
        message: 'Erreur lors du vote',
        error: error.message
      })
    }
  }

  /**
   * Approuver un avis (admin)
   * PATCH /api/reviews/:id/approve
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

      return response.ok({
        success: true,
        message: 'Avis approuvé avec succès'
      })
    } catch (error: any) {
      console.error('Erreur approve:', error)
      return response.internalServerError({
        success: false,
        message: 'Erreur lors de l\'approbation de l\'avis',
        error: error.message
      })
    }
  }

  /**
   * Rejeter un avis (admin)
   * PATCH /api/reviews/:id/reject
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

      return response.ok({
        success: true,
        message: 'Avis rejeté'
      })
    } catch (error: any) {
      console.error('Erreur reject:', error)
      return response.internalServerError({
        success: false,
        message: 'Erreur lors du rejet de l\'avis',
        error: error.message
      })
    }
  }

  /**
   * Récupérer les avis d'un utilisateur
   * GET /api/reviews/user/:userId
   */
  async myReviews({ params, response }: HttpContext) {
    try {
      const userId = params.userId

      const reviews = await Review.query()
        .where('user_id', userId)
        .preload('product', (query) => {
          query.select('id', 'name', 'image_url', 'price')
        })
        .orderBy('created_at', 'desc')

      return response.ok({
        success: true,
        data: reviews
      })
    } catch (error: any) {
      console.error('Erreur myReviews:', error)
      return response.internalServerError({
        success: false,
        message: 'Erreur lors de la récupération de vos avis',
        error: error.message
      })
    }
  }
}
