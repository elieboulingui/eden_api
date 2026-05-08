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

  // 🏦 GIMAC UNIQUEMENT
  private readonly GIMAC_CONFIG = {
    code: 'ACC_69FE0E1BC34B4',
    codeUrl: '6JN5J6U0NBJGKDAQ',
    password: 'Boulinguisanduku@1',
    operator: 'GIMAC_PAY'
  }

  constructor() {
    this.httpClient = axios.create({
      baseURL: this.BASE_URL,
      timeout: 30000
    })
  }

  // ============================================================
  // RENOUVELLEMENT SECRET GIMAC
  // ============================================================
  async renewForQRCode(): Promise<StoredSecret> {
    console.log('🔑 [QRCode] Renouvellement secret GIMAC...')
    console.log('🔑 [QRCode] Compte:', this.GIMAC_CONFIG.code)

    for (let i = 1; i <= 3; i++) {
      try {
        console.log(`📡 [QRCode] Tentative ${i}/3...`)

        const url = `/${this.GIMAC_CONFIG.codeUrl}/renew-secret`
        const body = new URLSearchParams()
        body.append('operationAccountCode', this.GIMAC_CONFIG.code)
        body.append('password', this.GIMAC_CONFIG.password)

        const response = await this.httpClient.post(url, body.toString(), {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        })

        console.log('✅ [QRCode] Réponse reçue')

        if (!response.data?.secret) {
          throw new Error('Secret non reçu')
        }

        this.qrCodeSecret = {
          key: response.data.secret,
          expiresAt: DateTime.now().plus({ seconds: response.data.expires_in || 86400 }),
          accountCode: this.GIMAC_CONFIG.code,
          renewedAt: DateTime.now(),
        }

        console.log('✅ [QRCode] Secret GIMAC renouvelé')
        return this.qrCodeSecret

      } catch (error: any) {
        console.error(`❌ [QRCode] Erreur tentative ${i}/3:`, error.message)
        if (i < 3) {
          await new Promise(resolve => setTimeout(resolve, 2000 * i))
        }
      }
    }
    throw new Error('Échec renouvellement secret QR Code GIMAC')
  }

  // ✅ Récupérer le secret QR Code
  async getQRCodeSecret(): Promise<string> {
    if (this.qrCodeSecret && this.qrCodeSecret.expiresAt > DateTime.now()) {
      console.log('🔐 [QRCode] Secret GIMAC valide')
      return this.qrCodeSecret.key
    }
    console.log('⚠️ [QRCode] Secret expiré, renouvellement...')
    const newSecret = await this.renewForQRCode()
    return newSecret.key
  }

  // ✅ Force le renouvellement
  async forceRenewal(): Promise<StoredSecret> {
    console.log('🔄 Renouvellement forcé GIMAC...')
    this.qrCodeSecret = null
    return this.renewForQRCode()
  }

  // ✅ Infos GIMAC
  getOperatorInfo(): { operator: string, accountCode: string, codeUrl: string } {
    return {
      operator: this.GIMAC_CONFIG.operator,
      accountCode: this.GIMAC_CONFIG.code,
      codeUrl: this.GIMAC_CONFIG.codeUrl
    }
  }
}

export default new MypvitSecretService()
