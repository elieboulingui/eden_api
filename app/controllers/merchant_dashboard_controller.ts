import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import Product from '#models/Product'
import Category from '#models/categories'
import Coupon from '#models/coupon'
import Database from '@adonisjs/lucid/services/db'
import Order from '#models/Order'
import OrderItem from '#models/OrderItem'
import OrderTracking from '#models/order_tracking'
import Wallet from '#models/wallet'
import { DateTime } from 'luxon'

export default class MerchantDashboardController {

  // ============= WALLET =============

  async getWallet({ params, response }: HttpContext) {
    try {
      const { userId } = params

      console.log('getWallet called for userId:', userId)

      if (!userId) {
        return response.badRequest({ success: false, message: "ID utilisateur manquant" })
      }

      const user = await User.findBy('id', userId)

      if (!user) {
        return response.notFound({ success: false, message: 'Utilisateur non trouvé' })
      }

      let wallet = await Wallet.query()
        .where('user_id', user.id)
        .first()

      if (!wallet) {
        wallet = await Wallet.create({
          user_id: user.id,
          balance: 0,
          currency: 'XAF',
          status: 'active'
        })
      }

      return response.ok({
        success: true,
        data: {
          id: wallet.id,
          user_id: wallet.user_id,
          balance: wallet.balance,
          currency: wallet.currency,
          status: wallet.status,
          created_at: wallet.created_at,
          updated_at: wallet.updated_at
        }
      })

    } catch (error) {
      console.error('Erreur dans getWallet:', error)
      return response.internalServerError({
        success: false,
        message: error.message
      })
    }
  }

  // ============= COMMANDES MARCHAND =============

  async getMerchantOrders({ params, response }: HttpContext) {
    try {
      const { userId } = params

      console.log('getMerchantOrders called for userId:', userId)

      if (!userId) {
        return response.badRequest({ success: false, message: "ID utilisateur manquant" })
      }

      const user = await User.findBy('id', userId)

      if (!user) {
        return response.notFound({ success: false, message: 'Utilisateur non trouvé' })
      }

      const merchantProducts = await Product.query()
        .where('user_id', user.id)
        .whereNull('deleted_at')
        .select('id', 'name', 'price', 'imageUrl')

      const productIds = merchantProducts.map(p => p.id)

      if (productIds.length === 0) {
        return response.ok({
          success: true,
          data: [],
          stats: {
            totalOrders: 0,
            totalRevenue: 0,
            pendingOrders: 0,
            processingOrders: 0,
            shippedOrders: 0,
            deliveredOrders: 0,
            cancelledOrders: 0,
            totalItems: 0,
            averageOrderValue: 0
          }
        })
      }

      const orderItems = await OrderItem.query()
        .whereIn('product_id', productIds)
        .preload('order', (orderQuery) => {
          orderQuery
            .preload('user', (userQuery) => {
              userQuery.select('id', 'full_name', 'email')
            })
            .orderBy('created_at', 'desc')
        })

      if (orderItems.length === 0) {
        return response.ok({
          success: true,
          data: [],
          stats: {
            totalOrders: 0,
            totalRevenue: 0,
            pendingOrders: 0,
            processingOrders: 0,
            shippedOrders: 0,
            deliveredOrders: 0,
            cancelledOrders: 0,
            totalItems: 0,
            averageOrderValue: 0
          }
        })
      }

      const ordersMap = new Map()

      for (const item of orderItems) {
        const order = item.order
        if (order && !ordersMap.has(order.id)) {
          const tracking = await OrderTracking.query()
            .where('order_id', order.id)
            .orderBy('tracked_at', 'desc')
            .first()

          ordersMap.set(order.id, {
            id: order.id,
            order_number: order.order_number,
            status: order.status,
            total: order.total,
            subtotal: order.subtotal,
            shipping_cost: order.shipping_cost,
            customer_name: order.customer_name,
            customer_email: order.customer_email,
            customer_phone: order.customer_phone,
            shipping_address: order.shipping_address,
            payment_method: order.payment_method,
            tracking_number: order.tracking_number,
            created_at: order.created_at,
            estimated_delivery: order.estimated_delivery,
            delivered_at: order.delivered_at,
            notes: order.notes,
            items: [],
            tracking: tracking ? {
              status: tracking.status,
              description: tracking.description,
              location: tracking.location,
              tracked_at: tracking.tracked_at
            } : null,
            user: order.user ? {
              id: order.user.id,
              full_name: order.user.full_name,
              email: order.user.email
            } : null
          })
        }

        if (ordersMap.has(order.id)) {
          const orderData = ordersMap.get(order.id)
          orderData.items.push({
            id: item.id,
            product_id: item.product_id,
            product_name: item.product_name,
            product_description: item.product_description,
            price: item.price,
            quantity: item.quantity,
            subtotal: item.subtotal,
            category: item.category,
            image: item.image
          })
        }
      }

      const orders = Array.from(ordersMap.values())

      orders.sort((a, b) => {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      })

      const stats = {
        totalOrders: orders.length,
        totalRevenue: orders.reduce((sum, order) => sum + order.total, 0),
        pendingOrders: orders.filter(o => o.status === 'pending').length,
        processingOrders: orders.filter(o => o.status === 'processing').length,
        shippedOrders: orders.filter(o => o.status === 'shipped').length,
        deliveredOrders: orders.filter(o => o.status === 'delivered').length,
        cancelledOrders: orders.filter(o => o.status === 'cancelled').length,
        totalItems: orders.reduce((sum, order) => sum + order.items.length, 0),
        averageOrderValue: orders.length > 0
          ? orders.reduce((sum, order) => sum + order.total, 0) / orders.length
          : 0
      }

      return response.ok({
        success: true,
        data: orders,
        stats: stats,
        count: orders.length
      })

    } catch (error) {
      console.error('Erreur dans getMerchantOrders:', error)
      return response.internalServerError({
        success: false,
        message: error.message
      })
    }
  }

