// app/services/mypvit_secret_services.ts
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
  private qrCodeSecret: StoredSecret | null = null
  private readonly BASE_URL = 'https://api.mypvit.pro/v2'

  private readonly GIMAC_CONFIG = {
    code: 'ACC_69FE0E1BC34B4',
    codeUrl: '6JN5J6U0NBJGKDAQ',
    password: 'Boulinguisanduku@1',
  }

  constructor() {
    this.httpClient = axios.create({
      baseURL: this.BASE_URL,
      timeout: 30000
    })
  }

  async renewForQRCode(): Promise<StoredSecret> {
    console.log('🔑 Renouvellement secret GIMAC...')

    for (let i = 1; i <= 3; i++) {
      try {
        console.log(`📡 Tentative ${i}/3...`)

        // 🔥 Utiliser URLSearchParams pour x-www-form-urlencoded
        const body = new URLSearchParams()
        body.append('accountOperationCode', this.GIMAC_CONFIG.code)
        body.append('password', this.GIMAC_CONFIG.password)

        const response = await this.httpClient.post(
          `/${this.GIMAC_CONFIG.codeUrl}/renew-secret`,
          body.toString(),
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded'
            }
          }
        )

        console.log('✅ Réponse:', {
          account: response.data?.operation_account_code,
          expiresIn: response.data?.expires_in
        })

        if (!response.data?.secret) {
          throw new Error('Secret non reçu')
        }

        this.qrCodeSecret = {
          key: response.data.secret,
          expiresAt: DateTime.now().plus({ seconds: response.data.expires_in || 3600 }),
          accountCode: response.data.operation_account_code || this.GIMAC_CONFIG.code,
          renewedAt: DateTime.now(),
        }

        console.log('✅ Secret GIMAC renouvelé')
        return this.qrCodeSecret

      } catch (error: any) {
        console.error(`❌ Tentative ${i}/3:`, {
          status: error.response?.status,
          data: error.response?.data,
          message: error.message
        })

        if (i < 3) {
          await new Promise(resolve => setTimeout(resolve, 2000 * i))
        }
      }
    }
    throw new Error('Échec renouvellement secret GIMAC')
  }

  async getQRCodeSecret(): Promise<string> {
    if (this.qrCodeSecret && this.qrCodeSecret.expiresAt > DateTime.now()) {
      console.log('🔐 Secret GIMAC valide')
      return this.qrCodeSecret.key
    }
    console.log('⚠️ Secret expiré, renouvellement...')
    const newSecret = await this.renewForQRCode()
    return newSecret.key
  }

  async forceRenewal(): Promise<StoredSecret> {
    console.log('🔄 Renouvellement forcé GIMAC...')
    this.qrCodeSecret = null
    return this.renewForQRCode()
  }
}

export default new MypvitSecretService()
