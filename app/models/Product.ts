// app/controllers/products_controller.ts
import type { HttpContext } from '@adonisjs/core/http'
import Product from '#models/Product'
import { DateTime } from 'luxon'

export default class ProductsController {

  /**
   * Vérifier et mettre à jour le statut "isNew" d'un produit
   * Si le produit a plus de 7 jours, isNew devient false
   */
  private async checkAndUpdateNewStatus(product: Product): Promise<Product> {
    const createdAt = product.createdAt instanceof Date
      ? DateTime.fromJSDate(product.createdAt)
      : DateTime.fromISO(product.createdAt.toString())

    const daysSinceCreation = Math.floor(DateTime.now().diff(createdAt, 'days').days)

    // Si le produit a plus de 7 jours et qu'il est encore marqué comme nouveau
    if (daysSinceCreation >= 7 && product.isNew === true) {
      product.isNew = false
      await product.save()
      console.log(`✅ Produit ${product.id} : isNew mis à false après ${daysSinceCreation} jours`)
    }

    return product
  }

  /**
   * Vérifier et mettre à jour le statut "isNew" pour plusieurs produits
   */
  private async checkAndUpdateNewStatusForMany(products: Product[]): Promise<Product[]> {
    const updatedProducts: Product[] = []

    for (const product of products) {
      const updatedProduct = await this.checkAndUpdateNewStatus(product)
      updatedProducts.push(updatedProduct)
    }

    return updatedProducts
  }

  // 🔥 Récupérer tous les produits + pays du vendeur
  async index({ response }: HttpContext) {
    try {
      const products = await Product
        .query()
        .preload('user', (query) => {
          query.select(['id', 'full_name', 'country'])
        })

      // Vérifier et mettre à jour le statut "isNew" pour chaque produit
      const updatedProducts = await this.checkAndUpdateNewStatusForMany(products)

      return response.status(200).json({
        success: true,
        data: updatedProducts,
        count: updatedProducts.length
      })
    } catch (error: any) {
      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des produits',
        error: error.message
      })
    }
  }

  // 🔥 Récupérer les produits nouveaux uniquement
  async newProducts({ response }: HttpContext) {
    try {
      const products = await Product
        .query()
        .where('is_new', true)
        .preload('user', (query) => {
          query.select(['id', 'full_name', 'country'])
        })

      // Vérifier et mettre à jour le statut "isNew" pour chaque produit
      const updatedProducts = await this.checkAndUpdateNewStatusForMany(products)

      // Filtrer pour ne garder que ceux qui sont encore nouveaux
      const trulyNewProducts = updatedProducts.filter(p => p.isNew === true)

      return response.status(200).json({
        success: true,
        data: trulyNewProducts,
        count: trulyNewProducts.length
      })
    } catch (error: any) {
      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des nouveaux produits',
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

      // Vérifier et mettre à jour le statut "isNew"
      const updatedProduct = await this.checkAndUpdateNewStatus(product)

      return response.status(200).json({
        success: true,
        data: updatedProduct
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
        'packaging', 'conservation', 'isNew', 'is_on_sale'
      ])

      if (!data.user_id) {
        return response.status(400).json({
          success: false,
          message: 'L\'ID de l\'utilisateur est requis'
        })
      }

      // Par défaut, un nouveau produit est marqué comme nouveau
      if (data.isNew === undefined) {
        data.isNew = true
      }

      const product = await Product.create(data)

      // 🔥 Recharge avec le pays
      await product.load('user', (query) => {
        query.select(['id', 'full_name', 'country'])
      })

      return response.status(201).json({
        success: true,
        message: 'Produit créé avec succès',
        data: product,
        info: {
          isNewUntil: DateTime.now().plus({ days: 7 }).toFormat('dd/MM/yyyy HH:mm')
        }
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
          message: 'Vous n\'êtes pas autorisé  à modifier ce produit'
        })
      }

      const data = request.only([
        'name', 'price', 'old_price', 'description', 'stock',
        'image_url', 'category', 'origin', 'weight',
        'packaging', 'conservation', 'isNew', 'is_on_sale'
      ])

      product.merge(data)
      await product.save()

      // 🔥 Vérifier le statut "isNew" après mise à jour
      const updatedProduct = await this.checkAndUpdateNewStatus(product)

      // 🔥 Charger le pays
      await updatedProduct.load('user', (query) => {
        query.select(['id', 'full_name', 'country'])
      })

      return response.status(200).json({
        success: true,
        message: 'Produit mis à jour avec succès',
        data: updatedProduct
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

  /**
   * Tâche CRON à exécuter quotidiennement pour mettre à jour tous les produits
   * Cette méthode peut être appelée par un scheduler
   * Exemple : 0 0 * * * (tous les jours à minuit)
   */
  async updateAllProductsNewStatus({ response }: HttpContext) {
    try {
      // Récupérer tous les produits marqués comme nouveaux
      const products = await Product
        .query()
        .where('is_new', true)

      let updatedCount = 0

      for (const product of products) {
        const createdAt = product.createdAt instanceof Date
          ? DateTime.fromJSDate(product.createdAt)
          : DateTime.fromISO(product.createdAt.toString())

        const daysSinceCreation = Math.floor(DateTime.now().diff(createdAt, 'days').days)

        if (daysSinceCreation >= 7) {
          product.isNew = false
          await product.save()
          updatedCount++
        }
      }

      return response.status(200).json({
        success: true,
        message: `Mise à jour terminée : ${updatedCount} produit(s) ne sont plus marqués comme nouveaux`,
        data: {
          total_checked: products.length,
          updated: updatedCount
        }
      })
    } catch (error: any) {
      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la mise à jour des statuts des produits',
        error: error.message
      })
    }
    
  }
}