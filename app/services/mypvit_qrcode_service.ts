// app/services/mypvit_qrcode_service.ts - Version corrigée avec le bon endpoint
import axios from 'axios'
import MypvitSecretService from './mypvit_secret_service.js'

interface QRCodeOptions {
  accountOperationCode: string
  terminalId: string
  callbackUrlCode: string
  amount: number
  reference: string
  phoneNumber?: string
}

export class MypvitQRCodeService {
  private httpClient: any
  private readonly BASE_URL = 'https://api.mypvit.pro/v2'

  constructor() {
    this.httpClient = axios.create({
      baseURL: this.BASE_URL,
      timeout: 30000,
      headers: {
        'User-Agent': 'EdenApp/1.0',
        'Content-Type': 'application/json'
      }
    })
  }

  async generateQRCode(options: QRCodeOptions): Promise<any> {
    try {
      const secret = await MypvitSecretService.getSecret()
      
      console.log('📱 [QRCodeService] Génération QR Code GIMAC:', {
        accountCode: options.accountOperationCode,
        amount: options.amount,
        reference: options.reference
      })

      // ✅ Utiliser le callbackUrlCode dans l'URL (comme pour renew-secret)
      const url = `/${options.callbackUrlCode}/generate-qr-code`
      
      console.log(`📡 URL complète: ${this.BASE_URL}${url}`)

      const response = await this.httpClient.post(url, {
        secret: secret,
        operation_account_code: options.accountOperationCode,
        terminal_id: options.terminalId,
        amount: options.amount,
        reference: options.reference,
        phone_number: options.phoneNumber || '060000000',
        currency: 'XAF'
      })

      console.log('✅ [QRCodeService] Réponse reçue, status:', response.status)

      if (!response.data || !response.data.qr_code) {
        console.error('❌ Pas de QR code dans la réponse:', response.data)
        throw new Error('QR Code non généré')
      }

      return {
        data: response.data.qr_code,
        reference_id: response.data.reference_id,
        transaction_id: response.data.transaction_id
      }

    } catch (error: any) {
      console.error('❌ [QRCodeService] Erreur:', error.message)
      if (error.response) {
        console.error('❌ Status:', error.response.status)
        console.error('❌ Data:', JSON.stringify(error.response.data))
      }
      throw error
    }
  }
}

export default new MypvitQRCodeService()
