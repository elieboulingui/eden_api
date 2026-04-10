// app/controllers/merchants_controller.ts
import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import db from '@adonisjs/lucid/services/db' // ✅ Garder l'import, il est utilisé dans getShopStats

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
      console.error('Erreur:', error)
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
      console.error('Erreur:', error)
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
          shop: { name: m.shop_name || m.full_name, image: m.shop_image || m.avatar },
          wallet: m.wallet ? { status: m.wallet.status } : null,
        })),
        meta: {
          total: merchants.total,
          current_page: merchants.currentPage,
          last_page: merchants.lastPage,
        },
      })
    } catch (error) {
      return response.status(500).json({ success: false, data: [] })
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
          shop: { name: m.shop_name || m.full_name, image: m.shop_image || m.avatar },
        })),
        meta: {
          total: merchants.total,
          current_page: merchants.currentPage,
          last_page: merchants.lastPage,
        },
      })
    } catch (error) {
      return response.status(500).json({ success: false, data: [] })
    }
  }

  async all({ response }: HttpContext) {
    try {
      const merchants = await User.query()
        .whereIn('role', ['merchant', 'marchant', 'marchand'])
        .select(['id', 'full_name', 'shop_name', 'shop_image', 'avatar', 'email'])
        .orderBy('shop_name', 'asc')
        .orderBy('full_name', 'asc')
        .orderBy('created_at', 'desc')

      // ✅ Filtrer les doublons par user_id
      const uniqueMerchants = this.removeDuplicatesById(merchants)

      const formattedMerchants = uniqueMerchants.map(m => ({
        id: m.id,
        name: this.getShopDisplayName(m),
        image: this.getShopImage(m),
      }))

      return response.status(200).json({
        success: true,
        data: formattedMerchants,
        total: formattedMerchants.length
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
        data: stats,
      })
    } catch (error) {
      return response.status(500).json({ success: false, data: null })
    }
  }

  // ✅ Méthode privée pour les statistiques
  private async getShopStats(merchantId: string) {
    try {
      const productsCount = await db
        .from('products')
        .where('user_id', merchantId)
        .count('* as total')

      const ordersCount = await db
        .from('orders')
        .where('merchant_id', merchantId)
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

      return {
        products_count: parseInt(productsCount[0]?.total || '0'),
        orders_count: parseInt(ordersCount[0]?.total || '0'),
        total_revenue: parseFloat(totalRevenue[0]?.total || '0'),
        average_rating: parseFloat(averageRating[0]?.average || '0').toFixed(1),
      }
    } catch (error) {
      return {
        products_count: 0,
        orders_count: 0,
        total_revenue: 0,
        average_rating: '0.0',
      }
    }
  }

  // ✅ Méthode pour filtrer par ID unique
  private removeDuplicatesById(merchants: User[]): User[] {
    const uniqueMerchants = new Map<string, User>()
    
    merchants.forEach(merchant => {
      if (!uniqueMerchants.has(merchant.id)) {
        uniqueMerchants.set(merchant.id, merchant)
      }
    })
    
    return Array.from(uniqueMerchants.values())
  }

  // ✅ Méthodes helper
  private getShopDisplayName(merchant: User): string {
    return merchant.shop_name || merchant.full_name || 'Marchand'
  }

  private getShopImage(merchant: User): string | null {
    return merchant.shop_image || merchant.avatar || null
  }
}
