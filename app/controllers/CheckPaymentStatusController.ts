// app/controllers/CheckPaymentStatusController.ts
import type { HttpContext } from '@adonisjs/core/http'
import Order from '#models/Order'
import OrderTracking from '#models/order_tracking'
import OrderItem from '#models/OrderItem'
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

      // 2. Si déjà confirmée, retourner direct
      if (order.status === 'confirmed' || order.status === 'completed') {
        return response.status(200).json({
          success: true,
          message: 'Paiement déjà confirmé ✅',
          data: {
            orderId: order.id,
            orderNumber: order.order_number,
            status: 'completed',
            paymentStatus: 'SUCCESS',
            total: order.total,
            confirmedAt: order.payment_confirmed_at,
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
        // Utiliser le service MypvitTransactionService
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

      switch (transactionStatus) {
        case 'SUCCESS':
        case 'SUCCESSFUL':
        case 'COMPLETED':
        case 'success':
        case 'completed':
          // ✅ PAIEMENT CONFIRMÉ
          console.log('✅ Paiement confirmé !')

          order.status = 'confirmed'
          order.payment_status = 'SUCCESS'
          order.payment_confirmed_at = DateTime.now()
          
          if (paymentStatus?.transaction_id) {
            order.payment_transaction_id = paymentStatus.transaction_id
          }
          
          await order.save()

          // Ajouter tracking
          await OrderTracking.create({
            order_id: order.id,
            status: 'confirmed',
            description: `✅ Paiement confirmé ${order.payment_method} - Transaction: ${paymentStatus?.transaction_id || 'N/A'}`,
            tracked_at: DateTime.now(),
          })

          // Marquer les items comme payés
          await OrderItem.query()
            .where('order_id', order.id)
            .update({ status: 'paid' })

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
              confirmedAt: order.payment_confirmed_at,
            },
          })

        case 'FAILED':
        case 'CANCELLED':
        case 'REJECTED':
        case 'failed':
        case 'cancelled':
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

        case 'PENDING':
        case 'PROCESSING':
        case 'INITIATED':
        default:
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
   * Vérification en masse pour le dashboard admin
   * GET /api/orders/pending-payments
   */
  async checkPendingPayments({ response }: HttpContext) {
    try {
      const pendingOrders = await Order.query()
        .whereIn('status', ['pending', 'pending_payment'])
        .whereNotNull('payment_reference_id')
        .where('payment_initiated_at', '>', DateTime.now().minus({ hours: 24 }).toSQL())
        .limit(50)

      const results = []

      for (const order of pendingOrders) {
        try {
          const status = await MypvitTransactionService.checkTransactionStatus({
            reference_id: order.payment_reference_id!,
            order_number: order.order_number,
          })

          if (status?.status === 'SUCCESS') {
            // Mettre à jour la commande
            order.status = 'confirmed'
            order.payment_status = 'SUCCESS'
            order.payment_confirmed_at = DateTime.now()
            await order.save()

            await OrderTracking.create({
              order_id: order.id,
              status: 'confirmed',
              description: '✅ Paiement confirmé (vérification automatique)',
              tracked_at: DateTime.now(),
            })

            results.push({
              orderNumber: order.order_number,
              status: 'confirmed',
              wasPending: true,
            })
          } else if (status?.status === 'FAILED') {
            await this.restoreStock(order.id)
            order.status = 'payment_failed'
            await order.save()
            
            results.push({
              orderNumber: order.order_number,
              status: 'failed',
              wasPending: true,
            })
          } else {
            results.push({
              orderNumber: order.order_number,
              status: 'still_pending',
              wasPending: true,
            })
          }
        } catch (error) {
          results.push({
            orderNumber: order.order_number,
            status: 'error',
            error: error.message,
          })
        }
      }

      return response.status(200).json({
        success: true,
        checked: pendingOrders.length,
        confirmed: results.filter(r => r.status === 'confirmed').length,
        failed: results.filter(r => r.status === 'failed').length,
        stillPending: results.filter(r => r.status === 'still_pending').length,
        results,
      })

    } catch (error) {
      return response.status(500).json({
        success: false,
        message: 'Erreur vérification en masse',
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
