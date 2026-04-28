// app/controllers/products_controller.ts
import type { HttpContext } from '@adonisjs/core/http'
import Product from '#models/Product'
import { DateTime } from 'luxon'

export default class ProductsController {

  async showWeb({ params, view, response }: HttpContext) {
    try {
      const product = await Product.query()
        .where('id', params.id)
        .where('isArchived', false)
        .preload('user') // Important : charge les infos du vendeur
        .first()

      if (!product) {
        return response.status(404).send('Produit non trouvé')
      }

      return view.render('pages/product/show', { product })
    } catch (error) {
      return response.status(404).send('Produit non trouvé')
    }
  }

  // 🔥 Récupérer tous les produits non archivés + pays du vendeur
  async index({ response }: HttpContext) {
    try {
      // Récupérer tous les produits (même archivés pour mise à jour de isNew)
      const allProducts = await Product
        .query()
        .preload('user', (query) => {
          query.select(['id', 'full_name', 'country'])
        })

      // Date d'il y a une semaine
      const oneWeekAgo = DateTime.now().minus({ weeks: 1 })

      // Mettre à jour le statut "isNew" si nécessaire
      for (const product of allProducts) {
        const createdAt = DateTime.fromJSDate(product.createdAt.toJSDate())

        // Si le produit a plus d'une semaine et est toujours marqué comme nouveau
        if (createdAt < oneWeekAgo && product.isNew === true) {
          product.isNew = false
          await product.save()
        }
      }

      // Filtrer uniquement les produits non archivés
      const products = allProducts.filter(product => product.isArchived === false)

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

  // 🔥 Récupérer un produit non archivé + pays du vendeur
  async show({ params, response }: HttpContext) {
    try {
      const product = await Product
        .query()
        .where('id', params.id)
        .preload('user', (query) => {
          query.select(['id', 'full_name', 'country'])
        })
        .firstOrFail()

      // Vérifier si le produit est archivé
      if (product.isArchived === true) {
        return response.status(404).json({
          success: false,
          message: 'Produit non trouvé'
        })
      }

      // Mettre à jour le statut "isNew" si nécessaire
      const oneWeekAgo = DateTime.now().minus({ weeks: 1 })
      const createdAt = DateTime.fromJSDate(product.createdAt.toJSDate())

      if (createdAt < oneWeekAgo && product.isNew === true) {
        product.isNew = false
        await product.save()
      }

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

      // Par défaut, un nouveau produit n'est pas archivé
      const productData = {
        ...data,
        isArchived: false
      }

      const product = await Product.create(productData)

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

      // Vérifier si le produit n'est pas archivé
      if (product.isArchived === true) {
        return response.status(400).json({
          success: false,
          message: 'Impossible de modifier un produit archivé'
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

  // 🔥 Archiver un produit (méthode destroy qui archive au lieu de supprimer)
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
          message: 'Vous n\'êtes pas autorisé à archiver ce produit'
        })
      }

      // Archiver le produit au lieu de le supprimer
      product.isArchived = true
      await product.save()

      return response.status(200).json({
        success: true,
        message: 'Produit archivé avec succès'
      })
    } catch (error: any) {
      return response.status(400).json({
        success: false,
        message: 'Erreur lors de l\'archivage du produit',
        error: error.message
      })
    }
  }
}
