import axios from 'axios'
import { DateTime } from 'luxon'

interface StoredSecret {
  key: string
  expiresAt: DateTime
  accountCode: string
  renewedAt: DateTime
}

interface AccountConfig {
  code: string
  codeUrl: string
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
    '07': {
      code: 'ACC_69EFB0E02FCA3',
      codeUrl: '6JN5J6U0NBJGKDAQ',
      password: 'Boulinguisanduku@1',
      operator: 'AIRTEL_MONEY'
    },
    '06': {
      code: 'ACC_69EFB143D4F54',
      codeUrl: '6JN5J6U0NBJGKDAQ',
      password: 'Boulinguisanduku@1',
      operator: 'MOOV_MONEY'
    },
    // ✅ AJOUTER GIMAC
    'gimac': {
      code: 'ACC_69FE0E1BC34B4',
      codeUrl: '6JN5J6U0NBJGKDAQ',
      password: 'Boulinguisanduku@1',
      operator: 'GIMAC_PAY'
    }
  }

  constructor() {
    this.httpClient = axios.create({
      baseURL: this.BASE_URL,
      timeout: 30000
    })
  }

  private detectOperator(phoneNumber?: string): string {
    if (!phoneNumber) return 'gimac'  // ✅ GIMAC par défaut

    const cleanNumber = phoneNumber.replace(/\D/g, '')
    let local = cleanNumber
    if (local.startsWith('241')) local = local.substring(3)
    if (local.startsWith('0')) local = local.substring(1)

    if (local.startsWith('07') || local.startsWith('7')) return '07'  // AIRTEL
    if (local.startsWith('06') || local.startsWith('6')) return '06'  // MOOV
    
    return 'gimac'  // ✅ GIMAC pour tout le reste
  }

  private getAccountConfig(phoneNumber?: string): AccountConfig {
    const operator = this.detectOperator(phoneNumber)
    return this.ACCOUNTS[operator] || this.ACCOUNTS['gimac']
  }

  async renewSecret(phoneNumber?: string): Promise<StoredSecret> {
    if (this.renewalPromise) {
      console.log('⏳ [SecretService] Renouvellement déjà en cours...')
      return this.renewalPromise
    }
    this.renewalPromise = this.performRenewal(phoneNumber)
    try {
      return await this.renewalPromise
    } finally {
      this.renewalPromise = null
    }
  }

  private async performRenewal(phoneNumber?: string): Promise<StoredSecret> {
    const accountConfig = this.getAccountConfig(phoneNumber)

    console.log(`📱 [SecretService] Opérateur: ${accountConfig.operator}`)
    console.log(`🔑 [SecretService] Compte: ${accountConfig.code}`)
    console.log(`🔗 [SecretService] CODE_URL: ${accountConfig.codeUrl}`)

    for (let i = 1; i <= 3; i++) {
      try {
        console.log(`📡 [SecretService] Tentative ${i}/3...`)

        const url = `/${accountConfig.codeUrl}/renew-secret`
        const body = new URLSearchParams()
        body.append('operationAccountCode', accountConfig.code)
        body.append('password', accountConfig.password)

        const response = await this.httpClient.post(url, body.toString(), {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        })

        console.log('✅ [SecretService] Réponse:', {
          operator: accountConfig.operator,
          hasSecret: !!response.data?.secret
        })

        if (!response.data?.secret) {
          throw new Error('Secret non reçu')
        }

        const secret: StoredSecret = {
          key: response.data.secret,
          expiresAt: DateTime.now().plus({ seconds: response.data.expires_in || 86400 }),
          accountCode: response.data.operation_account_code || accountConfig.code,
          renewedAt: DateTime.now(),
        }

        this.currentSecret = secret
        console.log(`✅ Secret renouvelé pour ${accountConfig.operator}`)
        return secret

      } catch (error: any) {
        console.error(`❌ Erreur tentative ${i}/3:`, {
          status: error.response?.status,
          message: error.message
        })

        if (i < 3) {
          const waitTime = 2000 * i
          console.log(`⏳ Nouvelle tentative dans ${waitTime}ms...`)
          await new Promise(resolve => setTimeout(resolve, waitTime))
        }
      }
    }
    throw new Error(`Secret renewal failed pour ${accountConfig.operator}`)
  }

  async getSecret(phoneNumber?: string): Promise<string> {
    try {
      if (this.currentSecret && this.currentSecret.expiresAt > DateTime.now()) {
        return this.currentSecret.key
      }
      console.log('⚠️ Secret expiré, renouvellement...')
      const newSecret = await this.renewSecret(phoneNumber)
      return newSecret.key
    } catch (error: any) {
      console.error('❌ Erreur getSecret:', error.message)
      throw error
    }
  }

  async forceRenewal(phoneNumber?: string): Promise<StoredSecret> {
    console.log('🔄 Renouvellement forcé...')
    this.currentSecret = null
    this.renewalPromise = null
    return this.renewSecret(phoneNumber)
  }

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
