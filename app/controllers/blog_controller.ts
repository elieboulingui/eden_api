// app/controllers/blog_controller.ts
import type { HttpContext } from '@adonisjs/core/http'
import BlogPost from '#models/blog_post'
import { DateTime } from 'luxon'
import redis from '@adonisjs/redis/services/main'

export default class BlogController {

  // Durées de cache (en secondes)
  private readonly CACHE_TTL = {
    LIST: 600,        // 10 minutes
    POST: 3600,       // 1 heure
    CATEGORIES: 7200, // 2 heures
    STATS: 300,       // 5 minutes
    FEATURED: 1800    // 30 minutes
  }

  /**
   * 🔧 Méthode utilitaire : Générer une clé de cache pour les listes
   */
  private getListCacheKey(page: number, limit: number, category?: string, search?: string, sort?: string): string {
    return `blog:list:${page}:${limit}:${category || 'all'}:${search ? encodeURIComponent(search) : 'none'}:${sort || 'latest'}`
  }

  /**
   * 🔧 Méthode utilitaire : Invalider tous les caches de liste
   */
  private async invalidateListCaches(): Promise<void> {
    const keys = await redis.keys('blog:list:*')
    if (keys.length > 0) {
      await redis.del(...keys)
    }
  }

  /**
   * 🔧 Méthode utilitaire : Invalider le cache d'un article spécifique
   */
  private async invalidatePostCache(slug: string): Promise<void> {
    await redis.del(`blog:post:${slug}`)
    await redis.del('blog:featured')
    await this.invalidateListCaches()
  }

  // ============= ROUTES PUBLIQUES =============

  /**
   * 📋 Liste des articles publiés (avec cache)
   */
  async index({ request, response }: HttpContext) {
    try {
      const page = request.input('page', 1)
      const limit = request.input('limit', 9)
      const category = request.input('category')
      const search = request.input('search')
      const sort = request.input('sort', 'latest')

      // 🔑 Générer la clé de cache
      const cacheKey = this.getListCacheKey(page, limit, category, search, sort)

      // 🔍 Vérifier le cache
      const cachedData = await redis.get(cacheKey)

      if (cachedData) {
        const data = JSON.parse(cachedData)
        return response.ok({
          success: true,
          source: 'cache',
          data: data
        })
      }

      // Si pas en cache, construire la requête
      let query = BlogPost.query()
        .where('status', 'published')
        .whereNotNull('published_at')
        .preload('author', (query) => {
          query.select('id', 'full_name', 'email', 'avatar')
        })

      if (category && category !== 'all') {
        query = query.where('category', category)
      }

      if (search) {
        query = query.where((builder) => {
          builder
            .whereILike('title', `%${search}%`)
            .orWhereILike('excerpt', `%${search}%`)
            .orWhereILike('content', `%${search}%`)
        })
      }

      if (sort === 'popular') {
        query = query.orderBy('views', 'desc')
      } else {
        query = query.orderBy('published_at', 'desc')
      }

      const posts = await query.paginate(page, limit)

      // 📋 Récupérer les catégories (avec cache séparé)
      let categoriesCacheKey = 'blog:categories'
      let categories = await redis.get(categoriesCacheKey)

      if (categories) {
        categories = JSON.parse(categories)
      } else {
        const cats = await BlogPost.query()
          .where('status', 'published')
          .distinct('category')
          .select('category')

        categories = cats.map(c => c.category)
        await redis.set(categoriesCacheKey, JSON.stringify(categories), 'EX', this.CACHE_TTL.CATEGORIES)
      }

      const responseData = {
        posts: posts.all(),
        meta: posts.getMeta(),
        categories: categories
      }

      // 💾 Mettre en cache
      await redis.set(cacheKey, JSON.stringify(responseData), 'EX', this.CACHE_TTL.LIST)

      return response.ok({
        success: true,
        source: 'database',
        data: responseData
      })

    } catch (error: any) {
      console.error('❌ Erreur index blog:', error)
      return response.internalServerError({
        success: false,
        message: error.message
      })
    }
  }

