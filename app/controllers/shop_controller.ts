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
      if (category && category !== 'all') {
        productsQuery = productsQuery.whereHas('categoryRelation', (builder) => {
          builder.where('slug', category)
        })
      }

      // Recherche
      if (search) {
        const searchTerm = `%${search}%`
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

      // Récupérer les coupons actifs
      const now = DateTime.now()
      const nowSQL = now.toSQL()
      
      const activeCoupons = await Coupon.query()
        .where('status', 'active')
        .where((builder) => {
          builder.whereNull('valid_until').orWhere('valid_until', '>', nowSQL)
        })
        .limit(6)
      console.log(`✅ ${activeCoupons.length} coupons trouvés`)

      // Récupérer les bannières
      const banners = await Promotion.query()
        .where('type', 'banner')
        .where('status', 'active')
        .limit(5)
      console.log(`✅ ${banners.length} bannières trouvées`)

      // Récupérer les catégories
      const categories = await Category.query()
        .where('is_active', true)
        .orderBy('name', 'asc')
      console.log(`✅ ${categories.length} catégories trouvées`)

      // Formater les produits
      const formatProduct = (p: any) => {
        // Gérer l'utilisateur (peut être préchargé ou non)
        let userData = null
        if (p.user) {
          userData = {
            id: p.user.id,
            name: p.user.name,
            shopName: p.user.shop_name || p.user.shopName || null,
          }
        }

        return {
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

      const allProducts = products.map(formatProduct)

      // Produits en promotion (avec old_price)
      const productsOnSale = allProducts
        .filter(p => p.oldPrice && p.oldPrice > p.price)
        .slice(0, 8)

      // Nouveaux produits
      const newProducts = allProducts
        .filter(p => p.isNew)
        .slice(0, 8)

      // Meilleures ventes
      const bestSellers = [...allProducts]
        .sort((a, b) => (b.sales || 0) - (a.sales || 0))
        .slice(0, 8)

      // Formater les coupons
      const formattedCoupons = activeCoupons.map((c: any) => ({
        id: c.id,
        code: c.code,
        discount: c.discount,
        type: c.type,
        description: c.description,
        validUntil: c.valid_until,
        isValid: true,
        product: null,
      }))

      // Formater les bannières
      const formattedBanners = banners.map((p: any) => ({
        id: p.id,
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
      }))

      // Formater les catégories
      const formattedCategories = categories.map((c: any) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
      }))

      // Statistiques
      const stats = {
        totalProducts: products.total,
        totalMerchants: 0,
        totalCoupons: activeCoupons.length,
        totalPromotions: banners.length,
      }

      // Pagination
      const pagination = {
        currentPage: products.currentPage,
        lastPage: products.lastPage,
        perPage: products.perPage,
        total: products.total,
        hasPrevious: products.currentPage > 1,
        hasNext: products.currentPage < products.lastPage,
      }

      return response.json({
        success: true,
        products: allProducts,
        productsOnSale: productsOnSale,
        newProducts: newProducts,
        bestSellers: bestSellers,
        activeCoupons: formattedCoupons,
        banners: formattedBanners,
        flashSales: [],
        categoryOffers: [],
        categories: formattedCategories,
        stats: stats,
        pagination: pagination,
        filters: { 
          category: category || null, 
          search: search || null, 
          sort 
        },
      })
      
    } catch (error: unknown) {
      const err = error as Error
      console.error('❌ Shop API error:', err)
      console.error('Error details:', {
        message: err.message,
        stack: err.stack,
        name: err.name,
      })
      
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
          id: c.id,
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
        error: err.message,
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
    } catch (error: unknown) {
      const err = error as Error
      console.error('apiPromotions error:', err)
      return response.status(500).json({ 
        success: false, 
        message: 'Erreur promotions',
        error: err.message,
      })
    }
  }
}
