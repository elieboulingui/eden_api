import type { HttpContext } from '@adonisjs/core/http'
import Category from '#models/categories'
import Product from '#models/Product'

export default class CategoriesController {

  // 🔹 Liste toutes les catégories
  async index({ response }: HttpContext) {
    try {
      const categories = await Category.query()

      const formattedCategories = categories.map(c => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        image_url: c.image_url,
        icon_name: c.icon_name,
        description: c.description,
        product_count: c.product_count ?? 0,
        sort_order: c.sort_order ?? 0,
        is_active: c.is_active,
      }))

      return response.status(200).json({
        success: true,
        message: 'Catégories récupérées avec succès',
        data: formattedCategories,
        count: formattedCategories.length,
      })
    } catch (error) {
      console.error('Erreur récupération catégories:', error)
      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des catégories',
        error: error.message,
      })
    }
  }

  // 🔹 Détails d'une catégorie
  async show({ params, response }: HttpContext) {
    try {
      const category = await Category.query()
        .where('slug', params.slug)
        .where('is_active', true)
        .preload('subCategories', (q) =>
          q.where('is_active', true).orderBy('sort_order', 'asc')
        )
        .preload('products', (q) =>
          q.where('stock', '>', 0).limit(12)
        )
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

  // 🔹 Créer une nouvelle catégorie
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

  // 🔹 Mettre à jour une catégorie
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

  // 🔹 Supprimer une catégorie
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

  // 🔹 Créer un produit dans une catégorie
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
        'isNew',
        'isOnSale',
        'user_id',
      ])

      // Création du produit
      const product = await Product.create({
        ...data,
        category_id: category.id,
      })

      // Ajouter l'ID du produit dans product_ids de la catégorie
      if (!category.product_ids) category.product_ids = []
      if (!category.product_ids.includes(product.id)) category.product_ids.push(product.id)
      await category.save()

      return response.status(201).json({
        success: true,
        message: 'Produit créé et ajouté à la catégorie avec succès',
        data: product,
      })
    } catch (error) {
      console.error('Erreur création produit:', error)
      return response.status(400).json({
        success: false,
        message: 'Erreur lors de la création du produit',
        error: error.message,
      })
    }
  }
}
