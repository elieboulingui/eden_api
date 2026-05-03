// app/controllers/PayMobileMoneyController.ts - VERSION SIMPLIFIÉE
import type { HttpContext } from '@adonisjs/core/http'
import MypvitSecretService from '../services/mypvit_secret_service.js'
import MypvitTransactionService from '../services/mypvit_transaction_service.js'
import MypvitKYCService from '../services/mypvit_kyc_service.js'

const CALLBACK_URL_CODE = '9ZOXW'

export default class PayMobileMoneyController {

  private async renewSecretIfNeeded(phoneNumber?: string): Promise<void> {
    try {
      console.log('🔄 Tentative de renouvellement du secret...')
      await MypvitSecretService.renewSecret(phoneNumber)
      console.log('✅ Clé renouvelée avec succès')
    } catch (error: any) {
      console.error('⚠️ Erreur renouvellement secret:', error.message)
    }
  }

  private detectOperatorGabon(phoneNumber: string): { name: string; code: string; accountCode: string } {
    console.log('🔍 Détection opérateur pour:', phoneNumber)
    
    const clean = phoneNumber.replace(/[\s\+\.\-]/g, '')
    let local = clean
    
    if (clean.startsWith('+241')) local = clean.substring(4)
    else if (clean.startsWith('241')) local = clean.substring(3)
    
    if (local.startsWith('0')) local = local.substring(1)
    
    console.log('📱 Numéro nettoyé:', local)
    console.log('🔢 Premier chiffre:', local.charAt(0))

    if (local.startsWith('7')) {
      console.log('✅ AIRTEL_MONEY détecté')
      return {
        name: 'AIRTEL_MONEY',
        code: 'AIRTEL_MONEY',
        accountCode: 'ACC_69EFB0E02FCA3'
      }
    }
    
    console.log('✅ MOOV_MONEY détecté')
    return {
      name: 'MOOV_MONEY',
      code: 'MOOV_MONEY',
      accountCode: 'ACC_69EFB143D4F54'
    }
  }

  private async performKYC(phoneNumber: string): Promise<{
    operator: string
    fullName: string
    accountNumber: string
    operatorCode: string
    accountCode: string
    isActive: boolean
  }> {
    console.log('🆔 Démarrage KYC pour:', phoneNumber)
    
    const detected = this.detectOperatorGabon(phoneNumber)
    let fullName = 'Client'

    try {
      await this.renewSecretIfNeeded(phoneNumber)
      const kycData = await MypvitKYCService.getKYCInfo(phoneNumber, detected.code)
      fullName = kycData.firstname || kycData.full_name || 'Client'
      console.log('✅ KYC réussi, nom:', fullName)
    } catch (error: any) {
      console.log('🟡 KYC fallback:', error.message)
    }

    return {
      operator: detected.name,
      fullName,
      accountNumber: phoneNumber,
      operatorCode: detected.code,
      accountCode: detected.accountCode,
      isActive: true
    }
  }

  // ==================== MÉTHODE PRINCIPALE ====================
  async pay({ request, response }: HttpContext) {
    console.log('📱 ========== PAIEMENT MOBILE MONEY ==========')

    try {
      const payload = request.only([
        'phoneNumber',
        'amount',
        'agent',
        'customerName',
        'customerEmail',
      ])

      const phoneNumber = payload.phoneNumber
      if (!phoneNumber) {
        return response.status(400).json({
          success: false,
          message: 'Numéro de téléphone requis'
        })
      }

      const amount = payload.amount
      if (!amount || amount <= 0) {
        return response.status(400).json({
          success: false,
          message: 'Montant requis et doit être supérieur à 0'
        })
      }

      // 1. KYC et détection opérateur
      const kyc = await this.performKYC(phoneNumber)
      console.log(`📱 Opérateur: ${kyc.operator} | Code: ${kyc.operatorCode} | Compte: ${kyc.accountCode}`)

      // 2. Renouveler le secret
      await this.renewSecretIfNeeded(phoneNumber)

      // 3. Paiement direct à Mypvit
      console.log(`💳 Paiement ${kyc.operator} - ${amount} XAF via compte ${kyc.accountCode}...`)

      const payment = await MypvitTransactionService.processPayment({
        agent: payload.agent || 'AGENT_DEFAULT',
        amount: amount,
        reference: `REF${Date.now()}`.substring(0, 15),
        callback_url_code: CALLBACK_URL_CODE,
        customer_account_number: kyc.accountNumber,
        merchant_operation_account_code: kyc.accountCode,
        owner_charge: 'CUSTOMER',
        operator_code: kyc.operatorCode,
      })

      console.log('💳 Résultat paiement:', JSON.stringify(payment, null, 2))

      // 4. Retourner le résultat
      if (payment.status !== 'FAILED' && payment.reference_id) {
        return response.status(200).json({
          success: true,
          message: '⏳ Vérifiez votre téléphone pour confirmer le paiement',
          data: {
            reference_id: payment.reference_id,
            amount: amount,
            operator: kyc.operator,
            phoneNumber: kyc.accountNumber,
            customerName: kyc.fullName,
            status: 'PENDING',
            payment: payment
          },
        })
      } else {
        return response.status(400).json({
          success: false,
          message: 'Paiement échoué',
          error: payment.message || 'Erreur inconnue',
          operator: kyc.operator,
          payment: payment
        })
      }
    } catch (error: any) {
      console.error('🔴 Erreur paiement:', error.message)
      
      if (error.response) {
        console.error('🔴 Status:', error.response.status)
        console.error('🔴 Data:', JSON.stringify(error.response.data))
      }
      
      return response.status(500).json({
        success: false,
        message: 'Erreur lors du paiement',
        error: error.message,
        details: error.response?.data || null
      })
    }
  }
}
