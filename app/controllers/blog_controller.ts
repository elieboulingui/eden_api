// app/controllers/blog_controller.ts
import type { HttpContext } from '@adonisjs/core/http'
import BlogPost from '#models/blog_post'
import User from '#models/user'
import { DateTime } from 'luxon'

export default class BlogController {

  // ============= ROUTES PUBLIQUES =============

  /**
   * Récupérer tous les articles publiés (public)
   */
  async index({ request, response }: HttpContext) {
    try {
      const page = request.input('page', 1)
      const limit = request.input('limit', 9)
      const category = request.input('category')
      const search = request.input('search')
      const sort = request.input('sort', 'latest') // latest, popular

      let query = BlogPost.query()
        .where('status', 'published')
        .whereNotNull('published_at')
        .preload('author', (query) => {
          query.select('id', 'full_name', 'email', 'avatar')
        })

      // Filtrer par catégorie
      if (category && category !== 'all') {
        query = query.where('category', category)
      }

      // Recherche
      if (search) {
        query = query.where((builder) => {
          builder
            .whereILike('title', `%${search}%`)
            .orWhereILike('excerpt', `%${search}%`)
            .orWhereILike('content', `%${search}%`)
        })
      }

      // Tri
      if (sort === 'popular') {
        query = query.orderBy('views', 'desc')
      } else {
        query = query.orderBy('published_at', 'desc')
      }

      const posts = await query.paginate(page, limit)

      // Récupérer toutes les catégories uniques
      const categories = await BlogPost.query()
        .where('status', 'published')
        .distinct('category')
        .select('category')

      return response.ok({
        success: true,
        data: {
          posts: posts.all(),
          meta: posts.getMeta(),
          categories: categories.map(c => c.category)
        }
      })

    } catch (error: any) {
      console.error('Erreur index blog:', error)
      return response.internalServerError({
        success: false,
        message: error.message
      })
    }
  }

  /**
   * Récupérer un article par son slug (public)
   */
  async show({ params, response }: HttpContext) {
    try {
      const { slug } = params

      const post = await BlogPost.query()
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

      // Incrémenter le compteur de vues
      post.views += 1
      await post.save()

      // Récupérer les articles similaires
      const relatedPosts = await BlogPost.query()
        .where('category', post.category)
        .where('status', 'published')
        .whereNot('id', post.id)
        .orderBy('published_at', 'desc')
        .limit(3)

      return response.ok({
        success: true,
        data: {
          post: post,
          related_posts: relatedPosts
        }
      })

    } catch (error: any) {
      console.error('Erreur show blog:', error)
      return response.internalServerError({
        success: false,
        message: error.message
      })
    }
  }

  /**
   * Récupérer l'article en vedette (public)
   */
  async featured({ response }: HttpContext) {
    try {
      const featuredPost = await BlogPost.query()
        .where('status', 'published')
        .orderBy('views', 'desc')
        .orderBy('published_at', 'desc')
        .preload('author', (query) => {
          query.select('id', 'full_name', 'email', 'avatar')
        })
        .first()

      return response.ok({
        success: true,
        data: featuredPost
      })

    } catch (error: any) {
      console.error('Erreur featured blog:', error)
      return response.internalServerError({
        success: false,
        message: error.message
      })
    }
  }

  // ============= ROUTES ADMIN =============

  /**
   * Récupérer tous les articles (admin)
   */
  async adminIndex({ request, response }: HttpContext) {
    try {
      const page = request.input('page', 1)
      const limit = request.input('limit', 10)
      const status = request.input('status')
      const search = request.input('search')

      let query = BlogPost.query()
        .preload('author', (query) => {
          query.select('id', 'full_name', 'email')
        })
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
      console.error('Erreur adminIndex blog:', error)
      return response.internalServerError({
        success: false,
        message: error.message
      })
    }
  }

