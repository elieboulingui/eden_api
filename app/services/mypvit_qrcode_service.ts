// app/services/mypvit_qrcode_service.ts
import axios from 'axios'
import MypvitSecretService from './mypvit_secret_service.js'

interface QRCodeResponse {
  status: string
  data: string  // Chaîne du QR code
  reference_id?: string
  merchant_reference_id?: string
  message?: string
}

export class MypvitQRCodeService {
  private readonly BASE_URL = 'https://api.mypvit.pro/v2'
  
  async generateStaticQRCode(params: {
    accountOperationCode: string
    terminalId: string
    callbackUrlCode: string
    amount?: number
    reference?: string
    phoneNumber?: string
  }): Promise<QRCodeResponse> {
    
    console.log('📷 [QRCodeService] Génération QR Code...')
    console.log('   accountOperationCode:', params.accountOperationCode)
    console.log('   terminalId:', params.terminalId)
    console.log('   callbackUrlCode:', params.callbackUrlCode)
    console.log('   amount:', params.amount)
    console.log('   reference:', params.reference)
    
    // Récupérer le CODE_URL spécifique à l'opérateur
    const operatorInfo = MypvitSecretService.getOperatorInfo(params.phoneNumber || '')
    const codeUrl = operatorInfo.codeUrl
    
    console.log(`🔗 CODE_URL pour cet opérateur: ${codeUrl}`)
    
    // 🔐 OBTENIR LE SECRET
    const secret = await MypvitSecretService.getSecret(params.phoneNumber)
    
    if (!secret) {
      throw new Error('Impossible d\'obtenir un secret valide pour le QR Code')
    }
    
    console.log('🔐 Secret obtenu (premiers caractères):', secret.substring(0, 20) + '...')
    
    // ✅ Construction des paramètres query (pour GET)
    const queryParams: Record<string, string> = {
      accountOperationCode: params.accountOperationCode,
      terminalId: params.terminalId,
      callbackUrlCode: params.callbackUrlCode
    }
    
    // Ajouter amount et reference si fournis (QR dynamique)
    if (params.amount) {
      queryParams.amount = params.amount.toString()
    }
    if (params.reference) {
      queryParams.reference = params.reference
    }
    
    console.log('📤 Query params:', JSON.stringify(queryParams, null, 2))
    
    try {
      // ✅ METHODE GET - URL CORRECTE : /v2/{codeUrl}/generate-qr-code
      const response = await axios.get(
        `${this.BASE_URL}/${codeUrl}/generate-qr-code`,
        {
          headers: {
            'Accept': 'application/json',
            'X-Secret': secret
          },
          params: queryParams
        }
      )
      
      console.log('✅ [QRCodeService] Réponse reçue:', {
        status: response.data?.status,
        hasData: !!response.data?.data,
        referenceId: response.data?.reference_id,
        merchantReferenceId: response.data?.merchant_reference_id
      })
      
      return response.data
      
    } catch (error: any) {
      console.error('❌ [QRCodeService] Erreur:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message
      })
      
      if (error.response?.status === 401) {
        console.log('🔄 401 détecté, renouvellement forcé du secret...')
        await MypvitSecretService.forceRenewal(params.phoneNumber)
        
        const newSecret = await MypvitSecretService.getSecret(params.phoneNumber)
        const retryResponse = await axios.get(
          `${this.BASE_URL}/${codeUrl}/generate-qr-code`,
          {
            headers: {
              'Accept': 'application/json',
              'X-Secret': newSecret
            },
            params: queryParams
          }
        )
        return retryResponse.data
      }
      
      throw new Error(error.response?.data?.message || error.message)
    }
  }
  
  // QR Code dynamique avec montant et référence
  async generateDynamicQRCode(params: {
    accountOperationCode: string
    terminalId: string
    callbackUrlCode: string
    amount: number
    reference: string
    phoneNumber?: string
  }): Promise<QRCodeResponse> {
    return this.generateStaticQRCode({
      ...params,
      amount: params.amount,
      reference: params.reference
    })
  }
}

export default new MypvitQRCodeService()
