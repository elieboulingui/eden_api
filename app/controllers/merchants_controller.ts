// app/controllers/merchants_controller.ts
import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import db from '@adonisjs/lucid/services/db'
import Product from '#models/product' // ✅ Correction du chemin d'import

export default class MerchantsController {
  
  // ✅ Récupérer tous les marchands avec pagination
  async index({ request, response }: HttpContext) {
    try {
      const page = request.input('page', 1)
      const limit = request.input('limit', 10)
      const status = request.input('status')
      const search = request.input('search')

      let query = User.query()
        .whereIn('role', ['merchant', 'marchant', 'marchand'])
        .preload('wallet')
        .select([
          'id',
          'full_name',
          'email',
          'role',
          'avatar',
          'shop_name',
          'shop_image',
          'created_at',
          'updated_at'
        ])

      if (status && status !== 'all') {
        query = query.whereHas('wallet', (walletQuery) => {
          walletQuery.where('status', status)
        })
      }

      if (search) {
        query = query.where((builder) => {
          builder
            .where('full_name', 'LIKE', `%${search}%`)
            .orWhere('shop_name', 'LIKE', `%${search}%`)
            .orWhere('email', 'LIKE', `%${search}%`)
        })
      }

      const merchants = await query.paginate(page, limit)

      const formattedMerchants = merchants.map((merchant) => ({
        id: merchant.id,
        full_name: merchant.full_name,
        email: merchant.email,
        avatar: merchant.avatar,
        role: merchant.role,
        shop: {
          name: merchant.shop_name || merchant.full_name,
          image: merchant.shop_image || merchant.avatar,
        },
        wallet: merchant.wallet ? {
          id: merchant.wallet.id,
          balance: merchant.wallet.balance,
          currency: merchant.wallet.currency,
          status: merchant.wallet.status,
        } : null,
        created_at: merchant.created_at,
        updated_at: merchant.updated_at,
      }))

      return response.status(200).json({
        success: true,
        data: formattedMerchants,
        meta: {
          total: merchants.total,
          per_page: merchants.perPage,
          current_page: merchants.currentPage,
          last_page: merchants.lastPage,
        },
      })
    } catch (error) {
      console.error('Erreur index merchants:', error)
      return response.status(500).json({
        success: false,
        message: 'Erreur serveur',
        data: [],
        meta: null
      })
    }
  }

  // ✅ Récupérer un marchand spécifique avec ses statistiques
  async show({ params, response }: HttpContext) {
    try {
      const merchant = await User.query()
        .where('id', params.id)
        .whereIn('role', ['merchant', 'marchant', 'marchand'])
        .preload('wallet')
        .first()

      if (!merchant) {
        return response.status(404).json({
          success: false,
          message: 'Marchand non trouvé',
        })
      }

      const stats = await this.getShopStats(merchant.id)

      return response.status(200).json({
        success: true,
        data: {
          id: merchant.id,
          full_name: merchant.full_name,
          email: merchant.email,
          avatar: merchant.avatar,
          role: merchant.role,
          shop: {
            name: merchant.shop_name || merchant.full_name,
            image: merchant.shop_image || merchant.avatar,
            stats: stats,
          },
          wallet: merchant.wallet ? {
            id: merchant.wallet.id,
            balance: merchant.wallet.balance,
            currency: merchant.wallet.currency,
            status: merchant.wallet.status,
          } : null,
          created_at: merchant.created_at,
          updated_at: merchant.updated_at,
        },
      })
    } catch (error) {
      console.error('Erreur show merchant:', error)
      return response.status(500).json({
        success: false,
        message: 'Erreur serveur',
      })
    }
  }

  // ✅ Récupérer les marchands actifs uniquement
  async active({ request, response }: HttpContext) {
    try {
      const page = request.input('page', 1)
      const limit = request.input('limit', 10)

      const merchants = await User.query()
        .whereIn('role', ['merchant', 'marchant', 'marchand'])
        .whereHas('wallet', (walletQuery) => {
          walletQuery.where('status', 'active')
        })
        .preload('wallet')
        .paginate(page, limit)

      return response.status(200).json({
        success: true,
        data: merchants.map(m => ({
          id: m.id,
          full_name: m.full_name,
          shop: { 
            name: m.shop_name || m.full_name, 
            image: m.shop_image || m.avatar 
          },
          wallet: m.wallet ? { status: m.wallet.status } : null,
        })),
        meta: {
          total: merchants.total,
          current_page: merchants.currentPage,
          last_page: merchants.lastPage,
        },
      })
    } catch (error) {
      console.error('Erreur active merchants:', error)
      return response.status(500).json({ 
        success: false, 
        message: 'Erreur serveur',
        data: [] 
      })
    }
  }

