// app/controllers/products_controller.ts
import type { HttpContext } from '@adonisjs/core/http'
import Product from '#models/Product'

export default class ProductsController {

  // 🔥 Récupérer tous les produits + pays du vendeur
  async index({ response }: HttpContext) {
    try {
      const products = await Product
        .query()
        .preload('user', (query) => {
          query.select(['id', 'full_name', 'country'])
        })

      return response.status(200).json({
        success: true,
        data: products,
        count: products.length
      })
    } catch (error: any) {
      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des produits',
        error: error.message
      })
    }
  }

  // 🔥 Récupérer un produit + pays du vendeur
  async show({ params, response }: HttpContext) {
    try {
      const product = await Product
        .query()
        .where('id', params.id)
        .preload('user', (query) => {
          query.select(['id', 'full_name', 'country'])
        })
        .firstOrFail()

      return response.status(200).json({
        success: true,
        data: product
      })
    } catch {
      return response.status(404).json({
        success: false,
        message: 'Produit non trouvé'
      })
    }
  }

  // 🔥 Créer un produit
  async store({ request, response }: HttpContext) {
    try {
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

      // 🔥 Recharge avec le pays
      await product.load('user', (query) => {
        query.select(['id', 'full_name', 'country'])
      })

      return response.status(201).json({
        success: true,
        message: 'Produit créé avec succès',
        data: product
      })
    } catch (error: any) {
      return response.status(400).json({
        success: false,
        message: 'Erreur lors de la création du produit',
        error: error.message
      })
    }
  }

  // 🔥 Mettre à jour
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

      const data = request.only([
        'name', 'price', 'old_price', 'description', 'stock',
        'image_url', 'category', 'origin', 'weight',
        'packaging', 'conservation', 'is_new', 'is_on_sale'
      ])

      product.merge(data)
      await product.save()

      // 🔥 Charger le pays
      await product.load('user', (query) => {
        query.select(['id', 'full_name', 'country'])
      })

      return response.status(200).json({
        success: true,
        message: 'Produit mis à jour avec succès',
        data: product
      })
    } catch (error: any) {
      return response.status(400).json({
        success: false,
        message: 'Erreur lors de la mise à jour du produit',
        error: error.message
      })
    }
  }

  // 🔥 Supprimer
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

      await product.delete()

      return response.status(200).json({
        success: true,
        message: 'Produit supprimé avec succès'
      })
    } catch (error: any) {
      return response.status(400).json({
        success: false,
        message: 'Erreur lors de la suppression du produit',
        error: error.message
      })
    }
  }
}
