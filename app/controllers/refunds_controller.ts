// app/controllers/refunds_controller.ts
import type { HttpContext } from '@adonisjs/core/http'
import Refund from '#models/Refund'
import Order from '#models/Order'
import User from '#models/user'
import Wallet from '#models/wallet'
import { DateTime } from 'luxon'

export default class RefundsController {
  // ========== CRUD PRINCIPAL ==========

  /**
   * Liste tous les remboursements (admin)
   * GET /api/refunds
   */
  async index({ request, response }: HttpContext) {
    try {
      const page = request.input('page', 1)
      const limit = request.input('limit', 20)
      const status = request.input('status')
      const orderId = request.input('order_id')

      let query = Refund.query()
        .preload('order')
        .preload('user')
        .preload('admin')
        .orderBy('created_at', 'desc')

      if (status) {
        query = query.where('status', status)
      }

      if (orderId) {
        query = query.where('order_id', orderId)
      }

      const refunds = await query.paginate(page, limit)

      return response.ok({
        success: true,
        data: refunds,
        meta: {
          total: refunds.total,
          per_page: refunds.perPage,
          current_page: refunds.currentPage,
          last_page: refunds.lastPage
        }
      })
    } catch (error) {
      console.error('Erreur index refunds:', error)
      return response.internalServerError({
        success: false,
        message: error.message
      })
    }
  }

