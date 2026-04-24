// app/services/mypvit_secret_service.ts
import axios from 'axios'
import { DateTime } from 'luxon'

interface StoredSecret {
  key: string; expiresAt: DateTime; accountCode: string; renewedAt: DateTime
}

export class MypvitSecretService {
  private httpClient: any
  private currentSecret: StoredSecret | null = null
  private renewalPromise: Promise<StoredSecret> | null = null
  private readonly BASE_URL = 'https://api.mypvit.pro/v2'
  private readonly CODE_URL = 'TEBSBVJBBWEGGUES'
  private readonly ACCOUNT_CODE = 'ACC_69EA59CBC7495'
  private readonly PASSWORD = 'Boulinguisanduku@1'

  constructor() {
    this.httpClient = axios.create({ baseURL: this.BASE_URL, timeout: 10000, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
  }

  async renewSecret(): Promise<StoredSecret> {
    if (this.renewalPromise) return this.renewalPromise
    this.renewalPromise = this.performRenewal()
    try { return await this.renewalPromise } finally { this.renewalPromise = null }
  }

  private async performRenewal(): Promise<StoredSecret> {
    for (let i = 1; i <= 3; i++) {
      try {
        const res = await this.httpClient.post(`/${this.CODE_URL}/renew-secret`,
          new URLSearchParams({ operationAccountCode: this.ACCOUNT_CODE, password: this.PASSWORD }).toString()
        )
        const s: StoredSecret = {
          key: res.data.secret,
          expiresAt: DateTime.now().plus({ seconds: res.data.expires_in }),
          accountCode: res.data.operation_account_code,
          renewedAt: DateTime.now(),
        }
        this.currentSecret = s
        return s
      } catch (e: any) {
        if (i < 3) await new Promise(r => setTimeout(r, 2000 * i))
      }
    }
    throw new Error('Secret renewal failed')
  }

  async getSecret(): Promise<string> {
    if (this.currentSecret && this.currentSecret.expiresAt > DateTime.now()) return this.currentSecret.key
    return (await this.renewSecret()).key
  }

  async forceRenewal(): Promise<StoredSecret> { return this.renewSecret() }
  destroy(): void { }
}

export default new MypvitSecretService()