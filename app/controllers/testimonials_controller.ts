import type { HttpContext } from '@adonisjs/core/http'
import Testimonial from '#models/testimonial'
import User from '#models/user'
import redis from '@adonisjs/redis/services/main'

export default class TestimonialsController {

  // Durées de cache (en secondes)
  private readonly CACHE_TTL = {
    LIST: 600,          // 10 minutes
    TESTIMONIAL: 1800,  // 30 minutes
    TOP: 3600,          // 1 heure
    STATS: 300          // 5 minutes
  }

  /**
   * 🔧 Générer une clé de cache pour la liste
   */
  private getListCacheKey(page: number = 1, limit: number = 20, filter: string = 'all'): string {
    return `testimonials:list:${page}:${limit}:${filter}`
  }

  /**
   * 🔧 Générer une clé de cache pour un témoignage
   */
  private getTestimonialCacheKey(id: number): string {
    return `testimonial:${id}`
  }

  /**
   * 🔧 Invalider les caches
   */
  private async invalidateCaches(testimonialId?: number): Promise<void> {
    if (testimonialId) {
      await redis.del(this.getTestimonialCacheKey(testimonialId))
    }

    // Invalider les listes
    const listKeys = await redis.keys('testimonials:list:*')
    if (listKeys.length > 0) {
      await redis.del(...listKeys)
    }

    // Invalider les tops
    await redis.del('testimonials:top')
    await redis.del('testimonials:stats')
  }

