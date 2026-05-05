// app/controllers/favorites_controller.ts
import type { HttpContext } from '@adonisjs/core/http'
import Favorite from '#models/favorite'

export default class FavoritesController {
  // Ajouter un produit aux favoris
  public async add({ request, response }: HttpContext) {
    const { userId, productId } = request.body()

    if (!userId || !productId) {
      return response.status(400).json({
        success: false,
        message: 'userId et productId sont requis'
      })
    }

    try {
      const existing = await Favorite.query()
        .where('user_id', userId)
        .andWhere('product_id', productId)
        .first()

      if (existing) {
        return response.status(400).json({
          success: false,
          message: 'Produit déjà dans les favoris'
        })
      }

      const favorite = await Favorite.create({
        user_id: userId,
        product_id: productId
      })

      return response.status(201).json({
        success: true,
        message: 'Produit ajouté aux favoris',
        data: favorite
      })
    } catch (error: any) {
      return response.status(500).json({
        success: false,
        message: 'Erreur lors de l\'ajout aux favoris',
        error: error.message
      })
    }
  }

  // Supprimer un produit des favoris
  public async remove({ request, params, response }: HttpContext) {
    try {
      // Récupérer les données soit du body POST, soit des params DELETE
      let userId, productId
      
      if (request.method() === 'POST') {
        const body = request.body()
        userId = body.userId
        productId = body.productId
      } else {
        // Pour les requêtes DELETE /api/favorites/userId/productId
        userId = params.userId
        productId = params.productId
      }

      if (!userId || !productId) {
        return response.status(400).json({
          success: false,
          message: 'userId et productId sont requis'
        })
      }

      const favorite = await Favorite.query()
        .where('user_id', userId)
        .andWhere('product_id', productId)
        .first()

      if (!favorite) {
        return response.status(404).json({
          success: false,
          message: 'Favori non trouvé'
        })
      }

      await favorite.delete()

      return response.json({
        success: true,
        message: 'Produit retiré des favoris'
      })
    } catch (error: any) {
      return response.status(500).json({
        success: false,
        message: 'Erreur lors du retrait des favoris',
        error: error.message
      })
    }
  }

  // Récupérer tous les favoris d'un utilisateur
  public async index({ request, params, response }: HttpContext) {
    try {
      // Supporter les deux formats : ?userId=... et /favorites/userId
      let userId = request.qs().userId || params.userId

      if (!userId) {
        return response.status(400).json({
          success: false,
          message: 'userId est requis'
        })
      }

      const favorites = await Favorite.query()
        .where('user_id', userId)
        .preload('product')
        .orderBy('created_at', 'desc')

      const products = favorites.map(fav => fav.product)

      return response.json({
        success: true,
        data: products
      })
    } catch (error: any) {
      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des favoris',
        error: error.message
      })
    }
  }

  // Vérifier si un produit est en favori
  public async check({ request, response }: HttpContext) {
    const { userId, productId } = request.qs()

    if (!userId || !productId) {
      return response.status(400).json({
        success: false,
        message: 'userId et productId sont requis'
      })
    }

    try {
      const favorite = await Favorite.query()
        .where('user_id', userId)
        .andWhere('product_id', productId)
        .first()

      return response.json({
        success: true,
        isFavorite: !!favorite
      })
    } catch (error: any) {
      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la vérification',
        error: error.message
      })
    }
  }
}
