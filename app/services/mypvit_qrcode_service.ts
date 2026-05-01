// app/services/mypvit_qrcode_service.ts
import axios from 'axios'
import MypvitSecretService from './mypvit_secret_service.js'

interface QRCodeResponse {
  status: string
  data: string
  reference_id?: string
  merchant_reference_id?: string
}

export class MypvitQRCodeService {
  private readonly BASE_URL = 'https://api.mypvit.pro/v2'
  
  async generateQRCode(params: {
    accountOperationCode: string
    terminalId: string
    callbackUrlCode: string
    amount?: number
    reference?: string
    phoneNumber?: string
  }): Promise<QRCodeResponse> {
    
    console.log('📷 [QRCodeService] Génération QR Code...')
    
    const operatorInfo = MypvitSecretService.getOperatorInfo(params.phoneNumber || '')
    const codeUrl = operatorInfo.codeUrl
    
    console.log(`🔗 CODE_URL: ${codeUrl}`)
    console.log(`🔑 accountOperationCode: ${params.accountOperationCode}`)
    console.log(`🏷️ terminalId: ${params.terminalId}`)
    console.log(`💰 amount: ${params.amount || 'statique'}`)
    
    const secret = await MypvitSecretService.getSecret(params.phoneNumber)
    
    if (!secret) {
      throw new Error('Impossible d\'obtenir un secret valide')
    }
    
    // Paramètres query
    const queryParams: Record<string, string> = {
      accountOperationCode: params.accountOperationCode,
      terminalId: params.terminalId,
      callbackUrlCode: params.callbackUrlCode
    }
    
    if (params.amount) {
      queryParams.amount = params.amount.toString()
    }
    if (params.reference) {
      queryParams.reference = params.reference
    }
    
    console.log('📤 Query params:', queryParams)
    
    try {
      // ✅ GET sur /v2/{codeUrl}/generate-qr-code
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
      
      console.log('✅ Réponse:', response.data)
      return response.data
      
    } catch (error: any) {
      console.error('❌ Erreur:', error.response?.data || error.message)
      throw new Error(error.response?.data?.message || error.message)
    }
  }
}

export default new MypvitQRCodeService()
