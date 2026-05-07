// app/controllers/SubscriptionCallbackController.ts
import type { HttpContext } from '@adonisjs/core/http'
import Subscription from '#models/Subscription'
import BoostService from '../services/BoostService.js'
import { DateTime } from 'luxon'

export default class SubscriptionCallbackController {

  /**
   * Callback Mypvit pour les paiements d'abonnement
   * POST /api/mypvit/callback/subscription
   */
  async handle({ request, response }: HttpContext) {
    console.log('🔔 ========== CALLBACK SUBSCRIPTION REÇU ==========')
    
    try {
      const payload = request.body()
      console.log('📦 Payload reçu:', payload)

      const { reference_id, status, transaction_id, message } = payload

      if (!reference_id) {
        console.log('❌ Pas de reference_id dans le callback')
        return response.status(400).json({ success: false, message: 'reference_id manquant' })
      }

      // Chercher l'abonnement par reference_id
      const subscription: any = await Subscription.query()
        .where('paymentReferenceId', reference_id)
        .first()

      if (!subscription) {
        console.log('❌ Aucun abonnement trouvé pour la référence:', reference_id)
        return response.status(404).json({ success: false, message: 'Abonnement introuvable' })
      }

      console.log('📋 Abonnement trouvé:', {
        id: subscription.id,
        plan: subscription.planName,
        type: subscription.subscriptionType,
        status: subscription.status,
      })

      // Traiter selon le statut
      if (status === 'SUCCESS') {
        // ✅ Paiement confirmé
        console.log('✅ Paiement confirmé - Activation de l\'abonnement')
        
        await subscription.activate()
        subscription.paymentStatus = 'SUCCESS'
        subscription.metadata = {
          ...subscription.metadata,
          callbackReceivedAt: DateTime.now().toISO(),
          transactionId: transaction_id,
          callbackStatus: status,
        }
        await subscription.save()

        // Activer le boost selon le type
        if (subscription.subscriptionType === 'all_products') {
          console.log('🚀 Activation boost pour TOUS les produits du marchand')
          await BoostService.activateBoostForMerchant(subscription.userId, subscription.id)
        } else if (subscription.subscriptionType === 'single_product' && subscription.productId) {
          console.log('🚀 Activation boost pour le produit:', subscription.productId)
          await BoostService.activateBoostForProduct(subscription.productId, subscription)
        }

        console.log('✅ Abonnement activé avec succès')

        return response.json({
          success: true,
          message: 'Abonnement activé',
          data: {
            subscriptionId: subscription.id,
            status: 'ACTIVE',
            remainingDays: subscription.remainingDays,
          },
        })

      } else if (status === 'FAILED') {
        // ❌ Paiement échoué
        console.log('❌ Paiement échoué - Annulation de l\'abonnement')
        
        subscription.status = 'cancelled'
        subscription.paymentStatus = 'FAILED'
        subscription.metadata = {
          ...subscription.metadata,
          callbackReceivedAt: DateTime.now().toISO(),
          transactionId: transaction_id,
          callbackStatus: status,
          errorMessage: message,
        }
        await subscription.save()

        console.log('❌ Abonnement annulé')

        return response.json({
          success: true,
          message: 'Abonnement annulé (paiement échoué)',
          data: {
            subscriptionId: subscription.id,
            status: 'CANCELLED',
          },
        })

      } else {
        // ⏳ PENDING ou autre
        console.log('⏳ Paiement toujours en attente')
        
        subscription.paymentStatus = 'PENDING'
        subscription.metadata = {
          ...subscription.metadata,
          lastCallbackReceivedAt: DateTime.now().toISO(),
          lastCallbackStatus: status,
        }
        await subscription.save()

        return response.json({
          success: true,
          message: 'Statut en attente enregistré',
          data: {
            subscriptionId: subscription.id,
            status: 'PENDING',
          },
        })
      }

    } catch (error: any) {
      console.error('🔴 Erreur callback subscription:', error)
      return response.status(500).json({
        success: false,
        message: 'Erreur lors du traitement du callback',
        error: error.message,
      })
    }
  }

  /**
   * Callback de test pour simuler Mypvit (développement)
   * POST /api/mypvit/callback/subscription/test
   */
  async test({ request, response }: HttpContext) {
    const { reference_id, status } = request.only(['reference_id', 'status'])

    console.log('🧪 TEST CALLBACK:', { reference_id, status })

    return this.handle({
      request: {
        body: () => ({
          reference_id,
          status: status || 'SUCCESS',
          transaction_id: 'TEST-' + Date.now(),
          message: 'Test callback',
        }),
      },
      response,
    } as any)
  }
}
