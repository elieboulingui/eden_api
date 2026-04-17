// app/controllers/shop_controller.ts
// app/controllers/shop_controller.ts
import type { HttpContext } from '@adonisjs/core/http'
import Coupon from '#models/coupon'
import Promotion from '#models/promotion'
import Product from '#models/Product'
import Category from '#models/categories'
import Coupon from '#models/coupon'
import { DateTime } from 'luxon'

export default class ShopController {
  /**
   * Page principale de la boutique
   */
  async index({ request, view }: HttpContext) {
    const page = request.input('page', 1)
    const category = request.input('category')
    const search = request.input('search')
    const sort = request.input('sort', 'newest')
    const limit = 12

    // Base query for products
    let productsQuery = Product.query()
      .preload('user', (query: any) => {
        query.select('id', 'name', 'shop_name')
      })
      .preload('category')
      .where('is_active', true)

    // Apply category filter
    if (category) {
      productsQuery = productsQuery.whereHas('category', (builder: any) => {
        builder.where('slug', category)
      })
    }

    // Apply search filter
    if (search) {
      productsQuery = productsQuery.where((builder: any) => {
        builder
          .where('name', 'LIKE', `%${search}%`)
          .orWhere('description', 'LIKE', `%${search}%`)
      })
    }

    // Apply sorting
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

    const products = await productsQuery.paginate(page, limit)

    // Get products on sale
    const productsOnSale = await Product.query()
      .preload('user', (query: any) => {
        query.select('id', 'name', 'shop_name')
      })
      .where('is_active', true)
      .whereNotNull('old_price')
      .where('old_price', '>', 0)
      .orderBy('created_at', 'desc')
      .limit(8)

    // Get new products
    const newProducts = await Product.query()
      .preload('user', (query: any) => {
        query.select('id', 'name', 'shop_name')
      })
      .where('is_active', true)
      .where('is_new', true)
      .orderBy('created_at', 'desc')
      .limit(8)

    // Get best sellers
    const bestSellers = await Product.query()
      .preload('user', (query: any) => {
        query.select('id', 'name', 'shop_name')
      })
      .where('is_active', true)
      .orderBy('sales', 'desc')
      .limit(8)

    // Get active coupons
    const now = DateTime.now()
    const activeCoupons = await Coupon.query()
      .preload('product')
      .where('is_active', true)
      .where((builder: any) => {
        builder
          .whereNull('valid_until')
          .orWhere('valid_until', '>', now.toSQL())
      })
      .orderBy('created_at', 'desc')
      .limit(6)

    // Get banners
    const banners = await Promotion.query()
      .where('type', 'banner')
      .where('is_active', true)
      .where((builder: any) => {
        builder
          .whereNull('start_date')
          .orWhere('start_date', '<=', now.toSQL())
      })
      .where((builder: any) => {
        builder
          .whereNull('end_date')
          .orWhere('end_date', '>=', now.toSQL())
      })
      .orderBy('priority', 'asc')
      .orderBy('created_at', 'desc')
      .limit(5)

    // Get flash sales
    const flashSales = await Promotion.query()
      .where('type', 'flash_sale')
      .where('is_active', true)
      .where((builder: any) => {
        builder
          .whereNull('start_date')
          .orWhere('start_date', '<=', now.toSQL())
      })
      .where((builder: any) => {
        builder
          .whereNull('end_date')
          .orWhere('end_date', '>=', now.toSQL())
      })
      .orderBy('priority', 'asc')
      .limit(4)

    // Get category offers
    const categoryOffers = await Promotion.query()
      .where('type', 'category_offer')
      .where('is_active', true)
      .where((builder: any) => {
        builder
          .whereNull('start_date')
          .orWhere('start_date', '<=', now.toSQL())
      })
      .where((builder: any) => {
        builder
          .whereNull('end_date')
          .orWhere('end_date', '>=', now.toSQL())
      })
      .orderBy('priority', 'asc')
      .limit(6)

    // Get all categories
    const categories = await Category.query()
      .where('is_active', true)
      .orderBy('name', 'asc')

    // Format products for response
    const formatProduct = (p: Product) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      price: p.price,
      formattedPrice: new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: 'XOF',
      }).format(p.price),
      oldPrice: p.oldPrice,
      formattedOldPrice: p.oldPrice
        ? new Intl.NumberFormat('fr-FR', {
            style: 'currency',
            currency: 'XOF',
          }).format(p.oldPrice)
        : null,
      discountPercentage: p.oldPrice
        ? Math.round(((p.oldPrice - p.price) / p.oldPrice) * 100)
        : null,
      image: p.image,
      stock: p.stock,
      isInStock: p.stock > 0,
      isLowStock: p.stock > 0 && p.stock <= 5,
      isNew: p.isNew || false,
      isOnSale: p.oldPrice ? p.oldPrice > p.price : false,
      rating: p.rating || 0,
      reviewsCount: p.reviewsCount || 0,
      sales: p.sales || 0,
      likes: p.likes || 0,
      category: p.category?.name || null,
      user: p.user
        ? {
            id: p.user.id,
            name: p.user.name,
            shopName: p.user.shopName,
          }
        : null,
    })

    // Format coupons
    const formatCoupon = (c: Coupon) => ({
      id: c.id,
      code: c.code,
      discount: c.discount,
      type: c.type,
      description: c.description,
      validUntil: c.validUntil,
      isValid: c.validUntil
        ? DateTime.fromJSDate(c.validUntil).toMillis() > DateTime.now().toMillis()
        : true,
      product: c.product
        ? {
            id: c.product.id,
            name: c.product.name,
            price: c.product.price,
          }
        : null,
    })

    // Format promotions
    const formatPromotion = (p: Promotion) => ({
      id: p.id,
      title: p.title,
      description: p.description,
      image: p.image,
      type: p.type,
      discountPercentage: p.discountPercentage,
      discountAmount: p.discountAmount,
      link: p.link,
      buttonText: p.buttonText,
      startDate: p.startDate,
      endDate: p.endDate,
      priority: p.priority,
    })

    // Get stats
    const stats = {
      totalProducts: await Product.query().where('is_active', true).count('* as total'),
      totalMerchants: await Product.query()
        .where('is_active', true)
        .distinct('user_id')
        .count('* as total'),
      totalCoupons: await Coupon.query().where('is_active', true).count('* as total'),
      totalPromotions: await Promotion.query().where('is_active', true).count('* as total'),
    }

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
      categories: categories.map((c: Category) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
      })),
      stats: {
        totalProducts: stats.totalProducts[0].$extras.total,
        totalMerchants: stats.totalMerchants[0].$extras.total,
        totalCoupons: stats.totalCoupons[0].$extras.total,
        totalPromotions: stats.totalPromotions[0].$extras.total,
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
  }

  /**
   * API endpoint for shop data (JSON response)
   */
  async apiIndex({ request, response }: HttpContext) {
    try {
      const page = request.input('page', 1)
      const category = request.input('category')
      const search = request.input('search')
      const sort = request.input('sort', 'newest')
      const limit = 12

      let productsQuery = Product.query()
        .preload('user', (query: any) => {
          query.select('id', 'name', 'shop_name')
        })
        .preload('category')
        .where('is_active', true)

      if (category) {
        productsQuery = productsQuery.whereHas('category', (builder: any) => {
          builder.where('slug', category)
        })
      }

      if (search) {
        productsQuery = productsQuery.where((builder: any) => {
          builder
            .where('name', 'LIKE', `%${search}%`)
            .orWhere('description', 'LIKE', `%${search}%`)
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

      const products = await productsQuery.paginate(page, limit)

      const now = DateTime.now()
      const activeCoupons = await Coupon.query()
        .preload('product')
        .where('is_active', true)
        .where((builder: any) => {
          builder
            .whereNull('valid_until')
            .orWhere('valid_until', '>', now.toSQL())
        })
        .orderBy('created_at', 'desc')
        .limit(6)

      const formatProduct = (p: Product) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        price: p.price,
        formattedPrice: new Intl.NumberFormat('fr-FR', {
          style: 'currency',
          currency: 'XOF',
        }).format(p.price),
        oldPrice: p.oldPrice,
        formattedOldPrice: p.oldPrice
          ? new Intl.NumberFormat('fr-FR', {
              style: 'currency',
              currency: 'XOF',
            }).format(p.oldPrice)
          : null,
        discountPercentage: p.oldPrice
          ? Math.round(((p.oldPrice - p.price) / p.oldPrice) * 100)
          : null,
        image: p.image,
        stock: p.stock,
        isInStock: p.stock > 0,
        isLowStock: p.stock > 0 && p.stock <= 5,
        isNew: p.isNew || false,
        isOnSale: p.oldPrice ? p.oldPrice > p.price : false,
        rating: p.rating || 0,
        reviewsCount: p.reviewsCount || 0,
        sales: p.sales || 0,
        likes: p.likes || 0,
        category: p.category?.name || null,
        user: p.user
          ? {
              id: p.user.id,
              name: p.user.name,
              shopName: p.user.shopName,
            }
          : null,
      })

      return response.json({
        success: true,
        products: products.map(formatProduct),
        activeCoupons: activeCoupons.map((c: Coupon) => ({
          id: c.id,
          code: c.code,
          discount: c.discount,
          type: c.type,
          description: c.description,
          validUntil: c.validUntil,
          isValid: c.validUntil
            ? DateTime.fromJSDate(c.validUntil).toMillis() > DateTime.now().toMillis()
            : true,
          product: c.product
            ? {
                id: c.product.id,
                name: c.product.name,
                price: c.product.price,
              }
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
        filters: {
          category: category || null,
          search: search || null,
          sort: sort,
        },
      })
    } catch (error) {
      console.error('Shop API error:', error)
      return response.status(500).json({
        success: false,
        message: 'Erreur lors du chargement de la boutique',
      })
    }
  }
}
