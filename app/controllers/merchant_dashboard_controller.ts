// app/controllers/merchant_dashboard_controller.ts
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
import Withdrawal from '#models/Withdrawal'
import WithdrawalHistory from '#models/WithdrawalHistory'

export default class MerchantDashboardController {

  // ============= WALLET =============

  // Ajoutez cette fonction dans votre MerchantDashboardController

/**
 * Récupère tous les produits archivés d'un marchand
 * GET /api/merchant/:userId/archived-products
 */
async getArchivedProducts({ params, request, response }: HttpContext) {
  try {
    const { userId } = params

    if (!userId) {
      return response.badRequest({ 
        success: false, 
        message: "ID utilisateur manquant" 
      })
    }

    const user = await User.findBy('id', userId)

    if (!user) {
      return response.notFound({ 
        success: false, 
        message: 'Utilisateur non trouvé' 
      })
    }

    if (user.role !== 'marchant' && user.role !== 'merchant') {
      return response.forbidden({ 
        success: false, 
        message: 'Seuls les marchands peuvent accéder à cette ressource' 
      })
    }

    // Pagination
    const page = request.input('page', 1)
    const limit = request.input('limit', 20)
    const search = request.input('search', '')

    // Requête de base pour les produits archivés
    let query = Product.query()
      .where('user_id', user.id)
      .where('isArchived', true)  // ✅ Uniquement les produits archivés
      .preload('categoryRelation')
      .orderBy('updatedAt', 'desc')  // Trier par date d'archivage (dernière modification)

    // Ajouter la recherche si présente
    if (search) {
      query = query.where((builder) => {
        builder
          .where('name', 'ILIKE', `%${search}%`)
          .orWhere('description', 'ILIKE', `%${search}%`)
      })
    }

    const products = await query.paginate(page, limit)

    // Transformer les produits pour le frontend
    const transformedProducts = products.all().map((product: any) => {
      let categoryName = 'Sans catégorie'

      if (product.categoryRelation) {
        categoryName = product.categoryRelation.name
      } else if (product.category) {
        categoryName = product.category
      }

      // Calculer le nombre de jours depuis l'archivage
      const archivedDate = DateTime.fromJSDate(product.updatedAt.toJSDate())
      const daysSinceArchived = Math.floor(DateTime.now().diff(archivedDate, 'days').days)

      return {
        id: product.id,
        name: product.name,
        description: product.description,
        price: product.price,
        old_price: product.old_price,
        stock: product.stock,
        image_url: product.image_url,
        category: categoryName,
        category_id: product.category_id,
        origin: product.origin,
        weight: product.weight,
        packaging: product.packaging,
        conservation: product.conservation,
        is_new: product.isNew,
        is_on_sale: product.isOnSale,
        rating: product.rating,
        sales: product.sales || 0,
        status: product.status || 'archived',
        created_at: product.createdAt,
        updated_at: product.updatedAt,
        archived_at: product.updatedAt,  // Date d'archivage
        days_since_archived: daysSinceArchived,
        // Informations supplémentaires
        can_be_restored: true,  // Toujours true car le produit existe toujours
        is_permanently_deleted: false  // Archivage ≠ suppression définitive
      }
    })

    // Calculer des statistiques sur les produits archivés
    const totalArchivedProducts = await Product.query()
      .where('user_id', user.id)
      .where('isArchived', true)
      .count('* as total')

    const stats = {
      total_archived: parseInt(totalArchivedProducts[0].$extras.total) || 0,
      archived_this_month: await Product.query()
        .where('user_id', user.id)
        .where('isArchived', true)
        .where('updatedAt', '>=', DateTime.now().startOf('month').toSQL())
        .count('* as total')
        .then(result => parseInt(result[0].$extras.total) || 0),
      oldest_archived: products.all().length > 0 
        ? products.all().reduce((oldest, p) => 
            p.updatedAt < oldest.updatedAt ? p : oldest
          ).updatedAt
        : null
    }

    return response.ok({
      success: true,
      data: transformedProducts,
      meta: {
        total: products.total,
        per_page: products.perPage,
        current_page: products.currentPage,
        last_page: products.lastPage,
        first_page: 1,
        first_page_url: `/api/merchant/${userId}/archived-products?page=1`,
        last_page_url: `/api/merchant/${userId}/archived-products?page=${products.lastPage}`,
        next_page_url: products.currentPage < products.lastPage 
          ? `/api/merchant/${userId}/archived-products?page=${products.currentPage + 1}` 
          : null,
        previous_page_url: products.currentPage > 1 
          ? `/api/merchant/${userId}/archived-products?page=${products.currentPage - 1}` 
          : null
      },
      stats: stats,
      count: transformedProducts.length,
      message: `${stats.total_archived} produit(s) archivé(s) trouvé(s)`
    })

  } catch (error: any) {
    console.error('Erreur dans getArchivedProducts:', error)
    return response.internalServerError({
      success: false,
      message: 'Erreur lors de la récupération des produits archivés',
      error: error.message
    })
  }
}

/**
 * Restaure un produit archivé (le remet en actif)
 * POST /api/merchant/:userId/archived-products/:productId/restore
 */
async restoreArchivedProduct({ params, response }: HttpContext) {
  try {
    const { userId, productId } = params

    if (!userId || !productId) {
      return response.badRequest({ 
        success: false, 
        message: "Paramètres manquants" 
      })
    }

    const user = await User.findBy('id', userId)

    if (!user) {
      return response.notFound({ 
        success: false, 
        message: 'Utilisateur non trouvé' 
      })
    }

    if (user.role !== 'marchant' && user.role !== 'merchant') {
      return response.forbidden({ 
        success: false, 
        message: 'Non autorisé' 
      })
    }

    const product = await Product.query()
      .where('id', productId)
      .where('user_id', user.id)
      .first()

    if (!product) {
      return response.notFound({ 
        success: false, 
        message: 'Produit non trouvé' 
      })
    }

    // Vérifier si le produit est bien archivé
    if (!product.isArchived) {
      return response.badRequest({
        success: false,
        message: 'Ce produit n\'est pas archivé'
      })
    }

    // Restaurer le produit
    product.isArchived = false
    product.isNew = false  // Un produit restauré n'est plus considéré comme "nouveau"
    await product.save()

    // Recharger avec la catégorie
    await product.load('categoryRelation')

    let categoryName = 'Sans catégorie'
    if (product.categoryRelation) {
      categoryName = product.categoryRelation.name
    }

    return response.ok({
      success: true,
      message: 'Produit restauré avec succès',
      data: {
        id: product.id,
        name: product.name,
        price: product.price,
        stock: product.stock,
        category: categoryName,
        is_archived: product.isArchived,
        restored_at: DateTime.now().toISO()
      }
    })

  } catch (error: any) {
    console.error('Erreur dans restoreArchivedProduct:', error)
    return response.internalServerError({
      success: false,
      message: 'Erreur lors de la restauration du produit',
      error: error.message
    })
  }
}

/**
 * Supprime définitivement un produit archivé
 * DELETE /api/merchant/:userId/archived-products/:productId/permanent
 */
async permanentlyDeleteProduct({ params, response }: HttpContext) {
  try {
    const { userId, productId } = params

    if (!userId || !productId) {
      return response.badRequest({ 
        success: false, 
        message: "Paramètres manquants" 
      })
    }

    const user = await User.findBy('id', userId)

    if (!user) {
      return response.notFound({ 
        success: false, 
        message: 'Utilisateur non trouvé' 
      })
    }

    if (user.role !== 'marchant' && user.role !== 'merchant') {
      return response.forbidden({ 
        success: false, 
        message: 'Non autorisé' 
      })
    }

    const product = await Product.query()
      .where('id', productId)
      .where('user_id', user.id)
      .first()

    if (!product) {
      return response.notFound({ 
        success: false, 
        message: 'Produit non trouvé' 
      })
    }

    // Vérifier si le produit est archivé (sécurité supplémentaire)
    if (!product.isArchived) {
      return response.badRequest({
        success: false,
        message: 'Seuls les produits archivés peuvent être supprimés définitivement. Archivez d\'abord le produit.'
      })
    }

    const productName = product.name
    const productId_deleted = product.id

    // Supprimer définitivement
    await product.delete()

    return response.ok({
      success: true,
      message: `Le produit "${productName}" a été supprimé définitivement`,
      data: {
        id: productId_deleted,
        name: productName,
        deleted_at: DateTime.now().toISO()
      }
    })

  } catch (error: any) {
    console.error('Erreur dans permanentlyDeleteProduct:', error)
    return response.internalServerError({
      success: false,
      message: 'Erreur lors de la suppression définitive du produit',
      error: error.message
    })
  }
}

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

