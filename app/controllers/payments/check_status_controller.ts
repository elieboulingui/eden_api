// app/controllers/payments/check_status_controller.ts
import type { HttpContext } from '@adonisjs/core/http'
import MypvitSecretService from '#services/mypvit_secret_services'

export default class CheckStatusController {
  async verify({ request, response }: HttpContext) {
    const transactionId = request.input('transactionId')
    const accountOperationCode = request.input('accountOperationCode')
    const xSecret = request.input('xSecret') || await MypvitSecretService.getSecret()

    // Appeler PVit
    const url = `https://api.mypvit.pro/FQDQOGFLKGT9BV0M/status?transactionId=${transactionId}&accountOperationCode=${accountOperationCode}&transactionOperation=PAYMENT`
    
    const pvitResponse = await fetch(url, {
      headers: { 'X-Secret': xSecret }
    })
    
    const data = await pvitResponse.json()
    
    return response.json({ success: true, status: data.status, data })
  }
}