  /**
   * Récupère un remboursement spécifique
   * GET /api/refunds/:id
   */
  async show({ params, response }: HttpContext) {
    try {
      const refund = await Refund.query()
        .where('id', params.id)
        .preload('order')
        .preload('user')
        .preload('admin')
        .first()

      if (!refund) {
        return response.notFound({
          success: false,
          message: 'Remboursement non trouvé'
        })
      }

      return response.ok({
        success: true,
        data: refund
      })
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: error.message
      })
    }
  }

  /**
   * Crée une demande de remboursement (client)
   * POST /api/refunds
   */
  async store({ request, response, auth }: HttpContext) {
    try {
      const { order_id, reason, reason_type, customer_notes, refund_items } = request.only([
        'order_id', 'reason', 'reason_type', 'customer_notes', 'refund_items'
      ])

      // Vérifier la commande
      const order = await Order.find(order_id)
      if (!order) {
        return response.notFound({
          success: false,
          message: 'Commande non trouvée'
        })
      }

      // Vérifier si l'utilisateur est autorisé
      const user = auth.user
      if (user && order.user_id !== user.id) {
        // Vérifier si la commande a été faite par l'utilisateur ou l'email correspond
        if (order.customer_email !== user.email) {
          return response.forbidden({
            success: false,
            message: 'Vous n\'êtes pas autorisé à demander un remboursement pour cette commande'
          })
        }
      }

      // Vérifier si un remboursement existe déjà pour cette commande
      const existingRefund = await Refund.query()
        .where('order_id', order_id)
        .whereNotIn('status', ['rejected', 'completed'])
        .first()

      if (existingRefund) {
        return response.badRequest({
          success: false,
          message: 'Une demande de remboursement existe déjà pour cette commande'
        })
      }

      // Vérifier si la commande est remboursable
      const refundableStatuses = ['paid', 'processing', 'shipped', 'delivered']
      if (!refundableStatuses.includes(order.status)) {
        return response.badRequest({
          success: false,
          message: 'Cette commande ne peut pas être remboursée (statut: ' + order.status + ')'
        })
      }

      // Créer le remboursement
      const refund = await Refund.create({
        order_id: order.id,
        user_id: user?.id || null,
        amount: order.total,
        reason: reason,
        reason_type: reason_type || 'other',
        customer_notes: customer_notes || null,
        refunded_items: refund_items || null,
        requested_at: DateTime.now(),
        status: 'pending'
      })

      await refund.load('order')
      await refund.load('user')

      return response.created({
        success: true,
        message: 'Demande de remboursement créée avec succès',
        data: refund
      })
    } catch (error) {
      console.error('Erreur store refund:', error)
      return response.internalServerError({
        success: false,
        message: error.message
      })
    }
  }

  /**
   * Approuve un remboursement (admin)
   * PATCH /api/refunds/:id/approve
   */
  async approve({ params, request, response, auth }: HttpContext) {
    try {
      const refund = await Refund.find(params.id)
      if (!refund) {
        return response.notFound({
          success: false,
          message: 'Remboursement non trouvé'
        })
      }

      if (!refund.canBeApproved()) {
        return response.badRequest({
          success: false,
          message: `Ce remboursement ne peut pas être approuvé (statut actuel: ${refund.status})`
        })
      }

      const { admin_notes } = request.only(['admin_notes'])
      const admin = auth.user

      // Approuver le remboursement
      await refund.approve(admin?.id || 'system', admin_notes)

      // Créditer le wallet du client (optionnel)
      if (refund.user_id) {
        const wallet = await Wallet.query().where('user_id', refund.user_id).first()
        if (wallet) {
          wallet.balance += refund.amount
          await wallet.save()
        }
      }

      await refund.load('order')
      await refund.load('user')
      await refund.load('admin')

      return response.ok({
        success: true,
        message: 'Remboursement approuvé avec succès',
        data: refund
      })
    } catch (error) {
      console.error('Erreur approve refund:', error)
      return response.internalServerError({
        success: false,
        message: error.message
      })
    }
  }

  /**
   * Rejette un remboursement (admin)
   * PATCH /api/refunds/:id/reject
   */
  async reject({ params, request, response, auth }: HttpContext) {
    try {
      const refund = await Refund.find(params.id)
      if (!refund) {
        return response.notFound({
          success: false,
          message: 'Remboursement non trouvé'
        })
      }

      if (!refund.canBeRejected()) {
        return response.badRequest({
          success: false,
          message: `Ce remboursement ne peut pas être rejeté (statut actuel: ${refund.status})`
        })
      }

      const { admin_notes } = request.only(['admin_notes'])
      const admin = auth.user

      if (!admin_notes) {
        return response.badRequest({
          success: false,
          message: 'Veuillez fournir un motif de rejet'
        })
      }

      await refund.reject(admin?.id || 'system', admin_notes)

      await refund.load('order')
      await refund.load('user')
      await refund.load('admin')

      return response.ok({
        success: true,
        message: 'Remboursement rejeté',
        data: refund
      })
    } catch (error) {
      console.error('Erreur reject refund:', error)
      return response.internalServerError({
        success: false,
        message: error.message
      })
    }
  }

  /**
   * Marque un remboursement comme complété (admin)
   * PATCH /api/refunds/:id/complete
   */
  async complete({ params, request, response }: HttpContext) {
    try {
      const refund = await Refund.find(params.id)
      if (!refund) {
        return response.notFound({
          success: false,
          message: 'Remboursement non trouvé'
        })
      }

      if (refund.status !== 'approved') {
        return response.badRequest({
          success: false,
          message: 'Seuls les remboursements approuvés peuvent être marqués comme complétés'
        })
      }

      const { external_transaction_id } = request.only(['external_transaction_id'])

      await refund.complete(external_transaction_id)

      // Mettre à jour le statut de la commande si nécessaire
      const order = await Order.find(refund.order_id)
      if (order) {
        // Optionnel: marquer la commande comme remboursée
        // order.status = 'refunded'
        // await order.save()
      }

      return response.ok({
        success: true,
        message: 'Remboursement marqué comme complété',
        data: refund
      })
    } catch (error) {
      console.error('Erreur complete refund:', error)
      return response.internalServerError({
        success: false,
        message: error.message
      })
    }
  }

  /**
   * Statistiques des remboursements (admin)
   * GET /api/refunds/stats
   */
  async stats({ response }: HttpContext) {
    try {
      const stats = await Refund.query()
        .select('status')
        .count('* as total')
        .groupBy('status')

      const totalAmount = await Refund.query()
        .where('status', 'completed')
        .sum('amount as total')

      const monthlyStats = await Refund.query()
        .select(Refund.query().raw('DATE_TRUNC(\'month\', requested_at) as month'))
        .count('* as total')
        .sum('amount as amount')
        .groupBy('month')
        .orderBy('month', 'desc')
        .limit(12)

      return response.ok({
        success: true,
        data: {
          by_status: stats,
          total_refunded_amount: totalAmount[0]?.$extras.total || 0,
          monthly_stats: monthlyStats
        }
      })
    } catch (error) {
      console.error('Erreur stats refunds:', error)
      return response.internalServerError({
        success: false,
        message: error.message
      })
    }
  }

  /**
   * Remboursements d'un utilisateur (client)
   * GET /api/refunds/user/:userId
   */
  async userRefunds({ params, response, auth }: HttpContext) {
    try {
      const user = auth.user
      if (!user || user.id !== params.userId) {
        return response.forbidden({
          success: false,
          message: 'Accès non autorisé'
        })
      }

      const refunds = await Refund.query()
        .where('user_id', params.userId)
        .orWhereHas('order', (query) => {
          query.where('customer_email', user.email)
        })
        .preload('order')
        .orderBy('created_at', 'desc')

      return response.ok({
        success: true,
        data: refunds,
        count: refunds.length
      })
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: error.message
      })
    }
  }

  /**
   * Remboursements d'une commande
   * GET /api/refunds/order/:orderId
   */
  async orderRefunds({ params, response }: HttpContext) {
    try {
      const refunds = await Refund.query()
        .where('order_id', params.orderId)
        .preload('user')
        .preload('admin')
        .orderBy('created_at', 'desc')

      return response.ok({
        success: true,
        data: refunds,
        count: refunds.length
      })
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: error.message
      })
    }
  }
}