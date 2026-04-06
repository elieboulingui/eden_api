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
import crypto from 'node:crypto'
import axios from 'axios'

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

    } catch (error: any) {
      console.error('Erreur dans getWallet:', error)
      return response.internalServerError({
        success: false,
        message: error.message
      })
    }
  }

  // ============= GIVE CHANGE (RETRAIT MARCHAND) =============

  async giveChange({ request, response }: HttpContext) {
    try {
      const {
        userId,
        amount,
        customer_account_number,
        operator_code,
        payment_api_key_public,
        payment_api_key_secret,
        notes
      } = request.only([
        'userId',
        'amount',
        'customer_account_number',
        'operator_code',
        'payment_api_key_public',
        'payment_api_key_secret',
        'notes'
      ])

      console.log('=== GIVE_CHANGE PAR MARCHAND ===')
      console.log('userId:', userId)
      console.log('amount:', amount)
      console.log('customer_account_number:', customer_account_number)
      console.log('operator_code:', operator_code)

      // Validation des paramètres
      if (!userId) {
        return response.badRequest({ success: false, message: "ID utilisateur manquant" })
      }

      if (!amount || amount <= 0) {
        return response.badRequest({ success: false, message: "Montant invalide" })
      }

      if (amount < 150) {
        return response.badRequest({ success: false, message: "Le montant minimum est de 150 FCFA" })
      }

      if (!customer_account_number) {
        return response.badRequest({ success: false, message: "Numéro de compte client requis" })
      }

      if (!payment_api_key_public || !payment_api_key_secret) {
        return response.badRequest({ success: false, message: "Clés API requises" })
      }

      // Vérifier l'utilisateur
      const user = await User.findBy('id', userId)

      if (!user) {
        return response.notFound({ success: false, message: 'Utilisateur non trouvé' })
      }

      if (user.role !== 'marchant' && user.role !== 'merchant') {
        return response.forbidden({ success: false, message: 'Seuls les marchands peuvent faire des retraits' })
      }

      // Récupérer le wallet du marchand
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

      // ✅ VÉRIFICATION DU SOLDE
      if (wallet.balance < amount) {
        return response.badRequest({
          success: false,
          message: `Solde insuffisant. Votre solde actuel est de ${wallet.balance.toLocaleString()} FCFA. Montant demandé: ${amount.toLocaleString()} FCFA.`,
          data: {
            current_balance: wallet.balance,
            requested_amount: amount,
            deficit: amount - wallet.balance,
            needed: amount - wallet.balance
          }
        })
      }

      // Appel à l'API GIVE_CHANGE externe
      console.log('🔵 Appel API GIVE_CHANGE externe...')

      const giveChangeResponse = await axios.post(
        'https://api-akiba-1.onrender.com/api/give-change',
        {
          amount: amount,
          customer_account_number: customer_account_number,
          payment_api_key_public: "pk_1773325888803_dt8diavuh3h",
          payment_api_key_secret: "sk_1773325888803_qt015a3cr5",
          free_info: notes || `Retrait marchand ${user.full_name}`
        },
        {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      )

      const giveChangeResult = giveChangeResponse.data
      console.log('✅ Réponse GIVE_CHANGE:', JSON.stringify(giveChangeResult, null, 2))

      if (!giveChangeResult.success) {
        return response.status(500).json({
          success: false,
          message: giveChangeResult.message || "Erreur lors du traitement du retrait",
          error: giveChangeResult.error
        })
      }

      // ✅ DÉBITER LE WALLET (seulement si l'API a répondu avec succès)
      const subtracted = await wallet.subtractBalance(amount)

      if (!subtracted) {
        return response.status(500).json({
          success: false,
          message: "Erreur lors du débit du wallet. Veuillez contacter le support.",
          data: {
            give_change_success: true,
            wallet_update_failed: true,
            amount: amount
          }
        })
      }

      // Enregistrer la transaction de retrait dans la base
      const withdrawalReference = `WDL-${Date.now()}-${Math.floor(Math.random() * 10000)}`

      // Vérifier si la table merchant_withdrawals existe
      const hasWithdrawalsTable = await Database.rawQuery(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_name = 'merchant_withdrawals'
        )
      `)

      if (hasWithdrawalsTable.rows[0].exists) {
        await Database.table('merchant_withdrawals').insert({
          id: crypto.randomUUID(),
          user_id: user.id,
          amount: amount,
          status: 'completed',
          payment_method: operator_code || 'mobile_money',
          account_number: customer_account_number,
          account_name: user.full_name,
          operator: operator_code,
          reference: withdrawalReference,
          transaction_id: giveChangeResult.data?.reference_id || null,
          notes: notes || null,
          processed_by: user.id,
          processed_at: DateTime.now().toSQL(),
          created_at: DateTime.now().toSQL(),
          updated_at: DateTime.now().toSQL()
        })
      }

      // Enregistrer dans la table transactions
      await Database.table('transactions').insert({
        id: crypto.randomUUID(),
        user_id: user.id,
        amount: amount,
        type: 'withdrawal',
        status: 'completed',
        reference: withdrawalReference,
        description: `Retrait via ${operator_code || 'mobile_money'} vers ${customer_account_number}`,
        created_at: DateTime.now().toSQL(),
        updated_at: DateTime.now().toSQL()
      })

      return response.ok({
        success: true,
        message: "Retrait effectué avec succès",
        data: {
          withdrawal_reference: withdrawalReference,
          amount: amount,
          new_balance: wallet.balance,
          old_balance: wallet.balance + amount,
          transaction: giveChangeResult.data,
          customer_account: customer_account_number,
          operator: operator_code,
          date: DateTime.now().toISO()
        }
      })

    } catch (error: any) {
      console.error('❌ Erreur dans giveChange:', error)

      // Gestion spécifique des erreurs
      if (error.code === 'ECONNREFUSED') {
        return response.status(503).json({
          success: false,
          message: "Service de paiement indisponible. Veuillez réessayer plus tard.",
          error: error.message
        })
      }

      if (error.response?.status === 401) {
        return response.status(401).json({
          success: false,
          message: "Erreur d'authentification avec le service de paiement. Clés API invalides.",
          error: error.message
        })
      }

      if (error.response?.status === 403) {
        return response.status(403).json({
          success: false,
          message: "Solde marchand insuffisant sur le service de paiement.",
          error: error.message,
          details: error.response?.data
        })
      }

      return response.status(500).json({
        success: false,
        message: error.message || "Erreur lors du retrait",
        error: error.message
      })
    }
  }

  async getWithdrawalHistory({ params, response }: HttpContext) {
    try {
      const { userId } = params

      if (!userId) {
        return response.badRequest({ success: false, message: "ID utilisateur manquant" })
      }

      const user = await User.findBy('id', userId)

      if (!user) {
        return response.notFound({ success: false, message: 'Utilisateur non trouvé' })
      }

      // Vérifier si la table merchant_withdrawals existe
      const hasWithdrawalsTable = await Database.rawQuery(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_name = 'merchant_withdrawals'
        )
      `)

      let withdrawals = []

      if (hasWithdrawalsTable.rows[0].exists) {
        withdrawals = await Database
          .from('merchant_withdrawals')
          .where('user_id', user.id)
          .orderBy('created_at', 'desc')
      }

      // Calculer les statistiques
      const stats = {
        total_withdrawn: withdrawals
          .filter(w => w.status === 'completed')
          .reduce((sum, w) => sum + Number(w.amount), 0),
        total_withdrawals: withdrawals.length,
        completed_count: withdrawals.filter(w => w.status === 'completed').length,
        pending_count: withdrawals.filter(w => w.status === 'pending').length,
        failed_count: withdrawals.filter(w => w.status === 'failed').length
      }

      return response.ok({
        success: true,
        data: withdrawals,
        stats: stats,
        count: withdrawals.length
      })

    } catch (error: any) {
      console.error('Erreur dans getWithdrawalHistory:', error)
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

    } catch (error: any) {
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

    } catch (error: any) {
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

    } catch (error: any) {
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
    } catch (error: any) {
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
        return response.ok({
          success: true,
          data: { data: [], meta: { total: 0 } }
        })
      }

      const page = request.input('page', 1)
      const limit = request.input('limit', 10)

      // ❌ SUPPRIMÉ preload (pas de relation)
      const products = await Product.query()
        .where('user_id', user.id)
        .orderBy('created_at', 'desc')
        .paginate(page, limit)

      const productArray = products.all()

      const productIds = productArray.map(p => p.id)

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

      const transformedProducts = productArray.map((product: any) => ({
        id: product.id,
        name: product.name,
        description: product.description,
        price: product.price,
        stock: product.stock,

        // ✅ OK car ton modèle est en snake_case
        image_url: product.image_url,

        // ⚠️ ici c’est une colonne simple, pas une relation
        category: product.category || 'Sans catégorie',

        likes: favoritesCountMap[product.id] || 0,
        sales: product.sales || 0,
        status: product.status || 'active'
      }))

      return response.ok({
        success: true,
        data: {
          meta: products.getMeta(),
          data: transformedProducts
        }
      })

    } catch (error: any) {
      return response.internalServerError({
        success: false,
        message: error.message
      })
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

      // Séparer les noms de catégories
      const categoryNames = category_name ? category_name.split(',').map((c: string) => c.trim()) : []
      const categoryIds: string[] = []

      for (const catName of categoryNames) {
        if (!catName) continue

        // Chercher la catégorie existante
        let category = await Category.query().where('name', catName).where('user_id', user.id).first()

        // Créer la catégorie si elle n'existe pas
        if (!category) {
          category = await Category.create({
            name: catName,
            image_url: image_url || null,
            slug: catName.toLowerCase().replace(/\s+/g, '-'),
            user_id: user.id,
            is_active: true,
            product_ids: [],
          })
        }

        categoryIds.push(category.id)
      }

      // Créer le produit
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
      })

      // Ajouter le produit à toutes les catégories correspondantes
      for (const categoryId of categoryIds) {
        const category = await Category.find(categoryId)
        if (!category) continue

        await category.addProduct(product.id) // utilise la méthode du modèle Category
      }

      return response.created({
        success: true,
        data: product,
        message: 'Produit créé et ajouté aux catégories',
      })
    } catch (error: any) {
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
    } catch (error: any) {
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
    } catch (error: any) {
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
    } catch (error: any) {
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
    } catch (error: any) {
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
    } catch (error: any) {
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
    } catch (error: any) {
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
    } catch (error: any) {
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

    // ✅ CORRECTION : Utiliser user_id au lieu de userIds
    const coupon = await Coupon.create({
      code: code.toUpperCase(),
      discount: parseFloat(discount),
      type: type,
      valid_until: validUntil ? DateTime.fromJSDate(new Date(validUntil)) : null,
      usage_limit: usageLimit ? parseInt(usageLimit) : undefined,
      used_count: 0,
      user_id: user.id,  // ✅ CHANGÉ: userIds → user_id
      // userIds: [user.id],  // ❌ À SUPPRIMER ou garder si la colonne existe
      product_id: productId || null,
      status: 'active'
    })

    return response.created({
      success: true,
      data: coupon,
      message: 'Code promo créé'
    })
  } catch (error: any) {
    console.error('Erreur createCoupon:', error)
    return response.internalServerError({
      success: false,
      message: error.message
    })
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
    } catch (error: any) {
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
    } catch (error: any) {
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
    } catch (error: any) {
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
    } catch (error: any) {
      return response.internalServerError({ success: false, message: error.message })
    }
  }
}
