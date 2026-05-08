// app/services/mypvit_secret_service.ts - Version GIMAC uniquement
import axios from 'axios'
import { DateTime } from 'luxon'

interface StoredSecret {
  key: string
  expiresAt: DateTime
  accountCode: string
  renewedAt: DateTime
}

export class MypvitSecretService {
  private httpClient: any
  private currentSecret: StoredSecret | null = null
  private renewalPromise: Promise<StoredSecret> | null = null
  private readonly BASE_URL = 'https://api.mypvit.pro/v2'

  // Configuration GIMAC uniquement
  private readonly GIMAC_CONFIG = {
    code: 'ACC_69FE0E1BC34B4',
    codeUrl: '6JN5J6U0NBJGKDAQ',
    password: 'Boulinguisanduku@1',
    operator: 'GIMAC_PAY'
  }

  constructor() {
    this.httpClient = axios.create({
      baseURL: this.BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    })
  }

  async renewSecret(): Promise<StoredSecret> {
    if (this.renewalPromise) {
      console.log('⏳ [SecretService] Renouvellement déjà en cours...')
      return this.renewalPromise
    }
    this.renewalPromise = this.performRenewal()
    try {
      return await this.renewalPromise
    } finally {
      this.renewalPromise = null
    }
  }

  private async performRenewal(): Promise<StoredSecret> {
    console.log(`📱 [SecretService] Opérateur: ${this.GIMAC_CONFIG.operator}`)
    console.log(`🔑 [SecretService] Compte: ${this.GIMAC_CONFIG.code}`)
    console.log(`🔗 [SecretService] CODE_URL: ${this.GIMAC_CONFIG.codeUrl}`)

    for (let i = 1; i <= 3; i++) {
      try {
        console.log(`📡 [SecretService] Tentative ${i}/3...`)

        const url = `/${this.GIMAC_CONFIG.codeUrl}/renew-secret`
        const body = new URLSearchParams()
        body.append('operationAccountCode', this.GIMAC_CONFIG.code)
        body.append('password', this.GIMAC_CONFIG.password)

        const response = await this.httpClient.post(url, body.toString())

        console.log('✅ [SecretService] Réponse reçue')
        console.log('✅ Secret présent:', !!response.data?.secret)

        if (!response.data?.secret) {
          throw new Error('Secret non reçu')
        }

        const secret: StoredSecret = {
          key: response.data.secret,
          expiresAt: DateTime.now().plus({ seconds: response.data.expires_in || 86400 }),
          accountCode: response.data.operation_account_code || this.GIMAC_CONFIG.code,
          renewedAt: DateTime.now(),
        }

        this.currentSecret = secret
        console.log(`✅ Secret renouvelé pour ${this.GIMAC_CONFIG.operator}`)
        return secret

      } catch (error: any) {
        console.error(`❌ Erreur tentative ${i}/3:`)
        console.error('❌ Status:', error.response?.status)
        console.error('❌ Message:', error.message)
        
        if (error.response?.data) {
          console.error('❌ Détails API:', JSON.stringify(error.response.data))
        }

        if (i < 3) {
          const waitTime = 2000 * i
          console.log(`⏳ Nouvelle tentative dans ${waitTime}ms...`)
          await new Promise(resolve => setTimeout(resolve, waitTime))
        }
      }
    }
    throw new Error(`Secret renewal failed pour GIMAC`)
  }

  async getSecret(): Promise<string> {
    try {
      if (this.currentSecret && this.currentSecret.expiresAt > DateTime.now()) {
        const remaining = Math.floor(this.currentSecret.expiresAt.diff(DateTime.now(), 'seconds').seconds)
        console.log(`🔐 Secret GIMAC valide, expire dans ${remaining}s`)
        return this.currentSecret.key
      }
      console.log('⚠️ Secret expiré, renouvellement...')
      const newSecret = await this.renewSecret()
      return newSecret.key
    } catch (error: any) {
      console.error('❌ Erreur getSecret:', error.message)
      throw error
    }
  }

  async forceRenewal(): Promise<StoredSecret> {
    console.log('🔄 Renouvellement forcé GIMAC...')
    this.currentSecret = null
    this.renewalPromise = null
    return this.renewSecret()
  }
}

export default new MypvitSecretService()