  // ✅ Rechercher des marchands
  async search({ request, response }: HttpContext) {
    try {
      const searchTerm = request.input('q', '')
      const page = request.input('page', 1)
      const limit = request.input('limit', 10)

      if (!searchTerm || searchTerm.length < 2) {
        return response.status(400).json({
          success: false,
          message: 'Terme de recherche trop court',
          data: [],
        })
      }

      const merchants = await User.query()
        .whereIn('role', ['merchant', 'marchant', 'marchand'])
        .where((builder) => {
          builder
            .where('full_name', 'LIKE', `%${searchTerm}%`)
            .orWhere('shop_name', 'LIKE', `%${searchTerm}%`)
            .orWhere('email', 'LIKE', `%${searchTerm}%`)
        })
        .preload('wallet')
        .paginate(page, limit)

      return response.status(200).json({
        success: true,
        data: merchants.map(m => ({
          id: m.id,
          full_name: m.full_name,
          shop: { 
            name: m.shop_name || m.full_name, 
            image: m.shop_image || m.avatar 
          },
        })),
        meta: {
          total: merchants.total,
          current_page: merchants.currentPage,
          last_page: merchants.lastPage,
        },
      })
    } catch (error) {
      console.error('Erreur search merchants:', error)
      return response.status(500).json({ 
        success: false, 
        message: 'Erreur serveur',
        data: [] 
      })
    }
  }

  // ✅ Récupérer tous les marchands avec leurs produits
  async all({ request, response }: HttpContext) {
    try {
      const includeProducts = request.input('include_products', 'true') === 'true'
      const productsLimit = request.input('products_limit', 10)
      
      let query = User.query()
        .whereIn('role', ['merchant', 'marchant', 'marchand'])
        .select(['id', 'full_name', 'shop_name', 'shop_image', 'avatar', 'email', 'created_at'])
        .orderBy('shop_name', 'asc')
        .orderBy('full_name', 'asc')
        .orderBy('created_at', 'desc')

      // ✅ Charger les produits si demandé
      if (includeProducts) {
        query = query.preload('products', (productsQuery) => {
          productsQuery
            .select([
              'id',
              'name',
              'price',
              'description',
              'image_url',
              'stock',
              'rating',
              'status',
              'isNew',
              'isOnSale',
              'user_id',
              'category_id',
              'created_at',
              'updated_at'
            ])
            .where('status', 'active')
            .orderBy('created_at', 'desc')
            .limit(productsLimit)
        })
      }

      // ✅ Ajouter les compteurs de produits
      query = query
        .withCount('products', (productsQuery) => {
          productsQuery.where('status', 'active').as('active_products_count')
        })
        .withCount('products', (productsQuery) => {
          productsQuery.where('status', 'inactive').as('inactive_products_count')
        })
        .withCount('products', (productsQuery) => {
          productsQuery.where('stock', 0).as('out_of_stock_count')
        })

      const merchants = await query

      const formattedMerchants = merchants.map(m => {
        const merchantData: any = {
          id: m.id,
          name: this.getShopDisplayName(m),
          image: this.getShopImage(m),
          email: m.email,
          created_at: m.created_at,
          products_stats: {
            total_active: m.$extras.active_products_count || 0,
            total_inactive: m.$extras.inactive_products_count || 0,
            out_of_stock: m.$extras.out_of_stock_count || 0,
          }
        }

        // ✅ Ajouter les produits si chargés
        if (includeProducts && m.products) {
          merchantData.products = m.products.map((p: Product) => ({
            id: p.id,
            name: p.name,
            price: p.price,
            description: p.description,
            image_url: p.image_url,
            stock: p.stock,
            rating: p.rating,
            status: p.status,
            isNew: p.isNew,
            isOnSale: p.isOnSale,
            category_id: p.category_id,
            created_at: p.created_at,
            updated_at: p.updated_at,
          }))
          
          // Ajouter quelques stats sur les produits chargés
          if (merchantData.products.length > 0) {
            merchantData.products_stats.loaded_count = merchantData.products.length
            merchantData.products_stats.average_price = 
              merchantData.products.reduce((sum: number, p: any) => sum + Number(p.price), 0) / merchantData.products.length
            merchantData.products_stats.average_rating = 
              merchantData.products.reduce((sum: number, p: any) => sum + (p.rating || 0), 0) / merchantData.products.length
          }
        }

        return merchantData
      })

      return response.status(200).json({
        success: true,
        data: formattedMerchants,
        total: formattedMerchants.length,
        filters: {
          include_products: includeProducts,
          products_limit: includeProducts ? productsLimit : null
        }
      })
    } catch (error) {
      console.error('Erreur all merchants:', error)
      return response.status(500).json({ 
        success: false, 
        message: 'Erreur lors de la récupération des marchands',
        data: [] 
      })
    }
  }

  // ✅ Récupérer les statistiques d'un marchand
  async stats({ params, response }: HttpContext) {
    try {
      const merchant = await User.query()
        .where('id', params.id)
        .whereIn('role', ['merchant', 'marchant', 'marchand'])
        .first()

      if (!merchant) {
        return response.status(404).json({
          success: false,
          message: 'Marchand non trouvé',
        })
      }

      const stats = await this.getShopStats(merchant.id)

      return response.status(200).json({
        success: true,
        data: {
          merchant_id: merchant.id,
          merchant_name: this.getShopDisplayName(merchant),
          ...stats
        },
      })
    } catch (error) {
      console.error('Erreur stats merchant:', error)
      return response.status(500).json({ 
        success: false, 
        message: 'Erreur serveur',
        data: null 
      })
    }
  }

