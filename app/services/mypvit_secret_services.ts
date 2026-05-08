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
      timeout: 30000,
      // 🔥 Ajouter un User-Agent
      headers: {
        'User-Agent': 'EdenApp/1.0'
      }
    })
  }

  async renewForQRCode(): Promise<StoredSecret> {
    const url = `/${this.GIMAC_CONFIG.codeUrl}/renew-secret`
    const body = new URLSearchParams()
    body.append('accountOperationCode', this.GIMAC_CONFIG.code)
    body.append('password', this.GIMAC_CONFIG.password)

    console.log('🔑 === RENOUVELLEMENT SECRET ===')
    console.log('🔑 URL complète:', `${this.BASE_URL}${url}`)
    console.log('🔑 Code compte:', this.GIMAC_CONFIG.code)
    console.log('🔑 Password présent:', !!this.GIMAC_CONFIG.password)
    console.log('🔑 Body:', body.toString())

    for (let i = 1; i <= 3; i++) {
      try {
        console.log(`📡 Tentative ${i}/3...`)

        const response = await this.httpClient.post(url, body.toString(), {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        })

        console.log('✅ Statut HTTP:', response.status)
        console.log('✅ Réponse brute:', JSON.stringify(response.data))

        if (!response.data?.secret) {
          throw new Error('Secret non reçu dans la réponse')
        }

        this.qrCodeSecret = {
          key: response.data.secret,
          expiresAt: DateTime.now().plus({ seconds: response.data.expires_in || 3600 }),
          accountCode: response.data.operation_account_code || this.GIMAC_CONFIG.code,
          renewedAt: DateTime.now(),
        }

        console.log('✅ Secret GIMAC renouvelé avec succès')
        return this.qrCodeSecret

      } catch (error: any) {
        console.error(`❌ Erreur tentative ${i}/3:`)
        console.error('❌ Status HTTP:', error.response?.status)
        console.error('❌ Headers:', JSON.stringify(error.response?.headers))
        console.error('❌ Data:', JSON.stringify(error.response?.data))
        console.error('❌ Message:', error.message)

        if (error.response?.status === 403 || error.response?.status === 401) {
          console.error('🔴 ERREUR AUTHENTIFICATION - Vérifie le password et le codeUrl')
        }

        if (i < 3) {
          const waitTime = 2000 * i
          console.log(`⏳ Nouvelle tentative dans ${waitTime}ms...`)
          await new Promise(resolve => setTimeout(resolve, waitTime))
        }
      }
    }
    throw new Error('Échec renouvellement secret GIMAC après 3 tentatives')
  }

  async getQRCodeSecret(): Promise<string> {
    if (this.qrCodeSecret && this.qrCodeSecret.expiresAt > DateTime.now()) {
      const remaining = Math.floor(this.qrCodeSecret.expiresAt.diff(DateTime.now(), 'seconds').seconds)
      console.log(`🔐 Secret GIMAC valide, expire dans ${remaining}s`)
      return this.qrCodeSecret.key
    }
    console.log('⚠️ Secret expiré ou inexistant, renouvellement...')
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
