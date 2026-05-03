// app/controllers/give_change_controller.ts
import type { HttpContext } from '@adonisjs/core/http'
import MypvitSecretService from '../services/mypvit_secret_service.js'
import MypvitTransactionService from '../services/mypvit_transaction_service.js'

const MIN_WITHDRAWAL_AMOUNT = 150

export default class GiveChangeController {

  private getOperatorInfo(phone: string): { 
    operator: string; operatorCode: string; accountCode: string 
  } {
    const clean = phone.replace(/[\s\+\.\-]/g, '')
    let local = clean
    if (clean.startsWith('241')) local = clean.substring(3)
    if (local.startsWith('0')) local = local.substring(1)

    if (local.startsWith('6')) {
      return { operator: 'MOOV_MONEY', operatorCode: 'MOOV_MONEY', accountCode: 'ACC_69EFB143D4F54' }
    }
    return { operator: 'AIRTEL_MONEY', operatorCode: 'AIRTEL_MONEY', accountCode: 'ACC_69EFB0E02FCA3' }
  }

  async giveChange({ request, response }: HttpContext) {
    console.log('💰 ========== GIVE CHANGE DEMANDÉ ==========')
    
    try {
      const { amount, customer_account_number } = request.body()

      if (!amount || Number(amount) < MIN_WITHDRAWAL_AMOUNT) {
        return response.status(400).json({ 
          success: false, 
          message: `Montant minimum: ${MIN_WITHDRAWAL_AMOUNT} FCFA` 
        })
      }
      if (!customer_account_number) {
        return response.status(400).json({ 
          success: false, 
          message: 'Numéro de téléphone requis' 
        })
      }

      const opInfo = this.getOperatorInfo(customer_account_number)
      console.log('📱 Opérateur détecté:', { 
        phone: customer_account_number, 
        operator: opInfo.operator, 
        accountCode: opInfo.accountCode 
      })

      await MypvitSecretService.renewSecret(customer_account_number)
      console.log('🔐 Secret MyPVit renouvelé')

      const reference = `GCH${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).substring(2, 5)}`.substring(0, 20)

      const paymentResult = await (MypvitTransactionService as any).processGiveChange({
        amount: Number(amount),
        reference: reference,
        callback_url_code: '4USEG',
        customer_account_number: customer_account_number.replace(/\s/g, ''),
        merchant_operation_account_code: opInfo.accountCode,
        owner_charge: 'MERCHANT',
        operator_code: opInfo.operatorCode,
        free_info: `Retrait ${opInfo.operator}`.substring(0, 15),
      })

      console.log('📡 Réponse MyPVit:', paymentResult)

      if (paymentResult.status === 'SUCCESS') {
        return response.status(200).json({
          success: true,
          message: `✅ Retrait de ${amount} FCFA effectué avec succès via ${opInfo.operator}`,
          data: {
            amount: Number(amount),
            status: 'completed',
            operator: opInfo.operator,
            reference: reference,
            transaction_id: paymentResult.reference_id,
          },
        })
      } else {
        return response.status(400).json({
          success: false,
          message: `❌ Retrait refusé: ${paymentResult.message || 'Échec'}`,
          operator: opInfo.operator,
          data: {
            reference: reference,
            status: 'failed',
          },
        })
      }

    } catch (error: any) {
      console.error('🔴 Erreur give-change:', error.message)
      return response.status(500).json({ 
        success: false, 
        message: 'Erreur interne', 
        error: error.message 
      })
    }
  }
}
