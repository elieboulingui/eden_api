// app/controllers/payments/check_status_controller.ts
// ✅ C'EST ICI qu'on récupère le X-Secret

import type { HttpContext } from '@adonisjs/core/http'
import Order from '#models/Order'
import OrderTracking from '#models/order_tracking'
import MypvitSecretService from '#services/mypvit_secret_services'
import PvitStatusService from '#services/pvit_status_service'
import { DateTime } from 'luxon'

export default class CheckStatusController {

  /**
   * GET /api/payments/status/:orderId
   */
  async check({ params, response }: HttpContext) {
    try {
      const order = await Order.find(params.orderId)

      if (!order) {
        return response.status(404).json({
          success: false,
          message: 'Commande introuvable'
        })
      }

      console.log('📋 Vérification commande:', order.order_number)
      console.log('   Référence PVit:', order.payment_reference_id)
      console.log('   Opérateur:', order.payment_operator_simple)

      // Si déjà confirmé
      if (order.status === 'paid' || order.status === 'confirmed') {
        return response.json({
          success: true,
          is_pending: false,
          status: 'SUCCESS',
          orderNumber: order.order_number,
          customerName: order.customer_name
        })
      }

      // Si déjà échoué
      if (order.status === 'payment_failed') {
        return response.json({
          success: false,
          is_pending: false,
          status: 'FAILED'
        })
      }

      // Vérifier qu'on a une référence
      if (!order.payment_reference_id) {
        return response.json({
          success: true,
          is_pending: true,
          status: 'PENDING',
          message: 'En attente...'
        })
      }

      // ✅ 1. RÉCUPÉRER LE X-SECRET
      console.log('🔑 Récupération du X-Secret...')
      const xSecret = await MypvitSecretService.getSecret()
      console.log('   X-Secret:', xSecret.substring(0, 15) + '...')

      // ✅ 2. DÉTERMINER LE COMPTE OPÉRATION
      const accountCode = this.getAccountCode(order.payment_operator_simple)

      // ✅ 3. RÉCUPÉRER LE TRANSACTION ID
      const transactionId = order.payment_reference_id

      console.log('📤 Envoi requête statut à PVit:')
      console.log('   X-Secret:', xSecret.substring(0, 15) + '...')
      console.log('   Transaction ID:', transactionId)
      console.log('   Compte:', accountCode)

      // ✅ 4. APPELER LE SERVICE DE STATUT
      const result = await PvitStatusService.checkStatus(
        xSecret,
        transactionId,
        accountCode
      )

      // Si erreur 401 → renouveler et réessayer
      if (!result.success && result.message?.includes('401')) {
        console.log('🔄 X-Secret expiré, renouvellement...')
        await MypvitSecretService.forceRenewal()
        const newSecret = await MypvitSecretService.getSecret()
        
        const retryResult = await PvitStatusService.checkStatus(
          newSecret,
          transactionId,
          accountCode
        )
        
        if (retryResult.success) {
          return this.handleResult(order, retryResult, response)
        }
      }

      // Traiter le résultat
      return this.handleResult(order, result, response)

    } catch (error: any) {
      console.error('❌ Erreur:', error.message)
      return response.status(500).json({
        success: false,
        message: error.message
      })
    }
  }

  /**
   * Traite le résultat du statut
   */
  private async handleResult(order: Order, result: any, response: HttpContext['response']) {
    if (!result.success) {
      return response.json({
        success: true,
        is_pending: true,
        status: 'PENDING',
        message: '⏳ Vérification en cours...'
      })
    }

    const { status, data } = result

    // ✅ SUCCESS
    if (status === 'SUCCESS') {
      order.status = 'paid'
      order.paid_at = DateTime.now()
      order.payment_amount = data.amount
      order.payment_fees = data.fees
      await order.save()

      await OrderTracking.create({
        order_id: order.id,
        status: 'paid',
        description: `✅ Paiement confirmé - ${data.operator} - ${data.amount} FCFA`,
        tracked_at: DateTime.now()
      })

      return response.json({
        success: true,
        is_pending: false,
        status: 'SUCCESS',
        message: '✅ Paiement confirmé !',
        orderNumber: order.order_number,
        customerName: order.customer_name,
        payment: {
          amount: data.amount,
          fees: data.fees,
          operator: data.operator,
          date: data.date
        }
      })
    }

    // ❌ FAILED
    if (status === 'FAILED') {
      order.status = 'payment_failed'
      await order.save()

      await OrderTracking.create({
        order_id: order.id,
        status: 'payment_failed',
        description: `❌ Paiement échoué`,
        tracked_at: DateTime.now()
      })

      return response.json({
        success: false,
        is_pending: false,
        status: 'FAILED',
        message: '❌ Paiement échoué'
      })
    }

    // ⏳ PENDING ou AMBIGUOUS
    return response.json({
      success: true,
      is_pending: true,
      status: status,
      message: '⏳ En attente...'
    })
  }

  /**
   * Retourne le code compte selon l'opérateur
   */
  private getAccountCode(operator?: string): string {
    if (!operator) return 'ACC_69FE0E1BC34B4'
    
    const op = operator.toUpperCase()
    if (op.includes('AIRTEL')) return 'ACC_69EFB0E02FCA3'
    if (op.includes('MOOV')) return 'ACC_69EFB143D4F54'
    if (op.includes('GIMAC')) return 'ACC_69FE0E1BC34B4'
    
    return 'ACC_69FE0E1BC34B4'
  }
}
