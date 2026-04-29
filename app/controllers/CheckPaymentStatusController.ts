// app/controllers/CheckPaymentStatusController.ts
import type { HttpContext } from '@adonisjs/core/http'
import Order from '#models/Order'
import OrderTracking from '#models/order_tracking'
import OrderItem from '#models/OrderItem'
import Product from '#models/Product'
import { DateTime } from 'luxon'
import MypvitTransactionService from '../services/mypvit_transaction_service.js'

export default class CheckPaymentStatusController {

  /**
   * Vérifie le statut d'un paiement Mobile Money
   * GET /api/orders/:orderNumber/payment-status
   * POST /api/orders/check-payment-status
   */
  async check({ request, response, params }: HttpContext) {
    console.log('🔍 ========== VÉRIFICATION STATUT PAIEMENT ==========')

    try {
      // Récupérer l'orderNumber depuis les params ou le body
      const orderNumber = params.orderNumber || request.input('orderNumber')

      if (!orderNumber) {
        return response.status(400).json({
          success: false,
          message: 'Numéro de commande requis',
        })
      }

      // 1. Récupérer la commande
      const order = await Order.query()
        .where('order_number', orderNumber)
        .preload('items')
        .first()

      if (!order) {
        return response.status(404).json({
          success: false,
          message: 'Commande introuvable',
        })
      }

      console.log(`📦 Commande: ${order.order_number} | Statut: ${order.status}`)

      // 2. Si déjà payée, retourner direct
      if (order.status === 'paid' || order.status === 'delivered') {
        return response.status(200).json({
          success: true,
          message: 'Paiement déjà confirmé ✅',
          data: {
            orderId: order.id,
            orderNumber: order.order_number,
            status: 'completed',
            paymentStatus: 'SUCCESS',
            total: order.total,
            confirmedAt: order.payment_completed_at,
          },
        })
      }

      // 3. Si échouée, retourner direct
      if (order.status === 'payment_failed' || order.status === 'cancelled') {
        return response.status(200).json({
          success: false,
          message: 'Paiement échoué ❌',
          data: {
            orderId: order.id,
            orderNumber: order.order_number,
            status: 'failed',
            paymentStatus: 'FAILED',
            errorMessage: order.payment_error_message || 'Paiement non abouti',
          },
        })
      }

      // 4. Si pas de référence de paiement
      if (!order.payment_reference_id) {
        return response.status(200).json({
          success: false,
          message: 'Aucune référence de paiement trouvée',
          data: {
            orderId: order.id,
            orderNumber: order.order_number,
            status: 'unknown',
            paymentStatus: 'UNKNOWN',
          },
        })
      }

      // 5. Vérifier le statut auprès de Mypvit
      console.log(`🔍 Vérification statut Mypvit pour référence: ${order.payment_reference_id}`)

      let paymentStatus = null
      try {
        paymentStatus = await MypvitTransactionService.checkTransactionStatus({
          reference_id: order.payment_reference_id,
          order_number: order.order_number,
        })

        console.log('📊 Résultat vérification Mypvit:', {
          status: paymentStatus.status,
          transactionStatus: paymentStatus.transaction_status,
          message: paymentStatus.message,
        })

      } catch (error: any) {
        console.log('⚠️ Erreur vérification Mypvit:', error.message)
        
        // Si l'API n'est pas dispo, retourner le statut actuel
        return response.status(200).json({
          success: true,
          message: 'Statut temporairement indisponible, statut actuel retourné',
          data: {
            orderId: order.id,
            orderNumber: order.order_number,
            status: 'pending',
            paymentStatus: 'PENDING',
            currentOrderStatus: order.status,
            isPending: true,
            message: 'En attente de vérification',
          },
        })
      }

      // 6. Traiter selon le résultat
      const transactionStatus = paymentStatus?.status || paymentStatus?.transaction_status

      if (transactionStatus === 'SUCCESS' || transactionStatus === 'SUCCESSFUL' || transactionStatus === 'COMPLETED' || transactionStatus === 'success' || transactionStatus === 'completed') {
        // ✅ PAIEMENT CONFIRMÉ
        console.log('✅ Paiement confirmé !')

        order.status = 'paid'
        order.payment_status = 'SUCCESS'
        order.payment_completed_at = DateTime.now()
        
        if (paymentStatus?.transaction_id) {
          order.payment_transaction_id = paymentStatus.transaction_id
        }
        
        await order.save()

        // Ajouter tracking
        await OrderTracking.create({
          order_id: order.id,
          status: 'paid',
          description: `✅ Paiement confirmé ${order.payment_method} - Transaction: ${paymentStatus?.transaction_id || 'N/A'}`,
          tracked_at: DateTime.now(),
        })

        // Marquer les items comme payés
        await OrderItem.query()
          .where('order_id', order.id)
          .update({ status: 'paid' })

        await order.load('items')

        return response.status(200).json({
          success: true,
          message: 'Paiement confirmé ✅',
          data: {
            orderId: order.id,
            orderNumber: order.order_number,
            status: 'completed',
            paymentStatus: 'SUCCESS',
            total: order.total,
            transactionId: paymentStatus?.transaction_id,
            confirmedAt: order.payment_completed_at,
          },
        })

      } else if (transactionStatus === 'FAILED' || transactionStatus === 'CANCELLED' || transactionStatus === 'REJECTED' || transactionStatus === 'failed' || transactionStatus === 'cancelled') {
        // ❌ PAIEMENT ÉCHOUÉ
        console.log('❌ Paiement échoué')

        // Restaurer le stock
        await this.restoreStock(order.id)

        order.status = 'payment_failed'
        order.payment_status = 'FAILED'
        order.payment_error_message = paymentStatus?.message || 'Paiement refusé'
        await order.save()

        await OrderTracking.create({
          order_id: order.id,
          status: 'payment_failed',
          description: `❌ Paiement échoué - ${paymentStatus?.message || 'Refusé'}`,
          tracked_at: DateTime.now(),
        })

        return response.status(200).json({
          success: false,
          message: 'Paiement échoué ❌',
          data: {
            orderId: order.id,
            orderNumber: order.order_number,
            status: 'failed',
            paymentStatus: 'FAILED',
            errorMessage: order.payment_error_message,
          },
        })

      } else {
        // ⏳ TOUJOURS EN ATTENTE
        console.log('⏳ Paiement toujours en attente')

        // Mettre à jour le statut si nécessaire
        if (order.status !== 'pending_payment') {
          order.status = 'pending_payment'
          order.payment_status = 'PENDING'
          await order.save()
        }

        return response.status(200).json({
          success: true,
          message: 'Paiement en attente ⏳',
          data: {
            orderId: order.id,
            orderNumber: order.order_number,
            status: 'pending',
            paymentStatus: 'PENDING',
            isPending: true,
            total: order.total,
            referenceId: order.payment_reference_id,
            initiatedAt: order.payment_initiated_at,
            message: paymentStatus?.message || 'En attente de confirmation',
          },
          is_pending: true,
        })
      }

    } catch (error: any) {
      console.error('🔴 Erreur vérification statut:', error)
      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la vérification',
        error: error.message,
      })
    }
  }

  /**
   * Restaurer le stock en cas d'échec
   */
  private async restoreStock(orderId: string): Promise<void> {
    try {
      const items = await OrderItem.query().where('order_id', orderId)
      
      for (const item of items) {
        const product = await Product.findBy('id', item.product_id)
        if (product) {
          product.stock += item.quantity
          if (product.is_archived && product.stock > 0) {
            product.is_archived = false
          }
          await product.save()
        }
      }
      
      console.log(`📦 Stock restauré pour la commande ${orderId}`)
    } catch (error) {
      console.error('❌ Erreur restauration stock:', error)
    }
  }
}
