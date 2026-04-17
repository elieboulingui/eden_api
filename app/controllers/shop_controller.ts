// app/controllers/shop_controller.ts
import type { HttpContext } from '@adonisjs/core/http'
import Product from '#models/Product'
import Coupon from '#models/coupon'
import Promotion from '#models/promotion'
import Category from '#models/categories'
import { DateTime } from 'luxon'

export default class ShopController {
  async index({ request, view }: HttpContext) {
    try {
      const page = Math.max(1, parseInt(request.input('page', '1') || '1'))
      const category = request.input('category')
      const search = request.input('search')
      const sort = request.input('sort', 'newest')
      const limit = Math.min(parseInt(request.input('limit', '12') || '12'), 100)

      let productsQuery = Product.query()
        .preload('user', (query) => {
          query.select('id', 'name', 'shop_name')
        })
        .preload('categoryRelation')
        .where('status', 'active')

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

      switch (sort) {
        case 'price_asc':
          productsQuery = productsQuery.orderBy('price', 'asc')
          break
        case 'price_desc':
          productsQuery = productsQuery.orderBy('price', 'desc')
          break
        case 'popular':
          productsQuery = productsQuery.orderBy('sales', 'desc')
          break
        case 'newest':
        default:
          productsQuery = productsQuery.orderBy('created_at', 'desc')
          break
      }

      const now = DateTime.now()
      const nowSQL = now.toSQL()

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
        totalProductsResult,
        totalMerchantsResult,
        totalCouponsResult,
        totalPromotionsResult,
      ] = await Promise.all([
        productsQuery.paginate(page, limit),

        Product.query()
          .preload('user', (query) => query.select('id', 'name', 'shop_name'))
          .where('status', 'active')
          .whereNotNull('old_price')
          .where('old_price', '>', 0)
          .orderBy('created_at', 'desc')
          .limit(8),

        Product.query()
          .preload('user', (query) => query.select('id', 'name', 'shop_name'))
          .where('status', 'active')
          .where('is_new', true)
          .orderBy('created_at', 'desc')
          .limit(8),

        Product.query()
          .preload('user', (query) => query.select('id', 'name', 'shop_name'))
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

        Category.query().where('is_active', true).orderBy('name', 'asc'),

        Product.query().where('status', 'active').count('* as total'),

        Product.query().where('status', 'active').distinct('user_id').count('* as total'),

        Coupon.query().where('status', 'active').count('* as total'),

        Promotion.query().where('status', 'active').count('* as total'),
      ])

      const formatProduct = (p: any) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        price: p.price,
        formattedPrice: new Intl.NumberFormat('fr-FR', {
          style: 'currency',
          currency: 'XOF',
        }).format(p.price),
        oldPrice: p.old_price,
        formattedOldPrice: p.old_price
          ? new Intl.NumberFormat('fr-FR', {
              style: 'currency',
              currency: 'XOF',
            }).format(p.old_price)
          : null,
        discountPercentage: p.old_price
          ? Math.round(((p.old_price - p.price) / p.old_price) * 100)
          : null,
        image: p.image_url ?? null,
        stock: p.stock,
        isInStock: p.stock > 0,
        isLowStock: p.stock > 0 && p.stock <= 5,
        isNew: p.isNew ?? p.is_new ?? false,
        isOnSale: p.old_price ? p.old_price > p.price : false,
        rating: p.rating || 0,
        reviewsCount: p.reviews_count || 0,
        sales: p.sales || 0,
        likes: p.likes || 0,
        category: p.categoryRelation?.name ?? p.category ?? null,
        user: p.user
          ? {
              id: p.user.id,
              name: p.user.name,
              shopName: p.user.shop_name,
            }
          : null,
      })

      const formatCoupon = (c: any) => ({
        id: c.id,
        code: c.code,
        discount: c.discount,
        type: c.type,
        description: c.description,
        validUntil: c.valid_until,
        isValid:
          c.isValid?.() ??
          (c.valid_until
            ? DateTime.fromJSDate(c.valid_until).toMillis() > DateTime.now().toMillis()
            : true),
        product: c.product
          ? { id: c.product.id, name: c.product.name, price: c.product.price }
          : null,
      })

      const formatPromotion = (p: any) => ({
        id: p.id,
        title: p.title,
        description: p.description,
        image: p.image_url ?? p.banner_image ?? null,
        type: p.type,
        discountPercentage: p.discount_percentage,
        discountAmount: p.discount_amount,
        link: p.link,
        buttonText: p.button_text,
        startDate: p.start_date,
        endDate: p.end_date,
        priority: p.priority,
      })

      return view.render('shop/index', {
        success: true,
        products: products.map(formatProduct),
        productsOnSale: productsOnSale.map(formatProduct),
        newProducts: newProducts.map(formatProduct),
        bestSellers: bestSellers.map(formatProduct),
        activeCoupons: activeCoupons.map(formatCoupon),
        banners: banners.map(formatPromotion),
        flashSales: flashSales.map(formatPromotion),
        categoryOffers: categoryOffers.map(formatPromotion),
        categories: categories.map((c: any) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
        })),
        stats: {
          totalProducts: Number(totalProductsResult[0].$extras.total),
          totalMerchants: Number(totalMerchantsResult[0].$extras.total),
          totalCoupons: Number(totalCouponsResult[0].$extras.total),
          totalPromotions: Number(totalPromotionsResult[0].$extras.total),
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
      console.error('Shop index error:', error)
      return view.render('errors/server-error')
    }
  }

  async apiIndex({ request, response }: HttpContext) {
    try {
      const page = Math.max(1, parseInt(request.input('page', '1') || '1'))
      const category = request.input('category')
      const search = request.input('search')
      const sort = request.input('sort', 'newest')
      const limit = Math.min(parseInt(request.input('limit', '12') || '12'), 100)

      let productsQuery = Product.query()
        .preload('user', (query) => query.select('id', 'name', 'shop_name'))
        .preload('categoryRelation')
        .where('status', 'active')

      if (category) {
        productsQuery = productsQuery.whereHas('categoryRelation', (builder) => {
          builder.where('slug', category)
        })
      }

      if (search) {
        const searchTerm = `%${search}%`
        productsQuery = productsQuery.where((builder) => {
          builder.where('name', 'LIKE', searchTerm).orWhere('description', 'LIKE', searchTerm)
        })
      }

      switch (sort) {
        case 'price_asc':
          productsQuery = productsQuery.orderBy('price', 'asc')
          break
        case 'price_desc':
          productsQuery = productsQuery.orderBy('price', 'desc')
          break
        case 'popular':
          productsQuery = productsQuery.orderBy('sales', 'desc')
          break
        default:
          productsQuery = productsQuery.orderBy('created_at', 'desc')
          break
      }

      const now = DateTime.now()
      const nowSQL = now.toSQL()

      const [products, activeCoupons] = await Promise.all([
        productsQuery.paginate(page, limit),
        Coupon.query()
          .preload('product')
          .where('status', 'active')
          .where((builder) => {
            builder.whereNull('valid_until').orWhere('valid_until', '>', nowSQL)
          })
          .orderBy('created_at', 'desc')
          .limit(6),
      ])

      const formatProduct = (p: any) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        price: p.price,
        formattedPrice: new Intl.NumberFormat('fr-FR', {
          style: 'currency',
          currency: 'XOF',
        }).format(p.price),
        oldPrice: p.old_price,
        formattedOldPrice: p.old_price
          ? new Intl.NumberFormat('fr-FR', {
              style: 'currency',
              currency: 'XOF',
            }).format(p.old_price)
          : null,
        discountPercentage: p.old_price
          ? Math.round(((p.old_price - p.price) / p.old_price) * 100)
          : null,
        image: p.image_url ?? null,
        stock: p.stock,
        isInStock: p.stock > 0,
        isLowStock: p.stock > 0 && p.stock <= 5,
        isNew: p.isNew ?? p.is_new ?? false,
        isOnSale: p.old_price ? p.old_price > p.price : false,
        rating: p.rating || 0,
        reviewsCount: p.reviews_count || 0,
        sales: p.sales || 0,
        likes: p.likes || 0,
        category: p.categoryRelation?.name ?? p.category ?? null,
        user: p.user
          ? { id: p.user.id, name: p.user.name, shopName: p.user.shop_name }
          : null,
      })

      return response.json({
        success: true,
        products: products.map(formatProduct),
        activeCoupons: activeCoupons.map((c: any) => ({
          id: c.id,
          code: c.code,
          discount: c.discount,
          type: c.type,
          description: c.description,
          validUntil: c.valid_until,
          isValid:
            c.isValid?.() ??
            (c.valid_until
              ? DateTime.fromJSDate(c.valid_until).toMillis() > Date.now()
              : true),
          product: c.product
            ? { id: c.product.id, name: c.product.name, price: c.product.price }
            : null,
        })),
        pagination: {
          currentPage: products.currentPage,
          lastPage: products.lastPage,
          perPage: products.perPage,
          total: products.total,
          hasPrevious: products.currentPage > 1,
          hasNext: products.currentPage < products.lastPage,
        },
        filters: { category: category || null, search: search || null, sort },
      })
    } catch (error) {
      console.error('Shop API error:', error)
      return response.status(500).json({
        success: false,
        message: 'Erreur lors du chargement de la boutique',
      })
    }
  }

  async apiCoupons({ response }: HttpContext) {
    try {
      const now = DateTime.now()
      const coupons = await Coupon.query()
        .preload('product')
        .where('status', 'active')
        .where((builder) => {
          builder.whereNull('valid_until').orWhere('valid_until', '>', now.toSQL())
        })
        .orderBy('created_at', 'desc')
        .limit(20)

      return response.json({
        success: true,
        coupons: coupons.map((c: any) => ({
          id: c.id,
          code: c.code,
          discount: c.discount,
          type: c.type,
          description: c.description,
          validUntil: c.valid_until,
          isValid: c.isValid?.() ?? true,
          product: c.product
            ? { id: c.product.id, name: c.product.name, price: c.product.price }
            : null,
        })),
      })
    } catch (error) {
      console.error('apiCoupons error:', error)
      return response.status(500).json({ success: false, message: 'Erreur coupons' })
    }
  }

  async apiPromotions({ response }: HttpContext) {
    try {
      const now = DateTime.now()
      const nowSQL = now.toSQL()

      const promotions = await Promotion.query()
        .where('status', 'active')
        .where((builder) => {
          builder.whereNull('start_date').orWhere('start_date', '<=', nowSQL)
        })
        .where((builder) => {
          builder.whereNull('end_date').orWhere('end_date', '>=', nowSQL)
        })
        .orderBy('priority', 'asc')
        .limit(20)

      return response.json({
        success: true,
        promotions: promotions.map((p: any) => ({
          id: p.id,
          title: p.title,
          description: p.description,
          image: p.image_url ?? p.banner_image ?? null,
          type: p.type,
          discountPercentage: p.discount_percentage,
          discountAmount: p.discount_amount,
          link: p.link,
          buttonText: p.button_text,
          startDate: p.start_date,
          endDate: p.end_date,
          priority: p.priority,
        })),
      })
    } catch (error) {
      console.error('apiPromotions error:', error)
      return response.status(500).json({ success: false, message: 'Erreur promotions' })
    }
  }
}
