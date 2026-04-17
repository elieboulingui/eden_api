// app/controllers/shop_controller.ts
import type { HttpContext } from '@adonisjs/core/http'
import Product from '#models/Product'
import Coupon from '#models/coupon'
import Promotion from '#models/promotion'
import Category from '#models/categories'
import { DateTime } from 'luxon'
import { ProductFormatter } from '#services/product_formatter'
import { CouponFormatter } from '#services/coupon_formatter'
import { PromotionFormatter } from '#services/promotion_formatter'
import logger from '@adonisjs/core/services/logger'

export default class ShopController {
  async index({ request, view }: HttpContext) {
    try {
      const page = Math.max(1, parseInt(request.input('page', '1')))
      const category = request.input('category')
      const search = request.input('search')
      const sort = request.input('sort', 'newest')
      const limit = Math.min(parseInt(request.input('limit', '12')), 100)

      // Construction de la requête de base
      const baseProductQuery = (withCategory = true) => {
        let query = Product.query()
          .preload('user', (q) => q.select('id', 'name', 'shop_name'))
          .where('status', 'active')
        
        if (withCategory) {
          query = query.preload('categoryRelation')
        }
        
        return query
      }

      let productsQuery = baseProductQuery()

      if (category) {
        productsQuery = productsQuery.whereHas('categoryRelation', (builder) => {
          builder.where('slug', category)
        })
      }

      if (search) {
        const searchTerm = `%${search}%`
        productsQuery = productsQuery.where((builder) => {
          builder
            .where('name', 'LIKE', searchTerm)
            .orWhere('description', 'LIKE', searchTerm)
        })
      }

      // Tri
      const sortOptions = {
        price_asc: ['price', 'asc'],
        price_desc: ['price', 'desc'],
        popular: ['sales', 'desc'],
        newest: ['created_at', 'desc'],
      }
      const [orderBy, direction] = sortOptions[sort] || sortOptions.newest
      productsQuery = productsQuery.orderBy(orderBy, direction as 'asc' | 'desc')

      const now = DateTime.now()
      const nowSQL = now.toSQL()

      // Exécution parallèle de toutes les requêtes
      const [
        products,
        productsOnSale,
        newProducts,
        bestSellers,
        activeCoupons,
        banners,
        flashSales,
        categoryOffers,
        categories,
        totalProducts,
        totalMerchants,
        totalCoupons,
        totalPromotions,
      ] = await Promise.all([
        productsQuery.paginate(page, limit),
        
        Product.query()
          .preload('user', (q) => q.select('id', 'name', 'shop_name'))
          .where('status', 'active')
          .whereNotNull('old_price')
          .where('old_price', '>', 0)
          .orderBy('created_at', 'desc')
          .limit(8),
        
        Product.query()
          .preload('user', (q) => q.select('id', 'name', 'shop_name'))
          .where('status', 'active')
          .where('is_new', true)
          .orderBy('created_at', 'desc')
          .limit(8),
        
        Product.query()
          .preload('user', (q) => q.select('id', 'name', 'shop_name'))
          .where('status', 'active')
          .orderBy('sales', 'desc')
          .limit(8),
        
        Coupon.query()
          .preload('product')
          .where('status', 'active')
          .where((builder) => {
            builder.whereNull('valid_until').orWhere('valid_until', '>', nowSQL)
          })
          .orderBy('created_at', 'desc')
          .limit(6),
        
        Promotion.query()
          .where('type', 'banner')
          .where('status', 'active')
          .where((builder) => {
            builder.whereNull('start_date').orWhere('start_date', '<=', nowSQL)
          })
          .where((builder) => {
            builder.whereNull('end_date').orWhere('end_date', '>=', nowSQL)
          })
          .orderBy('priority', 'asc')
          .limit(5),
        
        Promotion.query()
          .where('type', 'flash_sale')
          .where('status', 'active')
          .where((builder) => {
            builder.whereNull('start_date').orWhere('start_date', '<=', nowSQL)
          })
          .where((builder) => {
            builder.whereNull('end_date').orWhere('end_date', '>=', nowSQL)
          })
          .orderBy('priority', 'asc')
          .limit(4),
        
        Promotion.query()
          .where('type', 'category_offer')
          .where('status', 'active')
          .where((builder) => {
            builder.whereNull('start_date').orWhere('start_date', '<=', nowSQL)
          })
          .where((builder) => {
            builder.whereNull('end_date').orWhere('end_date', '>=', nowSQL)
          })
          .orderBy('priority', 'asc')
          .limit(6),
        
        Category.query()
          .where('is_active', true)
          .orderBy('name', 'asc'),
        
        Product.query().where('status', 'active').count('* as total'),
        
        Product.query()
          .where('status', 'active')
          .distinct('user_id')
          .count('* as total'),
        
        Coupon.query().where('status', 'active').count('* as total'),
        
        Promotion.query().where('status', 'active').count('* as total'),
      ])

      return view.render('shop/index', {
        success: true,
        products: products.map(ProductFormatter.format),
        productsOnSale: productsOnSale.map(ProductFormatter.format),
        newProducts: newProducts.map(ProductFormatter.format),
        bestSellers: bestSellers.map(ProductFormatter.format),
        activeCoupons: activeCoupons.map(CouponFormatter.format),
        banners: banners.map(PromotionFormatter.format),
        flashSales: flashSales.map(PromotionFormatter.format),
        categoryOffers: categoryOffers.map(PromotionFormatter.format),
        categories: categories.map((c) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
        })),
        stats: {
          totalProducts: Number(totalProducts[0].$extras.total),
          totalMerchants: Number(totalMerchants[0].$extras.total),
          totalCoupons: Number(totalCoupons[0].$extras.total),
          totalPromotions: Number(totalPromotions[0].$extras.total),
        },
        pagination: {
          currentPage: products.currentPage,
          lastPage: products.lastPage,
          perPage: products.perPage,
          total: products.total,
          hasPrevious: products.currentPage > 1,
          hasNext: products.currentPage < products.lastPage,
        },
        filters: {
          category: category || null,
          search: search || null,
          sort,
        },
      })
    } catch (error) {
      logger.error({ error }, 'Shop index error')
      return view.render('errors/server-error')
    }
  }
}
