import type { HttpContext } from '@adonisjs/core/http'
import Promotion from '#models/promotion'
import redis from '@adonisjs/redis/services/main'

export default class PromotionsController {

  // Durées de cache (en secondes)
  private readonly CACHE_TTL = {
    LIST: 300,          // 5 minutes
    BANNERS: 600,       // 10 minutes
    FLASH_SALES: 300,   // 5 minutes
    PROMOTION: 1800,    // 30 minutes
    STATS: 300          // 5 minutes
  }

  /**
   * 🔧 Générer une clé de cache pour la liste des promotions
   */
  private getListCacheKey(status: string, type?: string, category?: string, limit?: number): string {
    return `promotions:list:${status}:${type || 'all'}:${category || 'all'}:${limit || 'all'}`
  }

  /**
   * 🔧 Générer une clé de cache pour une promotion
   */
  private getPromotionCacheKey(id: number): string {
    return `promotion:${id}`
  }

  /**
   * 🔧 Invalider tous les caches de promotions
   */
  private async invalidateAllCaches(promotionId?: number): Promise<void> {
    if (promotionId) {
      await redis.del(this.getPromotionCacheKey(promotionId))
    }

    // Invalider les listes
    const listKeys = await redis.keys('promotions:list:*')
    if (listKeys.length > 0) {
      await redis.del(...listKeys)
    }

    // Invalider les bannières et flash sales
    await redis.del('promotions:banners')
    await redis.del('promotions:flash_sales')
    await redis.del('promotions:active_count')
    await redis.del('promotions:stats')
  }

  /**
   * 🔧 Vérifier si une promotion est active
   */
  private isPromotionActive(promotion: Promotion): boolean {
    const now = new Date()
    const startDate = promotion.startDate ? new Date(promotion.startDate.toString()) : null
    const endDate = promotion.endDate ? new Date(promotion.endDate.toString()) : null

    if (promotion.status !== 'active') return false
    if (startDate && now < startDate) return false
    if (endDate && now > endDate) return false

    return true
  }

  /**
   * 📋 Récupérer toutes les promotions (avec cache)
   */
  async index({ request, response }: HttpContext) {
    try {
      const status = request.input('status', 'active')
      const type = request.input('type')
      const category = request.input('category')
      const limit = request.input('limit', 50)
      const page = request.input('page', 1)

      const cacheKey = this.getListCacheKey(status, type, category, limit) + `:page:${page}`

      // 🔍 Vérifier le cache
      const cached = await redis.get(cacheKey)
      if (cached) {
        return response.json({
          success: true,
          source: 'cache',
          ...JSON.parse(cached)
        })
      }

      const now = new Date()
      let query = Promotion.query()

      // Filtre par statut
      if (status !== 'all') {
        query = query.where('status', status)
      }

      // Filtre par type
      if (type) {
        query = query.where('type', type)
      }

      // Filtre par catégorie
      if (category) {
        query = query.where('category', category)
      }

      const promotions = await query
        .orderBy('priority', 'desc')
        .orderBy('created_at', 'desc')

      // Filtrer les promotions actives par date
      let filteredPromotions = promotions
      if (status === 'active') {
        filteredPromotions = promotions.filter(p => this.isPromotionActive(p))
      }

      // Pagination manuelle
      const offset = (page - 1) * limit
      const paginatedPromotions = filteredPromotions.slice(offset, offset + limit)

      const responseData = {
        data: paginatedPromotions,
        meta: {
          total: filteredPromotions.length,
          page: page,
          limit: limit,
          totalPages: Math.ceil(filteredPromotions.length / limit),
          status: status,
          type: type || 'all',
          category: category || 'all'
        }
      }

      // 💾 Mettre en cache
      await redis.set(cacheKey, JSON.stringify(responseData), 'EX', this.CACHE_TTL.LIST)

      // 📊 Incrémenter le compteur de vues
      await redis.incr('promotions:views:total')

      return response.json({
        success: true,
        source: 'database',
        ...responseData
      })

    } catch (error: any) {
      console.error('❌ Erreur index promotions:', error)
      return response.status(500).json({
        success: false,
        message: error.message,
      })
    }
  }

