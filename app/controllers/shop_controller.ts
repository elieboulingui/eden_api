import type { HttpContext } from '@adonisjs/core/http'
import Product from '#models/Product'
import Coupon from '#models/Coupon'
import Promotion from '#models/Promotion'
import Category from '#models/categories'
import User from '#models/user'

export default class ShopController {
  /**
   * Page boutique - Affiche tous les produits, promotions et coupons actifs
   */
  async index({ view, request }: HttpContext) {
    const page = request.input('page', 1)
    const limit = request.input('limit', 12)
    const category = request.input('category')
    const search = request.input('search')
    const sort = request.input('sort', 'newest') // newest, price_asc, price_desc, popular

    // ============================================================
    // 1. RÉCUPÉRER LES PRODUITS
    // ============================================================
    let productQuery = Product.query()
      .where('status', 'active')
      .preload('user', (query) => {
        query.select('id', 'full_name', 'email', 'role')
      })
      .preload('categoryRelation', (query) => {
        query.select('id', 'name', 'slug')
      })
      .preload('reviews', (query) => {
        query.orderBy('created_at', 'desc').limit(3)
      })

    // Filtre par catégorie
    if (category) {
      productQuery.where('category', category)
    }

    // Recherche
    if (search) {
      productQuery.where((builder) => {
        builder.where('name', 'LIKE', `%${search}%`)
          .orWhere('description', 'LIKE', `%${search}%`)
      })
    }

    // Tri
    switch (sort) {
      case 'price_asc':
        productQuery.orderBy('price', 'asc')
        break
      case 'price_desc':
        productQuery.orderBy('price', 'desc')
        break
      case 'popular':
        productQuery.orderBy('sales', 'desc')
        break
      default:
        productQuery.orderBy('created_at', 'desc')
    }

    const products = await productQuery.paginate(page, limit)

    // ============================================================
    // 2. RÉCUPÉRER LES PRODUITS EN PROMOTION (FLASH SALES)
    // ============================================================
    const productsOnSale = await Product.query()
      .where('status', 'active')
      .where('isOnSale', true)
      .whereNotNull('old_price')
      .preload('user', (query) => {
        query.select('id', 'full_name', 'commercial_name', 'shop_name')
      })
      .orderBy('discount_percentage', 'desc')
      .limit(8)

    // ============================================================
    // 3. RÉCUPÉRER LES NOUVEAUX PRODUITS
    // ============================================================
    const newProducts = await Product.query()
      .where('status', 'active')
      .where('isNew', true)
      .preload('user', (query) => {
        query.select('id', 'full_name', 'commercial_name')
      })
      .orderBy('created_at', 'desc')
      .limit(8)

    // ============================================================
    // 4. RÉCUPÉRER LES PRODUITS LES PLUS VENDUS
    // ============================================================
    const bestSellers = await Product.query()
      .where('status', 'active')
      .where('sales', '>', 0)
      .preload('user', (query) => {
        query.select('id', 'full_name', 'commercial_name')
      })
      .orderBy('sales', 'desc')
      .limit(8)

    // ============================================================
    // 5. RÉCUPÉRER LES COUPONS ACTIFS
    // ============================================================
    const now = DateTime.now()
    
    const activeCoupons = await Coupon.query()
      .where('status', 'active')
      .where((builder) => {
        builder.whereNull('valid_until')
          .orWhere('valid_until', '>', now.toSQL())
      })
      .where((builder) => {
        builder.whereNull('valid_from')
          .orWhere('valid_from', '<=', now.toSQL())
      })
      .where((builder) => {
        builder.whereNull('usage_limit')
          .orWhereRaw('used_count < usage_limit')
      })
      .preload('product', (query) => {
        query.select('id', 'name', 'price', 'image_url')
      })
      .orderBy('created_at', 'desc')
      .limit(6)

    // ============================================================
    // 6. RÉCUPÉRER LES PROMOTIONS (BANNIÈRES ET OFFRES)
    // ============================================================
    const activePromotions = await Promotion.query()
      .where('status', 'active')
      .where((builder) => {
        builder.whereNull('end_date')
          .orWhere('end_date', '>', now.toSQL())
      })
      .where((builder) => {
        builder.whereNull('start_date')
          .orWhere('start_date', '<=', now.toSQL())
      })
      .orderBy('priority', 'desc')
      .orderBy('created_at', 'desc')

    // Séparer par type
    const banners = activePromotions.filter(p => p.type === 'banner')
    const flashSales = activePromotions.filter(p => p.type === 'flash_sale')
    const categoryOffers = activePromotions.filter(p => p.type === 'category_offer')

    // ============================================================
    // 7. RÉCUPÉRER TOUTES LES CATÉGORIES (pour les filtres)
    // ============================================================
    const categories = await Category.query()
      .where('status', 'active')
      .orderBy('name', 'asc')

    // ============================================================
    // 8. STATISTIQUES GÉNÉRALES
    // ============================================================
    const stats = {
      totalProducts: await Product.query().where('status', 'active').count('* as total'),
      totalMerchants: await User.query().whereIn('role', ['merchant', 'marchant']).where('is_verified', true).count('* as total'),
      totalCoupons: activeCoupons.length,
      totalPromotions: activePromotions.length,
    }

    // ============================================================
    // 9. RENVOYER LA VUE
    // ============================================================
    if (request.accepts(['json'])) {
      // Réponse API
      return {
        success: true,
        products: products.all().map(p => this.formatProduct(p)),
        productsOnSale: productsOnSale.map(p => this.formatProduct(p)),
        newProducts: newProducts.map(p => this.formatProduct(p)),
        bestSellers: bestSellers.map(p => this.formatProduct(p)),
        activeCoupons: activeCoupons.map(c => this.formatCoupon(c)),
        banners: banners.map(p => this.formatPromotion(p)),
        flashSales: flashSales.map(p => this.formatPromotion(p)),
        categoryOffers: categoryOffers.map(p => this.formatPromotion(p)),
        categories: categories.map(c => ({ id: c.id, name: c.name, slug: c.slug })),
        stats: {
          totalProducts: stats.totalProducts[0].$extras.total,
          totalMerchants: stats.totalMerchants[0].$extras.total,
          totalCoupons: stats.totalCoupons,
          totalPromotions: stats.totalPromotions,
        },
        pagination: {
          currentPage: products.currentPage,
          lastPage: products.lastPage,
          perPage: products.perPage,
          total: products.total,
        },
      }
    }

    // Réponse Web (vue)
    return view.render('pages/shop/index', {
      title: 'Boutique - Tous nos produits',
      products: products.all().map(p => this.formatProduct(p)),
      productsOnSale: productsOnSale.map(p => this.formatProduct(p)),
      newProducts: newProducts.map(p => this.formatProduct(p)),
      bestSellers: bestSellers.map(p => this.formatProduct(p)),
      activeCoupons: activeCoupons.map(c => this.formatCoupon(c)),
      banners: banners.map(p => this.formatPromotion(p)),
      flashSales: flashSales.map(p => this.formatPromotion(p)),
      categoryOffers: categoryOffers.map(p => this.formatPromotion(p)),
      categories: categories.map(c => ({ id: c.id, name: c.name, slug: c.slug })),
      stats: {
        totalProducts: stats.totalProducts[0].$extras.total,
        totalMerchants: stats.totalMerchants[0].$extras.total,
        totalCoupons: stats.totalCoupons,
        totalPromotions: stats.totalPromotions,
      },
      pagination: {
        currentPage: products.currentPage,
        lastPage: products.lastPage,
        perPage: products.perPage,
        total: products.total,
        hasPrevious: products.hasPrevious,
        hasNext: products.hasNext,
      },
      filters: {
        category,
        search,
        sort,
      },
    })
  }

