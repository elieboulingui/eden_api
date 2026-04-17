import type { HttpContext } from '@adonisjs/core/http'
import Product from '#models/Product'
import Coupon from '#models/coupon'
import Promotion from '#models/promotion'
import Category from '#models/categories'
import { DateTime } from 'luxon'

export default class ShopController {
  
  async apiIndex({ request, response }: HttpContext) {
    try {
      console.log('=== API SHOP START ===')
      
      const page = Math.max(1, parseInt(request.input('page', '1') || '1'))
      const category = request.input('category')
      const search = request.input('search')
      const sort = request.input('sort', 'newest')
      const limit = Math.min(parseInt(request.input('limit', '12') || '12'), 100)

      console.log('Params:', { page, category, search, sort, limit })

      // Test simple : juste récupérer les produits
      let productsQuery = Product.query()
        .preload('user', (query) => query.select('id', 'name', 'shop_name'))
        .where('status', 'active')
        .orderBy('created_at', 'desc')

      const products = await productsQuery.paginate(page, limit)
      console.log(`✅ ${products.length} produits trouvés`)

      // Test des coupons
      const now = DateTime.now()
      const nowSQL = now.toSQL()
      
      const activeCoupons = await Coupon.query()
        .where('status', 'active')
        .where((builder) => {
          builder.whereNull('valid_until').orWhere('valid_until', '>', nowSQL)
        })
        .limit(6)
      console.log(`✅ ${activeCoupons.length} coupons trouvés`)

      // Test des promotions
      const banners = await Promotion.query()
        .where('type', 'banner')
        .where('status', 'active')
        .limit(5)
      console.log(`✅ ${banners.length} bannières trouvées`)

      // Test des catégories
      const categories = await Category.query()
        .where('is_active', true)
        .orderBy('name', 'asc')
      console.log(`✅ ${categories.length} catégories trouvées`)

      // Formatage simple
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
        stock: p.stock || 0,
        isInStock: (p.stock || 0) > 0,
        isLowStock: (p.stock || 0) > 0 && (p.stock || 0) <= 5,
        isNew: p.is_new || false,
        isOnSale: p.old_price ? p.old_price > p.price : false,
        rating: p.rating || 0,
        reviewsCount: p.reviews_count || 0,
        sales: p.sales || 0,
        likes: p.likes || 0,
        category: p.category || null,
        user: p.user
          ? {
              id: p.user.id,
              name: p.user.name,
              shopName: p.user.shop_name,
            }
          : null,
      })

      return response.json({
        success: true,
        products: products.map(formatProduct),
        productsOnSale: products.filter(p => p.old_price && p.old_price > p.price).map(formatProduct).slice(0, 8),
        newProducts: products.filter(p => p.is_new).map(formatProduct).slice(0, 8),
        bestSellers: [...products].sort((a, b) => (b.sales || 0) - (a.sales || 0)).map(formatProduct).slice(0, 8),
        activeCoupons: activeCoupons.map((c: any) => ({
          id: c.id,
          code: c.code,
          discount: c.discount,
          type: c.type,
          description: c.description,
          validUntil: c.valid_until,
          isValid: true,
          product: null,
        })),
        banners: banners.map((p: any) => ({
          id: p.id,
          title: p.title,
          description: p.description,
          image: p.image_url ?? p.banner_image ?? null,
          type: p.type,
          discountPercentage: p.discount_percentage,
          link: p.link,
          buttonText: p.button_text || 'Voir plus',
          startDate: p.start_date,
          endDate: p.end_date,
          priority: p.priority,
        })),
        flashSales: [],
        categoryOffers: [],
        categories: categories.map((c: any) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
        })),
        stats: {
          totalProducts: products.total,
          totalMerchants: 0,
          totalCoupons: activeCoupons.length,
          totalPromotions: banners.length,
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
          sort 
        },
      })
      
    } catch (error) {
      console.error('❌ Shop API error:', error)
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
      })
      
      return response.status(500).json({
        success: false,
        message: 'Erreur lors du chargement de la boutique',
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      })
    }
  }

  async apiCoupons({ response }: HttpContext) {
    try {
      const now = DateTime.now()
      const coupons = await Coupon.query()
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
          isValid: true,
        })),
      })
    } catch (error) {
      console.error('apiCoupons error:', error)
      return response.status(500).json({ 
        success: false, 
        message: 'Erreur coupons',
        error: error.message,
      })
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
      return response.status(500).json({ 
        success: false, 
        message: 'Erreur promotions',
        error: error.message,
      })
    }
  }
}