  /**
   * 📖 Récupérer une promotion spécifique (avec cache)
   */
  async show({ params, response }: HttpContext) {
    try {
      const cacheKey = this.getPromotionCacheKey(params.id)

      // 🔍 Vérifier le cache
      const cached = await redis.get(cacheKey)
      if (cached) {
        // Incrémenter les vues
        await redis.incr(`promotion:views:${params.id}`)

        return response.json({
          success: true,
          source: 'cache',
          data: JSON.parse(cached)
        })
      }

      const promotion = await Promotion.find(params.id)

      if (!promotion) {
        return response.status(404).json({
          success: false,
          message: 'Promotion non trouvée',
        })
      }

      // 💾 Mettre en cache
      await redis.set(cacheKey, JSON.stringify(promotion), 'EX', this.CACHE_TTL.PROMOTION)

      // 📊 Incrémenter les vues
      await redis.incr(`promotion:views:${params.id}`)

      return response.json({
        success: true,
        source: 'database',
        data: promotion,
      })

    } catch (error: any) {
      console.error('❌ Erreur show promotion:', error)
      return response.status(500).json({
        success: false,
        message: error.message,
      })
    }
  }

  /**
   * 🎯 Récupérer les bannières actives (avec cache)
   */
  async banners({ response }: HttpContext) {
    try {
      const cacheKey = 'promotions:banners'

      // 🔍 Vérifier le cache
      const cached = await redis.get(cacheKey)
      if (cached) {
        // Incrémenter les impressions
        await redis.incr('promotions:banners:impressions')

        return response.json({
          success: true,
          source: 'cache',
          data: JSON.parse(cached)
        })
      }

      const now = new Date()
      const banners = await Promotion.query()
        .where('type', 'banner')
        .where('status', 'active')
        .orderBy('priority', 'desc')
        .orderBy('created_at', 'desc')

      // Filtrer par date
      const activeBanners = banners.filter(banner => this.isPromotionActive(banner))

      // 💾 Mettre en cache
      await redis.set(cacheKey, JSON.stringify(activeBanners), 'EX', this.CACHE_TTL.BANNERS)

      // 📊 Incrémenter les impressions
      await redis.incr('promotions:banners:impressions')

      return response.json({
        success: true,
        source: 'database',
        data: activeBanners,
      })

    } catch (error: any) {
      console.error('❌ Erreur banners:', error)
      return response.status(500).json({
        success: false,
        message: error.message,
      })
    }
  }

  /**
   * ⚡ Récupérer les offres flash actives (avec cache)
   */
  async flashSales({ response }: HttpContext) {
    try {
      const cacheKey = 'promotions:flash_sales'

      // 🔍 Vérifier le cache
      const cached = await redis.get(cacheKey)
      if (cached) {
        // Incrémenter les vues
        await redis.incr('promotions:flash_sales:views')

        return response.json({
          success: true,
          source: 'cache',
          data: JSON.parse(cached)
        })
      }

      const now = new Date()
      const flashSales = await Promotion.query()
        .where('type', 'flash_sale')
        .where('status', 'active')
        .orderBy('priority', 'desc')
        .orderBy('end_date', 'asc')

      // Filtrer par date de fin
      const activeFlashSales = flashSales.filter(sale => {
        if (sale.status !== 'active') return false
        const endDate = sale.endDate ? new Date(sale.endDate.toString()) : null
        return endDate && now <= endDate
      })

      // Ajouter le temps restant
      const flashSalesWithCountdown = activeFlashSales.map(sale => {
        const endDate = sale.endDate ? new Date(sale.endDate.toString()) : null
        const timeLeft = endDate ? Math.max(0, endDate.getTime() - now.getTime()) : 0

        return {
          ...sale.toJSON(),
          time_left_ms: timeLeft,
          time_left_formatted: this.formatTimeLeft(timeLeft)
        }
      })

      // 💾 Mettre en cache (TTL plus court pour les flash sales)
      await redis.set(cacheKey, JSON.stringify(flashSalesWithCountdown), 'EX', this.CACHE_TTL.FLASH_SALES)

      // 📊 Incrémenter les vues
      await redis.incr('promotions:flash_sales:views')

      return response.json({
        success: true,
        source: 'database',
        data: flashSalesWithCountdown,
      })

    } catch (error: any) {
      console.error('❌ Erreur flashSales:', error)
      return response.status(500).json({
        success: false,
        message: error.message,
      })
    }
  }

