// app/controllers/favorites_controller.ts
import type { HttpContext } from '@adonisjs/core/http'
import Favorite from '#models/favorite'

export default class FavoritesController {
  
  // Ajouter un produit aux favoris
  public async add({ request, response }: HttpContext) {
    try {
      const body = request.body()
      const userId = body.userId || body.user_id
      const productId = body.productId || body.product_id

      if (!userId || !productId) {
        return response.status(400).json({
          success: false,
          message: 'userId et productId sont requis',
          received: { userId, productId }
        })
      }

      // Vérifier si le favori existe déjà
      const existing = await Favorite.query()
        .where('user_id', userId)
        .andWhere('product_id', productId)
        .first()

      if (existing) {
        return response.status(200).json({
          success: true,
          message: 'Produit déjà dans les favoris',
          data: existing
        })
      }

      // Créer le favori
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
      console.error('❌ Erreur add favorite:', error)
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
      let userId, productId

      // Essayer de récupérer depuis le body
      const body = request.body()
      if (body) {
        userId = body.userId || body.user_id
        productId = body.productId || body.product_id
      }

      // Si pas dans le body, essayer les query params
      if (!userId || !productId) {
        const qs = request.qs()
        userId = qs.userId || qs.user_id
        productId = qs.productId || qs.product_id
      }

      // Si toujours pas, essayer les params d'URL
      if (!userId || !productId) {
        userId = params.userId || params.user_id
        productId = params.productId || params.product_id
      }

      // Si on a un id dans les params et pas de productId, utiliser cet id comme productId
      if (!productId && params.id) {
        productId = params.id
      }

      console.log('🗑️ Remove favorite:', { userId, productId, method: request.method(), url: request.url() })

      if (!userId || !productId) {
        return response.status(400).json({
          success: false,
          message: 'userId et productId sont requis',
          received: { userId, productId, params: params }
        })
      }

      // Chercher le favori
      const favorite = await Favorite.query()
        .where('user_id', userId)
        .andWhere('product_id', productId)
        .first()

      if (!favorite) {
        // Si pas trouvé, on retourne quand même un succès pour éviter les erreurs
        return response.status(200).json({
          success: true,
          message: 'Favori déjà supprimé ou inexistant'
        })
      }

      await favorite.delete()

      return response.status(200).json({
        success: true,
        message: 'Produit retiré des favoris'
      })
    } catch (error: any) {
      console.error('❌ Erreur remove favorite:', error)
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
      // Récupérer userId de différentes sources
      let userId = request.qs().userId || params.userId

      console.log('📋 Get favorites:', { userId, url: request.url() })

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

      // Extraire les produits en évitant les propriétés qui n'existent pas
      const products = favorites.map(fav => {
        const product = fav.product as any // Utiliser any pour éviter les erreurs de type
        if (!product) return null
        
        // Construire l'objet produit avec les propriétés disponibles
        return {
          id: product.id,
          name: product.name,
          price: product.price,
          description: product.description,
          stock: product.stock,
          category: product.category,
          // Utiliser les propriétés d'image disponibles
          image: product.imageUrl2 || product.imageUrl || product.image_url || product.image || null,
          imageUrl: product.imageUrl2 || product.imageUrl || product.image_url || product.image || null,
          image_url: product.imageUrl2 || product.imageUrl || product.image_url || product.image || null,
        }
      }).filter(Boolean)

      console.log('✅ Favorites found:', products.length)

      return response.status(200).json({
        success: true,
        data: products
      })
    } catch (error: any) {
      console.error('❌ Erreur index favorites:', error)
      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des favoris',
        error: error.message
      })
    }
  }

  // Vérifier si un produit est en favori
  public async check({ request, response }: HttpContext) {
    try {
      const qs = request.qs()
      const userId = qs.userId
      const productId = qs.productId

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

      return response.status(200).json({
        success: true,
        isFavorite: !!favorite
      })
    } catch (error: any) {
      console.error('❌ Erreur check favorite:', error)
      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la vérification',
        error: error.message
      })
    }
  }
}
