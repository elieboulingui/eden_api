// app/controllers/CallbackController.ts
import type { HttpContext } from '@adonisjs/core/http'

export default class CallbackController {

  /**
   * Callback Mypvit - Juste pour confirmer la réception du paiement
   * POST /api/callback/mypvit
   */
  async handle({ request, response }: HttpContext) {
    console.log('🔔 ========== CALLBACK MYPVIT REÇU ==========')
    
    try {
      const payload = request.body()
      console.log('📥 Payload complet:', JSON.stringify(payload, null, 2))

      // Extraire les informations
      const {
        reference_id,
        reference,
        status,
        message,
        operator_code,
        customer_account_number,
        amount,
        transaction_id,
      } = payload

      console.log('📋 Résumé callback:')
      console.log('  - Reference ID:', reference_id)
      console.log('  - Status:', status)
      console.log('  - Opérateur:', operator_code)
      console.log('  - Téléphone:', customer_account_number)
      console.log('  - Montant:', amount)
      console.log('  - Transaction ID:', transaction_id)
      console.log('  - Message:', message)

      // Vérifier le statut du paiement
      const successStatuses = ['SUCCESS', 'SUCCESSFUL', 'COMPLETED', 'OK']
      const isSuccess = successStatuses.includes(status?.toUpperCase())

      if (isSuccess) {
        console.log('✅ Paiement RÉUSSI')
        console.log(`✅ ${amount} XAF reçu de ${customer_account_number} via ${operator_code}`)
        
        return response.status(200).json({
          success: true,
          message: 'Paiement confirmé',
          data: {
            reference_id: reference_id || reference,
            transaction_id: transaction_id,
            status: 'SUCCESS',
            amount: amount,
            operator: operator_code,
            phoneNumber: customer_account_number,
          }
        })
      } else {
        console.log('❌ Paiement ÉCHOUÉ ou AUTRE')
        console.log(`❌ Status: ${status} - ${message}`)
        
        return response.status(200).json({
          success: false,
          message: message || 'Paiement non confirmé',
          data: {
            reference_id: reference_id || reference,
            transaction_id: transaction_id,
            status: status,
            operator: operator_code,
          }
        })
      }

    } catch (error: any) {
      console.error('🔴 Erreur callback:', error.message)
      
      return response.status(500).json({
        success: false,
        message: 'Erreur traitement callback',
        error: error.message
      })
    }
  }

  /**
   * Route de test pour simuler un callback
   * POST /api/callback/test
   */
  async test({ request, response }: HttpContext) {
    console.log('🧪 ========== CALLBACK TEST ==========')
    
    const payload = request.body()
    console.log('📥 Payload test:', JSON.stringify(payload, null, 2))

    return response.status(200).json({
      success: true,
      message: 'Callback test reçu',
      data: payload
    })
  }
}