  /**
   * 📖 Afficher un article (avec cache et gestion des vues optimisée)
   */
  async show({ params, response }: HttpContext) {
    try {
      const { slug } = params
      const cacheKey = `blog:post:${slug}`

      // 🔍 Vérifier le cache
      const cachedPost = await redis.get(cacheKey)

      let post: BlogPost | null = null
      let fromCache = false

      if (cachedPost) {
        post = JSON.parse(cachedPost)
        fromCache = true
      } else {
        post = await BlogPost.query()
          .where('slug', slug)
          .where('status', 'published')
          .preload('author', (query) => {
            query.select('id', 'full_name', 'email', 'avatar')
          })
          .first()

        if (!post) {
          return response.notFound({
            success: false,
            message: 'Article non trouvé'
          })
        }

        // 💾 Mettre en cache
        await redis.set(cacheKey, JSON.stringify(post), 'EX', this.CACHE_TTL.POST)
      }

      // 📊 Gestion des vues avec Redis (plus efficace)
      const viewsKey = `blog:views:${post.id}`
      const today = DateTime.now().toFormat('yyyy-MM-dd')
      const dailyViewsKey = `blog:daily_views:${post.id}:${today}`

      // Incrémenter les vues dans Redis
      const views = await redis.incr(viewsKey)
      await redis.incr(dailyViewsKey)
      await redis.expire(dailyViewsKey, 86400 * 7) // 7 jours

      // Mettre à jour la base de données périodiquement (tous les 10 vues)
      if (views % 10 === 0) {
        const dbPost = await BlogPost.find(post.id)
        if (dbPost) {
          dbPost.views = views
          await dbPost.save()
        }
      }

      // Articles similaires (avec cache)
      const relatedCacheKey = `blog:related:${post.category}:${post.id}`
      let relatedPosts = await redis.get(relatedCacheKey)

      if (relatedPosts) {
        relatedPosts = JSON.parse(relatedPosts)
      } else {
        relatedPosts = await BlogPost.query()
          .where('category', post.category)
          .where('status', 'published')
          .whereNot('id', post.id)
          .orderBy('published_at', 'desc')
          .limit(3)

        await redis.set(relatedCacheKey, JSON.stringify(relatedPosts), 'EX', this.CACHE_TTL.POST)
      }

      // Ajouter le nombre de vues actuel
      const postWithViews = {
        ...post,
        views: views
      }

      return response.ok({
        success: true,
        source: fromCache ? 'cache' : 'database',
        data: {
          post: postWithViews,
          related_posts: relatedPosts
        }
      })

    } catch (error: any) {
      console.error('❌ Erreur show blog:', error)
      return response.internalServerError({
        success: false,
        message: error.message
      })
    }
  }

  /**
   * ⭐ Article vedette (avec cache)
   */
  async featured({ response }: HttpContext) {
    try {
      const cacheKey = 'blog:featured'

      // 🔍 Vérifier le cache
      const cachedFeatured = await redis.get(cacheKey)

      if (cachedFeatured) {
        return response.ok({
          success: true,
          source: 'cache',
          data: JSON.parse(cachedFeatured)
        })
      }

      const featuredPost = await BlogPost.query()
        .where('status', 'published')
        .orderBy('views', 'desc')
        .orderBy('published_at', 'desc')
        .preload('author', (query) => {
          query.select('id', 'full_name', 'email', 'avatar')
        })
        .first()

      if (featuredPost) {
        await redis.set(cacheKey, JSON.stringify(featuredPost), 'EX', this.CACHE_TTL.FEATURED)
      }

      return response.ok({
        success: true,
        source: 'database',
        data: featuredPost
      })

    } catch (error: any) {
      console.error('❌ Erreur featured blog:', error)
      return response.internalServerError({
        success: false,
        message: error.message
      })
    }
  }

