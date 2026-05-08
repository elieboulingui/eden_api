// app/services/mypvit_qrcode_service.ts - Version avec gestion d'image PNG
import axios from 'axios'
import MypvitSecretService from './mypvit_secret_services.js'

interface QRCodeOptions {
  accountOperationCode: string
  terminalId: string
  callbackUrlCode: string
  amount: number
  reference: string
  phoneNumber?: string
  returnAsImage?: boolean // ✅ Si true, retourne l'image PNG en base64
}

export class MypvitQRCodeService {
  private httpClient: any
  private readonly BASE_URL = 'https://api.mypvit.pro/v2'

  constructor() {
    console.log('🏗️ [QRCodeService] Initialisation du service')
    console.log(`📡 [QRCodeService] Base URL: ${this.BASE_URL}`)
    
    this.httpClient = axios.create({
      baseURL: this.BASE_URL,
      timeout: 30000,
      headers: {
        'User-Agent': 'EdenApp/1.0'
      }
    })
    
    console.log('✅ [QRCodeService] Service initialisé avec timeout: 30000ms')
  }

  async generateQRCode(options: QRCodeOptions): Promise<any> {
    console.log('\n🚀 [QRCodeService] ========== DÉBUT GÉNÉRATION QR CODE ==========')
    console.log('📋 [QRCodeService] Options reçues:', {
      accountOperationCode: options.accountOperationCode,
      terminalId: options.terminalId,
      callbackUrlCode: options.callbackUrlCode,
      amount: options.amount,
      reference: options.reference,
      returnAsImage: options.returnAsImage || false
    })
    
    try {
      console.log('🔐 [QRCodeService] Récupération du secret Mypvit...')
      const secret = await MypvitSecretService.getSecret()
      console.log('✅ [QRCodeService] Secret récupéré avec succès')

      const url = `/4XWLIAKA5UFSIIYZ/generate-qr-code`
      
      const params: Record<string, string> = {
        accountOperationCode: options.accountOperationCode,
        terminalId: options.terminalId,
        callbackUrlCode: options.callbackUrlCode,
      }
      
      if (options.amount && options.amount > 0) {
        params.amount = options.amount.toString()
        console.log(`💰 [QRCodeService] Montant: ${options.amount} FCFA`)
      }
      
      if (options.reference) {
        params.reference = options.reference
        console.log(`🔖 [QRCodeService] Référence: ${options.reference}`)
      }
      
      // ✅ Choix du format selon returnAsImage
      const acceptFormat = options.returnAsImage ? 'image/png' : 'application/json'
      
      console.log(`📡 [QRCodeService] URL: ${this.BASE_URL}${url}`)
      console.log(`📡 [QRCodeService] Format demandé: ${acceptFormat}`)
      console.log(`📡 [QRCodeService] Headers:`, {
        'X-Secret': '***MASQUÉ***',
        'Accept': acceptFormat
      })
      
      // ✅ Configuration selon le format attendu
      const requestConfig: any = {
        headers: {
          'X-Secret': secret,
          'Accept': acceptFormat
        },
        params: params
      }
      
      // Si on veut l'image, on dit à axios de retourner un buffer
      if (options.returnAsImage) {
        requestConfig.responseType = 'arraybuffer'
      }
      
      const response = await this.httpClient.get(url, requestConfig)

      console.log('✅ [QRCodeService] Réponse reçue - Status:', response.status)
      console.log('✅ [QRCodeService] Content-Type:', response.headers['content-type'])
      
      // ✅ Traitement selon le format
      if (options.returnAsImage) {
        // Convertir le buffer PNG en base64
        const base64Image = Buffer.from(response.data).toString('base64')
        console.log('✅ [QRCodeService] Image PNG convertie en base64')
        console.log(`📊 [QRCodeService] Taille image: ${response.data.length} bytes`)
        console.log(`📊 [QRCodeService] Taille base64: ${base64Image.length} chars`)
        
        console.log('🎉 [QRCodeService] ========== FIN (IMAGE) ==========\n')
        
        return {
          data: base64Image,
          format: 'png_base64',
          content_type: 'image/png',
          reference_id: response.headers['x-reference-id'] || null
        }
      } else {
        // Format JSON
        if (!response.data || !response.data.data) {
          console.error('❌ [QRCodeService] Pas de QR code dans la réponse')
          throw new Error('QR Code non généré')
        }
        
        console.log('✅ [QRCodeService] QR Code JSON reçu')
        console.log('🎉 [QRCodeService] ========== FIN (JSON) ==========\n')
        
        return {
          data: response.data.data,
          reference_id: response.data.reference_id,
          merchant_reference_id: response.data.merchant_reference_id,
          format: 'json'
        }
      }

    } catch (error: any) {
      console.error('\n❌ [QRCodeService] ========== ERREUR ==========')
      console.error('❌ Message:', error.message)
      
      if (error.response) {
        console.error('❌ Status:', error.response.status)
        
        // Si c'est une erreur avec du contenu (peut-être JSON d'erreur même en demandant PNG)
        if (error.response.data && !options.returnAsImage) {
          console.error('❌ Data:', JSON.stringify(error.response.data, null, 2))
        } else if (error.response.data && options.returnAsImage) {
          // Tenter de parser l'erreur même en mode binaire
          try {
            const errorText = Buffer.from(error.response.data).toString('utf8')
            console.error('❌ Error text:', errorText)
          } catch (e) {
            console.error('❌ Binary error response')
          }
        }
      }
      
      console.error('❌ ========== FIN ERREUR ==========\n')
      throw error
    }
  }
}

export default new MypvitQRCodeService()
