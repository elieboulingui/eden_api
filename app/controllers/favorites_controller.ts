// app/controllers/favorites_controller.ts
import type { HttpContext } from '@adonisjs/core/http'
import Favorite from '#models/favorite'  // Note: Majuscule pour cohérence

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
      // Vérifier si le favori existe déjà
      const existing = await Favorite.query()
        .where('user_id', userId)  // snake_case
        .andWhere('product_id', productId)  // snake_case
        .first()

      if (existing) {
        return response.status(400).json({
          success: false,
          message: 'Produit déjà dans les favoris'
        })
      }

      // Créer le favori - utiliser snake_case
      const favorite = await Favorite.create({
        user_id: userId,  // Changé de userId à user_id
        product_id: productId  // Changé de productId à product_id
      })

      return response.status(201).json({
        success: true,
        message: 'Produit ajouté aux favoris',
        data: favorite
      })
    } catch (error) {
      return response.status(500).json({
        success: false,
        message: 'Erreur lors de l\'ajout aux favoris',
        error: error.message
      })
    }
  }

  // Supprimer un produit des favoris
  public async remove({ request, response }: HttpContext) {
    const { userId, productId } = request.body()

    if (!userId || !productId) {
      return response.status(400).json({
        success: false,
        message: 'userId et productId sont requis'
      })
    }

    try {
      const favorite = await Favorite.query()
        .where('user_id', userId)  // snake_case
        .andWhere('product_id', productId)  // snake_case
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
    } catch (error) {
      return response.status(500).json({
        success: false,
        message: 'Erreur lors du retrait des favoris',
        error: error.message
      })
    }
  }

  // Récupérer tous les favoris d'un utilisateur
  public async index({ request, response }: HttpContext) {
    const { userId } = request.qs()

    if (!userId) {
      return response.status(400).json({
        success: false,
        message: 'userId est requis'
      })
    }

    try {
      const favorites = await Favorite.query()
        .where('user_id', userId)  // snake_case
        .preload('product')
        .orderBy('created_at', 'desc')

      const products = favorites.map(fav => fav.product)

      return response.json({
        success: true,
        data: products
      })
    } catch (error) {
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
        .where('user_id', userId)  // snake_case
        .andWhere('product_id', productId)  // snake_case
        .first()

      return response.json({
        success: true,
        isFavorite: !!favorite
      })
    } catch (error) {
      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la vérification',
        error: error.message
      })
    }
  }
}