  /**
   * 📋 Lister les témoignages (avec cache et filtres)
   */
  async index({ request, response }: HttpContext) {
    try {
      const page = request.input('page', 1)
      const limit = request.input('limit', 20)
      const rating = request.input('rating') // Filtrer par note
      const userId = request.input('user_id') // Filtrer par utilisateur
      const sort = request.input('sort', 'recent') // recent, oldest, highest, lowest

      const filter = `${rating || 'all'}:${userId || 'all'}:${sort}`
      const cacheKey = this.getListCacheKey(page, limit, filter)

      // 🔍 Vérifier le cache
      const cached = await redis.get(cacheKey)
      if (cached) {
        return response.status(200).json({
          success: true,
          source: 'cache',
          data: JSON.parse(cached)
        })
      }

      // Construire la requête
      let query = Testimonial.query()
        .preload('user', (q) => q.select(['id', 'full_name', 'email', 'avatar']))
        .where('is_approved', true) // Uniquement les témoignages approuvés

      // Appliquer les filtres
      if (rating) {
        query = query.where('rating', parseInt(rating))
      }

      if (userId) {
        query = query.where('user_id', userId)
      }

      // Appliquer le tri
      switch (sort) {
        case 'oldest':
          query = query.orderBy('created_at', 'asc')
          break
        case 'highest':
          query = query.orderBy('rating', 'desc').orderBy('created_at', 'desc')
          break
        case 'lowest':
          query = query.orderBy('rating', 'asc').orderBy('created_at', 'desc')
          break
        default: // recent
          query = query.orderBy('created_at', 'desc')
      }

      const testimonials = await query.paginate(page, limit)

      // Récupérer les compteurs de likes depuis Redis
      const testimonialsWithLikes = await Promise.all(
        testimonials.all().map(async (t) => {
          const likes = await redis.get(`testimonial:likes:${t.id}`) || '0'
          return {
            ...t.toJSON(),
            helpful_count: parseInt(likes)
          }
        })
      )

      const responseData = {
        data: testimonialsWithLikes,
        meta: testimonials.getMeta()
      }

      // 💾 Mettre en cache
      await redis.set(cacheKey, JSON.stringify(responseData), 'EX', this.CACHE_TTL.LIST)

      return response.status(200).json({
        success: true,
        source: 'database',
        ...responseData
      })

    } catch (error: any) {
      console.error('❌ Erreur index testimonials:', error)
      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des témoignages',
        error: error.message
      })
    }
  }

  /**
   * ➕ Créer un témoignage (avec rate limiting et vérification anti-spam)
   */
  async store({ request, response }: HttpContext) {
    try {
      const clientIp = request.ip()
      const data = request.only(['rating', 'text', 'user_id'])

      // Validation
      if (!data.user_id) {
        return response.status(400).json({
          success: false,
          message: 'L\'ID de l\'utilisateur est requis'
        })
      }

      if (!data.rating || data.rating < 1 || data.rating > 5) {
        return response.status(400).json({
          success: false,
          message: 'La note doit être comprise entre 1 et 5'
        })
      }

      if (!data.text || data.text.length < 10) {
        return response.status(400).json({
          success: false,
          message: 'Le témoignage doit contenir au moins 10 caractères'
        })
      }

      // 🔒 Rate limiting : Max 3 témoignages par IP en 24h
      const rateLimitKey = `testimonials:rate:${clientIp}`
      const attempts = await redis.incr(rateLimitKey)

      if (attempts === 1) {
        await redis.expire(rateLimitKey, 86400) // 24 heures
      }

      if (attempts > 3) {
        const ttl = await redis.ttl(rateLimitKey)
        const hours = Math.ceil(ttl / 3600)
        return response.status(429).json({
          success: false,
          message: `Limite de témoignages atteinte. Réessayez dans ${hours} heure${hours > 1 ? 's' : ''}.`
        })
      }

      // 🔍 Vérifier si l'utilisateur existe
      const userCacheKey = `user:${data.user_id}`
      let user = await redis.get(userCacheKey)

      if (user) {
        user = JSON.parse(user)
      } else {
        const userModel = await User.find(data.user_id)
        if (!userModel) {
          return response.status(400).json({
            success: false,
            message: 'Utilisateur non trouvé'
          })
        }
        user = {
          id: userModel.id,
          full_name: userModel.full_name,
          email: userModel.email
        }
        await redis.set(userCacheKey, JSON.stringify(user), 'EX', 3600)
      }

      // 🔍 Vérifier les doublons (même utilisateur, contenu similaire)
      const duplicateKey = `testimonial:duplicate:${data.user_id}:${this.sanitizeText(data.text)}`
      const isDuplicate = await redis.get(duplicateKey)

      if (isDuplicate) {
        return response.status(400).json({
          success: false,
          message: 'Vous avez déjà soumis un témoignage similaire'
        })
      }

      // Vérifier le nombre de témoignages de l'utilisateur
      const userTestimonialCount = await Testimonial.query()
        .where('user_id', data.user_id)
        .count('* as total')

      const testimonial = await Testimonial.create({
        rating: data.rating,
        text: data.text,
        userId: data.user_id,
        is_approved: false, // Par défaut, en attente de modération
        ip_address: clientIp,
        user_agent: request.header('User-Agent')
      })

      // 💾 Marquer comme soumis pour éviter les doublons (24h)
      await redis.set(duplicateKey, testimonial.id.toString(), 'EX', 86400)

      // 📊 Incrémenter le compteur de soumissions
      const today = new Date().toISOString().split('T')[0]
      await redis.incr(`testimonials:submissions:${today}`)

      // Si premier témoignage, ajouter un badge à l'utilisateur
      if (parseInt(userTestimonialCount[0].$extras.total) === 0) {
        await redis.sadd('testimonials:first_timers', data.user_id.toString())
      }

      // 🗑️ Invalider les caches
      await this.invalidateCaches()

      // Charger la relation user
      await testimonial.load('user', (q) => q.select(['id', 'full_name', 'email', 'avatar']))

      return response.status(201).json({
        success: true,
        message: 'Témoignage soumis avec succès. Il sera publié après validation.',
        data: testimonial
      })

    } catch (error: any) {
      console.error('❌ Erreur store testimonial:', error)
      return response.status(400).json({
        success: false,
        message: 'Erreur lors de la création du témoignage',
        error: error.message
      })
    }
  }

  /**
   * 📖 Voir un témoignage (avec cache)
   */
  async show({ params, response }: HttpContext) {
    try {
      const cacheKey = this.getTestimonialCacheKey(params.id)

      // 🔍 Vérifier le cache
      const cached = await redis.get(cacheKey)
      if (cached) {
        const testimonial = JSON.parse(cached)
        const likes = await redis.get(`testimonial:likes:${params.id}`) || '0'

        return response.status(200).json({
          success: true,
          source: 'cache',
          data: {
            ...testimonial,
            helpful_count: parseInt(likes)
          }
        })
      }

      const testimonial = await Testimonial
        .query()
        .where('id', params.id)
        .preload('user', (q) => q.select(['id', 'full_name', 'email', 'avatar']))
        .firstOrFail()

      // Récupérer le nombre de likes
      const likes = await redis.get(`testimonial:likes:${params.id}`) || '0'

      const testimonialData = {
        ...testimonial.toJSON(),
        helpful_count: parseInt(likes)
      }

      // 💾 Mettre en cache
      await redis.set(cacheKey, JSON.stringify(testimonial.toJSON()), 'EX', this.CACHE_TTL.TESTIMONIAL)

      // 📊 Incrémenter les vues
      await redis.incr(`testimonial:views:${params.id}`)

      return response.status(200).json({
        success: true,
        source: 'database',
        data: testimonialData
      })

    } catch (error) {
      return response.status(404).json({
        success: false,
        message: 'Témoignage non trouvé'
      })
    }
  }

  /**
   * 🔄 Modifier un témoignage
   */
  async update({ params, request, response }: HttpContext) {
    try {
      const testimonial = await Testimonial.findOrFail(params.id)
      const user_id = request.input('user_id')

      if (!user_id) {
        return response.status(400).json({
          success: false,
          message: 'L\'ID de l\'utilisateur est requis'
        })
      }

      // Vérifier que l'utilisateur est le propriétaire
      if (testimonial.userId !== user_id) {
        return response.status(403).json({
          success: false,
          message: 'Vous n\'êtes pas autorisé à modifier ce témoignage'
        })
      }

      // Vérifier si le témoignage peut encore être modifié (délai de 1 heure)
      const createdAt = new Date(testimonial.created_at.toString())
      const hoursSinceCreation = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60)

      if (hoursSinceCreation > 1) {
        return response.status(400).json({
          success: false,
          message: 'Le délai de modification est dépassé (1 heure maximum)'
        })
      }

      const data = request.only(['rating', 'text'])

      if (data.rating && (data.rating < 1 || data.rating > 5)) {
        return response.status(400).json({
          success: false,
          message: 'La note doit être comprise entre 1 et 5'
        })
      }

      testimonial.merge(data)
      testimonial.is_edited = true
      testimonial.edited_at = new Date()
      await testimonial.save()

      // 🗑️ Invalider les caches
      await this.invalidateCaches(params.id)

      // Charger la relation user
      await testimonial.load('user', (q) => q.select(['id', 'full_name', 'email', 'avatar']))

      return response.status(200).json({
        success: true,
        message: 'Témoignage mis à jour avec succès',
        data: testimonial
      })

    } catch (error: any) {
      console.error('❌ Erreur update testimonial:', error)
      return response.status(400).json({
        success: false,
        message: 'Erreur lors de la mise à jour du témoignage',
        error: error.message
      })
    }
  }

  /**
   * ❌ Supprimer un témoignage
   */
  async destroy({ params, request, response }: HttpContext) {
    try {
      const testimonial = await Testimonial.findOrFail(params.id)
      const user_id = request.input('user_id')
      const is_admin = request.input('is_admin') === true

      // Vérifier les permissions (propriétaire OU admin)
      if (!is_admin && testimonial.userId !== user_id) {
        return response.status(403).json({
          success: false,
          message: 'Vous n\'êtes pas autorisé à supprimer ce témoignage'
        })
      }

      const testimonialId = testimonial.id
      const userId = testimonial.userId

      await testimonial.delete()

      // 🗑️ Invalider les caches
      await this.invalidateCaches(testimonialId)

      // 🧹 Nettoyer les données Redis
      await redis.del(`testimonial:likes:${testimonialId}`)
      await redis.del(`testimonial:views:${testimonialId}`)

      // Mettre à jour le compteur de témoignages de l'utilisateur
      const remainingCount = await Testimonial.query()
        .where('user_id', userId)
        .count('* as total')

      if (parseInt(remainingCount[0].$extras.total) === 0) {
        await redis.srem('testimonials:first_timers', userId.toString())
      }

      // 📝 Logger la suppression (pour audit)
      const auditKey = `testimonials:deleted:${new Date().toISOString().split('T')[0]}`
      await redis.lpush(
        auditKey,
        JSON.stringify({
          id: testimonialId,
          user_id: userId,
          deleted_by: is_admin ? 'admin' : user_id,
          timestamp: new Date().toISOString()
        })
      )
      await redis.expire(auditKey, 86400 * 30) // 30 jours

      return response.status(200).json({
        success: true,
        message: 'Témoignage supprimé avec succès'
      })

    } catch (error: any) {
      console.error('❌ Erreur destroy testimonial:', error)
      return response.status(400).json({
        success: false,
        message: 'Erreur lors de la suppression du témoignage',
        error: error.message
      })
    }
  }

  /**
   * 👍 Liker un témoignage (utile)
   */
  async like({ params, request, response }: HttpContext) {
    try {
      const testimonialId = params.id
      const userId = request.input('user_id')
      const clientIp = request.ip()

      if (!userId) {
        return response.status(400).json({
          success: false,
          message: 'Utilisateur non identifié'
        })
      }

      // Vérifier si le témoignage existe
      const testimonial = await Testimonial.find(testimonialId)
      if (!testimonial) {
        return response.status(404).json({
          success: false,
          message: 'Témoignage non trouvé'
        })
      }

      // Vérifier si l'utilisateur a déjà liké
      const likeKey = `testimonial:liked:${testimonialId}:${userId}`
      const hasLiked = await redis.get(likeKey)

      if (hasLiked) {
        // Unlike
        await redis.decr(`testimonial:likes:${testimonialId}`)
        await redis.del(likeKey)

        return response.status(200).json({
          success: true,
          liked: false,
          message: 'Like retiré',
          count: parseInt(await redis.get(`testimonial:likes:${testimonialId}`) || '0')
        })
      } else {
        // Like
        await redis.incr(`testimonial:likes:${testimonialId}`)
        await redis.set(likeKey, '1', 'EX', 86400 * 30) // 30 jours

        // Incrémenter le score de popularité
        await redis.zincrby('testimonials:popularity', 1, testimonialId.toString())

        return response.status(200).json({
          success: true,
          liked: true,
          message: 'Témoignage marqué comme utile',
          count: parseInt(await redis.get(`testimonial:likes:${testimonialId}`) || '0')
        })
      }

    } catch (error: any) {
      console.error('❌ Erreur like testimonial:', error)
      return response.status(500).json({
        success: false,
        message: 'Erreur lors du like',
        error: error.message
      })
    }
  }

  /**
   * 🚩 Signaler un témoignage
   */
  async report({ params, request, response }: HttpContext) {
    try {
      const testimonialId = params.id
      const { user_id, reason } = request.body()
      const clientIp = request.ip()

      if (!user_id) {
        return response.status(400).json({
          success: false,
          message: 'Utilisateur non identifié'
        })
      }

      if (!reason) {
        return response.status(400).json({
          success: false,
          message: 'La raison du signalement est requise'
        })
      }

      // Vérifier si l'utilisateur a déjà signalé
      const reportKey = `testimonial:reported:${testimonialId}:${user_id}`
      const hasReported = await redis.get(reportKey)

      if (hasReported) {
        return response.status(400).json({
          success: false,
          message: 'Vous avez déjà signalé ce témoignage'
        })
      }

      // Enregistrer le signalement
      await redis.set(reportKey, reason, 'EX', 86400 * 7) // 7 jours

      const reportCount = await redis.incr(`testimonial:report_count:${testimonialId}`)

      // Logger le signalement
      const reportsKey = `testimonials:reports:pending`
      await redis.lpush(
        reportsKey,
        JSON.stringify({
          testimonial_id: testimonialId,
          reported_by: user_id,
          reason: reason,
          ip: clientIp,
          timestamp: new Date().toISOString()
        })
      )

      // Si trop de signalements, désactiver automatiquement
      if (reportCount >= 5) {
        const testimonial = await Testimonial.find(testimonialId)
        if (testimonial) {
          testimonial.is_approved = false
          testimonial.flagged_at = new Date()
          testimonial.flag_reason = 'Signalements multiples'
          await testimonial.save()

          await this.invalidateCaches(testimonialId)
        }
      }

      return response.status(200).json({
        success: true,
        message: 'Témoignage signalé. Merci de votre vigilance.',
        report_count: reportCount
      })

    } catch (error: any) {
      console.error('❌ Erreur report testimonial:', error)
      return response.status(500).json({
        success: false,
        message: 'Erreur lors du signalement',
        error: error.message
      })
    }
  }

  /**
   * ⭐ Top témoignages (les plus utiles)
   */
  async top({ request, response }: HttpContext) {
    try {
      const limit = request.input('limit', 5)
      const cacheKey = `testimonials:top:${limit}`

      // Vérifier le cache
      const cached = await redis.get(cacheKey)
      if (cached) {
        return response.status(200).json({
          success: true,
          source: 'cache',
          data: JSON.parse(cached)
        })
      }

      // Récupérer les IDs les plus populaires
      const topIds = await redis.zrevrange('testimonials:popularity', 0, limit - 1)

      let testimonials: Testimonial[] = []

      if (topIds.length > 0) {
        testimonials = await Testimonial.query()
          .whereIn('id', topIds.map(id => parseInt(id)))
          .where('is_approved', true)
          .preload('user', (q) => q.select(['id', 'full_name', 'email', 'avatar']))
          .orderByRaw(`FIELD(id, ${topIds.join(',')})`)
      }

      // Compléter avec les mieux notés si nécessaire
      if (testimonials.length < limit) {
        const additional = await Testimonial.query()
          .where('is_approved', true)
          .whereNotIn('id', testimonials.map(t => t.id))
          .orderBy('rating', 'desc')
          .orderBy('created_at', 'desc')
          .limit(limit - testimonials.length)
          .preload('user', (q) => q.select(['id', 'full_name', 'email', 'avatar']))

        testimonials = [...testimonials, ...additional]
      }

      // Ajouter les compteurs
      const testimonialsWithCounts = await Promise.all(
        testimonials.map(async (t) => {
          const likes = await redis.get(`testimonial:likes:${t.id}`) || '0'
          return {
            ...t.toJSON(),
            helpful_count: parseInt(likes)
          }
        })
      )

      // 💾 Mettre en cache
      await redis.set(cacheKey, JSON.stringify(testimonialsWithCounts), 'EX', this.CACHE_TTL.TOP)

      return response.status(200).json({
        success: true,
        source: 'database',
        data: testimonialsWithCounts
      })

    } catch (error: any) {
      console.error('❌ Erreur top testimonials:', error)
      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des tops témoignages',
        error: error.message
      })
    }
  }

  /**
   * 📊 Statistiques des témoignages
   */
  async stats({ response }: HttpContext) {
    try {
      const cacheKey = 'testimonials:stats'

      const cached = await redis.get(cacheKey)
      if (cached) {
        return response.status(200).json({
          success: true,
          source: 'cache',
          data: JSON.parse(cached)
        })
      }

      // Statistiques globales
      const total = await Testimonial.query().count('* as total')
      const approved = await Testimonial.query().where('is_approved', true).count('* as total')
      const pending = await Testimonial.query().where('is_approved', false).count('* as total')

      // Moyenne des notes
      const avgRating = await Testimonial.query()
        .where('is_approved', true)
        .avg('rating as avg')

      // Distribution des notes
      const ratingDistribution = await Testimonial.query()
        .where('is_approved', true)
        .select('rating')
        .count('* as count')
        .groupBy('rating')

      // Témoignages par jour (7 derniers jours)
      const dailyStats = []
      for (let i = 6; i >= 0; i--) {
        const date = new Date()
        date.setDate(date.getDate() - i)
        const dateStr = date.toISOString().split('T')[0]
        const count = await redis.get(`testimonials:submissions:${dateStr}`) || '0'
        dailyStats.push({
          date: dateStr,
          count: parseInt(count)
        })
      }

      const stats = {
        total_testimonials: parseInt(total[0].$extras.total) || 0,
        approved_testimonials: parseInt(approved[0].$extras.total) || 0,
        pending_testimonials: parseInt(pending[0].$extras.total) || 0,
        average_rating: parseFloat(avgRating[0].$extras.avg) || 0,
        rating_distribution: ratingDistribution.reduce((acc, curr) => {
          acc[curr.rating] = parseInt(curr.$extras.count)
          return acc
        }, {} as Record<number, number>),
        daily_submissions: dailyStats,
        first_time_reviewers: await redis.scard('testimonials:first_timers'),
        pending_reports: await redis.llen('testimonials:reports:pending')
      }

      await redis.set(cacheKey, JSON.stringify(stats), 'EX', this.CACHE_TTL.STATS)

      return response.status(200).json({
        success: true,
        source: 'database',
        data: stats
      })

    } catch (error: any) {
      console.error('❌ Erreur stats testimonials:', error)
      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des statistiques',
        error: error.message
      })
    }
  }

  /**
   * ✅ Approuver un témoignage (admin)
   */
  async approve({ params, response }: HttpContext) {
    try {
      const testimonial = await Testimonial.findOrFail(params.id)

      testimonial.is_approved = true
      testimonial.approved_at = new Date()
      await testimonial.save()

      await this.invalidateCaches(params.id)

      // Notifier l'utilisateur (à implémenter)
      // await this.notifyUser(testimonial.userId, 'Votre témoignage a été approuvé !')

      return response.status(200).json({
        success: true,
        message: 'Témoignage approuvé avec succès'
      })

    } catch (error) {
      return response.status(404).json({
        success: false,
        message: 'Témoignage non trouvé'
      })
    }
  }

  /**
   * 🧹 Utilitaire : Nettoyer le texte pour la détection de doublons
   */
  private sanitizeText(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 100)
  }
}
