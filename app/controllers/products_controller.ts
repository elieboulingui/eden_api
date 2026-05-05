import type { HttpContext } from '@adonisjs/core/http'
import Product from '#models/Product'
import { DateTime } from 'luxon'

export default class ProductsController {

  /**
   * Affiche la page web d'un produit
   */
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

  /**
   * Récupère tous les produits avec pagination, filtrage et tri
   */
  async index({ request, response }: HttpContext) {
    try {
      const page = request.input('page', 1)
      const limit = request.input('limit', 20)
      const categoryId = request.input('category_id')
      const sortBy = request.input('sort_by', 'created_at')
      const sortOrder = request.input('sort_order', 'desc')
      const search = request.input('search', '')
      const minPrice = request.input('min_price')
      const maxPrice = request.input('max_price')
      const userId = request.input('user_id')
      const isNew = request.input('is_new')
      const isOnSale = request.input('is_on_sale')
      const hasStock = request.input('has_stock')

      let query = Product
        .query()
        .where('is_archived', false)
        .preload('user', (userQuery) => {
          userQuery.select(['id', 'full_name', 'country'])
        })
        .preload('categoryRelation')

      // Filtrage par catégorie
      if (categoryId) {
        query = query.where('category_id', categoryId)
      }

      // Recherche par nom ou description
      if (search) {
        query = query.where((builder) => {
          builder
            .where('name', 'like', `%${search}%`)
            .orWhere('description', 'like', `%${search}%`)
        })
      }

      // Filtrage par prix
      if (minPrice) {
        query = query.where('price', '>=', minPrice)
      }
      if (maxPrice) {
        query = query.where('price', '<=', maxPrice)
      }

      // Filtrage par utilisateur/marchand
      if (userId) {
        query = query.where('user_id', userId)
      }

      // Filtrage produits nouveaux
      if (isNew === 'true' || isNew === '1') {
        query = query.where('is_new', true)
      }

      // Filtrage produits en promotion
      if (isOnSale === 'true' || isOnSale === '1') {
        query = query.where('is_on_sale', true)
      }

      // Filtrage produits en stock uniquement
      if (hasStock === 'true' || hasStock === '1') {
        query = query.where('stock', '>', 0)
      }

      // Tri
      const allowedSortFields = ['created_at', 'price', 'name', 'stock', 'updated_at']
      const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'created_at'
      const direction = sortOrder === 'asc' ? 'asc' : 'desc'

      query = query.orderBy(sortField, direction)

      // Pagination
      const products = await query.paginate(page, limit)

      // Mise à jour du flag isNew pour les produits de plus d'une semaine
      const oneWeekAgo = DateTime.now().minus({ weeks: 1 })
      for (const product of products) {
        const createdAt = DateTime.fromJSDate(product.createdAt.toJSDate())
        if (createdAt < oneWeekAgo && product.isNew === true) {
          product.isNew = false
          await product.save()
        }
      }

      // Formatage avec categoryName
      const data = products.all().map((product) => {
        const json = product.toJSON()
        return {
          ...json,
          categoryName: product.categoryRelation?.name || null
        }
      })

      return response.status(200).json({
        success: true,
        data: data,
        pagination: {
          page: products.currentPage,
          perPage: products.perPage,
          total: products.total,
          lastPage: products.lastPage,
          hasMorePages: products.hasMorePages
        }
      })
    } catch (error: any) {
      console.error('Erreur index products:', error)
      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des produits',
        error: error.message
      })
    }
  }

  /**
   * Récupère un produit par son ID
   */
  async show({ params, response }: HttpContext) {
    try {
      const product = await Product
        .query()
        .where('id', params.id)
        .where('is_archived', false)
        .preload('user', (query) => {
          query.select(['id', 'full_name', 'country'])
        })
        .preload('categoryRelation')
        .firstOrFail()

      const oneWeekAgo = DateTime.now().minus({ weeks: 1 })
      const createdAt = DateTime.fromJSDate(product.createdAt.toJSDate())

      if (createdAt < oneWeekAgo && product.isNew === true) {
        product.isNew = false
        await product.save()
      }

      const json = product.toJSON()
      const data = {
        ...json,
        categoryName: product.categoryRelation?.name || null
      }

      return response.status(200).json({
        success: true,
        data: data
      })
    } catch (error) {
      return response.status(404).json({
        success: false,
        message: 'Produit non trouvé'
      })
    }
  }

  /**
   * Crée un nouveau produit
   */
  async store({ request, response }: HttpContext) {
    try {
      const data = request.only([
        'name',
        'price',
        'old_price',
        'description',
        'stock',
        'user_id',
        'image_url',
        'category_id',
        'origin',
        'weight',
        'packaging',
        'conservation',
        'is_new',
        'is_on_sale',
        'status'
      ])

      // Validation
      if (!data.user_id) {
        return response.status(400).json({
          success: false,
          message: 'L\'ID de l\'utilisateur est requis'
        })
      }

      if (!data.name || !data.price) {
        return response.status(400).json({
          success: false,
          message: 'Le nom et le prix sont requis'
        })
      }

      // Vérifier les doublons (même nom + même user_id)
      const existingProduct = await Product.query()
        .where('name', data.name)
        .where('user_id', data.user_id)
        .where('is_archived', false)
        .first()

      if (existingProduct) {
        return response.status(409).json({
          success: false,
          message: 'Un produit avec le même nom existe déjà dans votre boutique',
          data: {
            existing_product_id: existingProduct.id
          }
        })
      }

      // Valeurs par défaut
      const productData = {
        ...data,
        isNew: data.is_new !== undefined ? data.is_new : true,
        isOnSale: data.is_on_sale !== undefined ? data.is_on_sale : false,
        status: data.status || 'active',
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
      console.error('Erreur création produit:', error)
      return response.status(400).json({
        success: false,
        message: 'Erreur lors de la création du produit',
        error: error.message
      })
    }
  }

  /**
   * Met à jour un produit existant
   */
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
        'name',
        'price',
        'old_price',
        'description',
        'stock',
        'image_url',
        'category_id',
        'origin',
        'weight',
        'packaging',
        'conservation',
        'is_new',
        'is_on_sale',
        'status'
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
      console.error('Erreur mise à jour produit:', error)
      return response.status(400).json({
        success: false,
        message: 'Erreur lors de la mise à jour du produit',
        error: error.message
      })
    }
  }

  /**
   * Archive un produit (soft delete)
   */
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
      console.error('Erreur archivage produit:', error)
      return response.status(400).json({
        success: false,
        message: 'Erreur lors de l\'archivage du produit',
        error: error.message
      })
    }
  }

  /**
   * Supprime définitivement un produit
   */
  async forceDelete({ params, request, response }: HttpContext) {
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
        message: 'Produit supprimé définitivement'
      })
    } catch (error: any) {
      console.error('Erreur suppression produit:', error)
      return response.status(400).json({
        success: false,
        message: 'Erreur lors de la suppression du produit',
        error: error.message
      })
    }
  }

  /**
   * Récupère les produits d'un marchand spécifique
   */
  async getByMerchant({ params, request, response }: HttpContext) {
    try {
      const page = request.input('page', 1)
      const limit = request.input('limit', 20)
      const userId = params.userId

      const products = await Product
        .query()
        .where('user_id', userId)
        .where('is_archived', false)
        .preload('user', (query) => {
          query.select(['id', 'full_name', 'country'])
        })
        .preload('categoryRelation')
        .orderBy('created_at', 'desc')
        .paginate(page, limit)

      const data = products.all().map((product) => {
        const json = product.toJSON()
        return {
          ...json,
          categoryName: product.categoryRelation?.name || null
        }
      })

      return response.status(200).json({
        success: true,
        data: data,
        pagination: {
          page: products.currentPage,
          perPage: products.perPage,
          total: products.total,
          lastPage: products.lastPage
        }
      })
    } catch (error: any) {
      console.error('Erreur récupération produits marchand:', error)
      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des produits du marchand',
        error: error.message
      })
    }
  }
}
