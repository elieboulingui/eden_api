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
        .preload('user')
        .preload('categoryRelation')
        .first()

      if (!product) {
        return response.status(404).send('Produit non trouvé')
      }

      return view.render('pages/product/show', { product })
    } catch (error) {
      return response.status(404).send('Produit non trouvé')
    }
  }

  async index({ response }: HttpContext) {
    try {
      const allProducts = await Product
        .query()
        .preload('user', (query) => {
          query.select(['id', 'full_name', 'country'])
        })
        .preload('categoryRelation') // ✅ CHARGER LA CATÉGORIE

      const oneWeekAgo = DateTime.now().minus({ weeks: 1 })

      for (const product of allProducts) {
        const createdAt = DateTime.fromJSDate(product.createdAt.toJSDate())
        if (createdAt < oneWeekAgo && product.isNew === true) {
          product.isNew = false
          await product.save()
        }
      }

      const products = allProducts.filter(product => product.isArchived === false)

      // ✅ AJOUTER categoryName
      const data = products.map((product) => {
        const json = product.toJSON()
        return {
          ...json,
          categoryName: product.categoryRelation?.name || null
        }
      })

      return response.status(200).json({
        success: true,
        data: data,
        count: data.length
      })
    } catch (error: any) {
      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des produits',
        error: error.message
      })
    }
  }

  async show({ params, response }: HttpContext) {
    try {
      const product = await Product
        .query()
        .where('id', params.id)
        .preload('user', (query) => {
          query.select(['id', 'full_name', 'country'])
        })
        .preload('categoryRelation') // ✅ CHARGER LA CATÉGORIE
        .firstOrFail()

      if (product.isArchived === true) {
        return response.status(404).json({
          success: false,
          message: 'Produit non trouvé'
        })
      }

      const oneWeekAgo = DateTime.now().minus({ weeks: 1 })
      const createdAt = DateTime.fromJSDate(product.createdAt.toJSDate())

      if (createdAt < oneWeekAgo && product.isNew === true) {
        product.isNew = false
        await product.save()
      }

      // ✅ AJOUTER categoryName
      const json = product.toJSON()
      const data = {
        ...json,
        categoryName: product.categoryRelation?.name || null
      }

      return response.status(200).json({
        success: true,
        data: data
      })
    } catch {
      return response.status(404).json({
        success: false,
        message: 'Produit non trouvé'
      })
    }
  }

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

      const productData = {
        ...data,
        isArchived: false
      }

      const product = await Product.create(productData)
      await product.load('user', (query) => {
        query.select(['id', 'full_name', 'country'])
      })
      await product.load('categoryRelation')

      const json = product.toJSON()
      const result = {
        ...json,
        categoryName: product.categoryRelation?.name || null
      }

      return response.status(201).json({
        success: true,
        message: 'Produit créé avec succès',
        data: result
      })
    } catch (error: any) {
      return response.status(400).json({
        success: false,
        message: 'Erreur lors de la création du produit',
        error: error.message
      })
    }
  }

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
      await product.load('user', (query) => {
        query.select(['id', 'full_name', 'country'])
      })
      await product.load('categoryRelation')

      const json = product.toJSON()
      const result = {
        ...json,
        categoryName: product.categoryRelation?.name || null
      }

      return response.status(200).json({
        success: true,
        message: 'Produit mis à jour avec succès',
        data: result
      })
    } catch (error: any) {
      return response.status(400).json({
        success: false,
        message: 'Erreur lors de la mise à jour du produit',
        error: error.message
      })
    }
  }

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
