// app/services/mypvit_qrcode_service.ts
import axios from 'axios'
import MypvitSecretService from './mypvit_secret_services.js'

const BASE_URL = 'https://api.mypvit.pro/v2'
const GIMAC_CODE_URL = '6JN5J6U0NBJGKDAQ'

export default class MypvitQRCodeService {

  static async generateQRCode(params: {
    accountOperationCode: string
    terminalId: string
    callbackUrlCode: string
    amount?: number
    reference?: string
    phoneNumber?: string
  }): Promise<any> {

    // 🔥 Récupérer le secret GIMAC
    const secret = await MypvitSecretService.getQRCodeSecret()
    console.log('🔐 Secret:', secret.substring(0, 20) + '...')

    // 🔥 Construire l'URL avec les query params (comme la doc)
    const url = `${BASE_URL}/${GIMAC_CODE_URL}/generate-qr-code`

    const queryParams: Record<string, string> = {
      accountOperationCode: params.accountOperationCode,
      terminalId: params.terminalId,
      callbackUrlCode: params.callbackUrlCode,
    }
    if (params.amount) queryParams.amount = params.amount.toString()
    if (params.reference) queryParams.reference = params.reference

    console.log('🔑 URL:', url)
    console.log('🔑 Params:', queryParams)

    try {
      const response = await axios.get(url, {
        headers: {
          'X-Secret': secret,
          'Accept': 'application/json'
        },
        params: queryParams,
        timeout: 30000
      })

      console.log('✅ QR Code:', response.data?.status)
      
      if (response.data?.status !== 'SUCCESS') {
        throw new Error(response.data?.message || 'Échec génération QR')
      }

      return response.data

    } catch (error: any) {
      console.error('❌ Erreur QR Code:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message
      })
      throw error
    }
  }
}
