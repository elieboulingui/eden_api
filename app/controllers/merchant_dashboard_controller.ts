import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import Product from '#models/Product'
import Category from '#models/categories'
import Coupon from '#models/coupon'
import Order from '#models/Order'
import { DateTime } from 'luxon'

export default class MerchantDashboardController {
  // ============= PRODUITS =============
  
async getProducts({ params, request, response }: HttpContext) {
  try {
    const { userId } = params
    const user = await User.findBy('uuid', userId)
    
    if (!user || (user.role !== 'marchant' && user.role !== 'merchant')) {
      return response.ok({ success: true, data: { data: [], meta: { total: 0 } } })
    }

    const page = request.input('page', 1)
    const limit = request.input('limit', 10)

    const products = await Product.query()
      .where('user_id', Number(user.id))
      .whereNull('deleted_at')
      .preload('category')  // Changez 'categoryRelation' en 'category'
      .orderBy('created_at', 'desc')
      .paginate(page, limit)

    return response.ok({ success: true, data: products })
  } catch (error) {
    return response.internalServerError({ success: false, message: error.message })
  }
}

async createProduct({ params, request, response }: HttpContext) {
  try {
    const { userId } = params
    const { name, description, price, stock, category_name, image_url } = request.only([
      'name',
      'description',
      'price',
      'stock',
      'category_name',
      'image_url',
    ])

    // Trouver l'utilisateur par UUID (string)
    const user = await User.findBy('uuid', userId)

    if (!user || (user.role !== 'marchant' && user.role !== 'merchant')) {
      return response.forbidden({ success: false, message: 'Non autorisé' })
    }

    let categoryId = null

    if (category_name && category_name.trim() !== '') {
      const category = await Category.query()
        .where('name', category_name)
        .where('user_id', user.id)
        .first()

      if (category) {
        categoryId = category.id
      } else {
        const newCategory = await Category.create({
          name: category_name,
          slug: category_name.toLowerCase().replace(/\s+/g, '-'),
            user_id: user.id.toString(), 
          is_active: true,
        })
        categoryId = newCategory.id
      }
    }

    const product = await Product.create({
      name,
      description: description || null,
      price: parseFloat(price),
      stock: parseInt(stock),
      image_url: image_url || null,
      user_id: parseInt(user.id, 10),
      category_id: categoryId,
      is_new: false,
      is_on_sale: false,
      rating: 0,
      reviews_count: 0,
    })

    return response.created({
      success: true,
      data: product,
      message: 'Produit créé',
    })
  } catch (error) {
    console.error('Erreur createProduct:', error)
    return response.internalServerError({
      success: false,
      message: error.message,
    })
  }
}
  async updateProduct({ params, request, response }: HttpContext) {
    try {
      const { userId, productId } = params
      const { name, description, price, stock, category_name, image_url } = request.only([
        'name', 'description', 'price', 'stock', 'category_name', 'image_url'
      ])

      const user = await User.findBy('uuid', userId)
      
      if (!user || (user.role !== 'marchant' && user.role !== 'merchant')) {
        return response.forbidden({ success: false, message: 'Non autorisé' })
      }

      const product = await Product.query()
        .where('id', productId)
        .where('user_id', Number(user.id))
        .first()

      if (!product) {
        return response.notFound({ success: false, message: 'Produit non trouvé' })
      }

      let categoryId = null
      
      if (category_name && category_name.trim() !== '') {
        const category = await Category.query()
          .where('name', category_name)
          .where('user_id', user.id)
          .first()
        
        if (category) {
          categoryId = category.id
        } else {
          const newCategory = await Category.create({
            name: category_name,
            slug: category_name.toLowerCase().replace(/\s+/g, '-'),
            user_id: user.id,
            is_active: true
          })
          categoryId = newCategory.id
        }
      }

      if (name) product.name = name
      if (description !== undefined) product.description = description
      if (price) product.price = parseFloat(price)
      if (stock !== undefined) product.stock = parseInt(stock)
      if (image_url !== undefined) product.image_url = image_url
      if (categoryId) product.category_id = categoryId

      await product.save()

      return response.ok({ 
        success: true, 
        data: product, 
        message: 'Produit mis à jour avec succès' 
      })
    } catch (error) {
      console.error('Erreur updateProduct:', error)
      return response.internalServerError({ 
        success: false, 
        message: error.message 
      })
    }
  }