  async getPendingOrders({ params, response }: HttpContext) {
    try {
      const { userId } = params

      if (!userId) {
        return response.badRequest({ success: false, message: "ID utilisateur manquant" })
      }

      const user = await User.findBy('id', userId)

      if (!user) {
        return response.notFound({ success: false, message: 'Utilisateur non trouvé' })
      }

      const merchantProducts = await Product.query()
        .where('user_id', user.id)
        .whereNull('deleted_at')
        .select('id')

      const productIds = merchantProducts.map(p => p.id)

      if (productIds.length === 0) {
        return response.ok({
          success: true,
          data: [],
          count: 0
        })
      }

      const orderItems = await OrderItem.query()
        .whereIn('product_id', productIds)
        .preload('order', (orderQuery) => {
          orderQuery
            .where('status', 'pending')
            .preload('user', (userQuery) => {
              userQuery.select('id', 'full_name', 'email')
            })
        })

      const ordersMap = new Map()

      for (const item of orderItems) {
        const order = item.order
        if (order && order.status === 'pending' && !ordersMap.has(order.id)) {
          ordersMap.set(order.id, {
            id: order.id,
            order_number: order.order_number,
            status: order.status,
            total: order.total,
            customer_name: order.customer_name,
            customer_email: order.customer_email,
            customer_phone: order.customer_phone,
            created_at: order.created_at,
            items_count: 0,
            user: order.user ? {
              full_name: order.user.full_name,
              email: order.user.email
            } : null
          })
        }

        if (ordersMap.has(order.id)) {
          const orderData = ordersMap.get(order.id)
          orderData.items_count++
        }
      }

      const pendingOrders = Array.from(ordersMap.values())
      pendingOrders.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

      return response.ok({
        success: true,
        data: pendingOrders,
        count: pendingOrders.length
      })

    } catch (error) {
      console.error('Erreur dans getPendingOrders:', error)
      return response.internalServerError({
        success: false,
        message: error.message
      })
    }
  }

