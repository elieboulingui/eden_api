// app/controllers/merchant_dashboard_controller.ts
import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import Product from '#models/product'
import Category from '#models/categories'
import Coupon from '#models/coupon'
import Order from '#models/Order'
import OrderItem from '#models/OrderItem'
import Review from '#models/review'
import Wallet from '#models/wallet'
import { DateTime } from 'luxon'

export default class MerchantDashboardController {
  /**
   * Récupérer toutes les données du dashboard
   * COMMENTÉ TEMPORAIREMENT POUR ÉVITER LES ERREURS
   */
  // async getDashboard({ params, response }: HttpContext) {
  //   ... (code commenté)
  // }

  // ============= PRODUITS =============
  
  async getProducts({ params, request, response }: HttpContext) {
    try {
      const { userId } = params
      // Chercher l'utilisateur par UUID
      const user = await User.findBy('uuid', userId)
      
      if (!user || (user.role !== 'marchant' && user.role !== 'merchant')) {
        return response.ok({ success: true, data: { data: [], meta: { total: 0 } } })
      }

      const page = request.input('page', 1)
      const limit = request.input('limit', 10)

      const products = await Product.query()
        .where('user_id', user.id)
        .whereNull('deleted_at')
        .preload('category')
        .orderBy('created_at', 'desc')
        .paginate(page, limit)

      return response.ok({ success: true, data: products })
    } catch (error) {
      return response.internalServerError({ success: false, message: error.message })
    }
  }

 
// app/controllers/merchant_dashboard_controller.ts
// app/controllers/merchant_dashboard_controller.
// app/controllers/merchant_dashboard_controller.ts
async createProduct({ params, request, response }: HttpContext) {
  try {
    const { userId } = params
    const { name, description, price, stock, category_name, image_url } = request.only([
      'name', 'description', 'price', 'stock', 'category_name', 'image_url'
    ])

    console.log('=== createProduct ===')
    console.log('userId param:', userId)

    const userIdNum = parseInt(userId)
    const user = await User.find(userIdNum)
    
    if (!user || (user.role !== 'marchant' && user.role !== 'merchant')) {
      return response.forbidden({ success: false, message: 'Non autorisé' })
    }

    let categoryId = null
    
    if (category_name && category_name.trim() !== '') {
      console.log('Recherche catégorie:', category_name)
      const category = await Category.query()
        .where('name', category_name)
        .where('user_id', user.id)
        .first()
      
      if (category) {
        categoryId = category.id
        console.log('Catégorie trouvée - ID:', categoryId)
      } else {
        console.log('Création nouvelle catégorie')
        const newCategory = await Category.create({
          name: category_name,
          slug: category_name.toLowerCase().replace(/\s+/g, '-'),
          user_id: user.id,
          is_active: true
        })
        categoryId = newCategory.id
        console.log('Nouvelle catégorie - ID:', categoryId)
      }
    }

    // VÉRIFICATION : Si categoryId est un nombre (quel qu'il soit), on le met à null
    // Car category_id attend un UUID
    if (typeof categoryId === 'number' || !isNaN(parseInt(categoryId))) {
      console.log(`⚠️ categoryId est un nombre (${categoryId}), on le met à null`)
      categoryId = null
    }

    // Vérification du format UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (categoryId && !uuidRegex.test(categoryId)) {
      console.log(`⚠️ categoryId (${categoryId}) n'est pas un UUID valide, on le met à null`)
      categoryId = null
    }

    console.log('categoryId final:', categoryId)

    const product = await Product.create({
      name,
      description: description || null,
      price: parseFloat(price),
      stock: parseInt(stock),
      image_url: image_url || null,
      user_id: user.id,
      category_id: categoryId,  // Maintenant c'est soit null soit un UUID valide
      is_new: false,
      is_on_sale: false,
      rating: 0,
      reviews_count: 0
    })

    return response.created({ 
      success: true, 
      data: product, 
      message: 'Produit créé' 
    })
  } catch (error) {
    console.error('Erreur createProduct:', error)
    return response.internalServerError({ 
      success: false, 
      message: error.message 
    })
  }
}

  async deleteProduct({ params, response }: HttpContext) {
    try {
      const { userId, productId } = params
      // Chercher l'utilisateur par UUID
      const user = await User.findBy('uuid', userId)
      
      if (!user || (user.role !== 'marchant' && user.role !== 'merchant')) {
        return response.forbidden({ success: false, message: 'Non autorisé' })
      }

      const product = await Product.query()
        .where('id', productId)
        .where('user_id', user.id)
        .first()

      if (!product) {
        return response.notFound({ success: false, message: 'Produit non trouvé' })
      }

      await product.delete()
      return response.ok({ success: true, message: 'Produit supprimé' })
    } catch (error) {
      return response.internalServerError({ success: false, message: error.message })
    }
  }

  // ============= CATÉGORIES =============
  
  async getCategories({ params, response }: HttpContext) {
    try {
      const { userId } = params
      console.log('=== getCategories appelé ===')
      console.log('userId (UUID):', userId)

      if (!userId) {
        return response.badRequest({
          success: false,
          message: 'ID utilisateur requis'
        })
      }

      // Chercher l'utilisateur par UUID
      const user = await User.findBy('uuid', userId)

      if (!user) {
        return response.notFound({
          success: false,
          message: 'Utilisateur non trouvé'
        })
      }

      if (user.role !== 'marchant' && user.role !== 'merchant') {
        return response.forbidden({
          success: false,
          message: 'Cet utilisateur n\'est pas un marchand'
        })
      }

      const categories = await Category.query()
        .where('user_id', user.id)
        .orderBy('name', 'asc')

      console.log('Catégories trouvées:', categories.length)

      return response.ok({
        success: true,
        data: categories
      })

    } catch (error) {
      console.error('ERREUR getCategories:', error)
      return response.internalServerError({
        success: false,
        message: error.message
      })
    }
  }

  async createCategory({ params, request, response }: HttpContext) {
    try {
      const { userId } = params
      const { name, slug } = request.only(['name', 'slug'])

      if (!name) {
        return response.badRequest({ success: false, message: 'Le nom est requis' })
      }

      // Chercher l'utilisateur par UUID
      const user = await User.findBy('uuid', userId)
      
      if (!user || (user.role !== 'marchant' && user.role !== 'merchant')) {
        return response.forbidden({ success: false, message: 'Non autorisé' })
      }

      const slugToUse = slug || name.toLowerCase().replace(/\s+/g, '-')

      const category = await Category.create({
        name,
        slug: slugToUse,
        user_id: user.id
      })

      return response.created({
        success: true,
        data: { 
          id: category.id, 
          name: category.name, 
          slug: category.slug, 
          productCount: 0 
        },
        message: 'Catégorie créée'
      })
    } catch (error) {
      console.error('ERREUR createCategory:', error)
      return response.internalServerError({ success: false, message: error.message })
    }
  }

  // ============= COUPONS =============
  
  async getCoupons({ params, response }: HttpContext) {
    try {
      const { userId } = params
      // Chercher l'utilisateur par UUID
      const user = await User.findBy('uuid', userId)
      
      if (!user || (user.role !== 'marchant' && user.role !== 'merchant')) {
        return response.ok({ success: true, data: [] })
      }

      const coupons = await Coupon.query()
        .where('user_id', user.id)
        .orderBy('created_at', 'desc')

      return response.ok({ success: true, data: coupons })
    } catch (error) {
      return response.internalServerError({ success: false, message: error.message })
    }
  }

  async createCoupon({ params, request, response }: HttpContext) {
    try {
      const { userId } = params
      const { code, discount, type, validUntil, usageLimit, productId } = request.only([
        'code', 'discount', 'type', 'validUntil', 'usageLimit', 'productId'
      ])

      // Chercher l'utilisateur par UUID
      const user = await User.findBy('uuid', userId)
      
      if (!user || (user.role !== 'marchant' && user.role !== 'merchant')) {
        return response.forbidden({ success: false, message: 'Non autorisé' })
      }

      const coupon = await Coupon.create({
        code: code.toUpperCase(),
        discount: parseFloat(discount),
        type,
        valid_until: validUntil ? new Date(validUntil) : null,
        usage_limit: parseInt(usageLimit) || 1,
        used_count: 0,
        user_id: user.id,
        product_id: productId ? parseInt(productId) : null,
        status: 'active'
      })

      return response.created({ success: true, data: coupon, message: 'Code promo créé' })
    } catch (error) {
      return response.internalServerError({ success: false, message: error.message })
    }
  }

  // ============= STATISTIQUES =============
  
  async getStats({ params, response }: HttpContext) {
    try {
      const { userId } = params
      // Chercher l'utilisateur par UUID
      const user = await User.findBy('uuid', userId)
      
      const totalProducts = await Product.query()
        .where('user_id', user?.id || 0)
        .whereNull('deleted_at')
        .count('* as total')

      return response.ok({
        success: true,
        data: {
          totalProducts: parseInt(totalProducts[0].$extras.total) || 0,
          sales: { today: 0, week: 0, month: 0 },
          totalRevenue: 0,
        }
      })
    } catch (error) {
      return response.internalServerError({ success: false, message: error.message })
    }
  }

  async getRecentOrders({ params, response }: HttpContext) {
    try {
      const { userId } = params
      // Chercher l'utilisateur par UUID
      const user = await User.findBy('uuid', userId)
      
      if (!user || (user.role !== 'marchant' && user.role !== 'merchant')) {
        return response.ok({ success: true, data: [] })
      }

      const orders = await Order.query()
        .where('merchant_id', user.id)
        .where('status', 'pending')
        .preload('user', (query) => {
          query.select('id', 'full_name', 'email')
        })
        .orderBy('created_at', 'desc')
        .limit(10)

      const ordersData = orders.map(order => ({
        id: order.id,
        orderNumber: `CMD-${order.id.slice(-8)}`,
        customerName: order.user?.full_name || 'Client',
        total: order.total,
        status: order.status,
        createdAt: order.createdAt.toISO(),
      }))

      return response.ok({ success: true, data: ordersData })
    } catch (error) {
      return response.internalServerError({ success: false, message: error.message })
    }
  }
}