  /**
   * 📝 Soumettre un article (PUBLIC - avec rate limiting)
   */
  async publicStore({ request, response }: HttpContext) {
    try {
      const clientIp = request.ip()

      // 🔒 Rate limiting : Max 5 soumissions par IP en 24h
      const rateLimitKey = `blog:submissions:${clientIp}`
      const submissions = await redis.incr(rateLimitKey)

      if (submissions === 1) {
        await redis.expire(rateLimitKey, 86400) // 24 heures
      }

      if (submissions > 5) {
        const ttl = await redis.ttl(rateLimitKey)
        const hours = Math.ceil(ttl / 3600)
        return response.status(429).json({
          success: false,
          message: `Limite de soumissions atteinte. Réessayez dans ${hours} heure${hours > 1 ? 's' : ''}.`
        })
      }

      const {
        title,
        excerpt,
        content,
        image_url,
        category,
        author_name,
        read_time,
        tags
      } = request.only([
        'title',
        'excerpt',
        'content',
        'image_url',
        'category',
        'author_name',
        'read_time',
        'tags'
      ])

      if (!title || !excerpt || !content || !category) {
        return response.badRequest({
          success: false,
          message: 'Titre, extrait, contenu et catégorie sont requis'
        })
      }

      if (!author_name) {
        return response.badRequest({
          success: false,
          message: 'Le nom de l\'auteur est requis'
        })
      }

      const post = await BlogPost.create({
        title,
        excerpt,
        content,
        image_url: image_url || undefined,
        category,
        author_name: author_name,
        author_id: undefined,
        read_time: read_time || 5,
        status: 'draft',
        meta_title: title,
        meta_description: excerpt.substring(0, 160),
        tags: tags || [],
        published_at: undefined
      })

      // 📊 Logger la soumission
      const submissionsLogKey = 'blog:submissions_log'
      await redis.lpush(
        submissionsLogKey,
        JSON.stringify({
          id: post.id,
          title: post.title,
          author: author_name,
          ip: clientIp,
          timestamp: new Date().toISOString()
        })
      )
      await redis.ltrim(submissionsLogKey, 0, 99) // Garder 100 dernières soumissions

      return response.created({
        success: true,
        data: post,
        message: 'Article soumis avec succès ! Il sera publié après validation.'
      })

    } catch (error: any) {
      console.error('❌ Erreur publicStore blog:', error)
      return response.internalServerError({
        success: false,
        message: error.message
      })
    }
  }

  // ============= ROUTES ADMIN =============

  async adminIndex({ request, response }: HttpContext) {
    try {
      const page = request.input('page', 1)
      const limit = request.input('limit', 10)
      const status = request.input('status')
      const search = request.input('search')

      // Pas de cache pour l'admin (données toujours fraîches)
      let query = BlogPost.query()
        .orderBy('created_at', 'desc')

      if (status) {
        query = query.where('status', status)
      }

      if (search) {
        query = query.where((builder) => {
          builder
            .whereILike('title', `%${search}%`)
            .orWhereILike('content', `%${search}%`)
        })
      }

      const posts = await query.paginate(page, limit)

      return response.ok({
        success: true,
        data: {
          posts: posts.all(),
          meta: posts.getMeta()
        }
      })

    } catch (error: any) {
      console.error('❌ Erreur adminIndex blog:', error)
      return response.internalServerError({
        success: false,
        message: error.message
      })
    }
  }

  /**
   * Créer un article (ADMIN - invalide le cache)
   */
  async store({ request, response }: HttpContext) {
    try {
      const {
        title,
        excerpt,
        content,
        image_url,
        category,
        author_name,
        read_time,
        status,
        meta_title,
        meta_description,
        tags
      } = request.only([
        'title',
        'excerpt',
        'content',
        'image_url',
        'category',
        'author_name',
        'read_time',
        'status',
        'meta_title',
        'meta_description',
        'tags'
      ])

      if (!title || !excerpt || !content || !category) {
        return response.badRequest({
          success: false,
          message: 'Titre, extrait, contenu et catégorie sont requis'
        })
      }

      const post = await BlogPost.create({
        title,
        excerpt,
        content,
        image_url: image_url || undefined,
        category,
        author_name: author_name || 'Admin',
        author_id: undefined,
        read_time: read_time || 5,
        status: status || 'draft',
        meta_title: meta_title || title,
        meta_description: meta_description || excerpt.substring(0, 160),
        tags: tags || [],
        published_at: status === 'published' ? DateTime.now() : undefined
      })

      // 🗑️ Invalider les caches
      await redis.del('blog:categories')
      await this.invalidateListCaches()

      if (status === 'published') {
        await redis.del('blog:featured')
      }

      return response.created({
        success: true,
        data: post,
        message: 'Article créé avec succès'
      })

    } catch (error: any) {
      console.error('❌ Erreur store blog:', error)
      return response.internalServerError({
        success: false,
        message: error.message
      })
    }
  }

