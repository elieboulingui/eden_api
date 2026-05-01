// app/services/mypvit_qrcode_service.ts
import axios from 'axios'
import MypvitSecretService from './mypvit_secret_service.js'

interface QRCodeResponse {
  status: string
  data: string
  reference_id?: string
  merchant_reference_id?: string
  message?: string
}

export class MypvitQRCodeService {
  private readonly BASE_URL = 'https://api.mypvit.pro/v2'
  private readonly MAX_REFERENCE_LENGTH = 20
  
  /**
   * Génère un QR Code (statique ou dynamique)
   * @param params - Paramètres de génération
   * @returns QRCodeResponse
   */
  async generateQRCode(params: {
    accountOperationCode: string
    terminalId: string
    callbackUrlCode: string
    amount?: number
    reference?: string
    phoneNumber?: string
  }): Promise<QRCodeResponse> {
    
    console.log('📷 [QRCodeService] ========== DÉBUT GÉNÉRATION QR CODE ==========')
    console.log('📷 Paramètres reçus:', JSON.stringify(params, null, 2))
    
    // Récupérer le CODE_URL spécifique à l'opérateur
    const operatorInfo = MypvitSecretService.getOperatorInfo(params.phoneNumber || '')
    const codeUrl = operatorInfo.codeUrl
    
    console.log(`🔗 CODE_URL pour l'opérateur: ${codeUrl}`)
    console.log(`🔑 accountOperationCode: ${params.accountOperationCode}`)
    console.log(`🏷️ terminalId: ${params.terminalId}`)
    console.log(`🔗 callbackUrlCode: ${params.callbackUrlCode}`)
    console.log(`💰 amount: ${params.amount || 'non fourni (QR statique)'}`)
    
    // ========== VALIDATION ET TRONCATURE DE LA RÉFÉRENCE ==========
    if (params.reference) {
      const originalLength = params.reference.length
      console.log(`📝 reference originale (longueur: ${originalLength}): "${params.reference}"`)
      
      if (originalLength > this.MAX_REFERENCE_LENGTH) {
        // Tronquer à 20 caractères
        const originalRef = params.reference
        params.reference = params.reference.substring(0, this.MAX_REFERENCE_LENGTH)
        
        console.warn(`⚠️ RÉFÉRENCE TRONQUÉE CAR DÉPASSE LA LIMITE DE ${this.MAX_REFERENCE_LENGTH} CARACTÈRES:`)
        console.warn(`   Longueur originale: ${originalLength}`)
        console.warn(`   Avant: "${originalRef}"`)
        console.warn(`   Après: "${params.reference}"`)
      } else {
        console.log(`✅ Référence valide (${originalLength} caractères)`)
      }
    } else {
      console.log('📝 reference: non fournie')
    }
    
    // Obtenir le secret
    const secret = await MypvitSecretService.getSecret(params.phoneNumber)
    
    if (!secret) {
      throw new Error('Impossible d\'obtenir un secret valide pour le QR Code')
    }
    
    console.log('🔐 Secret obtenu (premiers caractères):', secret.substring(0, 20) + '...')
    
    // Construction des paramètres query
    const queryParams: Record<string, string> = {
      accountOperationCode: params.accountOperationCode,
      terminalId: params.terminalId,
      callbackUrlCode: params.callbackUrlCode
    }
    
    // Ajouter amount si fourni (QR dynamique)
    if (params.amount && params.amount > 0) {
      queryParams.amount = params.amount.toString()
      console.log(`💰 QR dynamique avec montant: ${params.amount} FCFA`)
    } else {
      console.log('📷 QR statique (sans montant)')
    }
    
    // Ajouter reference si fournie (déjà tronquée si nécessaire)
    if (params.reference) {
      queryParams.reference = params.reference
      console.log(`📝 Référence envoyée (longueur: ${params.reference.length}): "${params.reference}"`)
    }
    
    console.log('📤 Query params envoyés:', JSON.stringify(queryParams, null, 2))
    
    // URL complète pour debug
    const fullUrl = `${this.BASE_URL}/4XWLIAKA5UFSIIYZ/generate-qr-code`
    console.log(`🌐 URL complète: ${fullUrl}`)
    
    try {
      // Requête GET vers l'API MyPVit
      const response = await axios.get(
        fullUrl,
        {
          headers: {
            'Accept': 'application/json',
            'X-Secret': secret
          },
          params: queryParams
        }
      )
      
      console.log('✅ [QRCodeService] Réponse reçue avec succès')
      console.log('📊 Status:', response.data?.status)
      console.log('🔑 reference_id:', response.data?.reference_id)
      console.log('📊 merchant_reference_id:', response.data?.merchant_reference_id)
      console.log('📊 data (premiers caractères):', response.data?.data?.substring(0, 50) + '...')
      
      return response.data
      
    } catch (error: any) {
      console.error('❌ [QRCodeService] ========== ERREUR ==========')
      console.error('❌ Status HTTP:', error.response?.status)
      console.error('❌ Message:', error.message)
      console.error('❌ Données réponse:', JSON.stringify(error.response?.data, null, 2))
      
      // Gestion des erreurs spécifiques
      if (error.response?.status === 401) {
        console.error('🔐 AUTHENTICATION_FAILED - Secret invalide ou expiré')
        console.log('🔄 Tentative de renouvellement du secret...')
        
        try {
          await MypvitSecretService.forceRenewal(params.phoneNumber)
          const newSecret = await MypvitSecretService.getSecret(params.phoneNumber)
          
          console.log('🔄 Nouvelle tentative avec secret frais...')
          const retryResponse = await axios.get(
            fullUrl,
            {
              headers: {
                'Accept': 'application/json',
                'X-Secret': newSecret
              },
              params: queryParams
            }
          )
          
          console.log('✅ Succès après renouvellement du secret')
          return retryResponse.data
        } catch (retryError: any) {
          console.error('❌ Échec après renouvellement:', retryError.message)
          throw new Error('AUTHENTICATION_FAILED: Secret invalide après renouvellement')
        }
      }
      
      if (error.response?.status === 403) {
        console.error('⛔ FORBIDDEN - Vérifiez les permissions du compte')
        console.error('   - Compte opération actif?')
        console.error('   - Service actif pour cet opérateur?')
        console.error('   - Type de transaction autorisé?')
        throw new Error(`FORBIDDEN: ${error.response?.data?.message || 'Accès interdit'}`)
      }
      
      if (error.response?.status === 404) {
        console.error('🔍 NOT_FOUND - Vérifiez:')
        console.error('   - CODE_URL est-il valide?')
        console.error('   - API endpoint existe-t-il?')
        throw new Error(`NOT_FOUND: ${error.response?.data?.message || 'Ressource non trouvée'}`)
      }
      
      if (error.response?.status === 422) {
        console.error('⚠️ CONSTRAINT_VIOLATION - Vérifiez les paramètres:')
        console.error('   - accountOperationCode: doit être un code valide chez MyPVit')
        console.error('   - terminalId: doit être un identifiant valide')
        console.error('   - callbackUrlCode: doit exister et être actif')
        console.error('   - amount: doit être un nombre positif (si fourni)')
        console.error('   - reference: doit être unique et ≤ 20 caractères (si fournie)')
        
        const errorData = error.response?.data
        throw new Error(`CONSTRAINT_VIOLATION: ${JSON.stringify(errorData)}`)
      }
      
      if (error.response?.status === 500) {
        console.error('💥 SERVER_ERROR - Problème côté MyPVit')
        throw new Error(`SERVER_ERROR: ${error.response?.data?.message || 'Erreur serveur MyPVit'}`)
      }
      
      // Erreur générique
      throw new Error(error.response?.data?.message || error.message || 'Erreur inconnue lors de la génération du QR Code')
    }
  }
  
