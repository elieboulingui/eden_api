// app/controllers/reviews_controller.ts (exemple)
import type { HttpContext } from '@adonisjs/core/http'
import Review from '#models/review'
import Product from '#models/product'

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

      // Récupérer le produit pour obtenir l'ID du marchand
      const product = await Product.find(product_id)
      if (!product) {
        return response.notFound({
          success: false,
          message: 'Produit non trouvé'
        })
      }

      // Créer l'avis avec l'ID du marchand
      const review = await Review.create({
        user_id: user.id,
        product_id,
        merchant_id: product.user_id, // Ajout automatique du marchand
        rating,
        comment,
      })

      return response.created({
        success: true,
        data: review,
      })

    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Erreur lors de la création de l\'avis',
        error: error.message,
      })
    }
  }
}