  async adminShow({ params, response }: HttpContext) {
    try {
      const { id } = params

      const post = await BlogPost.find(id)

      if (!post) {
        return response.notFound({
          success: false,
          message: 'Article non trouvé'
        })
      }

      return response.ok({
        success: true,
        data: post
      })

    } catch (error: any) {
      console.error('❌ Erreur adminShow blog:', error)
      return response.internalServerError({
        success: false,
        message: error.message
      })
    }
  }

  /**
   * Mettre à jour un article (invalide le cache)
   */
  async update({ params, request, response }: HttpContext) {
    try {
      const { id } = params

      const post = await BlogPost.find(id)

      if (!post) {
        return response.notFound({
          success: false,
          message: 'Article non trouvé'
        })
      }

      const oldSlug = post.slug
      const oldStatus = post.status

      const payload = request.only([
        'title',
        'excerpt',
        'content',
        'image_url',
        'category',
        'read_time',
        'status',
        'meta_title',
        'meta_description',
        'tags'
      ])

      if (payload.title) post.title = payload.title
      if (payload.excerpt) post.excerpt = payload.excerpt
      if (payload.content) post.content = payload.content
      if (payload.image_url !== undefined) post.image_url = payload.image_url || undefined
      if (payload.category) post.category = payload.category
      if (payload.read_time) post.read_time = payload.read_time
      if (payload.meta_title !== undefined) post.meta_title = payload.meta_title || undefined
      if (payload.meta_description !== undefined) post.meta_description = payload.meta_description || undefined
      if (payload.tags) post.tags = payload.tags

      let statusChanged = false
      if (payload.status && payload.status !== post.status) {
        post.status = payload.status
        statusChanged = true
        if (payload.status === 'published' && !post.published_at) {
          post.published_at = DateTime.now()
        }
      }

      await post.save()

      // 🗑️ Invalider les caches
      await this.invalidatePostCache(oldSlug)
      if (oldSlug !== post.slug) {
        await this.invalidatePostCache(post.slug)
      }

      await redis.del('blog:categories')
      await redis.del(`blog:related:${post.category}:*`)

      if (statusChanged || oldStatus !== 'published' && post.status === 'published') {
        await redis.del('blog:featured')
      }

      return response.ok({
        success: true,
        data: post,
        message: 'Article mis à jour avec succès'
      })

    } catch (error: any) {
      console.error('❌ Erreur update blog:', error)
      return response.internalServerError({
        success: false,
        message: error.message
      })
    }
  }

  /**
   * Supprimer un article (invalide le cache)
   */
  async destroy({ params, response }: HttpContext) {
    try {
      const { id } = params

      const post = await BlogPost.find(id)

      if (!post) {
        return response.notFound({
          success: false,
          message: 'Article non trouvé'
        })
      }

      const slug = post.slug
      const category = post.category

      await post.delete()

      // 🗑️ Invalider tous les caches concernés
      await this.invalidatePostCache(slug)
      await redis.del('blog:categories')
      await redis.del(`blog:related:${category}:*`)
      await redis.del('blog:featured')

      // Supprimer les vues de Redis
      await redis.del(`blog:views:${id}`)
      await redis.del(`blog:daily_views:${id}:*`)

      return response.ok({
        success: true,
        message: 'Article supprimé avec succès'
      })

    } catch (error: any) {
      console.error('❌ Erreur destroy blog:', error)
      return response.internalServerError({
        success: false,
        message: error.message
      })
    }
  }