  /**
   * Génère un QR Code statique (sans montant, informations fixes)
   */
  async generateStaticQR(params: {
    accountOperationCode: string
    terminalId: string
    callbackUrlCode: string
    phoneNumber?: string
  }): Promise<QRCodeResponse> {
    console.log('📷 Génération QR Code statique...')
    return this.generateQRCode({
      accountOperationCode: params.accountOperationCode,
      terminalId: params.terminalId,
      callbackUrlCode: params.callbackUrlCode,
      phoneNumber: params.phoneNumber
      // Pas de amount ni reference → QR statique
    })
  }
  
  /**
   * Génère un QR Code dynamique (avec montant et référence)
   */
  async generateDynamicQR(params: {
    accountOperationCode: string
    terminalId: string
    callbackUrlCode: string
    amount: number
    reference: string
    phoneNumber?: string
  }): Promise<QRCodeResponse> {
    console.log('📷 Génération QR Code dynamique...')
    console.log(`💰 Montant: ${params.amount} FCFA`)
    console.log(`📝 Référence originale: "${params.reference}" (longueur: ${params.reference.length})`)
    
    // Tronquer la référence si nécessaire AVANT d'appeler generateQRCode
    if (params.reference.length > this.MAX_REFERENCE_LENGTH) {
      console.warn(`⚠️ Référence sera tronquée à ${this.MAX_REFERENCE_LENGTH} caractères dans generateQRCode`)
    }
    
    return this.generateQRCode({
      accountOperationCode: params.accountOperationCode,
      terminalId: params.terminalId,
      callbackUrlCode: params.callbackUrlCode,
      amount: params.amount,
      reference: params.reference,
      phoneNumber: params.phoneNumber
    })
  }
}

export default new MypvitQRCodeService()
