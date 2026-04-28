import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'

export default class MerchantsController {

  // ✅ GET /api/admin/merchants/:id/details - Admin voir détails marchand
  async adminShow({ params, response }: HttpContext) {
    try {
      const merchant = await User.query()
        .where('id', params.id)
        .whereIn('role', ['marchant', 'merchant'])
        .preload('products', (query) => {
          query.where('is_archived', false).limit(10)
        })
        .preload('wallet')
        .first()

      if (!merchant) {
        return response.status(404).json({
          success: false,
          message: 'Marchand non trouvé'
        })
      }

      return response.status(200).json({
        success: true,
        data: merchant
      })
    } catch (error) {
      console.error('Erreur adminShow:', error)
      return response.status(500).json({
        success: false,
        message: 'Erreur serveur'
      })
    }
  }

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

  // ✅ GET /api/merchants/all - TOUS les marchands VÉRIFIÉS
  async all({ response }: HttpContext) {
    try {
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

      return response.status(200).json({
        success: true,
        data: formattedMerchants,
        total: formattedMerchants.length
      })
    } catch (error: any) {
      console.error('Erreur all merchants:', error)
      return response.status(500).json({
        success: false,
        message: `Erreur: ${error.message}`,
        data: []
      })
    }
  }

  // ✅ PATCH /api/admin/merchants/:id/verify - Vérifier un marchand
  async verifyMerchant({ params, request, response }: HttpContext) {
    const merchant = await User.find(params.id)
    if (!merchant) {
      return response.notFound({ message: 'Marchand non trouvé' })
    }

    // Force l'approbation
    merchant.is_verified = true
    merchant.verification_status = 'approved'
    merchant.verified_at = DateTime.now()
    merchant.verified_by = request.ctx?.auth?.user?.id || null
    merchant.rejection_reason = null

    await merchant.save()

    // ✅ Recharge le marchand depuis la base de données pour avoir les vraies valeurs
    const updatedMerchant = await User.find(params.id)

    console.log('✅ Marchand vérifié:', {
      id: updatedMerchant?.id,
      is_verified: updatedMerchant?.is_verified,
      verification_status: updatedMerchant?.verification_status
    })

    return response.ok({
      success: true,
      message: 'Marchand vérifié avec succès',
      data: {
        id: updatedMerchant?.id,
        is_verified: updatedMerchant?.is_verified,
        verification_status: updatedMerchant?.verification_status
      }
    })
  }

  // ✅ POST /api/admin/merchants/:id/reject - Rejeter un marchand
  async rejectMerchant({ params, request, response }: HttpContext) {
    const merchant = await User.find(params.id)
    if (!merchant) {
      return response.notFound({ message: 'Marchand non trouvé' })
    }

    const { reason } = request.body()
    merchant.is_verified = false;
    merchant.verification_status = 'rejected';
    merchant.rejection_reason = reason || null;
    await merchant.save()

    return response.ok({
      success: true,
      message: 'Marchand rejeté avec succès'
    })
  }

  // ✅ GET /api/merchants/:id - Détail d'un marchand VÉRIFIÉ pour API publique
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

      const shopData: any = {
        name: merchant.commercial_name || merchant.shop_name || merchant.full_name,
        image: merchant.logo_url || merchant.shop_image || merchant.avatar,
        cover: merchant.cover_photo_url,
        stats: stats,
      }

      if (merchant.vendor_type === 'boutique_physique') {
        shopData.address = (merchant as any).shop_address
        shopData.latitude = (merchant as any).shop_latitude
        shopData.longitude = (merchant as any).shop_longitude
        shopData.photos = {
          facade1: (merchant as any).facade_photo1_url,
          facade2: (merchant as any).facade_photo2_url,
          interior1: (merchant as any).interior_photo1_url,
          interior2: (merchant as any).interior_photo2_url,
        }
      }

      if (merchant.vendor_type === 'vendeur_ligne' || merchant.vendor_type === 'particulier') {
        shopData.stock_address = (merchant as any).stock_address
        shopData.social_media = {
          facebook: (merchant as any).facebook_url,
          instagram: (merchant as any).instagram_url,
          tiktok: (merchant as any).tiktok_url,
        }
        shopData.stock_video = (merchant as any).stock_video_url
      }

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
          vendor_type_label: (merchant as any).vendorTypeLabel,
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

  // ✅ Méthode privée pour les statistiques
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
        products: { total: parseInt(productsCount[0]?.total || '0') },
        orders: {
          total: parseInt(ordersCount[0]?.total || '0'),
          completed: parseInt(completedOrdersCount[0]?.total || '0')
        },
        revenue: { total: parseFloat(totalRevenue[0]?.total || '0') },
        reviews: {
          average: parseFloat(averageRating[0]?.average || '0').toFixed(1),
          total: parseInt(reviewsCount[0]?.total || '0')
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