  async getOrderDetails({ params, response }: HttpContext) {
    try {
      const { userId, orderId } = params

      if (!userId || !orderId) {
        return response.badRequest({ success: false, message: "Paramètres manquants" })
      }

      const user = await User.findBy('id', userId)

      if (!user) {
        return response.notFound({ success: false, message: 'Utilisateur non trouvé' })
      }

      const order = await Order.query()
        .where('id', orderId)
        .preload('user', (userQuery) => {
          userQuery.select('id', 'full_name', 'email', 'phone')
        })
        .preload('items', (itemsQuery) => {
          itemsQuery.preload('product')
        })
        .first()

      if (!order) {
        return response.notFound({ success: false, message: 'Commande non trouvée' })
      }

      const merchantProducts = await Product.query()
        .where('user_id', user.id)
        .select('id')

      const merchantProductIds = merchantProducts.map(p => p.id)
      const hasMerchantProducts = order.items.some(item => merchantProductIds.includes(item.product_id))

      if (!hasMerchantProducts) {
        return response.forbidden({ success: false, message: 'Cette commande ne contient pas de vos produits' })
      }

      const tracking = await OrderTracking.query()
        .where('order_id', order.id)
        .orderBy('tracked_at', 'desc')
        .first()

      return response.ok({
        success: true,
        data: {
          ...order.toJSON(),
          tracking: tracking ? {
            status: tracking.status,
            description: tracking.description,
            location: tracking.location,
            tracked_at: tracking.tracked_at
          } : null,
          merchant_items: order.items.filter(item => merchantProductIds.includes(item.product_id))
        }
      })

    } catch (error) {
      console.error('Erreur dans getOrderDetails:', error)
      return response.internalServerError({
        success: false,
        message: error.message
      })
    }
  }

  // ============= VOS MÉTHODES EXISTANTES =============

  public async index({ params, response }: HttpContext) {
    const { id } = params

    if (!id) {
      return response.badRequest({ success: false, message: "ID manquant" })
    }

    try {
      const orders = await OrderTracking.query()
        .where('user_id', id)
        .preload('order', (orderQuery) => {
          orderQuery.preload('items', (itemsQuery) => {
            itemsQuery.preload('product')
          })
        })

      return response.ok({
        success: true,
        count: orders.length,
        data: orders
      })
    } catch (error) {
      console.error('Erreur SQL:', error)
      return response.internalServerError({
        success: false,
        message: "Erreur lors de la récupération des commandes du client",
        error: error.message
      })
    }
  }

  async dashboard(ctx: HttpContext) {
    const { params, response } = ctx
    const userId = params.userId

    const user = await User.findBy('id', userId)
    if (!user || (user.role !== 'marchant' && user.role !== 'merchant')) {
      return response.forbidden({ success: false, message: 'Non autorisé' })
    }

    const products = await Product.query()
      .where('user_id', user.id)
      .orderBy('created_at', 'desc')


    return response.ok({
      success: true,
      data: {
        stats: {
          totalProducts: products.length,
          totalSales: 0,
          totalRevenue: 0,
          totalLikes: 0,
          pendingOrders: 0,
        },
        products: products.map(p => ({
          id: p.id,
          name: p.name,
          description: p.description,
          price: p.price,
          stock: p.stock,
          image_url: p.image_url,
          likes: 0,
          sales: 0,
          status: 'active',
        })),
        categories: [],
        coupons: [],
        salesChart: [],
        pendingOrders: [],
        popularProducts: [],
        merchant: {
          id: user.id,
          full_name: user.full_name,
          email: user.email,
          avatar: null,
          availableBalance: 0,
        }
      }
    })
  }

