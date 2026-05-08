// app/services/mypvit_qrcode_service.ts - Version corrigée avec GET
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
        'Accept': 'application/json'
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
      phoneNumber: options.phoneNumber || 'non fourni'
    })
    
    try {
      console.log('🔐 [QRCodeService] Récupération du secret Mypvit...')
      const secret = await MypvitSecretService.getSecret()
      console.log('✅ [QRCodeService] Secret récupéré avec succès')

      // ✅ Construction de l'URL avec les paramètres en query string (GET)
      const codeUrl = options.callbackUrlCode // Le codeUrl du marchand
      const url = `/4XWLIAKA5UFSIIYZ/generate-qr-code`
      
      // ✅ Paramètres query (comme dans la doc)
      const params: Record<string, string> = {
        accountOperationCode: options.accountOperationCode,
        terminalId: options.terminalId,
        callbackUrlCode: options.callbackUrlCode,
      }
      
      // Ajouter amount et reference si fournis (QR Code dynamique)
      if (options.amount && options.amount > 0) {
        params.amount = options.amount.toString()
        console.log(`💰 [QRCodeService] QR Code dynamique avec montant: ${options.amount} FCFA`)
      } else {
        console.log('📦 [QRCodeService] QR Code statique (sans montant)')
      }
      
      if (options.reference) {
        params.reference = options.reference
        console.log(`🔖 [QRCodeService] Référence: ${options.reference}`)
      }
      
      console.log(`📡 [QRCodeService] URL: ${this.BASE_URL}${url}`)
      console.log(`📡 [QRCodeService] Méthode: GET`)
      console.log(`📡 [QRCodeService] Headers:`, {
        'X-Secret': '***MASQUÉ***',
        'Accept': 'application/json'
      })
      console.log(`📡 [QRCodeService] Query params:`, params)
      
      // ✅ Utilisation de GET avec headers et params
      const response = await this.httpClient.get(url, {
        headers: {
          'X-Secret': secret,
          'Accept': 'application/json'
        },
        params: params
      })

      console.log('✅ [QRCodeService] Réponse reçue - Status:', response.status)
      
      if (!response.data) {
        console.error('❌ [QRCodeService] Pas de data dans la réponse')
        throw new Error('Réponse vide de l\'API Mypvit')
      }

      console.log('📦 [QRCodeService] Structure de la réponse:', {
        status: response.data.status,
        hasData: !!response.data.data,
        hasReferenceId: !!response.data.reference_id,
        dataLength: response.data.data?.length || 0
      })

      if (response.data.status !== 'SUCCESS') {
        console.error('❌ [QRCodeService] Statut non SUCCESS:', response.data.status)
        throw new Error(`Mypvit error: ${response.data.status}`)
      }

      if (!response.data.data) {
        console.error('❌ [QRCodeService] Pas de QR code dans la réponse:', JSON.stringify(response.data, null, 2))
        throw new Error('QR Code non généré - champ data manquant')
      }

      console.log('✅ [QRCodeService] QR Code généré avec succès')
      console.log('📊 [QRCodeService] Informations retournées:', {
        qr_code_length: response.data.data?.length || 0,
        reference_id: response.data.reference_id,
        merchant_reference_id: response.data.merchant_reference_id,
        status: response.data.status
      })
      
      console.log('🎉 [QRCodeService] ========== FIN GÉNÉRATION QR CODE ==========\n')
      
      return {
        data: response.data.data,
        reference_id: response.data.reference_id,
        merchant_reference_id: response.data.merchant_reference_id,
        status: response.data.status
      }

    } catch (error: any) {
      console.error('\n❌ [QRCodeService] ========== ERREUR GÉNÉRATION QR CODE ==========')
      console.error('❌ [QRCodeService] Message d\'erreur:', error.message)
      
      if (error.response) {
        console.error('❌ [QRCodeService] Status HTTP:', error.response.status)
        console.error('❌ [QRCodeService] Data de réponse:', JSON.stringify(error.response.data, null, 2))
        
        // Analyser l'erreur selon la doc Mypvit
        const errorCode = error.response.data?.code
        const errorMessage = error.response.data?.message
        
        if (errorCode) {
          console.error(`📋 [QRCodeService] Code erreur Mypvit: ${errorCode} - ${errorMessage}`)
          
          // Mapping des erreurs selon la doc
          const errorMap: Record<string, string> = {
            '1002': 'Callback URL invalide',
            '2000': 'Solde insuffisant sur le compte',
            '3004': 'Service non actif',
            '3018': 'Montant trop bas',
            '3019': 'Montant trop élevé',
            '4002': 'Compte d\'opération non trouvé',
            '4003': 'Service non trouvé',
            '4006': 'Transaction non trouvée',
            '5000': 'Référence déjà existante',
            '6000': 'Transaction expirée'
          }
          
          if (errorMap[errorCode]) {
            console.error(`💡 [QRCodeService] Explication: ${errorMap[errorCode]}`)
          }
        }
        
        if (error.response.status === 400) {
          console.error('⚠️ [QRCodeService] Erreur 400 - Vérifiez les paramètres:')
          console.error('   - accountOperationCode doit être valide')
          console.error('   - terminalId doit être valide')
          console.error('   - callbackUrlCode doit être actif')
          console.error('   - amount doit être un nombre positif')
        } else if (error.response.status === 401) {
          console.error('🔐 [QRCodeService] Erreur 401 - Secret invalide')
        } else if (error.response.status === 403) {
          console.error('🚫 [QRCodeService] Erreur 403 - Permission refusée')
        } else if (error.response.status === 404) {
          console.error('🔍 [QRCodeService] Erreur 404 - API ou ressource non trouvée')
        }
      } else if (error.request) {
        console.error('❌ [QRCodeService] Pas de réponse reçue')
        console.error('⏱️ [QRCodeService] Timeout ou problème réseau')
      } else {
        console.error('❌ [QRCodeService] Erreur de configuration:', error.message)
      }
      
      console.error('❌ [QRCodeService] ========== FIN ERREUR ==========\n')
      throw error
    }
  }
}

export default new MypvitQRCodeService()
