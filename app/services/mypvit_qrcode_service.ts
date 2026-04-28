// app/services/mypvit_qrcode_service.ts
import axios from 'axios'

interface QRCodeResponse {
  status: string
  data: string
  reference_id?: string
  merchant_reference_id?: string
}

interface QRCodeParams {
  accountOperationCode: string
  amount?: string
  terminalId: string
  reference?: string
  transactionType?: string
  callbackUrlCode: string
}

export class MypvitQRCodeService {
  private readonly BASE_URL = 'https://api.mypvit.pro/v2'

  // ✅ Chaque API a son propre CODE_URL
  private readonly RENEW_SECRET_URL = '6JN5J6U0NBJGKDAQ'   // Pour /renew-secret
  private readonly QR_CODE_URL = '4XWLIAKA5UFSIIYZ'        // Pour /generate-qr-code

  private readonly ACCOUNT_CODE = 'ACC_69EFB143D4F54'
  private readonly PASSWORD = 'Boulinguisanduku@1'

  private secret: string | null = null
  private secretExpiresAt: number = 0

  /**
   * Récupère un secret valide (renouvelle si nécessaire)
   * Le secret est généré via RENEW_SECRET_URL mais fonctionne pour tous les CODE_URL
   */
  private async getSecret(): Promise<string> {
    const now = Date.now()

    if (this.secret && now < this.secretExpiresAt) {
      return this.secret
    }

    console.log('🔄 Génération secret QR...')

    const body = new URLSearchParams()
    body.append('operationAccountCode', this.ACCOUNT_CODE)
    body.append('password', this.PASSWORD)

    const response = await axios.post(
      `${this.BASE_URL}/${this.RENEW_SECRET_URL}/renew-secret`,
      body.toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    )

    if (!response.data?.secret) {
      throw new Error('Secret non reçu')
    }

    this.secret = response.data.secret
    this.secretExpiresAt = now + ((response.data.expires_in || 3600) * 1000) - 60000
    console.log('✅ Secret QR prêt')
    return this.secret!  // ← AJOUT DU ! ICI
  }

  /**
   * Appel générique à l'API QR Code
   */
  private async callQRCodeAPI(params: Record<string, string>): Promise<QRCodeResponse> {
    let lastError: any

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const secret = await this.getSecret()

        const response = await axios.get<QRCodeResponse>(
          `${this.BASE_URL}/${this.QR_CODE_URL}/generate-qr-code`,
          {
            headers: {
              'X-Secret': secret,
              'Accept': 'application/json'
            },
            params
          }
        )

        return response.data

      } catch (error: any) {
        lastError = error
        const errData = error.response?.data
        const errCode = errData?.status_code

        console.error(`❌ Tentative ${attempt}:`, {
          code: errCode,
          error: errData?.error,
          message: errData?.message
        })

        // Si AUTHENTICATION_FAILED (3100) → renouveler le secret et réessayer
        if (errCode === 3100 && attempt === 1) {
          console.log('🔄 Secret invalide, renouvellement...')
          this.secret = null
          continue
        }

        // Pour les autres erreurs, ne pas réessayer
        throw new Error(errData?.message || errData?.error || error.message)
      }
    }

    throw lastError
  }

  /**
   * Génère un QR Code statique
   */
  public async generateStaticQRCode(params: Omit<QRCodeParams, 'amount' | 'reference'>): Promise<QRCodeResponse> {
    console.log('📷 QR Code statique...')

    const queryParams: Record<string, string> = {
      accountOperationCode: params.accountOperationCode || this.ACCOUNT_CODE,
      terminalId: params.terminalId || 'T001',
      callbackUrlCode: params.callbackUrlCode || '9ZOXW',
    }

    if (params.transactionType) {
      queryParams.transactionType = params.transactionType
    }

    return this.callQRCodeAPI(queryParams)
  }

  /**
   * Génère un QR Code dynamique
   */
  public async generateDynamicQRCode(
    params: Required<Pick<QRCodeParams, 'amount' | 'reference'>> & Omit<QRCodeParams, 'amount' | 'reference'>
  ): Promise<QRCodeResponse> {
    console.log('📷 QR Code dynamique...')

    const queryParams: Record<string, string> = {
      accountOperationCode: params.accountOperationCode || this.ACCOUNT_CODE,
      terminalId: params.terminalId || 'T001',
      callbackUrlCode: params.callbackUrlCode || '9ZOXW',
      amount: params.amount,
      reference: params.reference,
    }

    if (params.transactionType) {
      queryParams.transactionType = params.transactionType
    }

    return this.callQRCodeAPI(queryParams)
  }

  /**
   * Génération automatique
   */
  public async generateQRCode(params: QRCodeParams): Promise<QRCodeResponse> {
    if (params.amount && params.reference) {
      return this.generateDynamicQRCode({
        ...params,
        amount: params.amount,
        reference: params.reference,
      })
    }
    return this.generateStaticQRCode(params)
  }
}

export default new MypvitQRCodeService()
