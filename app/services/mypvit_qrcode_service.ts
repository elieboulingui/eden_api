import axios from 'axios'
import MypvitSecretService from './mypvit_secret_service.js'

const MYPVIT_CODE_URL = 'MTX1MTKQQCULKA3W'

interface QRCodeResponse {
  status: string
  data: string  // Base64 du QR code
  reference_id: string
  message?: string
}

export class MypvitQRCodeService {
  private readonly BASE_URL = 'https://api.mypvit.pro'
  
  async generateStaticQRCode(params: {
    accountOperationCode: string
    terminalId: string
    callbackUrlCode: string
    phoneNumber?: string  // Ajouté pour le secret
  }): Promise<QRCodeResponse> {
    
    console.log('📷 [QRCodeService] Génération QR Code...')
    console.log('   accountOperationCode:', params.accountOperationCode)
    console.log('   terminalId:', params.terminalId)
    console.log('   callbackUrlCode:', params.callbackUrlCode)
    
    // 🔐 OBTENIR LE SECRET FRAIS
    const secret = await MypvitSecretService.getSecret(params.phoneNumber)
    
    if (!secret) {
      throw new Error('Impossible d\'obtenir un secret valide pour le QR Code')
    }
    
    console.log('🔐 Secret obtenu (premiers caractères):', secret.substring(0, 20) + '...')
    
    const payload = {
      account_operation_code: params.accountOperationCode,
      terminal_id: params.terminalId,
      callback_url_code: params.callbackUrlCode
    }
    
    console.log('📤 Payload QR:', JSON.stringify(payload, null, 2))
    
    try {
      const response = await axios.post(
        `${this.BASE_URL}/${MYPVIT_CODE_URL}/static-qr`,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Secret': secret,
            'X-Callback-MediaType': 'application/json'
          }
        }
      )
      
      console.log('✅ [QRCodeService] Réponse reçue:', {
        status: response.data?.status,
        hasData: !!response.data?.data,
        referenceId: response.data?.reference_id
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
        // Forcer le renouvellement du secret
        console.log('🔄 401 détecté, renouvellement forcé du secret...')
        await MypvitSecretService.forceRenewal(params.phoneNumber)
        
        // Réessayer une fois avec le nouveau secret
        const newSecret = await MypvitSecretService.getSecret(params.phoneNumber)
        const retryResponse = await axios.post(
          `${this.BASE_URL}/${MYPVIT_CODE_URL}/static-qr`,
          payload,
          {
            headers: {
              'Content-Type': 'application/json',
              'X-Secret': newSecret,
              'X-Callback-MediaType': 'application/json'
            }
          }
        )
        return retryResponse.data
      }
      
      throw new Error(error.response?.data?.message || error.message)
    }
  }
}

export default new MypvitQRCodeService()
