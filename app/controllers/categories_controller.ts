import type { HttpContext } from '@adonisjs/core/http'
import Category from '#models/categories'
import Product from '#models/Product'

export default class CategoriesController {
  async index({ response }: HttpContext) {
    try {
      const categories = await Category.query()
        .where('is_active', true)
        .orderBy('sort_order', 'asc')
        .preload('subCategories', (query) => {
          query.where('is_active', true).orderBy('sort_order', 'asc')
        })

      return response.status(200).json({
        success: true,
        data: categories,
        count: categories.length,
      })
    } catch (error) {
      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des catégories',
        error: error.message,
      })
    }
  }

  async show({ params, response }: HttpContext) {
    try {
      const category = await Category.query()
        .where('slug', params.slug)
        .where('is_active', true)
        .preload('subCategories', (query) => {
          query.where('is_active', true).orderBy('sort_order', 'asc')
        })
        .preload('products', (query) => {
          query.where('stock', '>', 0).limit(12)
        })
        .firstOrFail()

      return response.status(200).json({
        success: true,
        data: category,
      })
    } catch {
      return response.status(404).json({
        success: false,
        message: 'Catégorie non trouvée',
      })
    }
  }

  async store({ request, response }: HttpContext) {
    try {
      const data = request.only(['name', 'slug', 'description', 'sort_order', 'is_active', 'user_id'])
      const category = await Category.create(data)

      return response.status(201).json({
        success: true,
        message: 'Catégorie créée avec succès',
        data: category,
      })
    } catch (error) {
      return response.status(400).json({
        success: false,
        message: 'Erreur lors de la création de la catégorie',
        error: error.message,
      })
    }
  }

  async update({ params, request, response }: HttpContext) {
    try {
      const category = await Category.findOrFail(params.id)
      const data = request.only(['name', 'slug', 'description', 'sort_order', 'is_active'])
      category.merge(data)
      await category.save()

      return response.status(200).json({
        success: true,
        message: 'Catégorie mise à jour avec succès',
        data: category,
      })
    } catch (error) {
      return response.status(400).json({
        success: false,
        message: 'Erreur lors de la mise à jour de la catégorie',
        error: error.message,
      })
    }
  }

  async destroy({ params, response }: HttpContext) {
    try {
      const category = await Category.findOrFail(params.id)
      await category.delete()

      return response.status(200).json({
        success: true,
        message: 'Catégorie supprimée avec succès',
      })
    } catch (error) {
      return response.status(400).json({
        success: false,
        message: 'Erreur lors de la suppression de la catégorie',
        error: error.message,
      })
    }
  }

  async createProduct({ params, request, response }: HttpContext) {
    try {
      const category = await Category.findOrFail(params.id)
      const data = request.only([
        'name',
        'price',
        'description',
        'stock',
        'image_url',
        'origin',
        'weight',
        'packaging',
        'conservation',
        'is_new',
        'is_on_sale',
        'user_id',
      ])

      const product = await Product.create({
        ...data,
        category_id: category.id,
      })

      return response.status(201).json({
        success: true,
        message: 'Produit créé dans la catégorie avec succès',
        data: product,
      })
    } catch (error) {
      return response.status(400).json({
        success: false,
        message: 'Erreur lors de la création du produit dans la catégorie',
        error: error.message,
      })
    }
  }
}