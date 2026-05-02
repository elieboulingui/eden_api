// app/controllers/products_controller.ts

import type { HttpContext } from '@adonisjs/core/http'
import Product from '#models/product'  // ✅ Vérifiez que le chemin est correct

export default class ProductsController {
  
  /**
   * Récupère tous les produits en promotion (old_price > price)
   */
  async onSale({ request, response }: HttpContext) {
    try {
      const page = request.input('page', 1)
      const limit = request.input('limit', 20)
      const categoryId = request.input('category_id')

      let query = Product.query()
        .whereNotNull('old_price')
        .where('old_price', '>', 0)
        .whereRaw('old_price > price')
        .where('is_archived', false)
        .where('status', 'active')
        .preload('user')
        .orderByRaw('((old_price - price) / old_price) DESC')

      if (categoryId) {
        query = query.where('category_id', categoryId)
      }

      const products = await query.paginate(page, limit)

      return response.json({
        success: true,
        data: products,
      })
    } catch (error: unknown) {  // ✅ Typage explicite
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
      const minDiscount = request.input('min_discount', 20) // % minimum de réduction

      const products = await Product.query()
        .whereNotNull('old_price')
        .where('old_price', '>', 0)
        .whereRaw('old_price > price')
        .whereRaw('((old_price - price) / old_price * 100) >= ?', [minDiscount])
        .where('is_archived', false)
        .where('status', 'active')
        .preload('user')
        .orderByRaw('((old_price - price) / old_price) DESC')
        .limit(limit)

      return response.json({
        success: true,
        data: products,
        total: products.length,
      })
    } catch (error: unknown) {  // ✅ Typage explicite
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
        .whereNotNull('old_price')
        .where('old_price', '>', 0)
        .whereRaw('old_price > price')
        .where('is_archived', false)
        .where('status', 'active')
        .where('is_on_sale', true) // Flag spécial Black Friday
        .preload('user')
        .orderByRaw('((old_price - price) / old_price) DESC')
        .paginate(page, limit)

      return response.json({
        success: true,
        data: products,
      })
    } catch (error: unknown) {  // ✅ Typage explicite
      const errorMessage = error instanceof Error ? error.message : 'Une erreur inconnue est survenue'
      
      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des produits Black Friday',
        error: errorMessage,
      })
    }
  }
}