  /**
   * 📊 Statistiques du blog (avec cache)
   */
  async stats({ response }: HttpContext) {
    try {
      const cacheKey = 'blog:stats'

      // 🔍 Vérifier le cache
      const cachedStats = await redis.get(cacheKey)

      if (cachedStats) {
        return response.ok({
          success: true,
          source: 'cache',
          data: JSON.parse(cachedStats)
        })
      }

      const totalPosts = await BlogPost.query().count('* as total')
      const publishedPosts = await BlogPost.query().where('status', 'published').count('* as total')
      const draftPosts = await BlogPost.query().where('status', 'draft').count('* as total')
      const totalViews = await BlogPost.query().sum('views as total')

      const popularPosts = await BlogPost.query()
        .where('status', 'published')
        .orderBy('views', 'desc')
        .limit(5)
        .select('id', 'title', 'slug', 'views', 'category', 'published_at')

      const postsByCategory = await BlogPost.query()
        .where('status', 'published')
        .select('category')
        .count('* as total')
        .groupBy('category')

      // Récupérer les soumissions en attente
      const pendingSubmissionsKey = 'blog:submissions_log'
      const pendingCount = await redis.llen(pendingSubmissionsKey)

      const statsData = {
        total_posts: parseInt(totalPosts[0].$extras.total) || 0,
        published_posts: parseInt(publishedPosts[0].$extras.total) || 0,
        draft_posts: parseInt(draftPosts[0].$extras.total) || 0,
        total_views: parseInt(totalViews[0].$extras.total) || 0,
        pending_submissions: pendingCount,
        popular_posts: popularPosts,
        posts_by_category: postsByCategory
      }

      // 💾 Mettre en cache
      await redis.set(cacheKey, JSON.stringify(statsData), 'EX', this.CACHE_TTL.STATS)

      return response.ok({
        success: true,
        source: 'database',
        data: statsData
      })

    } catch (error: any) {
      console.error('❌ Erreur stats blog:', error)
      return response.internalServerError({
        success: false,
        message: error.message
      })
    }
  }

  /**
   * 🔧 Méthode utilitaire : Récupérer les soumissions en attente
   */
  async getPendingSubmissions({ response }: HttpContext) {
    try {
      const submissionsKey = 'blog:submissions_log'
      const submissions = await redis.lrange(submissionsKey, 0, -1)

      return response.ok({
        success: true,
        data: submissions.map(s => JSON.parse(s))
      })
    } catch (error: any) {
      console.error('❌ Erreur pending submissions:', error)
      return response.internalServerError({
        success: false,
        message: error.message
      })
    }
  }

  /**
   * 🔧 Méthode utilitaire : Vider tout le cache du blog
   */
  async clearCache({ response }: HttpContext) {
    try {
      const keys = await redis.keys('blog:*')

      if (keys.length > 0) {
        await redis.del(...keys)
      }

      return response.ok({
        success: true,
        message: `Cache vidé : ${keys.length} clés supprimées`
      })
    } catch (error: any) {
      console.error('❌ Erreur clear cache:', error)
      return response.internalServerError({
        success: false,
        message: error.message
      })
    }
  }

  /**
   * 📈 Récupérer les statistiques de vues quotidiennes d'un article
   */
  async getPostDailyViews({ params, response }: HttpContext) {
    try {
      const { id } = params
      const days = 7

      const dailyViews = []
      for (let i = 0; i < days; i++) {
        const date = DateTime.now().minus({ days: i }).toFormat('yyyy-MM-dd')
        const key = `blog:daily_views:${id}:${date}`
        const views = await redis.get(key) || '0'
        dailyViews.push({
          date,
          views: parseInt(views)
        })
      }

      return response.ok({
        success: true,
        data: dailyViews.reverse()
      })
    } catch (error: any) {
      console.error('❌ Erreur daily views:', error)
      return response.internalServerError({
        success: false,
        message: error.message
      })
    }
  }
}