  /**
   * ➕ Créer une promotion (avec rate limiting)
   */
  async store({ request, response }: HttpContext) {
    try {
      const clientIp = request.ip()

      // 🔒 Rate limiting : Max 10 créations par IP en 1 heure
      const rateLimitKey = `promotions:create:${clientIp}`
      const attempts = await redis.incr(rateLimitKey)

      if (attempts === 1) {
        await redis.expire(rateLimitKey, 3600)
      }

      if (attempts > 10) {
        const ttl = await redis.ttl(rateLimitKey)
        const minutes = Math.ceil(ttl / 60)
        return response.status(429).json({
          success: false,
          message: `Limite de création atteinte. Réessayez dans ${minutes} minute${minutes > 1 ? 's' : ''}.`
        })
      }

      const data = request.only([
        'title',
        'description',
        'image_url',
        'banner_image',
        'type',
        'discount_percentage',
        'discount_amount',
        'category',
        'product_ids',
        'link',
        'button_text',
        'min_order_amount',
        'start_date',
        'end_date',
        'status',
        'priority',
      ])

      // Transformer product_ids en JSON si présent
      if (data.product_ids && typeof data.product_ids === 'string') {
        try {
          data.product_ids = JSON.stringify(data.product_ids.split(',').map(id => id.trim()))
        } catch {
          data.product_ids = JSON.stringify([data.product_ids])
        }
      }

      const promotion = await Promotion.create(data)

      // 🗑️ Invalider tous les caches
      await this.invalidateAllCaches()

      // 📊 Mettre à jour les statistiques
      await redis.incr('promotions:stats:total_created')
      await redis.hincrby('promotions:stats:by_type', promotion.type, 1)

      // Si active, mettre à jour le compteur
      if (promotion.status === 'active') {
        await redis.incr('promotions:active_count')
      }

      return response.status(201).json({
        success: true,
        data: promotion,
        message: 'Promotion créée avec succès'
      })

    } catch (error: any) {
      console.error('❌ Erreur store promotion:', error)
      return response.status(500).json({
        success: false,
        message: error.message,
      })
    }
  }

  /**
   * 🔄 Mettre à jour une promotion
   */
  async update({ params, request, response }: HttpContext) {
    try {
      const promotion = await Promotion.find(params.id)

      if (!promotion) {
        return response.status(404).json({
          success: false,
          message: 'Promotion non trouvée',
        })
      }

      const oldStatus = promotion.status
      const oldType = promotion.type

      const data = request.only([
        'title',
        'description',
        'image_url',
        'banner_image',
        'type',
        'discount_percentage',
        'discount_amount',
        'category',
        'product_ids',
        'link',
        'button_text',
        'min_order_amount',
        'start_date',
        'end_date',
        'status',
        'priority',
      ])

      promotion.merge(data)
      await promotion.save()

      // 🗑️ Invalider tous les caches
      await this.invalidateAllCaches(params.id)

      // Mettre à jour les statistiques
      if (oldStatus !== promotion.status) {
        if (promotion.status === 'active') {
          await redis.incr('promotions:active_count')
        } else if (oldStatus === 'active') {
          await redis.decr('promotions:active_count')
        }
      }

      if (oldType !== promotion.type) {
        await redis.hincrby('promotions:stats:by_type', oldType, -1)
        await redis.hincrby('promotions:stats:by_type', promotion.type, 1)
      }

      // 📝 Logger la modification
      const auditKey = `promotions:audit:${promotion.id}`
      await redis.lpush(
        auditKey,
        JSON.stringify({
          action: 'update',
          timestamp: new Date().toISOString(),
          changes: data
        })
      )
      await redis.ltrim(auditKey, 0, 9)
      await redis.expire(auditKey, 86400 * 30)

      return response.json({
        success: true,
        data: promotion,
        message: 'Promotion mise à jour avec succès'
      })

    } catch (error: any) {
      console.error('❌ Erreur update promotion:', error)
      return response.status(500).json({
        success: false,
        message: error.message,
      })
    }
  }