    // ✅ Lire depuis la table merchant_withdrawals (où sont vos retraits)
    let withdrawals: any[] = []
    
    try {
      withdrawals = await Database
        .from('merchant_withdrawals')
        .where('user_id', user.id)
        .orderBy('created_at', 'desc')
    } catch (error) {
      console.log('Table merchant_withdrawals non trouvée, tentative avec withdrawals...')
      
      // Fallback sur la nouvelle table withdrawals
      try {
        withdrawals = await Database
          .from('withdrawals')
          .where('user_id', user.id)
          .orderBy('created_at', 'desc')
      } catch (e) {
        console.error('Aucune table de retraits trouvée')
      }
    }

    // Transformer les données pour le frontend
    const formattedWithdrawals = withdrawals.map(w => ({
      id: w.id,
      amount: Number(w.amount),
      status: w.status,
      payment_method: w.payment_method || 'mobile_money',
      account_number: w.account_number,
      account_name: w.account_name,
      operator: w.operator,
      reference: w.reference,
      created_at: w.created_at
    }))

    // Calculer les statistiques
    const completed = formattedWithdrawals.filter(w => w.status === 'completed')
    const pending = formattedWithdrawals.filter(w => w.status === 'pending' || w.status === 'processing')
    const failed = formattedWithdrawals.filter(w => w.status === 'failed' || w.status === 'cancelled')
    
