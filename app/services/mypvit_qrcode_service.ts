// app/services/mypvit_qrcode_service.ts
import axios, { type AxiosInstance, type AxiosError } from 'axios'
import MypvitSecretService from './mypvit_secret_service.js'

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

interface QRCodeError {
  date: string
  status_code: number
  error: string
  message: string
  path: string
}

export class MypvitQRCodeService {
  private httpClient: AxiosInstance
  private readonly BASE_URL = 'https://api.mypvit.pro/v2'
  private readonly CODE_URL = 'BVO9ML77GDOFNT3Y'

  constructor() {
    this.httpClient = axios.create({
      baseURL: this.BASE_URL,
      timeout: 15000,
    })

    // Intercepteur pour ajouter automatiquement le X-Secret
    this.httpClient.interceptors.request.use(async (config) => {
      const secret = await MypvitSecretService.getSecret()
      config.headers['X-Secret'] = secret
      return config
    })

    // Intercepteur pour gérer les erreurs d'authentification
    this.httpClient.interceptors.response.use(
      (response) => response,
      async (error: AxiosError<QRCodeError>) => {
        if (error.response?.status === 401 && error.config) {
          await MypvitSecretService.renewSecret()
          const secret = await MypvitSecretService.getSecret()
          error.config.headers['X-Secret'] = secret
          return this.httpClient.request(error.config)
        }
        return Promise.reject(error)
      }
    )
  }

  /**
   * Génère un QR Code statique (sans montant ni référence)
   */
  public async generateStaticQRCode(params: Omit<QRCodeParams, 'amount' | 'reference'>): Promise<QRCodeResponse> {
    try {
      console.log('📷 Génération QR Code statique...')
      console.log('📦 Params:', {
        accountOperationCode: params.accountOperationCode,
        terminalId: params.terminalId,
        callbackUrlCode: params.callbackUrlCode,
      })

      // Construire les query params
      const queryParams: any = {
        accountOperationCode: params.accountOperationCode,
        terminalId: params.terminalId,
        callbackUrlCode: params.callbackUrlCode,
      }

      if (params.transactionType) {
        queryParams.transactionType = params.transactionType
      }

      console.log('📡 URL:', `${this.BASE_URL}/${this.CODE_URL}/generate-qr-code`)
      console.log('📡 Query params:', queryParams)

      const response = await this.httpClient.get<QRCodeResponse>(
        `/${this.CODE_URL}/generate-qr-code`,
        {
          headers: {
            'Accept': 'application/json',
          },
          params: queryParams,
        }
      )

      console.log('✅ QR Code généré avec succès')
      return response.data

    } catch (error: any) {
      console.error('❌ Erreur QR Code - Status:', error.response?.status)
      console.error('❌ Erreur QR Code - Data:', JSON.stringify(error.response?.data))

      if (error.response?.data) {
        const errData = error.response.data
        throw new Error(`Failed to generate static QR code: ${errData.message || errData.error || error.message}`)
      }
      throw new Error(`Failed to generate static QR code: ${error.message}`)
    }
  }

  /**
   * Génère un QR Code dynamique (avec montant et référence)
   */
  public async generateDynamicQRCode(params: Required<Pick<QRCodeParams, 'amount' | 'reference'>> & Omit<QRCodeParams, 'amount' | 'reference'>): Promise<QRCodeResponse> {
    try {
      console.log('📷 Génération QR Code dynamique...')

      const queryParams: any = {
        accountOperationCode: params.accountOperationCode,
        terminalId: params.terminalId,
        callbackUrlCode: params.callbackUrlCode,
        amount: params.amount,
        reference: params.reference,
      }

      if (params.transactionType) {
        queryParams.transactionType = params.transactionType
      }

      const response = await this.httpClient.get<QRCodeResponse>(
        `/${this.CODE_URL}/generate-qr-code`,
        {
          headers: {
            'Accept': 'application/json',
          },
          params: queryParams,
        }
      )

      console.log('✅ QR Code dynamique généré avec succès')
      return response.data

    } catch (error: any) {
      console.error('❌ Erreur QR Code dynamique:', error.response?.data || error.message)

      if (error.response?.data) {
        const errData = error.response.data
        throw new Error(`Failed to generate dynamic QR code: ${errData.message || errData.error || error.message}`)
      }
      throw new Error(`Failed to generate dynamic QR code: ${error.message}`)
    }
  }

  /**
   * Génère un QR Code en format image PNG
   */
  public async generateQRCodeAsImage(params: QRCodeParams): Promise<Buffer> {
    try {
      const queryParams: any = {
        accountOperationCode: params.accountOperationCode,
        terminalId: params.terminalId,
        callbackUrlCode: params.callbackUrlCode,
      }

      if (params.amount) queryParams.amount = params.amount
      if (params.reference) queryParams.reference = params.reference
      if (params.transactionType) queryParams.transactionType = params.transactionType

      const response = await this.httpClient.get(
        `/${this.CODE_URL}/generate-qr-code`,
        {
          headers: {
            'Accept': 'image/png',
          },
          params: queryParams,
          responseType: 'arraybuffer',
        }
      )

      return Buffer.from(response.data)

    } catch (error: any) {
      throw new Error(`Failed to generate QR code image: ${error.message}`)
    }
  }

  /**
   * Génère un QR Code automatiquement selon les paramètres
   */
  public async generateQRCode(params: QRCodeParams): Promise<QRCodeResponse> {
    if (params.amount && params.reference) {
      return this.generateDynamicQRCode({
        ...params,
        amount: params.amount,
        reference: params.reference,
      })
    } else {
      return this.generateStaticQRCode(params)
    }
  }
}

export default new MypvitQRCodeService()