  /**
   * ❌ Supprimer une promotion
   */
  async destroy({ params, response }: HttpContext) {
    try {
      const promotion = await Promotion.find(params.id)

      if (!promotion) {
        return response.status(404).json({
          success: false,
          message: 'Promotion non trouvée',
        })
      }

      const promotionId = promotion.id
      const status = promotion.status
      const type = promotion.type

      await promotion.delete()

      // 🗑️ Invalider tous les caches
      await this.invalidateAllCaches(promotionId)

      // 🧹 Nettoyer les données Redis
      await redis.del(`promotion:views:${promotionId}`)
      await redis.del(`promotion:clicks:${promotionId}`)

      // Mettre à jour les statistiques
      await redis.incr('promotions:stats:total_deleted')
      await redis.hincrby('promotions:stats:by_type', type, -1)

      if (status === 'active') {
        await redis.decr('promotions:active_count')
      }

      return response.json({
        success: true,
        message: 'Promotion supprimée avec succès'
      })

    } catch (error: any) {
      console.error('❌ Erreur destroy promotion:', error)
      return response.status(500).json({
        success: false,
        message: error.message,
      })
    }
  }

  /**
   * 🖱️ Enregistrer un clic sur une promotion
   */
  async trackClick({ params, request, response }: HttpContext) {
    try {
      const promotionId = params.id
      const userId = request.input('userId')
      const clientIp = request.ip()

      // Incrémenter le compteur de clics
      await redis.incr(`promotion:clicks:${promotionId}`)

      // Enregistrer dans les statistiques quotidiennes
      const today = new Date().toISOString().split('T')[0]
      await redis.hincrby(`promotion:daily_clicks:${today}`, promotionId.toString(), 1)

      // Logger le clic
      const clickKey = `promotion:clicks:log:${promotionId}`
      await redis.lpush(
        clickKey,
        JSON.stringify({
          user_id: userId,
          ip: clientIp,
          timestamp: new Date().toISOString(),
          user_agent: request.header('User-Agent')
        })
      )
      await redis.ltrim(clickKey, 0, 99)
      await redis.expire(clickKey, 86400 * 7)

      return response.json({
        success: true,
        message: 'Clic enregistré'
      })

    } catch (error: any) {
      console.error('❌ Erreur trackClick:', error)
      // Ne pas bloquer l'utilisateur si l'enregistrement échoue
      return response.json({
        success: true,
        message: 'OK'
      })
    }
  }