  // ✅ Récupérer les produits d'un marchand spécifique
  async merchantProducts({ params, request, response }: HttpContext) {
    try {
      const merchantId = params.id
      const page = request.input('page', 1)
      const limit = request.input('limit', 20)
      const status = request.input('status', 'active')
      const sortBy = request.input('sort_by', 'created_at')
      const sortOrder = request.input('sort_order', 'desc')

      const merchant = await User.query()
        .where('id', merchantId)
        .whereIn('role', ['merchant', 'marchant', 'marchand'])
        .first()

      if (!merchant) {
        return response.status(404).json({
          success: false,
          message: 'Marchand non trouvé',
        })
      }

      const productsQuery = Product.query()
        .where('user_id', merchantId)
        .preload('categoryRelation')
        .orderBy(sortBy, sortOrder as 'asc' | 'desc')

      if (status !== 'all') {
        productsQuery.where('status', status)
      }

      const products = await productsQuery.paginate(page, limit)

      const formattedProducts = products.map((p: Product) => ({
        id: p.id,
        name: p.name,
        price: p.price,
        description: p.description,
        image_url: p.image_url,
        stock: p.stock,
        rating: p.rating,
        isNew: p.isNew,
        isOnSale: p.isOnSale,
        sales: p.sales,
        status: p.status,
        origin: p.origin,
        weight: p.weight,
        packaging: p.packaging,
        conservation: p.conservation,
        category: p.categoryRelation ? {
          id: p.categoryRelation.id,
          name: p.categoryRelation.name
        } : null,
        created_at: p.created_at,
        updated_at: p.updated_at,
      }))

      return response.status(200).json({
        success: true,
        data: {
          merchant: {
            id: merchant.id,
            name: this.getShopDisplayName(merchant),
            image: this.getShopImage(merchant),
            email: merchant.email,
          },
          products: formattedProducts,
        },
        meta: {
          total: products.total,
          per_page: products.perPage,
          current_page: products.currentPage,
          last_page: products.lastPage,
        }
      })
    } catch (error) {
      console.error('Erreur merchant products:', error)
      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des produits',
      })
    }
  }

  // ✅ Récupérer les statistiques détaillées de la boutique
  private async getShopStats(merchantId: string) {
    try {
      // Nombre de produits
      const productsCount = await db
        .from('products')
        .where('user_id', merchantId)
        .count('* as total')

      const activeProductsCount = await db
        .from('products')
        .where('user_id', merchantId)
        .where('status', 'active')
        .count('* as total')

      // Commandes
      const ordersCount = await db
        .from('orders')
        .where('merchant_id', merchantId)
        .count('* as total')

      const completedOrdersCount = await db
        .from('orders')
        .where('merchant_id', merchantId)
        .where('status', 'completed')
        .count('* as total')

      // Revenus
      const totalRevenue = await db
        .from('orders')
        .where('merchant_id', merchantId)
        .where('status', 'completed')
        .sum('total_amount as total')

      const pendingRevenue = await db
        .from('orders')
        .where('merchant_id', merchantId)
        .whereIn('status', ['pending', 'processing'])
        .sum('total_amount as total')

      // Avis
      const averageRating = await db
        .from('reviews')
        .where('merchant_id', merchantId)
        .avg('rating as average')

      const reviewsCount = await db
        .from('reviews')
        .where('merchant_id', merchantId)
        .count('* as total')

      return {
        products: {
          total: parseInt(productsCount[0]?.total || '0'),
          active: parseInt(activeProductsCount[0]?.total || '0'),
        },
        orders: {
          total: parseInt(ordersCount[0]?.total || '0'),
          completed: parseInt(completedOrdersCount[0]?.total || '0'),
        },
        revenue: {
          total: parseFloat(totalRevenue[0]?.total || '0'),
          pending: parseFloat(pendingRevenue[0]?.total || '0'),
        },
        reviews: {
          average: parseFloat(averageRating[0]?.average || '0').toFixed(1),
          total: parseInt(reviewsCount[0]?.total || '0'),
        }
      }
    } catch (error) {
      console.error('Erreur getShopStats:', error)
      return {
        products: { total: 0, active: 0 },
        orders: { total: 0, completed: 0 },
        revenue: { total: 0, pending: 0 },
        reviews: { average: '0.0', total: 0 }
      }
    }
  }

  // ✅ Méthodes helper
  private getShopDisplayName(merchant: User): string {
    return merchant.shop_name || merchant.full_name || 'Marchand'
  }

  private getShopImage(merchant: User): string | null {
    return merchant.shop_image || merchant.avatar || null
  }
}