    const totalWithdrawn = completed.reduce((sum, w) => sum + w.amount, 0)

    // Récupérer le solde actuel
    const wallet = await Wallet.query().where('user_id', user.id).first()
    const currentBalance = wallet ? wallet.balance : 0

    return response.ok({
      success: true,
      data: formattedWithdrawals,
      stats: {
        total_withdrawn: totalWithdrawn,
        total_withdrawals: withdrawals.length,
        completed_count: completed.length,
        pending_count: pending.length,
        failed_count: failed.length
      },
      count: withdrawals.length,
      current_balance: currentBalance
    })

  } catch (error: any) {
    console.error('Erreur dans getWithdrawalHistory:', error)
    return response.internalServerError({
      success: false,
      message: error.message
    })
  }
}
  /**
   * Récupère les statistiques détaillées des retraits pour un marchand
   * GET /api/merchant/give-change/stats?userId={userId}
   */
  async getWithdrawalStats({ request, response }: HttpContext) {
    try {
      const userId = request.qs().userId || request.input('userId')

      if (!userId) {
        return response.badRequest({ 
          success: false, 
          message: "Paramètre userId manquant" 
        })
      }

      const user = await User.findBy('id', userId)

      if (!user) {
        return response.notFound({ 
          success: false, 
          message: 'Utilisateur non trouvé' 
        })
      }

      if (user.role !== 'marchant' && user.role !== 'merchant') {
        return response.forbidden({ 
          success: false, 
          message: 'Accès réservé aux marchands' 
        })
      }

      // Récupérer le wallet
      const wallet = await Wallet.query()
        .where('user_id', user.id)
        .first()

      const currentBalance = wallet ? wallet.balance : 0

      // Vérifier si la table merchant_withdrawals existe
      const hasWithdrawalsTable = await Database.rawQuery(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_name = 'merchant_withdrawals'
        )
      `)

      let withdrawals: any[] = []

      if (hasWithdrawalsTable.rows[0].exists) {
        withdrawals = await Database
          .from('merchant_withdrawals')
          .where('user_id', user.id)
          .orderBy('created_at', 'desc')
      }

      // Statistiques globales
      const completed = withdrawals.filter(w => w.status === 'completed')
      const pending = withdrawals.filter(w => w.status === 'pending')
      const failed = withdrawals.filter(w => w.status === 'failed')

      const totalWithdrawn = completed.reduce((sum, w) => sum + Number(w.amount), 0)
      const averageWithdrawal = completed.length > 0 ? totalWithdrawn / completed.length : 0

      // Dernier retrait
      const lastWithdrawal = withdrawals.length > 0 ? {
        id: withdrawals[0].id,
        amount: Number(withdrawals[0].amount),
        status: withdrawals[0].status,
        payment_method: withdrawals[0].payment_method,
        account_number: withdrawals[0].account_number,
        account_name: withdrawals[0].account_name,
        operator: withdrawals[0].operator,
        reference: withdrawals[0].reference,
        created_at: withdrawals[0].created_at
      } : null

      // Statistiques par mois (24 derniers mois)
      const monthlyStats: { month: string; amount: number; count: number }[] = []
      const now = DateTime.now()
      const twoYearsAgo = now.minus({ years: 2 })

      for (let i = 0; i <= 24; i++) {
        const monthDate = now.minus({ months: i })
        if (monthDate < twoYearsAgo) continue

        const monthStr = monthDate.toFormat('yyyy-MM')
        const monthName = monthDate.toFormat('MMM yyyy')

        const monthWithdrawals = completed.filter(w => {
          const wDate = DateTime.fromSQL(w.created_at)
          return wDate.toFormat('yyyy-MM') === monthStr
        })

        monthlyStats.unshift({
          month: monthName,
          amount: monthWithdrawals.reduce((sum, w) => sum + Number(w.amount), 0),
          count: monthWithdrawals.length
        })
      }

      // Statistiques par opérateur
      const operatorStats: { operator: string; amount: number; count: number }[] = []
      const operatorMap = new Map<string, { amount: number; count: number }>()

      for (const w of completed) {
        const operator = w.operator || w.payment_method || 'Autre'
        const existing = operatorMap.get(operator) || { amount: 0, count: 0 }
        operatorMap.set(operator, {
          amount: existing.amount + Number(w.amount),
          count: existing.count + 1
        })
      }

      for (const [operator, data] of operatorMap) {
        operatorStats.push({
          operator,
          amount: data.amount,
          count: data.count
        })
      }

      operatorStats.sort((a, b) => b.amount - a.amount)

      // Résumé
      const summary = {
        totalWithdrawn,
        totalWithdrawals: withdrawals.length,
        completedWithdrawals: completed.length,
        pendingWithdrawals: pending.length,
        failedWithdrawals: failed.length,
        averageWithdrawal,
        currentBalance
      }

      return response.ok({
        success: true,
        data: {
          summary,
          monthly: monthlyStats,
          by_operator: operatorStats,
          last_withdrawal: lastWithdrawal,
          current_balance: currentBalance
        }
      })

    } catch (error: any) {
      console.error('Erreur dans getWithdrawalStats:', error)
      return response.internalServerError({
        success: false,
        message: error.message || 'Erreur lors de la récupération des statistiques'
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

      // ✅ Récupérer TOUS les produits du marchand
      const merchantProducts = await Product.query()
        .where('user_id', user.id)
        .where('isArchived', false)  // ✅ Exclure les produits archivés
        .select('id', 'name', 'price', 'image_url')

      const productIds = merchantProducts.map(p => p.id)

      console.log(`📦 Produits du marchand: ${productIds.length} IDs`)

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

      // ✅ Récupérer les OrderItem qui contiennent les produits du marchand
      const orderItems = await OrderItem.query()
        .whereIn('product_id', productIds)
        .preload('order', (orderQuery) => {
          orderQuery
            .preload('user', (userQuery) => {
              userQuery.select('id', 'full_name', 'email')
            })
            .orderBy('created_at', 'desc')
        })
        .preload('product')

      console.log(`🛒 OrderItems trouvés: ${orderItems.length}`)

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
        if (!order) continue

        // Si la commande n'est pas encore dans la map, on l'initialise
        if (!ordersMap.has(order.id)) {
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

        // Ajouter l'item à la commande (seulement les items qui appartiennent au marchand)
        const orderData = ordersMap.get(order.id)

        // ✅ Vérifier que le produit appartient bien au marchand
        const productBelongsToMerchant = merchantProducts.some(p => p.id === item.product_id)

        if (productBelongsToMerchant) {
          orderData.items.push({
            id: item.id,
            product_id: item.product_id,
            product_name: item.product_name || item.product?.name || 'Produit',
            product_description: item.product_description || item.product?.description || null,
            price: item.price,
            quantity: item.quantity,
            subtotal: item.subtotal || (item.price * item.quantity),
            category: item.category,
            image: item.image || item.product?.image_url || null
          })
        }
      }

      // Convertir la map en tableau
      const orders = Array.from(ordersMap.values())

      // Filtrer les commandes qui ont au moins un item du marchand
      const ordersWithMerchantItems = orders.filter(order => order.items.length > 0)

      // Trier par date de création (plus récent d'abord)
      ordersWithMerchantItems.sort((a, b) => {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      })

      // Calculer les statistiques
      const stats = {
        totalOrders: ordersWithMerchantItems.length,
        totalRevenue: ordersWithMerchantItems.reduce((sum, order) => {
          const merchantRevenue = order.items.reduce((itemSum: number, item: any) => itemSum + item.subtotal, 0)
          return sum + merchantRevenue
        }, 0),
        pendingOrders: ordersWithMerchantItems.filter(o => o.status === 'pending').length,
        processingOrders: ordersWithMerchantItems.filter(o => o.status === 'processing').length,
        shippedOrders: ordersWithMerchantItems.filter(o => o.status === 'shipped').length,
        deliveredOrders: ordersWithMerchantItems.filter(o => o.status === 'delivered').length,
        cancelledOrders: ordersWithMerchantItems.filter(o => o.status === 'cancelled').length,
        totalItems: ordersWithMerchantItems.reduce((sum, order) => sum + order.items.length, 0),
        averageOrderValue: ordersWithMerchantItems.length > 0
          ? ordersWithMerchantItems.reduce((sum, order) => {
            const merchantRevenue = order.items.reduce((itemSum: number, item: any) => itemSum + item.subtotal, 0)
            return sum + merchantRevenue
          }, 0) / ordersWithMerchantItems.length
          : 0
      }

      console.log(`✅ Commandes trouvées: ${ordersWithMerchantItems.length}`)

      return response.ok({
        success: true,
        data: ordersWithMerchantItems,
        stats: stats,
        count: ordersWithMerchantItems.length
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

      // ✅ Récupérer les produits du marchand
      const merchantProducts = await Product.query()
        .where('user_id', user.id)
        .where('isArchived', false)
        .select('id')

      const productIds = merchantProducts.map(p => p.id)

      if (productIds.length === 0) {
        return response.ok({
          success: true,
          data: [],
          count: 0
        })
      }

      // ✅ Récupérer les OrderItem pour les commandes en attente
      const orderItems = await OrderItem.query()
        .whereIn('product_id', productIds)
        .preload('order', (orderQuery) => {
          orderQuery
            .where('status', 'pending')
            .preload('user', (userQuery) => {
              userQuery.select('id', 'full_name', 'email')
            })
        })
        .preload('product')

      const ordersMap = new Map()

      for (const item of orderItems) {
        const order = item.order
        if (!order || order.status !== 'pending') continue

        // ✅ Vérifier que le produit appartient au marchand
        const productBelongsToMerchant = merchantProducts.some(p => p.id === item.product_id)
        if (!productBelongsToMerchant) continue

        if (!ordersMap.has(order.id)) {
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

        const orderData = ordersMap.get(order.id)
        orderData.items_count++
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
        .where('isArchived', false)
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

    // ✅ Charger les produits avec leur catégorie
    const products = await Product.query()
      .where('user_id', user.id)
      .where('isArchived', false)  // 🔴 AJOUTER CE FILTRE
      .preload('categoryRelation')
      .orderBy('createdAt', 'desc')  // ✅ Correction: createdAt au lieu de created_at

    // Récupérer les catégories du marchand
    const categories = await Category.query()
      .where('user_id', user.id)
      .orderBy('name', 'asc')

    // Récupérer les coupons du marchand
    const coupons = await Coupon.query()
      .where('user_id', user.id)
      .orderBy('created_at', 'desc')

    // Récupérer le wallet
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

    // Transformer les produits
    const transformedProducts = products.map(p => {
      let categoryName = 'Sans catégorie'
      if (p.categoryRelation) {
        categoryName = p.categoryRelation.name
      } else if (p.category) {
        categoryName = p.category
      }

      return {
        id: p.id,
        name: p.name,
        description: p.description,
        price: p.price,
        stock: p.stock,
        image_url: p.image_url,
        category: categoryName,
        likes: 0,
        sales: p.sales || 0,
        status: p.status || 'active',
        createdAt: p.createdAt  // ✅ Correction: createdAt au lieu de created_at
      }
    })

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
        products: transformedProducts,
        categories: categories.map(c => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          image_url: c.image_url || null,
          productCount: c.product_count || 0
        })),
        coupons: coupons,
        salesChart: [],
        pendingOrders: [],
        popularProducts: [],
        merchant: {
          id: user.id,
          uuid: user.id,
          full_name: user.full_name,
          email: user.email,
          avatar: user.avatar || null,
          availableBalance: wallet.balance
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

      // ✅ CHARGER LA RELATION categoryRelation
      const products = await Product.query()
        .where('user_id', user.id)
        .where('isArchived', false) // ✅ Filtre ajouté
        .preload('categoryRelation')
        .orderBy('createdAt', 'desc')  // ✅ Correction: createdAt
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

      const transformedProducts = productArray.map((product: any) => {
        let categoryName = 'Sans catégorie'

        if (product.categoryRelation) {
          categoryName = product.categoryRelation.name
        } else if (product.category) {
          categoryName = product.category
        }

        return {
          id: product.id,
          name: product.name,
          description: product.description,
          price: product.price,
          stock: product.stock,
          image_url: product.image_url,
          category: categoryName,
          category_id: product.category_id,
          likes: favoritesCountMap[product.id] || 0,
          sales: product.sales || 0,
          status: product.status || 'active',
          created_at: product.createdAt  // ✅ Correction: utiliser createdAt du modèle
        }
      })

      return response.ok({
        success: true,
        data: {
          meta: products.getMeta(),
          data: transformedProducts
        }
      })

    } catch (error: any) {
      console.error('Erreur getProducts:', error)
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

      let categoryId: string | null = null

      // Gérer la catégorie
      if (category_name && category_name.trim() !== '') {
        const catName = category_name.trim()

        let category = await Category.query()
          .where('name', catName)
          .where('user_id', user.id)
          .first()

        if (!category) {
          category = await Category.create({
            name: catName,
            slug: catName.toLowerCase().replace(/\s+/g, '-'),
            user_id: user.id,
            is_active: true,
            product_ids: [],
            product_count: 0,
          })
        }

        categoryId = category.id
      }

      // Créer le produit
      const product = await Product.create({
        name,
        description: description || null,
        price: parseFloat(price),
        stock: parseInt(stock),
        image_url: image_url || null,
        user_id: user.id,
        category_id: categoryId,
        isNew: true,
        isOnSale: false,
        rating: 0,
      })

      // ✅ Ajouter le produit à la catégorie SANS écraser les anciens
      if (categoryId) {
        const category = await Category.find(categoryId)
        if (category) {
          let existingProductIds = category.product_ids || []

          if (!Array.isArray(existingProductIds)) {
            existingProductIds = []
          }

          console.log('📦 IDs existants avant ajout:', existingProductIds)

          if (!existingProductIds.includes(product.id)) {
            existingProductIds.push(product.id)

            category.product_ids = existingProductIds
            category.product_count = existingProductIds.length

            await category.save()

            console.log(`✅ Produit ${product.id} ajouté à la catégorie ${category.name}`)
            console.log(`📦 IDs après ajout: ${category.product_ids.join(', ')}`)
            console.log(`📊 Nombre total de produits: ${category.product_count}`)
          } else {
            console.log(`⚠️ Le produit ${product.id} existe déjà dans la catégorie`)
          }
        }
      }

      return response.created({
        success: true,
        data: {
          id: product.id,
          name: product.name,
          price: product.price,
          stock: product.stock,
          category_id: product.category_id,
          category_name: category_name,
        },
        message: `Produit "${name}" créé et ajouté à la catégorie "${category_name}"`,
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

      let categoryId: string | null = null

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

    // Vérifier si le produit est déjà archivé
    if (product.isArchived) {
      return response.badRequest({
        success: false,
        message: 'Ce produit est déjà archivé'
      })
    }

    // ✅ CORRECTION : Mettre à jour directement le champ isArchived
    product.isArchived = true
    await product.save()

    return response.ok({
      success: true,
      message: 'Produit archivé avec succès',
      data: {
        id: product.id,
        is_archived: product.isArchived,
        archived_at: product.updatedAt
      }
    })
  } catch (error: any) {
    console.error('Erreur deleteProduct (archive):', error)
    return response.internalServerError({
      success: false,
      message: error.message || 'Erreur lors de l\'archivage du produit'
    })
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

      const coupon = await Coupon.create({
        code: code.toUpperCase(),
        discount: parseFloat(discount),
        type: type,
        valid_until: validUntil ? DateTime.fromJSDate(new Date(validUntil)) : null,
        usage_limit: usageLimit ? parseInt(usageLimit) : undefined,
        used_count: 0,
        user_id: user.id,
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
        .where('isArchived', false)  // ✅ Correction: isArchived
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
