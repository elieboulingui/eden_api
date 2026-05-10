// app/controllers/blog_controller.ts
import type { HttpContext } from '@adonisjs/core/http'
import BlogPost from '#models/blog_post'
import { DateTime } from 'luxon'

export default class BlogController {

  // ============= ROUTES PUBLIQUES =============

  async index({ request, response }: HttpContext) {
    try {
      const page = request.input('page', 1)
      const limit = request.input('limit', 9)
      const category = request.input('category')
      const search = request.input('search')
      const sort = request.input('sort', 'latest')

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

      post.views += 1
      await post.save()

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

  /**
   * Soumettre un article (PUBLIC - tout le monde peut poster)
   */
  async publicStore({ request, response }: HttpContext) {
    try {
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

      return response.created({
        success: true,
        data: post,
        message: 'Article soumis avec succès ! Il sera publié après validation.'
      })

    } catch (error: any) {
      console.error('Erreur publicStore blog:', error)
      return response.internalServerError({
        success: false,
        message: error.message
      })
    }
  }

  // ============= ROUTES MARCHAND =============

  /**
   * Lister les articles d'un marchand spécifique
   * GET /api/blog/merchant/:userId/posts
   */
  async merchantPosts({ params, request, response }: HttpContext) {
    try {
      const { userId } = params
      const page = request.input('page', 1)
      const limit = request.input('limit', 10)
      const status = request.input('status')
      const search = request.input('search')
      const sort = request.input('sort', 'latest')

      let query = BlogPost.query()
        .where('author_id', userId)  // 🔑 Filtre par le marchand connecté
        .orderBy('created_at', 'desc')

      if (status && status !== 'all') {
        query = query.where('status', status)
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
      } else if (sort === 'oldest') {
        query = query.orderBy('created_at', 'asc')
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
      console.error('Erreur merchantPosts blog:', error)
      return response.internalServerError({
        success: false,
        message: error.message
      })
    }
  }

  /**
   * Statistiques des articles d'un marchand
   * GET /api/blog/merchant/:userId/stats
   */
  async merchantStats({ params, response }: HttpContext) {
    try {
      const { userId } = params

      const totalPosts = await BlogPost.query()
        .where('author_id', userId)
        .count('* as total')

      const publishedPosts = await BlogPost.query()
        .where('author_id', userId)
        .where('status', 'published')
        .count('* as total')

      const draftPosts = await BlogPost.query()
        .where('author_id', userId)
        .where('status', 'draft')
        .count('* as total')

      const totalViews = await BlogPost.query()
        .where('author_id', userId)
        .sum('views as total')

      const totalComments = await BlogPost.query()
        .where('author_id', userId)
        .sum('comments_count as total')

      const popularPosts = await BlogPost.query()
        .where('author_id', userId)
        .where('status', 'published')
        .orderBy('views', 'desc')
        .limit(5)

      const postsByCategory = await BlogPost.query()
        .where('author_id', userId)
        .select('category')
        .count('* as total')
        .groupBy('category')

      // Articles récents
      const recentPosts = await BlogPost.query()
        .where('author_id', userId)
        .orderBy('created_at', 'desc')
        .limit(5)

      return response.ok({
        success: true,
        data: {
          total_posts: parseInt(totalPosts[0].$extras.total) || 0,
          published_posts: parseInt(publishedPosts[0].$extras.total) || 0,
          draft_posts: parseInt(draftPosts[0].$extras.total) || 0,
          total_views: parseInt(totalViews[0].$extras.total) || 0,
          total_comments: parseInt(totalComments[0].$extras.total) || 0,
          popular_posts: popularPosts,
          recent_posts: recentPosts,
          posts_by_category: postsByCategory
        }
      })

    } catch (error: any) {
      console.error('Erreur merchantStats blog:', error)
      return response.internalServerError({
        success: false,
        message: error.message
      })
    }
  }

  /**
   * Créer un article (MARCHAND)
   * POST /api/blog/merchant/:userId/posts
   */
  async merchantStore({ params, request, response }: HttpContext) {
    try {
      const { userId } = params

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

      // Générer un slug unique à partir du titre
      let slug = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
        .substring(0, 100)

      // Vérifier que le slug est unique
      const existingSlug = await BlogPost.findBy('slug', slug)
      if (existingSlug) {
        slug = `${slug}-${DateTime.now().toFormat('yyyyLLddHHmm')}`
      }

      const post = await BlogPost.create({
        title,
        slug,
        excerpt,
        content,
        image_url: image_url || undefined,
        category,
        author_name: null,  // Sera rempli par la relation
        author_id: userId,  // 🔑 Lié au marchand
        read_time: read_time || 5,
        status: status || 'draft',
        meta_title: meta_title || title,
        meta_description: meta_description || excerpt.substring(0, 160),
        tags: tags || [],
        published_at: status === 'published' ? DateTime.now() : undefined
      })

      // Charger la relation author si elle existe
      await post.load('author', (query) => {
        query.select('id', 'full_name', 'email', 'avatar')
      })

      return response.created({
        success: true,
        data: post,
        message: 'Article créé avec succès'
      })

    } catch (error: any) {
      console.error('Erreur merchantStore blog:', error)
      return response.internalServerError({
        success: false,
        message: error.message
      })
    }
  }

  /**
   * Voir un article spécifique du marchand
   * GET /api/blog/merchant/:userId/posts/:id
   */
  async merchantShow({ params, response }: HttpContext) {
    try {
      const { userId, id } = params

      const post = await BlogPost.query()
        .where('id', id)
        .where('author_id', userId)  // 🔑 Vérifie que l'article appartient bien au marchand
        .preload('author', (query) => {
          query.select('id', 'full_name', 'email', 'avatar')
        })
        .first()

      if (!post) {
        return response.notFound({
          success: false,
          message: 'Article non trouvé ou non autorisé'
        })
      }

      return response.ok({
        success: true,
        data: post
      })

    } catch (error: any) {
      console.error('Erreur merchantShow blog:', error)
      return response.internalServerError({
        success: false,
        message: error.message
      })
    }
  }

  /**
   * Mettre à jour un article du marchand
   * PUT /api/blog/merchant/:userId/posts/:id
   */
  async merchantUpdate({ params, request, response }: HttpContext) {
    try {
      const { userId, id } = params

      const post = await BlogPost.query()
        .where('id', id)
        .where('author_id', userId)  // 🔑 Vérifie que l'article appartient au marchand
        .first()

      if (!post) {
        return response.notFound({
          success: false,
          message: 'Article non trouvé ou non autorisé'
        })
      }

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

      // Mise à jour conditionnelle des champs
      if (payload.title !== undefined) {
        post.title = payload.title
        // Régénérer le slug si le titre change
        let newSlug = payload.title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '')
          .substring(0, 100)
        
        // Vérifier l'unicité du slug
        const existingSlug = await BlogPost.query()
          .where('slug', newSlug)
          .whereNot('id', id)
          .first()
        
        if (existingSlug) {
          newSlug = `${newSlug}-${DateTime.now().toFormat('yyyyLLddHHmm')}`
        }
        post.slug = newSlug
      }
      if (payload.excerpt !== undefined) post.excerpt = payload.excerpt
      if (payload.content !== undefined) post.content = payload.content
      if (payload.image_url !== undefined) post.image_url = payload.image_url || undefined
      if (payload.category !== undefined) post.category = payload.category
      if (payload.read_time !== undefined) post.read_time = payload.read_time
      if (payload.meta_title !== undefined) post.meta_title = payload.meta_title || undefined
      if (payload.meta_description !== undefined) post.meta_description = payload.meta_description || undefined
      if (payload.tags !== undefined) post.tags = payload.tags

      // Gestion du statut
      if (payload.status && payload.status !== post.status) {
        post.status = payload.status
        if (payload.status === 'published' && !post.published_at) {
          post.published_at = DateTime.now()
        } else if (payload.status !== 'published') {
          post.published_at = undefined
        }
      }

      await post.save()

      // Recharger avec la relation
      await post.load('author', (query) => {
        query.select('id', 'full_name', 'email', 'avatar')
      })

      return response.ok({
        success: true,
        data: post,
        message: 'Article mis à jour avec succès'
      })

    } catch (error: any) {
      console.error('Erreur merchantUpdate blog:', error)
      return response.internalServerError({
        success: false,
        message: error.message
      })
    }
  }

  /**
   * Supprimer un article du marchand
   * DELETE /api/blog/merchant/:userId/posts/:id
   */
  async merchantDestroy({ params, response }: HttpContext) {
    try {
      const { userId, id } = params

      const post = await BlogPost.query()
        .where('id', id)
        .where('author_id', userId)  // 🔑 Vérifie que l'article appartient au marchand
        .first()

      if (!post) {
        return response.notFound({
          success: false,
          message: 'Article non trouvé ou non autorisé'
        })
      }

      await post.delete()

      return response.ok({
        success: true,
        message: 'Article supprimé avec succès'
      })

    } catch (error: any) {
      console.error('Erreur merchantDestroy blog:', error)
      return response.internalServerError({
        success: false,
        message: error.message
      })
    }
  }

  /**
   * Publier/Dépublier un article du marchand
   * PATCH /api/blog/merchant/:userId/posts/:id/toggle-status
   */
  async merchantToggleStatus({ params, response }: HttpContext) {
    try {
      const { userId, id } = params

      const post = await BlogPost.query()
        .where('id', id)
        .where('author_id', userId)  // 🔑 Vérifie que l'article appartient au marchand
        .first()

      if (!post) {
        return response.notFound({
          success: false,
          message: 'Article non trouvé ou non autorisé'
        })
      }

      // Basculer entre published et draft
      if (post.status === 'published') {
        post.status = 'draft'
        post.published_at = undefined
      } else {
        post.status = 'published'
        post.published_at = DateTime.now()
      }

      await post.save()

      return response.ok({
        success: true,
        data: post,
        message: `Article ${post.status === 'published' ? 'publié' : 'dépublié'} avec succès`
      })

    } catch (error: any) {
      console.error('Erreur merchantToggleStatus blog:', error)
      return response.internalServerError({
        success: false,
        message: error.message
      })
    }
  }

  // ============= COMMENTAIRES =============

  /**
   * Récupérer les commentaires d'un article
   * GET /api/blog/posts/:postId/comments
   */
  async getComments({ params, response }: HttpContext) {
    try {
      const { postId } = params

      // Vérifier que l'article existe
      const post = await BlogPost.find(postId)
      if (!post) {
        return response.notFound({
          success: false,
          message: 'Article non trouvé'
        })
      }

      // TODO: Implémenter la récupération des commentaires
      // Pour l'instant, retourner un tableau vide
      return response.ok({
        success: true,
        data: {
          comments: [],
          total: 0
        }
      })

    } catch (error: any) {
      console.error('Erreur getComments blog:', error)
      return response.internalServerError({
        success: false,
        message: error.message
      })
    }
  }

  /**
   * Ajouter un commentaire à un article
   * POST /api/blog/posts/:postId/comments
   */
  async storeComment({ params, request, response }: HttpContext) {
    try {
      const { postId } = params
      const { content, author_name, author_email } = request.only([
        'content',
        'author_name',
        'author_email'
      ])

      if (!content || !author_name) {
        return response.badRequest({
          success: false,
          message: 'Le contenu et le nom sont requis'
        })
      }

      // Vérifier que l'article existe et est publié
      const post = await BlogPost.query()
        .where('id', postId)
        .where('status', 'published')
        .first()

      if (!post) {
        return response.notFound({
          success: false,
          message: 'Article non trouvé'
        })
      }

      // TODO: Implémenter la création de commentaires
      // Pour l'instant, retourner un message de succès
      return response.created({
        success: true,
        message: 'Commentaire ajouté avec succès. En attente de validation.'
      })

    } catch (error: any) {
      console.error('Erreur storeComment blog:', error)
      return response.internalServerError({
        success: false,
        message: error.message
      })
    }
  }

  /**
   * Supprimer un commentaire
   * DELETE /api/blog/merchant/comments/:commentId
   */
  async deleteComment({ params, response }: HttpContext) {
    try {
      const { commentId } = params

      // TODO: Implémenter la suppression de commentaires
      return response.ok({
        success: true,
        message: 'Commentaire supprimé avec succès'
      })

    } catch (error: any) {
      console.error('Erreur deleteComment blog:', error)
      return response.internalServerError({
        success: false,
        message: error.message
      })
    }
  }

  // ============= ROUTES ADMIN (SANS AUTH) =============

  async adminIndex({ request, response }: HttpContext) {
    try {
      const page = request.input('page', 1)
      const limit = request.input('limit', 10)
      const status = request.input('status')
      const search = request.input('search')

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
      console.error('Erreur adminIndex blog:', error)
      return response.internalServerError({
        success: false,
        message: error.message
      })
    }
  }

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

      // Générer un slug unique
      let slug = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
        .substring(0, 100)

      const existingSlug = await BlogPost.findBy('slug', slug)
      if (existingSlug) {
        slug = `${slug}-${DateTime.now().toFormat('yyyyLLddHHmm')}`
      }

      const post = await BlogPost.create({
        title,
        slug,
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

      if (payload.title) {
        post.title = payload.title
        // Mettre à jour le slug
        let newSlug = payload.title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '')
          .substring(0, 100)
        
        const existingSlug = await BlogPost.query()
          .where('slug', newSlug)
          .whereNot('id', id)
          .first()
        
        if (existingSlug) {
          newSlug = `${newSlug}-${DateTime.now().toFormat('yyyyLLddHHmm')}`
        }
        post.slug = newSlug
      }
      if (payload.excerpt) post.excerpt = payload.excerpt
      if (payload.content) post.content = payload.content
      if (payload.image_url !== undefined) post.image_url = payload.image_url || undefined
      if (payload.category) post.category = payload.category
      if (payload.read_time) post.read_time = payload.read_time
      if (payload.meta_title !== undefined) post.meta_title = payload.meta_title || undefined
      if (payload.meta_description !== undefined) post.meta_description = payload.meta_description || undefined
      if (payload.tags) post.tags = payload.tags

      if (payload.status && payload.status !== post.status) {
        post.status = payload.status
        if (payload.status === 'published' && !post.published_at) {
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