  async deleteProduct({ params, response }: HttpContext) {
    try {
      const { userId, productId } = params
      const user = await User.findBy('uuid', userId)
      
      if (!user || (user.role !== 'marchant' && user.role !== 'merchant')) {
        return response.forbidden({ success: false, message: 'Non autorisé' })
      }

      const product = await Product.query()
        .where('id', productId)
        .where('user_id', Number(user.id))
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

      if (!userId) {
        return response.badRequest({ success: false, message: 'ID utilisateur requis' })
      }

      const user = await User.findBy('uuid', userId)

      if (!user) {
        return response.notFound({ success: false, message: 'Utilisateur non trouvé' })
      }

      if (user.role !== 'marchant' && user.role !== 'merchant') {
        return response.forbidden({ success: false, message: 'Cet utilisateur n\'est pas un marchand' })
      }

      const categories = await Category.query()
        .where('user_id', user.id)
        .orderBy('name', 'asc')

      return response.ok({ success: true, data: categories })
    } catch (error) {
      console.error('ERREUR getCategories:', error)
      return response.internalServerError({ success: false, message: error.message })
    }
  }

async createCategory({ params, request, response }: HttpContext) {
  try {
    const { userId } = params
    const { name, slug } = request.only(['name', 'slug'])

    if (!name) {
      return response.badRequest({ success: false, message: 'Le nom est requis' })
    }

    const user = await User.findBy('uuid', userId)
    
    if (!user || (user.role !== 'marchant' && user.role !== 'merchant')) {
      return response.forbidden({ success: false, message: 'Non autorisé' })
    }

    const slugToUse = slug || name.toLowerCase().replace(/\s+/g, '-')

    const category = await Category.create({
      name,
      slug: slugToUse,
      user_id: user.id, // user.id est une string, Category.user_id doit être string aussi
    })

    return response.created({
      success: true,
      data: { 
        id: category.id, 
        name: category.name, 
        slug: category.slug, 
        productCount: 0,
      },
      message: 'Catégorie créée',
    })
  } catch (error) {
    console.error('ERREUR createCategory:', error)
    return response.internalServerError({ 
      success: false, 
      message: error.message,
    })
  }
}

  async updateCategory({ params, request, response }: HttpContext) {
    try {
      const { userId, categoryId } = params
      const { name, slug, is_active } = request.only(['name', 'slug', 'is_active'])

      const user = await User.findBy('uuid', userId)
      
      if (!user || (user.role !== 'marchant' && user.role !== 'merchant')) {
        return response.forbidden({ success: false, message: 'Non autorisé' })
      }

      const category = await Category.query()
        .where('id', categoryId)
        .where('user_id', user.id)
        .first()

      if (!category) {
        return response.notFound({ success: false, message: 'Catégorie non trouvée' })
      }

      if (name) category.name = name
      if (slug) category.slug = slug
      if (is_active !== undefined) category.is_active = is_active

      await category.save()

      return response.ok({ 
        success: true, 
        data: category, 
        message: 'Catégorie mise à jour avec succès' 
      })
    } catch (error) {
      console.error('Erreur updateCategory:', error)
      return response.internalServerError({ 
        success: false, 
        message: error.message 
      })
    }
  }

