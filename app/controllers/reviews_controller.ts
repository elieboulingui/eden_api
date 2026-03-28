import type { HttpContext } from '@adonisjs/core/http'
import Review from '#models/review'
import Product from '#models/Product'

export default class ReviewsController {
  async store({ request, response, auth }: HttpContext) {
    try {
      const user = auth.user
      if (!user) {
        return response.unauthorized({
          success: false,
          message: 'Utilisateur non authentifié'
        })
      }

      const { product_id, rating, comment } = request.only(['product_id', 'rating', 'comment'])

      // Validate required fields
      if (!product_id || !rating) {
        return response.badRequest({
          success: false,
          message: 'Product ID and rating are required'
        })
      }

      // Récupérer le produit pour obtenir l'ID du marchand
      const product = await Product.find(product_id)
      if (!product) {
        return response.notFound({
          success: false,
          message: 'Produit non trouvé'
        })
      }

      // Convert user_id to string if needed
      const merchantId = product.user_id ? product.user_id.toString() : null

      // Créer l'avis avec l'ID du marchand
      const review = await Review.create({
        user_id: user.id,
        product_id: product_id,
        merchant_id: merchantId, // Convert to string
        rating: rating,
        comment: comment || null,
      })

      return response.created({
        success: true,
        data: review,
        message: 'Avis créé avec succès'
      })

    } catch (error) {
      console.error('Error creating review:', error)
      return response.internalServerError({
        success: false,
        message: 'Erreur lors de la création de l\'avis',
        error: error.message,
      })
    }
  }

  // Optional: Add method to get reviews for a product
  async index({ params, response }: HttpContext) {
    try {
      const { product_id } = params
      
      const reviews = await Review.query()
        .where('product_id', product_id)
        .preload('user', (query) => {
          query.select('id', 'full_name', 'avatar')
        })
        .orderBy('created_at', 'desc')

      return response.ok({
        success: true,
        data: reviews
      })
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Erreur lors de la récupération des avis',
        error: error.message
      })
    }
  }

  // Optional: Add method to update a review
  async update({ params, request, response, auth }: HttpContext) {
    try {
      const user = auth.user
      const { id } = params
      const { rating, comment } = request.only(['rating', 'comment'])

      const review = await Review.find(id)
      
      if (!review) {
        return response.notFound({
          success: false,
          message: 'Avis non trouvé'
        })
      }

      // Check if the review belongs to the user
      if (review.user_id !== user?.id) {
        return response.forbidden({
          success: false,
          message: 'Vous n\'êtes pas autorisé à modifier cet avis'
        })
      }

      review.rating = rating || review.rating
      review.comment = comment !== undefined ? comment : review.comment
      await review.save()

      return response.ok({
        success: true,
        data: review,
        message: 'Avis mis à jour avec succès'
      })
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Erreur lors de la mise à jour de l\'avis',
        error: error.message
      })
    }
  }

  // Optional: Add method to delete a review
  async destroy({ params, response, auth }: HttpContext) {
    try {
      const user = auth.user
      const { id } = params

      const review = await Review.find(id)
      
      if (!review) {
        return response.notFound({
          success: false,
          message: 'Avis non trouvé'
        })
      }

      // Check if the review belongs to the user or user is admin
      if (review.user_id !== user?.id && user?.role !== 'admin' && user?.role !== 'superadmin') {
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
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Erreur lors de la suppression de l\'avis',
        error: error.message
      })
    }
  }
}