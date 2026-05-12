// app/controllers/payments/check_status_controller.ts
// ✅ SANS MypvitSecretService - le X-Secret vient du frontend

import type { HttpContext } from '@adonisjs/core/http'

export default class CheckStatusController {
  
  /**
   * GET /api/payments/status/verify
   * Vérifie le statut d'une transaction via PVit
   * Le X-Secret est envoyé directement depuis le frontend
   */
  async verify({ request, response }: HttpContext) {
    const transactionId = request.input('transactionId')
    const accountOperationCode = request.input('accountOperationCode')
    const xSecret = request.input('xSecret')

    console.log('🔍 [CheckStatus] Vérification statut PVit:')
    console.log('   Transaction:', transactionId)
    console.log('   Compte:', accountOperationCode)

    if (!transactionId || !accountOperationCode || !xSecret) {
      return response.status(400).json({
        success: false,
        message: 'transactionId, accountOperationCode et xSecret requis'
      })
    }
    
    // Appeler PVit directement avec le X-Secret du frontend
    const url = `https://api.mypvit.pro/FQDQOGFLKGT9BV0M/status?transactionId=${encodeURIComponent(transactionId)}&accountOperationCode=${encodeURIComponent(accountOperationCode)}&transactionOperation=PAYMENT`
    
    console.log('📡 Appel PVit:', url)
    
    const pvitResponse = await fetch(url, {
      headers: { 'X-Secret': xSecret }
    })
    
    const data: any = await pvitResponse.json()
    
    console.log('✅ Statut PVit:', data.status)
    console.log('   Montant:', data.amount)
    console.log('   Opérateur:', data.operator)
    
    return response.json({
      success: true,
      status: data.status,
      data: data
    })
  }
}
