// app/controllers/CheckPaymentStatusController.ts
import type { HttpContext } from '@adonisjs/core/http'
import Order from '#models/Order'
import MypvitTransactionService from '../services/mypvit_transaction_service.js'

export default class CheckPaymentStatusController {

  /**
   * Vérifie le statut d'un paiement (juste vérifier, pas modifier)
   * GET /api/orders/:orderNumber/payment-status
   * POST /api/orders/check-payment-status
   */
  async check({ request, response, params }: HttpContext) {
    console.log('🔍 ========== VÉRIFICATION STATUT PAIEMENT ==========')

    try {
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
        .first()

      if (!order) {
        return response.status(404).json({
          success: false,
          message: 'Commande introuvable',
        })
      }

      console.log(`📦 Commande: ${order.order_number} | Statut: ${order.status}`)

      // 2. Si pas de référence de paiement
      if (!order.payment_reference_id) {
        return response.status(200).json({
          success: false,
          message: 'Aucune référence de paiement trouvée',
          data: {
            orderId: order.id,
            orderNumber: order.order_number,
            status: order.status,
            paymentStatus: 'UNKNOWN',
          },
        })
      }

      // 3. Vérifier le statut auprès de Mypvit (juste lire)
      console.log(`🔍 Vérification Mypvit pour: ${order.payment_reference_id}`)

      let paymentStatus: any = null
      try {
        paymentStatus = await MypvitTransactionService.checkTransactionStatus(
          order.payment_reference_id,
          order.order_number
        )
        console.log('📊 Résultat Mypvit:', paymentStatus)
      } catch (error: any) {
        console.log('⚠️ Erreur Mypvit:', error.message)
        return response.status(200).json({
          success: true,
          message: 'Service Mypvit temporairement indisponible',
          data: {
            orderId: order.id,
            orderNumber: order.order_number,
            status: order.status,
            paymentStatus: order.payment_status || 'UNKNOWN',
            isPending: true,
          },
        })
      }

      // 4. Mapper le statut Mypvit vers notre format
      const mypvitStatus = paymentStatus?.status || 'PENDING'

      let resultStatus: string
      let resultPaymentStatus: string
      let isPending = false

      switch (mypvitStatus) {
        case 'SUCCESS':
          resultStatus = 'completed'
          resultPaymentStatus = 'SUCCESS'
          break
        case 'FAILED':
          resultStatus = 'failed'
          resultPaymentStatus = 'FAILED'
          break
        case 'PENDING':
        case 'AMBIGUOUS':
        default:
          resultStatus = 'pending'
          resultPaymentStatus = 'PENDING'
          isPending = true
          break
      }

      // 5. Retourner le statut SANS rien modifier en base
      return response.status(200).json({
        success: mypvitStatus !== 'FAILED',
        message: mypvitStatus === 'SUCCESS' 
          ? '✅ Paiement confirmé' 
          : mypvitStatus === 'FAILED' 
            ? '❌ Paiement échoué' 
            : '⏳ Paiement en attente',
        data: {
          orderId: order.id,
          orderNumber: order.order_number,
          status: resultStatus,
          paymentStatus: resultPaymentStatus,
          currentOrderStatus: order.status,
          total: order.total,
          referenceId: order.payment_reference_id,
          mypvitRawStatus: mypvitStatus,
        },
        is_pending: isPending,
      })

    } catch (error: any) {
      console.error('🔴 Erreur:', error)
      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la vérification',
        error: error.message,
      })
    }
  }
}
