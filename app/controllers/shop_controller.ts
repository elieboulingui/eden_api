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

      // Requête de base pour les produits
      let productsQuery = Product.query()
        .preload('user', (query) => query.select('id', 'name', 'shop_name'))
        .where('status', 'active')

      // Filtre par catégorie
      if (category && category !== 'all' && category !== '') {
        productsQuery = productsQuery.whereHas('categoryRelation', (builder) => {
          builder.where('slug', category)
        })
      }

      // Recherche
      if (search && search.trim() !== '') {
        const searchTerm = `%${search.trim()}%`
        productsQuery = productsQuery.where((builder) => {
          builder.where('name', 'LIKE', searchTerm)
            .orWhere('description', 'LIKE', searchTerm)
        })
      }

      // Tri
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

      const products = await productsQuery.paginate(page, limit)
      console.log(`✅ ${products.length} produits trouvés`)

      // Récupérer les produits en promotion
      const productsOnSale = await Product.query()
        .preload('user', (query) => query.select('id', 'name', 'shop_name'))
        .where('status', 'active')
        .whereNotNull('old_price')
        .where('old_price', '>', 0)
        .orderBy('created_at', 'desc')
        .limit(8)
      console.log(`✅ ${productsOnSale.length} produits en promo trouvés`)

      // Récupérer les nouveaux produits
      const newProducts = await Product.query()
        .preload('user', (query) => query.select('id', 'name', 'shop_name'))
        .where('status', 'active')
        .where('is_new', true)
        .orderBy('created_at', 'desc')
        .limit(8)
      console.log(`✅ ${newProducts.length} nouveaux produits trouvés`)

      // Récupérer les meilleures ventes
      const bestSellers = await Product.query()
        .preload('user', (query) => query.select('id', 'name', 'shop_name'))
        .where('status', 'active')
        .orderBy('sales', 'desc')
        .limit(8)
      console.log(`✅ ${bestSellers.length} meilleures ventes trouvées`)

      // Récupérer les coupons actifs
      const now = DateTime.now()
      const nowSQL = now.toSQL()
      
      const activeCoupons = await Coupon.query()
        .where('status', 'active')
        .where((builder) => {
          builder.whereNull('valid_until').orWhere('valid_until', '>', nowSQL)
        })
        .orderBy('created_at', 'desc')
        .limit(6)
      console.log(`✅ ${activeCoupons.length} coupons trouvés`)

      // Récupérer les bannières
      const banners = await Promotion.query()
        .where('type', 'banner')
        .where('status', 'active')
        .where((builder) => {
          builder.whereNull('start_date').orWhere('start_date', '<=', nowSQL)
        })
        .where((builder) => {
          builder.whereNull('end_date').orWhere('end_date', '>=', nowSQL)
        })
        .orderBy('priority', 'asc')
        .limit(5)
      console.log(`✅ ${banners.length} bannières trouvées`)

      // Récupérer les flash sales
      const flashSales = await Promotion.query()
        .where('type', 'flash_sale')
        .where('status', 'active')
        .where((builder) => {
          builder.whereNull('start_date').orWhere('start_date', '<=', nowSQL)
        })
        .where((builder) => {
          builder.whereNull('end_date').orWhere('end_date', '>=', nowSQL)
        })
        .orderBy('priority', 'asc')
        .limit(4)
      console.log(`✅ ${flashSales.length} flash sales trouvées`)

      // Récupérer les offres par catégorie
      const categoryOffers = await Promotion.query()
        .where('type', 'category_offer')
        .where('status', 'active')
        .where((builder) => {
          builder.whereNull('start_date').orWhere('start_date', '<=', nowSQL)
        })
        .where((builder) => {
          builder.whereNull('end_date').orWhere('end_date', '>=', nowSQL)
        })
        .orderBy('priority', 'asc')
        .limit(6)
      console.log(`✅ ${categoryOffers.length} offres catégorie trouvées`)

      // Récupérer les catégories
      const categories = await Category.query()
        .where('is_active', true)
        .orderBy('name', 'asc')
      console.log(`✅ ${categories.length} catégories trouvées`)

      // Statistiques
      const totalProducts = await Product.query().where('status', 'active').count('* as total')
      const totalMerchants = await Product.query()
        .where('status', 'active')
        .distinct('user_id')
        .count('* as total')
      const totalCoupons = await Coupon.query().where('status', 'active').count('* as total')
      const totalPromotions = await Promotion.query().where('status', 'active').count('* as total')

      // Fonction de formatage des produits
      const formatProduct = (p: any) => {
        let userData = null
        if (p.user) {
          userData = {
            id: String(p.user.id),
            name: p.user.name,
            shopName: p.user.shop_name || null,
          }
        }

        return {
          id: String(p.id),
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
          isNew: p.isNew || p.is_new || false,
          isOnSale: p.old_price ? p.old_price > p.price : false,
          rating: p.rating || 0,
          reviewsCount: p.reviews_count || 0,
          sales: p.sales || 0,
          likes: p.likes || 0,
          category: p.category || null,
          user: userData,
        }
      }

      // Formater les coupons
      const formatCoupon = (c: any) => ({
        id: String(c.id),
        code: c.code,
        discount: c.discount,
        type: c.type,
        description: c.description,
        validUntil: c.valid_until,
        isValid: true,
        product: null,
      })

      // Formater les promotions
      const formatPromotion = (p: any) => ({
        id: String(p.id),
        title: p.title,
        description: p.description,
        image: p.image_url ?? p.banner_image ?? null,
        type: p.type,
        discountPercentage: p.discount_percentage,
        discountAmount: p.discount_amount,
        link: p.link,
        buttonText: p.button_text || 'Voir plus',
        startDate: p.start_date,
        endDate: p.end_date,
        priority: p.priority,
      })

      // Formater les catégories
      const formatCategory = (c: any) => ({
        id: String(c.id),
        name: c.name,
        slug: c.slug,
      })

      return response.json({
        success: true,
        products: products.map(formatProduct),
        productsOnSale: productsOnSale.map(formatProduct),
        newProducts: newProducts.map(formatProduct),
        bestSellers: bestSellers.map(formatProduct),
        activeCoupons: activeCoupons.map(formatCoupon),
        banners: banners.map(formatPromotion),
        flashSales: flashSales.map(formatPromotion),
        categoryOffers: categoryOffers.map(formatPromotion),
        categories: categories.map(formatCategory),
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
          sort: sort,
        },
      })
      
    } catch (error: unknown) {
      const err = error as Error
      console.error('❌ Shop API error:', err)
      
      return response.status(500).json({
        success: false,
        message: 'Erreur lors du chargement de la boutique',
        error: err.message,
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
          id: String(c.id),
          code: c.code,
          discount: c.discount,
          type: c.type,
          description: c.description,
          validUntil: c.valid_until,
          isValid: true,
        })),
      })
    } catch (error: unknown) {
      const err = error as Error
      console.error('apiCoupons error:', err)
      return response.status(500).json({ 
        success: false, 
        message: 'Erreur coupons',
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
          id: String(p.id),
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
    } catch (error: unknown) {
      const err = error as Error
      console.error('apiPromotions error:', err)
      return response.status(500).json({ 
        success: false, 
        message: 'Erreur promotions',
      })
    }
  }
}