  async deleteCategory({ params, response }: HttpContext) {
    try {
      const { userId, categoryId } = params

      const user = await User.findBy('uuid', userId)
      
      if (!user || (user.role !== 'marchant' && user.role !== 'merchant')) {
        return response.forbidden({ success: false, message: 'Non autorisé' })
      }

      const category = await Category.query()
        .where('id', categoryId)
        .where('user_id', user.id)
        .first()

      if (!category) {
        return response.notFound({ success: false, message: 'Catégorie non trouvée' })
      }

      const productsCount = await Product.query()
        .where('category_id', category.id)
        .count('* as total')

      if (parseInt(productsCount[0].$extras.total) > 0) {
        return response.badRequest({ 
          success: false, 
          message: 'Impossible de supprimer cette catégorie car elle contient des produits' 
        })
      }

      await category.delete()

      return response.ok({ 
        success: true, 
        message: 'Catégorie supprimée avec succès' 
      })
    } catch (error) {
      console.error('Erreur deleteCategory:', error)
      return response.internalServerError({ 
        success: false, 
        message: error.message 
      })
    }
  }

  // ============= COUPONS =============
  
  async getCoupons({ params, response }: HttpContext) {
    try {
      const { userId } = params
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

      const user = await User.findBy('uuid', userId)
      
      if (!user || (user.role !== 'marchant' && user.role !== 'merchant')) {
        return response.forbidden({ success: false, message: 'Non autorisé' })
      }

      const coupon = await Coupon.create({
        code: code.toUpperCase(),
        discount: parseFloat(discount),
        type,
        valid_until: validUntil ? DateTime.fromJSDate(new Date(validUntil)) : null,
        usage_limit: parseInt(usageLimit) || 1,
        used_count: 0,
        user_id: user.id,
        product_id: productId || null,
        status: 'active'
      })

      return response.created({ success: true, data: coupon, message: 'Code promo créé' })
    } catch (error) {
      return response.internalServerError({ success: false, message: error.message })
    }
  }

  async updateCoupon({ params, request, response }: HttpContext) {
    try {
      const { userId, couponId } = params
      const { code, discount, type, validUntil, usageLimit, status } = request.only([
        'code', 'discount', 'type', 'validUntil', 'usageLimit', 'status'
      ])

      const user = await User.findBy('uuid', userId)
      
      if (!user || (user.role !== 'marchant' && user.role !== 'merchant')) {
        return response.forbidden({ success: false, message: 'Non autorisé' })
      }

      const coupon = await Coupon.query()
        .where('id', couponId)
        .where('user_id', user.id)
        .first()

      if (!coupon) {
        return response.notFound({ success: false, message: 'Code promo non trouvé' })
      }

      if (code) coupon.code = code.toUpperCase()
      if (discount) coupon.discount = parseFloat(discount)
      if (type) coupon.type = type
      if (validUntil) coupon.valid_until = DateTime.fromJSDate(new Date(validUntil))
      if (usageLimit) coupon.usage_limit = parseInt(usageLimit)
      if (status) coupon.status = status

      await coupon.save()

      return response.ok({ 
        success: true, 
        data: coupon, 
        message: 'Code promo mis à jour avec succès' 
      })
    } catch (error) {
      console.error('Erreur updateCoupon:', error)
      return response.internalServerError({ 
        success: false, 
        message: error.message 
      })
    }
  }

  async deleteCoupon({ params, response }: HttpContext) {
    try {
      const { userId, couponId } = params

      const user = await User.findBy('uuid', userId)
      
      if (!user || (user.role !== 'marchant' && user.role !== 'merchant')) {
        return response.forbidden({ success: false, message: 'Non autorisé' })
      }

      const coupon = await Coupon.query()
        .where('id', couponId)
        .where('user_id', user.id)
        .first()

      if (!coupon) {
        return response.notFound({ success: false, message: 'Code promo non trouvé' })
      }

      await coupon.delete()

      return response.ok({ 
        success: true, 
        message: 'Code promo supprimé avec succès' 
      })
    } catch (error) {
      console.error('Erreur deleteCoupon:', error)
      return response.internalServerError({ 
        success: false, 
        message: error.message 
      })
    }
  }

  // ============= STATISTIQUES =============
  
  async getStats({ params, response }: HttpContext) {
    try {
      const { userId } = params
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
        createdAt: order.created_at.toISO(),
      }))

      return response.ok({ success: true, data: ordersData })
    } catch (error) {
      return response.internalServerError({ success: false, message: error.message })
    }
  }
}