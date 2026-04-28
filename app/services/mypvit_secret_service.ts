// app/services/mypvit_secret_service.ts
import axios from 'axios'
import { DateTime } from 'luxon'

interface StoredSecret {
  key: string
  expiresAt: DateTime
  accountCode: string
  renewedAt: DateTime
}

interface AccountConfig {
  code: string        // ACC_... pour operationAccountCode dans le body
  codeUrl: string     // CODE_URL pour l'URL (6JN5J6U0NBJGKDAQ)
  password: string
  operator: string
}

export class MypvitSecretService {
  private httpClient: any
  private currentSecret: StoredSecret | null = null
  private renewalPromise: Promise<StoredSecret> | null = null
  private readonly BASE_URL = 'https://api.mypvit.pro/v2'

  // Configuration des comptes
  private readonly ACCOUNTS: Record<string, AccountConfig> = {
    '07': { // AIRTEL
      code: 'ACC_69EFB0E02FCA3',
      codeUrl: '6JN5J6U0NBJGKDAQ',
      password: 'Boulinguisanduku@1',
      operator: 'AIRTEL_MONEY'
    },
    '06': { // LIBERTIS
      code: 'ACC_69EFB143D4F54',
      codeUrl: '6JN5J6U0NBJGKDAQ',
      password: 'Boulinguisanduku@1',
      operator: 'LIBERTIS'
    }
  }

  constructor() {
    this.httpClient = axios.create({
      baseURL: this.BASE_URL,
      timeout: 30000
    })
  }

  /**
   * Détecte l'opérateur selon le numéro de téléphone
   */
  private detectOperator(phoneNumber?: string): string {
    if (!phoneNumber) return 'default'

    // Nettoyer le numéro
    const cleanNumber = phoneNumber.replace(/\D/g, '')

    if (cleanNumber.startsWith('07')) return '07'
    if (cleanNumber.startsWith('06')) return '06'

    return 'default' // MOOV par défaut
  }

  /**
   * Récupère la configuration du compte selon l'opérateur
   */
  private getAccountConfig(phoneNumber?: string): AccountConfig {
    const operator = this.detectOperator(phoneNumber)
    return this.ACCOUNTS[operator]
  }

  async renewSecret(phoneNumber?: string): Promise<StoredSecret> {
    if (this.renewalPromise) return this.renewalPromise
    this.renewalPromise = this.performRenewal(phoneNumber)
    try {
      return await this.renewalPromise
    } finally {
      this.renewalPromise = null
    }
  }

  private async performRenewal(phoneNumber?: string): Promise<StoredSecret> {
    const accountConfig = this.getAccountConfig(phoneNumber)

    console.log(`📱 [SecretService] Opérateur détecté: ${accountConfig.operator}`)
    console.log(`🔑 [SecretService] Compte: ${accountConfig.code}`)
    console.log(`🔗 [SecretService] CODE_URL: ${accountConfig.codeUrl}`)

    for (let i = 1; i <= 3; i++) {
      try {
        console.log(`📡 [SecretService] Tentative ${i}/3 - Renouvellement pour ${accountConfig.operator}...`)

        // ✅ CODE_URL dans l'URL, PAS le code compte
        const url = `/${accountConfig.codeUrl}/renew-secret`

        // ✅ code compte dans le body
        const body = new URLSearchParams()
        body.append('operationAccountCode', accountConfig.code)
        body.append('password', accountConfig.password)

        const response = await this.httpClient.post(url, body.toString(), {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        })

        console.log('✅ [SecretService] Réponse reçue:', {
          operator: accountConfig.operator,
          hasSecret: !!response.data?.secret,
          expiresIn: response.data?.expires_in
        })

        if (!response.data?.secret) {
          throw new Error('Secret non reçu dans la réponse')
        }

        const secret: StoredSecret = {
          key: response.data.secret,
          expiresAt: DateTime.now().plus({ seconds: response.data.expires_in || 86400 }),
          accountCode: response.data.operation_account_code || accountConfig.code,
          renewedAt: DateTime.now(),
        }

        this.currentSecret = secret
        console.log(`✅ [SecretService] Secret renouvelé avec succès pour ${accountConfig.operator}`)
        console.log('📅 Expire le:', secret.expiresAt.toFormat('dd/MM/yyyy HH:mm:ss'))

        return secret

      } catch (error: any) {
        console.error(`❌ [SecretService] Erreur tentative ${i}/3 pour ${accountConfig.operator}:`, {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          message: error.message
        })

        if (i < 3) {
          const waitTime = 2000 * i
          console.log(`⏳ Nouvelle tentative dans ${waitTime}ms...`)
          await new Promise(resolve => setTimeout(resolve, waitTime))
        }
      }
    }
    throw new Error(`Secret renewal failed pour ${accountConfig.operator} après 3 tentatives`)
  }

  async getSecret(phoneNumber?: string): Promise<string> {
    try {
      if (this.currentSecret && this.currentSecret.expiresAt > DateTime.now()) {
        const remaining = Math.floor(this.currentSecret.expiresAt.diff(DateTime.now(), 'seconds').seconds)
        console.log(`🔐 [SecretService] Secret valide, expire dans ${remaining} secondes`)
        return this.currentSecret.key
      }

      console.log('⚠️ [SecretService] Secret expiré ou inexistant, renouvellement...')
      const newSecret = await this.renewSecret(phoneNumber)
      return newSecret.key
    } catch (error: any) {
      console.error('❌ [SecretService] Erreur getSecret:', error.message)
      throw error
    }
  }

  async forceRenewal(phoneNumber?: string): Promise<StoredSecret> {
    console.log('🔄 [SecretService] Renouvellement forcé...')
    this.currentSecret = null
    this.renewalPromise = null
    return this.renewSecret(phoneNumber)
  }

  /**
   * Récupère les informations de l'opérateur pour un numéro donné
   */
  getOperatorInfo(phoneNumber: string): { operator: string, accountCode: string, codeUrl: string } {
    const config = this.getAccountConfig(phoneNumber)
    return {
      operator: config.operator,
      accountCode: config.code,
      codeUrl: config.codeUrl
    }
  }
}

export default new MypvitSecretService()