  /**
   * Formater un produit pour l'affichage
   */
  private formatProduct(product: Product) {
    return {
      id: product.id,
      name: product.name,
      description: product.description?.substring(0, 150) + '...',
      price: product.price,
      formattedPrice: product.formattedPrice,
      oldPrice: product.old_price,
      formattedOldPrice: product.formattedOldPrice,
      discountPercentage: product.discountPercentage,
      image: product.image_url,
      stock: product.stock,
      isInStock: product.isInStock,
      isLowStock: product.isLowStock,
      isNew: product.isNew,
      isOnSale: product.isOnSale,
      rating: product.rating || 4.5,
      reviewsCount: product.reviews_count || 0,
      sales: product.sales || 0,
      likes: product.likes || 0,
      category: product.category,
      user: product.user ? {
        id: product.user.id,
        name: product.user.full_name,
        shopName: product.user.shop_name || product.user.commercial_name,
      } : null,
      categoryRelation: product.categoryRelation ? {
        id: product.categoryRelation.id,
        name: product.categoryRelation.name,
        slug: product.categoryRelation.slug,
      } : null,
      createdAt: product.created_at?.toISO(),
    }
  }

  /**
   * Formater un coupon pour l'affichage
   */
  private formatCoupon(coupon: Coupon) {
    return {
      id: coupon.id,
      code: coupon.code,
      discount: coupon.discount,
      type: coupon.type,
      description: coupon.description,
      validUntil: coupon.valid_until?.toISO(),
      isValid: coupon.isValid(),
      product: coupon.product ? {
        id: coupon.product.id,
        name: coupon.product.name,
        price: coupon.product.price,
      } : null,
    }
  }

  /**
   * Formater une promotion pour l'affichage
   */
  private formatPromotion(promotion: Promotion) {
    return {
      id: promotion.id,
      title: promotion.title,
      description: promotion.description,
      image: promotion.image_url || promotion.banner_image,
      type: promotion.type,
      discountPercentage: promotion.discount_percentage,
      discountAmount: promotion.discount_amount,
      link: promotion.link,
      buttonText: promotion.button_text,
      startDate: promotion.start_date?.toISO(),
      endDate: promotion.end_date?.toISO(),
      priority: promotion.priority,
    }
  }

  /**
   * API - Récupérer tous les produits (JSON)
   */
  async apiIndex({ response }: HttpContext) {
    const products = await Product.query()
      .where('status', 'active')
      .preload('user')
      .preload('categoryRelation')
      .orderBy('created_at', 'desc')

    return response.json({
      success: true,
      products: products.map(p => this.formatProduct(p)),
    })
  }

  /**
   * API - Récupérer les coupons actifs (JSON)
   */
  async apiCoupons({ response }: HttpContext) {
    const now = DateTime.now()
    
    const coupons = await Coupon.query()
      .where('status', 'active')
      .where((builder) => {
        builder.whereNull('valid_until')
          .orWhere('valid_until', '>', now.toSQL())
      })
      .preload('product')
      .orderBy('created_at', 'desc')

    return response.json({
      success: true,
      coupons: coupons.map(c => this.formatCoupon(c)),
    })
  }

  /**
   * API - Récupérer les promotions actives (JSON)
   */
  async apiPromotions({ response }: HttpContext) {
    const now = DateTime.now()
    
    const promotions = await Promotion.query()
      .where('status', 'active')
      .where((builder) => {
        builder.whereNull('end_date')
          .orWhere('end_date', '>', now.toSQL())
      })
      .orderBy('priority', 'desc')

    return response.json({
      success: true,
      promotions: promotions.map(p => this.formatPromotion(p)),
    })
  }
}
