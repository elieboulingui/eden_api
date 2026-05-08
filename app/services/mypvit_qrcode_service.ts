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
    console.log('🏗️ [QRCodeService] Initialisation du service')
    console.log(`📡 [QRCodeService] Base URL: ${this.BASE_URL}`)
    
    this.httpClient = axios.create({
      baseURL: this.BASE_URL,
      timeout: 30000,
      headers: {
        'User-Agent': 'EdenApp/1.0',
        'Content-Type': 'application/json'
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
      phoneNumber: options.phoneNumber || '060000000 (défaut)'
    })
    
    try {
      console.log('🔐 [QRCodeService] Récupération du secret Mypvit...')
      const secret = await MypvitSecretService.getSecret()
      console.log('✅ [QRCodeService] Secret récupéré avec succès (longueur:', secret?.length || 0, 'caractères)')
      
      console.log('📱 [QRCodeService] Génération QR Code GIMAC:', {
        accountCode: options.accountOperationCode,
        amount: options.amount,
        reference: options.reference,
        callbackUrlCode: options.callbackUrlCode
      })

      // ✅ Utiliser le callbackUrlCode dans l'URL (comme pour renew-secret)
      const url = `/4XWLIAKA5UFSIIYZ/generate-qr-code`
      
      console.log(`📡 [QRCodeService] URL complète: ${this.BASE_URL}${url}`)
      console.log(`📡 [QRCodeService] Méthode: POST`)
      
      const payload = {
        secret: secret,
        operation_account_code: options.accountOperationCode,
        terminal_id: options.terminalId,
        amount: options.amount,
        reference: options.reference,
        phone_number: options.phoneNumber || '060000000',
        currency: 'XAF'
      }
      
      console.log('📦 [QRCodeService] Payload envoyé:', {
        ...payload,
        secret: payload.secret ? '***MASQUÉ***' : 'undefined',
        operation_account_code: payload.operation_account_code,
        terminal_id: payload.terminal_id,
        amount: payload.amount,
        reference: payload.reference,
        phone_number: payload.phone_number,
        currency: payload.currency
      })
      
      console.log('⏳ [QRCodeService] Envoi de la requête...')
      const response = await this.httpClient.post(url, payload)

      console.log('✅ [QRCodeService] Réponse reçue - Status:', response.status)
      console.log('✅ [QRCodeService] Headers reçus:', JSON.stringify(response.headers, null, 2))
      
      console.log('📦 [QRCodeService] Structure de la réponse:', {
        hasData: !!response.data,
        dataKeys: response.data ? Object.keys(response.data) : [],
        status: response.status,
        statusText: response.statusText
      })

      if (!response.data) {
        console.error('❌ [QRCodeService] Pas de data dans la réponse')
        throw new Error('Réponse vide de l\'API Mypvit')
      }

      if (!response.data.qr_code) {
        console.error('❌ [QRCodeService] Pas de QR code dans la réponse:', JSON.stringify(response.data, null, 2))
        console.log('📋 [QRCodeService] Contenu de la réponse:', response.data)
        throw new Error('QR Code non généré - champ qr_code manquant')
      }

      console.log('✅ [QRCodeService] QR Code généré avec succès')
      console.log('📊 [QRCodeService] Informations retournées:', {
        qr_code_length: response.data.qr_code?.length || 0,
        reference_id: response.data.reference_id,
        transaction_id: response.data.transaction_id,
        status: response.data.status,
        message: response.data.message
      })
      
      console.log('🎉 [QRCodeService] ========== FIN GÉNÉRATION QR CODE ==========\n')
      
      return {
        data: response.data.qr_code,
        reference_id: response.data.reference_id,
        transaction_id: response.data.transaction_id
      }

    } catch (error: any) {
      console.error('\n❌ [QRCodeService] ========== ERREUR GÉNÉRATION QR CODE ==========')
      console.error('❌ [QRCodeService] Message d\'erreur:', error.message)
      console.error('❌ [QRCodeService] Code d\'erreur:', error.code)
      
      if (error.response) {
        console.error('❌ [QRCodeService] Status HTTP:', error.response.status)
        console.error('❌ [QRCodeService] Status Text:', error.response.statusText)
        console.error('❌ [QRCodeService] Headers de réponse:', JSON.stringify(error.response.headers, null, 2))
        console.error('❌ [QRCodeService] Data de réponse:', JSON.stringify(error.response.data, null, 2))
        
        // Log spécifique selon le code d'erreur
        if (error.response.status === 401) {
          console.error('🔐 [QRCodeService] Erreur 401 - Secret invalide ou expiré')
        } else if (error.response.status === 400) {
          console.error('⚠️ [QRCodeService] Erreur 400 - Paramètres invalides')
          console.error('📋 [QRCodeService] Vérifiez:', {
            accountCode: options.accountOperationCode,
            terminalId: options.terminalId,
            amount: options.amount,
            reference: options.reference
          })
        } else if (error.response.status === 500) {
          console.error('🔥 [QRCodeService] Erreur 500 - Erreur serveur Mypvit')
        }
      } else if (error.request) {
        console.error('❌ [QRCodeService] Pas de réponse reçue')
        console.error('📡 [QRCodeService] Requête envoyée à:', `${this.BASE_URL}/4XWLIAKA5UFSIIYZ/generate-qr-code`)
        console.error('⏱️ [QRCodeService] Timeout ou problème réseau')
      } else {
        console.error('❌ [QRCodeService] Erreur de configuration:', error.message)
      }
      
      console.error('📚 [QRCodeService] Stack trace:', error.stack)
      console.error('❌ [QRCodeService] ========== FIN ERREUR ==========\n')
      
      throw error
    }
  }
}

export default new MypvitQRCodeService()
