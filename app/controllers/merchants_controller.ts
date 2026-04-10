// app/controllers/merchants_controller.ts
import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import db from '@adonisjs/lucid/services/db'

export default class MerchantsController {
  
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

  // ✅ VERSION CORRIGÉE - request n'est pas utilisé
  async all({ response }: HttpContext) {
    try {
      console.log('Début all merchants')
      
      // Récupérer tous les marchands sans pagination
      const merchants = await User.query()
        .whereIn('role', ['merchant', 'marchant', 'marchand'])
        .select(['id', 'full_name', 'shop_name', 'shop_image', 'avatar', 'email', 'created_at'])
        .orderBy('shop_name', 'asc')
        .orderBy('full_name', 'asc')

      console.log('Marchands trouvés:', merchants.length)

      // Pour chaque marchand, récupérer ses produits
      const formattedMerchants = []
      
      for (const merchant of merchants) {
        try {
          // Récupérer les produits du marchand
          const products = await db
            .from('products')
            .where('user_id', merchant.id)
            .where('status', 'active')
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
              'category_id',
              'created_at'
            ])
            .orderBy('created_at', 'desc')
            .limit(10)

          // Compter le total des produits
          const productsCount = await db
            .from('products')
            .where('user_id', merchant.id)
            .where('status', 'active')
            .count('* as total')

          formattedMerchants.push({
            id: merchant.id,
            name: merchant.shop_name || merchant.full_name || 'Marchand',
            image: merchant.shop_image || merchant.avatar || null,
            email: merchant.email,
            created_at: merchant.created_at,
            products: products.map((p: any) => ({
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
            })),
            products_stats: {
              total_active: parseInt(productsCount[0]?.total || '0'),
              loaded: products.length
            }
          })
        } catch (err) {
          console.error(`Erreur pour le marchand ${merchant.id}:`, err)
          // Ajouter le marchand sans produits en cas d'erreur
          formattedMerchants.push({
            id: merchant.id,
            name: merchant.shop_name || merchant.full_name || 'Marchand',
            image: merchant.shop_image || merchant.avatar || null,
            email: merchant.email,
            created_at: merchant.created_at,
            products: [],
            products_stats: {
              total_active: 0,
              loaded: 0
            }
          })
        }
      }

      console.log('Réponse formatée avec succès')

      return response.status(200).json({
        success: true,
        data: formattedMerchants,
        total: formattedMerchants.length
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue'
      console.error('Erreur all merchants:', errorMessage)
      return response.status(500).json({ 
        success: false, 
        message: `Erreur lors de la récupération des marchands: ${errorMessage}`,
        data: [] 
      })
    }
  }

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
          merchant_name: merchant.shop_name || merchant.full_name,
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

  async merchantProducts({ params, request, response }: HttpContext) {
    try {
      const merchantId = params.id
      const page = request.input('page', 1)
      const limit = request.input('limit', 20)
      const status = request.input('status', 'active')

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

      const productsQuery = db
        .from('products')
        .where('user_id', merchantId)
        .orderBy('created_at', 'desc')

      if (status !== 'all') {
        productsQuery.where('status', status)
      }

      // Pagination manuelle
      const offset = (page - 1) * limit
      const products = await productsQuery
        .limit(limit)
        .offset(offset)

      const totalCount = await db
        .from('products')
        .where('user_id', merchantId)
        .count('* as total')

      const formattedProducts = products.map((p: any) => ({
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
        category_id: p.category_id,
        created_at: p.created_at,
        updated_at: p.updated_at,
      }))

      return response.status(200).json({
        success: true,
        data: {
          merchant: {
            id: merchant.id,
            name: merchant.shop_name || merchant.full_name,
            image: merchant.shop_image || merchant.avatar,
            email: merchant.email,
          },
          products: formattedProducts,
        },
        meta: {
          total: parseInt(totalCount[0]?.total || '0'),
          per_page: limit,
          current_page: page,
          last_page: Math.ceil(parseInt(totalCount[0]?.total || '0') / limit)
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

  private async getShopStats(merchantId: string) {
    try {
      const productsCount = await db
        .from('products')
        .where('user_id', merchantId)
        .count('* as total')

      const activeProductsCount = await db
        .from('products')
        .where('user_id', merchantId)
        .where('status', 'active')
        .count('* as total')

      const ordersCount = await db
        .from('orders')
        .where('merchant_id', merchantId)
        .count('* as total')

      const completedOrdersCount = await db
        .from('orders')
        .where('merchant_id', merchantId)
        .where('status', 'completed')
        .count('* as total')

      const totalRevenue = await db
        .from('orders')
        .where('merchant_id', merchantId)
        .where('status', 'completed')
        .sum('total_amount as total')

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
        revenue: { total: 0 },
        reviews: { average: '0.0', total: 0 }
      }
    }
  }
}