  /**
   * 📊 Statistiques des promotions
   */
  async stats({ request, response }: HttpContext) {
    try {
      const promotionId = request.input('promotion_id')
      const cacheKey = promotionId
        ? `promotions:stats:${promotionId}`
        : 'promotions:stats:global'

      // Vérifier le cache
      const cached = await redis.get(cacheKey)
      if (cached) {
        return response.json({
          success: true,
          source: 'cache',
          data: JSON.parse(cached)
        })
      }

      let stats: any = {}

      if (promotionId) {
        // Stats pour une promotion spécifique
        const promotion = await Promotion.find(promotionId)

        if (!promotion) {
          return response.status(404).json({
            success: false,
            message: 'Promotion non trouvée'
          })
        }

        const views = await redis.get(`promotion:views:${promotionId}`) || '0'
        const clicks = await redis.get(`promotion:clicks:${promotionId}`) || '0'

        const ctr = parseInt(views) > 0
          ? (parseInt(clicks) / parseInt(views) * 100).toFixed(2)
          : '0'

        stats = {
          id: promotion.id,
          title: promotion.title,
          type: promotion.type,
          status: promotion.status,
          views: parseInt(views),
          clicks: parseInt(clicks),
          ctr: parseFloat(ctr),
          created_at: promotion.createdAt,
          updated_at: promotion.updatedAt
        }

      } else {
        // Stats globales
        const totalPromotions = await Promotion.query().count('* as total')
        const activePromotions = await Promotion.query().where('status', 'active').count('* as total')

        const byType = await Promotion.query()
          .select('type')
          .count('* as count')
          .groupBy('type')

        const byStatus = await Promotion.query()
          .select('status')
          .count('* as count')
          .groupBy('status')

        const totalViews = await redis.get('promotions:views:total') || '0'
        const bannerImpressions = await redis.get('promotions:banners:impressions') || '0'
        const flashSaleViews = await redis.get('promotions:flash_sales:views') || '0'

        // Récupérer les promotions les plus performantes
        const topPromotions = []
        const allPromotions = await Promotion.query().select('id', 'title', 'type').limit(50)

        for (const promo of allPromotions) {
          const views = await redis.get(`promotion:views:${promo.id}`) || '0'
          const clicks = await redis.get(`promotion:clicks:${promo.id}`) || '0'

          if (parseInt(views) > 0) {
            topPromotions.push({
              id: promo.id,
              title: promo.title,
              type: promo.type,
              views: parseInt(views),
              clicks: parseInt(clicks),
              ctr: (parseInt(clicks) / parseInt(views) * 100)
            })
          }
        }

        topPromotions.sort((a, b) => b.views - a.views)

        stats = {
          total_promotions: parseInt(totalPromotions[0].$extras.total) || 0,
          active_promotions: parseInt(activePromotions[0].$extras.total) || 0,
          by_type: byType.reduce((acc, curr) => {
            acc[curr.type] = parseInt(curr.$extras.count)
            return acc
          }, {} as Record<string, number>),
          by_status: byStatus.reduce((acc, curr) => {
            acc[curr.status] = parseInt(curr.$extras.count)
            return acc
          }, {} as Record<string, number>),
          total_views: parseInt(totalViews),
          banner_impressions: parseInt(bannerImpressions),
          flash_sale_views: parseInt(flashSaleViews),
          top_promotions: topPromotions.slice(0, 10)
        }
      }

      // Mettre en cache
      await redis.set(cacheKey, JSON.stringify(stats), 'EX', this.CACHE_TTL.STATS)

      return response.json({
        success: true,
        source: 'database',
        data: stats
      })

    } catch (error: any) {
      console.error('❌ Erreur stats:', error)
      return response.status(500).json({
        success: false,
        message: error.message,
      })
    }
  }

  /**
   * 🔧 Formater le temps restant
   */
  private formatTimeLeft(ms: number): string {
    if (ms <= 0) return 'Terminé'

    const days = Math.floor(ms / (1000 * 60 * 60 * 24))
    const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60))

    if (days > 0) return `${days}j ${hours}h`
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes} min`
  }

  /**
   * 🧹 Nettoyer les promotions expirées
   */
  async cleanupExpired({ response }: HttpContext) {
    try {
      const now = new Date()

      const expiredPromotions = await Promotion.query()
        .where('status', 'active')
        .whereNotNull('end_date')
        .where('end_date', '<', now)

      let count = 0
      for (const promo of expiredPromotions) {
        promo.status = 'expired'
        await promo.save()
        count++
      }

      if (count > 0) {
        await this.invalidateAllCaches()
      }

      return response.json({
        success: true,
        message: `${count} promotion(s) marquée(s) comme expirée(s)`
      })

    } catch (error: any) {
      console.error('❌ Erreur cleanup:', error)
      return response.status(500).json({
        success: false,
        message: error.message,
      })
    }
  }
}
