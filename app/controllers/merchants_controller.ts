// app/controllers/merchants_controller.ts
import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import db from '@adonisjs/lucid/services/db'

export default class MerchantsController {

  // ✅ GET /api/merchants - Liste paginée des marchands VÉRIFIÉS
  async index({ request, response }: HttpContext) {
    try {
      const page = request.input('page', 1)
      const limit = request.input('limit', 10)
      const status = request.input('status')
      const search = request.input('search')

      let query = User.query()
        .whereIn('role', ['merchant', 'marchant', 'marchand'])
        .where('is_verified', true)
        .where('verification_status', 'approved')
        .preload('wallet')
        .select([
          'id',
          'full_name',
          'email',
          'role',
          'avatar',
          'shop_name',
          'shop_image',
          'commercial_name',
          'logo_url',
          'vendor_type',
          'shop_description',
          'country',
          'neighborhood',
          'is_verified',
          'verification_status',
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
            .orWhere('commercial_name', 'LIKE', `%${search}%`)
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
        country: merchant.country,
        neighborhood: merchant.neighborhood,
        vendor_type: merchant.vendor_type,
        shop_description: merchant.shop_description,
        is_verified: merchant.is_verified,
        shop: {
          name: merchant.commercial_name || merchant.shop_name || merchant.full_name,
          image: merchant.logo_url || merchant.shop_image || merchant.avatar,
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
    } catch (error: any) {
      console.error('Erreur index merchants:', error)
      return response.status(500).json({
        success: false,
        message: 'Erreur serveur',
        data: [],
        meta: null
      })
    }
  }

  // ✅ GET /api/merchants/:id - Détail d'un marchand VÉRIFIÉ avec ses produits
  async show({ params, response }: HttpContext) {
    try {
      const merchant = await User.query()
        .where('id', params.id)
        .whereIn('role', ['merchant', 'marchant', 'marchand'])
        .where('is_verified', true)
        .where('verification_status', 'approved')
        .preload('wallet')
        .first()

      if (!merchant) {
        return response.status(404).json({
          success: false,
          message: 'Marchand non trouvé ou non vérifié',
        })
      }

      const products = await db
        .from('products')
        .where('user_id', merchant.id)
        .orderBy('created_at', 'desc')

      const stats = await this.getShopStats(merchant.id)

      // Construction de l'objet shop avec les infos conditionnelles
      const shopData: any = {
        name: merchant.commercial_name || merchant.shop_name || merchant.full_name,
        image: merchant.logo_url || merchant.shop_image || merchant.avatar,
        cover: merchant.cover_photo_url,
        stats: stats,
      }

      // Ajout des infos boutique physique
      if (merchant.vendor_type === 'boutique_physique') {
        shopData.address = merchant.shop_address
        shopData.latitude = merchant.shop_latitude
        shopData.longitude = merchant.shop_longitude
        shopData.photos = {
          facade1: merchant.facade_photo1_url,
          facade2: merchant.facade_photo2_url,
          interior1: merchant.interior_photo1_url,
          interior2: merchant.interior_photo2_url,
        }
      }

      // Ajout des infos vendeur en ligne
      if (merchant.vendor_type === 'vendeur_ligne' || merchant.vendor_type === 'particulier') {
        shopData.stock_address = merchant.stock_address
        shopData.social_media = {
          facebook: merchant.facebook_url,
          instagram: merchant.instagram_url,
          tiktok: merchant.tiktok_url,
        }
        shopData.stock_video = merchant.stock_video_url
      }

      // Ajout du contact WhatsApp
      shopData.whatsapp = merchant.whatsapp_phone
      shopData.is_whatsapp_verified = merchant.is_whatsapp_verified

      return response.status(200).json({
        success: true,
        data: {
          id: merchant.id,
          full_name: merchant.full_name,
          email: merchant.email,
          avatar: merchant.avatar,
          phone: merchant.phone,
          role: merchant.role,
          country: merchant.country,
          neighborhood: merchant.neighborhood,
          residence_address: merchant.residence_address,
          vendor_type: merchant.vendor_type,
          vendor_type_label: merchant.vendorTypeLabel,
          shop_description: merchant.shop_description,
          is_verified: merchant.is_verified,
          verification_status: merchant.verification_status,
          shop: shopData,
          products: products.map((p: any) => ({
            id: p.id,
            name: p.name,
            price: p.price,
            description: p.description,
            image_url: p.image_url,
            stock: p.stock,
            rating: p.rating,
            isNew: p.isNew,
            isOnSale: p.isOnSale,
            category_id: p.category_id,
            created_at: p.created_at,
          })),
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
    } catch (error: any) {
      console.error('Erreur show merchant:', error)
      return response.status(500).json({
        success: false,
        message: 'Erreur serveur',
      })
    }
  }

  // ✅ GET /api/merchants/active - Liste des marchands actifs ET VÉRIFIÉS
  async active({ request, response }: HttpContext) {
    try {
      const page = request.input('page', 1)
      const limit = request.input('limit', 10)

      const merchants = await User.query()
        .whereIn('role', ['merchant', 'marchant', 'marchand'])
        .where('is_verified', true)
        .where('verification_status', 'approved')
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
          country: m.country,
          neighborhood: m.neighborhood,
          vendor_type: m.vendor_type,
          shop: {
            name: m.commercial_name || m.shop_name || m.full_name,
            image: m.logo_url || m.shop_image || m.avatar,
          },
          wallet: m.wallet ? { status: m.wallet.status } : null,
        })),
        meta: {
          total: merchants.total,
          current_page: merchants.currentPage,
          last_page: merchants.lastPage,
        },
      })
    } catch (error: any) {
      console.error('Erreur active merchants:', error)
      return response.status(500).json({
        success: false,
        message: 'Erreur serveur',
        data: []
      })
    }
  }

  // ✅ GET /api/merchants/search?q=xxx - Recherche de marchands VÉRIFIÉS
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
        .where('is_verified', true)
        .where('verification_status', 'approved')
        .where((builder) => {
          builder
            .where('full_name', 'LIKE', `%${searchTerm}%`)
            .orWhere('shop_name', 'LIKE', `%${searchTerm}%`)
            .orWhere('commercial_name', 'LIKE', `%${searchTerm}%`)
            .orWhere('email', 'LIKE', `%${searchTerm}%`)
            .orWhere('shop_description', 'LIKE', `%${searchTerm}%`)
        })
        .preload('wallet')
        .paginate(page, limit)

      return response.status(200).json({
        success: true,
        data: merchants.map(m => ({
          id: m.id,
          full_name: m.full_name,
          country: m.country,
          neighborhood: m.neighborhood,
          vendor_type: m.vendor_type,
          shop_description: m.shop_description,
          shop: {
            name: m.commercial_name || m.shop_name || m.full_name,
            image: m.logo_url || m.shop_image || m.avatar,
          },
        })),
        meta: {
          total: merchants.total,
          current_page: merchants.currentPage,
          last_page: merchants.lastPage,
        },
      })
    } catch (error: any) {
      console.error('Erreur search merchants:', error)
      return response.status(500).json({
        success: false,
        message: 'Erreur serveur',
        data: []
      })
    }
  }

  // ✅ GET /api/merchants/all - TOUS les marchands VÉRIFIÉS avec leurs produits
  async all({ response }: HttpContext) {
    try {
      console.log('=== DÉBUT all merchants (vérifiés uniquement) ===')

      const merchants = await db
        .from('users')
        .whereIn('role', ['merchant', 'marchant', 'marchand'])
        .where('is_verified', true)
        .where('verification_status', 'approved')
        .select([
          'id', 
          'full_name', 
          'shop_name', 
          'commercial_name',
          'shop_image', 
          'logo_url',
          'cover_photo_url',
          'avatar', 
          'email', 
          'country',
          'neighborhood',
          'vendor_type',
          'shop_description',
          'whatsapp_phone',
          'created_at'
        ])
        .orderBy('commercial_name', 'asc')
        .orderBy('shop_name', 'asc')
        .orderBy('full_name', 'asc')

      console.log(`✓ ${merchants.length} marchands vérifiés trouvés`)

      if (merchants.length === 0) {
        return response.status(200).json({
          success: true,
          data: [],
          total: 0
        })
      }

      const formattedMerchants = []

      for (const merchant of merchants) {
        const products = await db
          .from('products')
          .where('user_id', merchant.id)
          .select('*')
          .orderBy('created_at', 'desc')

        const stats = await this.getShopStats(merchant.id)

        formattedMerchants.push({
          id: merchant.id,
          name: merchant.commercial_name || merchant.shop_name || merchant.full_name || 'Marchand',
          image: merchant.logo_url || merchant.shop_image || merchant.avatar || null,
          cover: merchant.cover_photo_url || null,
          email: merchant.email,
          country: merchant.country,
          neighborhood: merchant.neighborhood,
          vendor_type: merchant.vendor_type,
          shop_description: merchant.shop_description,
          whatsapp: merchant.whatsapp_phone,
          created_at: merchant.created_at,
          stats: stats,
          products: products.map((p: any) => ({
            id: p.id,
            name: p.name,
            price: p.price,
            description: p.description,
            image_url: p.image_url,
            stock: p.stock,
            rating: p.rating,
            isNew: p.isNew,
            isOnSale: p.isOnSale,
            category_id: p.category_id,
            created_at: p.created_at,
            updated_at: p.updated_at,
          })),
          products_count: products.length
        })
      }

      console.log(`=== FIN all merchants - ${formattedMerchants.length} marchands formatés ===`)

      return response.status(200).json({
        success: true,
        data: formattedMerchants,
        total: formattedMerchants.length
      })

    } catch (error: any) {
      console.error('=== ERREUR all merchants ===')
      console.error('Message:', error.message)

      return response.status(500).json({
        success: false,
        message: `Erreur: ${error.message}`,
        data: []
      })
    }
  }

  // ✅ GET /api/merchants/:id/stats - Statistiques d'un marchand VÉRIFIÉ
  async stats({ params, response }: HttpContext) {
    try {
      const merchant = await db
        .from('users')
        .where('id', params.id)
        .whereIn('role', ['merchant', 'marchant', 'marchand'])
        .where('is_verified', true)
        .where('verification_status', 'approved')
        .first()

      if (!merchant) {
        return response.status(404).json({
          success: false,
          message: 'Marchand non trouvé ou non vérifié',
        })
      }

      const stats = await this.getShopStats(merchant.id)

      return response.status(200).json({
        success: true,
        data: {
          merchant_id: merchant.id,
          merchant_name: merchant.commercial_name || merchant.shop_name || merchant.full_name,
          country: merchant.country,
          neighborhood: merchant.neighborhood,
          vendor_type: merchant.vendor_type,
          ...stats
        },
      })
    } catch (error: any) {
      console.error('Erreur stats merchant:', error)
      return response.status(500).json({
        success: false,
        message: 'Erreur serveur',
        data: null
      })
    }
  }

  // ✅ GET /api/merchants/:id/products - Produits paginés d'un marchand VÉRIFIÉ
  async merchantProducts({ params, request, response }: HttpContext) {
    try {
      const merchantId = params.id
      const page = request.input('page', 1)
      const limit = request.input('limit', 20)

      const merchant = await db
        .from('users')
        .where('id', merchantId)
        .whereIn('role', ['merchant', 'marchant', 'marchand'])
        .where('is_verified', true)
        .where('verification_status', 'approved')
        .first()

      if (!merchant) {
        return response.status(404).json({
          success: false,
          message: 'Marchand non trouvé ou non vérifié',
        })
      }

      const offset = (page - 1) * limit

      const products = await db
        .from('products')
        .where('user_id', merchantId)
        .orderBy('created_at', 'desc')
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
            name: merchant.commercial_name || merchant.shop_name || merchant.full_name,
            image: merchant.logo_url || merchant.shop_image || merchant.avatar,
            email: merchant.email,
            country: merchant.country,
            neighborhood: merchant.neighborhood,
            vendor_type: merchant.vendor_type,
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
    } catch (error: any) {
      console.error('Erreur merchant products:', error)
      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des produits',
      })
    }
  }

  // ✅ Méthode privée pour calculer les statistiques d'une boutique
  private async getShopStats(merchantId: string) {
    try {
      const productsCount = await db
        .from('products')
        .where('user_id', merchantId)
        .count('* as total')

      const ordersCount = await db
        .from('orders')
        .where('user_id', merchantId)
        .count('* as total')

      const completedOrdersCount = await db
        .from('orders')
        .where('user_id', merchantId)
        .where('status', 'completed')
        .count('* as total')

      const totalRevenue = await db
        .from('orders')
        .where('user_id', merchantId)
        .where('status', 'completed')
        .sum('total_amount as total')

      const averageRating = await db
        .from('reviews')
        .where('user_id', merchantId)
        .avg('rating as average')

      const reviewsCount = await db
        .from('reviews')
        .where('user_id', merchantId)
        .count('* as total')

      return {
        products: {
          total: parseInt(productsCount[0]?.total || '0'),
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
    } catch (error: any) {
      console.error('Erreur getShopStats:', error)
      return {
        products: { total: 0 },
        orders: { total: 0, completed: 0 },
        revenue: { total: 0 },
        reviews: { average: '0.0', total: 0 }
      }
    }
  }
}