  /**
   * Créer un nouvel article (admin)
   */
  async store({ request, response, auth }: HttpContext) {
    try {
      const user = auth.user
      if (!user) {
        return response.unauthorized({
          success: false,
          message: 'Non authentifié'
        })
      }

      const {
        title,
        excerpt,
        content,
        image_url,
        category,
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
        'read_time',
        'status',
        'meta_title',
        'meta_description',
        'tags'
      ])

      // Validation
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
        image_url: image_url || null,
        category,
        author_name: user.full_name,
        author_id: user.id,
        read_time: read_time || 5,
        status: status || 'draft',
        meta_title: meta_title || title,
        meta_description: meta_description || excerpt.substring(0, 160),
        tags: tags || [],
        published_at: status === 'published' ? DateTime.now() : null
      })

      return response.created({
        success: true,
        data: post,
        message: 'Article créé avec succès'
      })

    } catch (error: any) {
      console.error('Erreur store blog:', error)
      return response.internalServerError({
        success: false,
        message: error.message
      })
    }
  }

  /**
   * Récupérer un article par ID (admin)
   */
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
      console.error('Erreur adminShow blog:', error)
      return response.internalServerError({
        success: false,
        message: error.message
      })
    }
  }

  /**
   * Mettre à jour un article (admin)
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

      const {
        title,
        excerpt,
        content,
        image_url,
        category,
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
        'read_time',
        'status',
        'meta_title',
        'meta_description',
        'tags'
      ])

      // Mettre à jour les champs
      if (title) post.title = title
      if (excerpt) post.excerpt = excerpt
      if (content) post.content = content
      if (image_url !== undefined) post.image_url = image_url
      if (category) post.category = category
      if (read_time) post.read_time = read_time
      if (meta_title !== undefined) post.meta_title = meta_title
      if (meta_description !== undefined) post.meta_description = meta_description
      if (tags) post.tags = tags

      // Gérer le changement de statut
      if (status && status !== post.status) {
        post.status = status
        if (status === 'published' && !post.published_at) {
          post.published_at = DateTime.now()
        }
      }

      await post.save()

      return response.ok({
        success: true,
        data: post,
        message: 'Article mis à jour avec succès'
      })

    } catch (error: any) {
      console.error('Erreur update blog:', error)
      return response.internalServerError({
        success: false,
        message: error.message
      })
    }
  }

  /**
   * Supprimer un article (admin)
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

      await post.delete()

      return response.ok({
        success: true,
        message: 'Article supprimé avec succès'
      })

    } catch (error: any) {
      console.error('Erreur destroy blog:', error)
      return response.internalServerError({
        success: false,
        message: error.message
      })
    }
  }

  /**
   * Récupérer les statistiques du blog (admin)
   */
  async stats({ response }: HttpContext) {
    try {
      const totalPosts = await BlogPost.query().count('* as total')
      const publishedPosts = await BlogPost.query().where('status', 'published').count('* as total')
      const draftPosts = await BlogPost.query().where('status', 'draft').count('* as total')
      const totalViews = await BlogPost.query().sum('views as total')
      const popularPosts = await BlogPost.query()
        .where('status', 'published')
        .orderBy('views', 'desc')
        .limit(5)

      // Posts par catégorie
      const postsByCategory = await BlogPost.query()
        .where('status', 'published')
        .select('category')
        .count('* as total')
        .groupBy('category')

      return response.ok({
        success: true,
        data: {
          total_posts: parseInt(totalPosts[0].$extras.total) || 0,
          published_posts: parseInt(publishedPosts[0].$extras.total) || 0,
          draft_posts: parseInt(draftPosts[0].$extras.total) || 0,
          total_views: parseInt(totalViews[0].$extras.total) || 0,
          popular_posts: popularPosts,
          posts_by_category: postsByCategory
        }
      })

    } catch (error: any) {
      console.error('Erreur stats blog:', error)
      return response.internalServerError({
        success: false,
        message: error.message
      })
    }
  }
}