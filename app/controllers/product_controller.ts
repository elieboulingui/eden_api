// app/controllers/product_controller.ts

import type { HttpContext } from '@adonisjs/core/http'
import Product from '#models/Product'

export default class ProductsController {
  
  /**
   * Récupère tous les produits en promotion (oldPrice > price)
   */
  async onSale({ request, response }: HttpContext) {
    try {
      const page = request.input('page', 1)
      const limit = request.input('limit', 20)
      const categoryId = request.input('category_id')

      let query = Product.query()
        .whereNotNull('oldPrice')  // ✅ CORRIGÉ: old_price → oldPrice
        .where('oldPrice', '>', 0)  // ✅ CORRIGÉ: old_price → oldPrice
        .whereRaw('oldPrice > price')  // ✅ CORRIGÉ: old_price → oldPrice
        .where('isArchived', false)  // ✅ CORRIGÉ: is_archived → isArchived
        .where('status', 'active')
        .preload('user')
        .preload('categoryRelation')
        .orderByRaw('((oldPrice - price) / oldPrice) DESC')  // ✅ CORRIGÉ: old_price → oldPrice

      if (categoryId) {
        query = query.where('categoryId', categoryId)  // ✅ CORRIGÉ: category_id → categoryId
      }

      const products = await query.paginate(page, limit)

      // ✅ Ajouter categoryName dans chaque produit
      const data = products.all().map((product) => {
        const json = product.toJSON()
        return {
          ...json,
          categoryName: product.categoryRelation?.name || null
        }
      })

      return response.json({
        success: true,
        data: data,
        meta: {
          page: products.currentPage,
          limit: products.perPage,
          total: products.total,
          lastPage: products.lastPage
        }
      })
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Une erreur inconnue est survenue'
      
      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des produits en promotion',
        error: errorMessage,
      })
    }
  }

  /**
   * Récupère les produits avec les plus grosses réductions
   */
  async biggestDiscounts({ request, response }: HttpContext) {
    try {
      const limit = request.input('limit', 10)
      const minDiscount = request.input('min_discount', 20)

      const products = await Product.query()
        .whereNotNull('oldPrice')  // ✅ CORRIGÉ: old_price → oldPrice
        .where('oldPrice', '>', 0)  // ✅ CORRIGÉ: old_price → oldPrice
        .whereRaw('oldPrice > price')  // ✅ CORRIGÉ: old_price → oldPrice
        .whereRaw('((oldPrice - price) / oldPrice * 100) >= ?', [minDiscount])  // ✅ CORRIGÉ: old_price → oldPrice
        .where('isArchived', false)  // ✅ CORRIGÉ: is_archived → isArchived
        .where('status', 'active')
        .preload('user')
        .preload('categoryRelation')
        .orderByRaw('((oldPrice - price) / oldPrice) DESC')  // ✅ CORRIGÉ: old_price → oldPrice
        .limit(limit)

      // ✅ Ajouter categoryName dans chaque produit
      const data = products.map((product) => {
        const json = product.toJSON()
        return {
          ...json,
          categoryName: product.categoryRelation?.name || null
        }
      })

      return response.json({
        success: true,
        data: data,
        total: products.length,
      })
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Une erreur inconnue est survenue'
      
      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des meilleures réductions',
        error: errorMessage,
      })
    }
  }

  /**
   * Récupère les produits Black Friday (exemple)
   */
  async blackFriday({ request, response }: HttpContext) {
    try {
      const page = request.input('page', 1)
      const limit = request.input('limit', 20)

      const products = await Product.query()
        .whereNotNull('oldPrice')  // ✅ CORRIGÉ: old_price → oldPrice
        .where('oldPrice', '>', 0)  // ✅ CORRIGÉ: old_price → oldPrice
        .whereRaw('oldPrice > price')  // ✅ CORRIGÉ: old_price → oldPrice
        .where('isArchived', false)  // ✅ CORRIGÉ: is_archived → isArchived
        .where('status', 'active')
        .where('isOnSale', true)  // ✅ CORRIGÉ: is_on_sale → isOnSale
        .preload('user')
        .preload('categoryRelation')
        .orderByRaw('((oldPrice - price) / oldPrice) DESC')  // ✅ CORRIGÉ: old_price → oldPrice
        .paginate(page, limit)

      // ✅ Ajouter categoryName dans chaque produit
      const data = products.all().map((product) => {
        const json = product.toJSON()
        return {
          ...json,
          categoryName: product.categoryRelation?.name || null
        }
      })

      return response.json({
        success: true,
        data: data,
        meta: {
          page: products.currentPage,
          limit: products.perPage,
          total: products.total,
          lastPage: products.lastPage
        }
      })
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Une erreur inconnue est survenue'
      
      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des produits Black Friday',
        error: errorMessage,
      })
    }
  }
}