  async getProducts({ params, request, response }: HttpContext) {
    try {
      const { userId } = params
      const user = await User.findBy('id', userId)

      if (!user || (user.role !== 'marchant' && user.role !== 'merchant')) {
        return response.ok({ success: true, data: { data: [], meta: { total: 0 } } })
      }

      const page = request.input('page', 1)
      const limit = request.input('limit', 10)

      // Récupérer les produits
      const products = await Product.query()
        .where('user_id', user.id)
        .whereNull('deleted_at')
        .orderBy('created_at', 'desc')
        .paginate(page, limit)

      // Récupérer les IDs des produits
      const productIds = products.map(p => p.id)

      // Compter le nombre de favoris pour chaque produit
      let favoritesCountMap: Record<string, number> = {}

      if (productIds.length > 0) {
        const favoritesCount = await Database
          .from('favorites')
          .select('product_id')
          .count('* as total')
          .whereIn('product_id', productIds)
          .groupBy('product_id')

        favoritesCountMap = favoritesCount.reduce((acc: Record<string, number>, curr: any) => {
          acc[curr.product_id] = parseInt(curr.total)
          return acc
        }, {})
      }

      // Transformer les données
      const transformedProducts = products.map((product: any) => ({
        id: product.id,
        name: product.name,
        description: product.description,
        price: product.price,
        stock: product.stock,
        image_url: product.image_url,
        category: product.category,
        likes: favoritesCountMap[product.id] || 0, // Nombre total de fois dans les favoris
        sales: product.sales || 0,
        created_at: product.created_at,
        status: product.status || 'active'
      }))

      return response.ok({
        success: true,
        data: {
          ...products,
          data: transformedProducts
        }
      })
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

      const user = await User.findBy('id', userId)

      if (!user || (user.role !== 'marchant' && user.role !== 'merchant')) {
        return response.forbidden({ success: false, message: 'Non autorisé' })
      }

      // **Support pour plusieurs catégories séparées par des virgules**
      const categoryNames = category_name ? category_name.split(',').map((c: string) => c.trim()) : []
      const categoryIds: string[] = []

      for (const name of categoryNames) {
        if (!name) continue

        // Cherche ou crée la catégorie
        let category = await Category.query().where('name', name).where('user_id', user.id).first()

        if (!category) {
          category = await Category.create({
            name,
            image_url: image_url || null,
            slug: name.toLowerCase().replace(/\s+/g, '-'),
            user_id: user.id,
            is_active: true,
            product_ids: [], // initialise le tableau
          })
        }

        categoryIds.push(category.id)
      }

      // Crée le produit
      const product = await Product.create({
        name,
        description: description || null,
        price: parseFloat(price),
        stock: parseInt(stock),
        image_url: image_url || null,
        user_id: user.id,
        isNew: true,
        isOnSale: false,
        rating: 0,
        // pas besoin de category_id si tu veux gérer avec product_ids
      })

      // **Ajoute l'ID du produit dans chaque catégorie**
      for (const categoryId of categoryIds) {
        const category = await Category.find(categoryId)
        if (!category) continue

        if (!category.product_ids) category.product_ids = []
        // Évite les doublons
        if (!category.product_ids.includes(product.id)) {
          category.product_ids.push(product.id)
        }

        await category.save()
      }

      return response.created({
        success: true,
        data: product,
        message: 'Produit créé et ajouté aux catégories',
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

      const user = await User.findBy('id', userId)

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
      const user = await User.findBy('id', userId)

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

  async getCategories({ params, response }: HttpContext) {
    try {
      const { userId } = params

      if (!userId) {
        return response.badRequest({ success: false, message: 'ID utilisateur requis' })
      }

      const user = await User.findBy('id', userId)

      if (!user) {
        return response.notFound({ success: false, message: 'Utilisateur non trouvé' })
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

      const user = await User.findBy('id', userId)

      if (!user || (user.role !== 'marchant' && user.role !== 'merchant')) {
        return response.forbidden({ success: false, message: 'Non autorisé' })
      }

      const slugToUse = slug || name.toLowerCase().replace(/\s+/g, '-')

      const category = await Category.create({
        name,
        slug: slugToUse,
        user_id: user.id,
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

      const user = await User.findBy('id', userId)

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

      const user = await User.findBy('id', userId)

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

  async getCoupons({ params, response }: HttpContext) {
    try {
      const { userId } = params
      const user = await User.findBy('id', userId)

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

      const user = await User.findBy('id', userId)

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
        userIds: [user.id], // <-- fixed,
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

      const user = await User.findBy('id', userId)

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

      const user = await User.findBy('id', userId)

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

  async getStats({ params, response }: HttpContext) {
    try {
      const { userId } = params
      const user = await User.findBy('id', userId)

      if (!user) {
        return response.notFound({ success: false, message: 'Utilisateur non trouvé' })
      }

      const totalProducts = await Product.query()
        .where('user_id', user.id)
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
      const user = await User.findBy('id', userId)

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
