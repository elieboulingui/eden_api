// app/controllers/merchants_controller.ts
import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import db from '@adonisjs/lucid/services/db'

export default class MerchantsController {
  /**
   * Récupérer tous les marchands avec leurs boutiques
   * GET /api/merchants
   * GET /api/merchants?page=1&limit=10
   * GET /api/merchants?status=active
   * GET /api/merchants?search=nom
   */
  // app/controllers/merchants_controller.ts - méthode index()
  async index({ request, response }: HttpContext) {
    try {
      const page = request.input('page', 1)
      const limit = request.input('limit', 10)
      const status = request.input('status')
      const search = request.input('search')

      let query = User.query()
        .where('role', 'merchant')
        .preload('wallet')
        .select([
          'id',
          'full_name',
          'email',
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
        shop: {
          name: merchant.shop_name,
          image: merchant.shop_image,
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

      // ✅ Format de réponse cohérent
      return response.status(200).json({
        success: true,
        data: formattedMerchants,
        meta: {
          total: merchants.total,
          per_page: merchants.perPage,
          current_page: merchants.currentPage,
          last_page: merchants.lastPage,
          first_page: merchants.firstPage,
          first_page_url: merchants.getUrl(1),
          last_page_url: merchants.getUrl(merchants.lastPage),
          next_page_url: merchants.getNextPageUrl(),
          previous_page_url: merchants.getPreviousPageUrl(),
        },
      })
    } catch (error) {
      console.error('Erreur:', error)
      return response.status(500).json({
        success: false,
        message: 'Erreur serveur',
        data: [],  // ✅ Toujours renvoyer un tableau vide
        meta: null
      })
    }
  }

  /**
   * Récupérer un marchand spécifique avec sa boutique
   * GET /api/merchants/:id
   */
  async show({ params, response }: HttpContext) {
    try {
      const merchantId = params.id // ✅ Garder comme string (UUID)

      const merchant = await User.query()
        .where('id', merchantId)
        .where('role', 'merchant')
        .preload('wallet')
        .select([
          'id',
          'full_name',
          'email',
          'avatar',
          'shop_name',
          'shop_image',
          'created_at',
          'updated_at'
        ])
        .first()

      if (!merchant) {
        return response.status(404).json({
          success: false,
          message: 'Marchand non trouvé',
        })
      }

      // Récupérer les statistiques de la boutique
      const stats = await this.getShopStats(merchant.id)

      const formattedMerchant = {
        id: merchant.id,
        full_name: merchant.full_name,
        email: merchant.email,
        avatar: merchant.avatar,
        shop: {
          name: merchant.shop_name,
          image: merchant.shop_image,
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
      }

      return response.status(200).json({
        success: true,
        data: formattedMerchant,
      })
    } catch (error) {
      console.error('Erreur lors de la récupération du marchand:', error)
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue'
      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération du marchand',
        error: errorMessage,
      })
    }
  }

  /**
   * Récupérer tous les marchands actifs
   * GET /api/merchants/active
   */
  async active({ request, response }: HttpContext) {
    try {
      const page = request.input('page', 1)
      const limit = request.input('limit', 10)

      const merchants = await User.query()
        .where('role', 'merchant')
        .whereHas('wallet', (walletQuery) => {
          walletQuery.where('status', 'active')
        })
        .preload('wallet')
        .select([
          'id',
          'full_name',
          'email',
          'avatar',
          'shop_name',
          'shop_image',
          'created_at',
          'updated_at'
        ])
        .paginate(page, limit)

      const formattedMerchants = merchants.map((merchant) => ({
        id: merchant.id,
        full_name: merchant.full_name,
        email: merchant.email,
        avatar: merchant.avatar,
        shop: {
          name: merchant.shop_name,
          image: merchant.shop_image,
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
      console.error('Erreur lors de la récupération des marchands actifs:', error)
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue'
      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des marchands actifs',
        error: errorMessage,
      })
    }
  }

  /**
   * Récupérer les statistiques d'une boutique
   * GET /api/merchants/:id/stats
   */
  async stats({ params, response }: HttpContext) {
    try {
      const merchantId = params.id // ✅ Garder comme string (UUID)

      const merchant = await User.query()
        .where('id', merchantId)
        .where('role', 'merchant')
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
      console.error('Erreur lors de la récupération des statistiques:', error)
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue'
      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des statistiques',
        error: errorMessage,
      })
    }
  }

  /**
   * Rechercher des marchands
   * GET /api/merchants/search?q=terme
   */
  async search({ request, response }: HttpContext) {
    try {
      const searchTerm = request.input('q', '')
      const page = request.input('page', 1)
      const limit = request.input('limit', 10)

      if (!searchTerm || searchTerm.length < 2) {
        return response.status(400).json({
          success: false,
          message: 'Le terme de recherche doit contenir au moins 2 caractères',
        })
      }

      const merchants = await User.query()
        .where('role', 'merchant')
        .where((builder) => {
          builder
            .where('full_name', 'LIKE', `%${searchTerm}%`)
            .orWhere('shop_name', 'LIKE', `%${searchTerm}%`)
            .orWhere('email', 'LIKE', `%${searchTerm}%`)
        })
        .preload('wallet')
        .select([
          'id',
          'full_name',
          'email',
          'avatar',
          'shop_name',
          'shop_image',
          'created_at',
          'updated_at'
        ])
        .paginate(page, limit)

      const formattedMerchants = merchants.map((merchant) => ({
        id: merchant.id,
        full_name: merchant.full_name,
        email: merchant.email,
        avatar: merchant.avatar,
        shop: {
          name: merchant.shop_name,
          image: merchant.shop_image,
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
        search_term: searchTerm,
      })
    } catch (error) {
      console.error('Erreur lors de la recherche des marchands:', error)
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue'
      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la recherche des marchands',
        error: errorMessage,
      })
    }
  }

  /**
   * Récupérer tous les marchands (sans pagination) - pour les listes déroulantes
   * GET /api/merchants/all
   */
  async all({ response }: HttpContext) {
    try {
      const merchants = await User.query()
        .where('role', 'merchant')
        .select(['id', 'full_name', 'shop_name', 'shop_image', 'avatar'])
        .orderBy('shop_name', 'asc')

      const formattedMerchants = merchants.map((merchant) => ({
        id: merchant.id,
        name: merchant.shop_name || merchant.full_name,
        image: merchant.shop_image || merchant.avatar,
      }))

      return response.status(200).json({
        success: true,
        data: formattedMerchants,
        total: merchants.length,
      })
    } catch (error) {
      console.error('Erreur lors de la récupération des marchands:', error)
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue'
      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des marchands',
        error: errorMessage,
      })
    }
  }

  /**
   * Méthode privée pour récupérer les statistiques d'une boutique
   */
  private async getShopStats(merchantId: string) { // ✅ Changé de number à string
    try {
      // Nombre de produits
      const productsCount = await db
        .from('products')
        .where('user_id', merchantId)
        .count('* as total')

      // Nombre de commandes
      const ordersCount = await db
        .from('orders')
        .where('merchant_id', merchantId)
        .count('* as total')

      // Chiffre d'affaires total
      const totalRevenue = await db
        .from('orders')
        .where('merchant_id', merchantId)
        .where('status', 'completed')
        .sum('total_amount as total')

      // Note moyenne (si vous avez un système de notation)
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
      console.error('Erreur lors du calcul des statistiques:', error)
      return {
        products_count: 0,
        orders_count: 0,
        total_revenue: 0,
        average_rating: '0.0',
      }
    }
  }
}