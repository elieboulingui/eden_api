// app/services/mypvit_link_service.ts
import axios, { type AxiosInstance, type AxiosError } from 'axios'
import MypvitSecretService from './mypvit_secret_service.js'

interface LinkRequest {
  agent?: string
  amount: number
  product?: string
  reference: string
  service: 'WEB' | 'VISA_MASTERCARD' | 'RESTLINK'
  callback_url_code: string
  merchant_operation_account_code: string
  transaction_type: 'PAYMENT'
  owner_charge: 'MERCHANT' | 'CUSTOMER'
  operator_owner_charge?: string
  free_info?: string
  failed_redirection_url_code?: string  // CODE court, pas URL
  success_redirection_url_code?: string // CODE court, pas URL
  customer_account_number?: string
  operator_code?: string
}

interface LinkResponse {
  status: 'SUCCESS' | 'FAILED'
  status_code: string
  merchant_reference_id: string
  url: string
}

interface ApiError {
  date: string
  status_code: number
  error: string
  message: string
  path: string
}

export class MypvitLinkService {
  private httpClient: AxiosInstance
  private readonly BASE_URL = 'https://api.mypvit.pro'
  private readonly CODE_URL = 'TEBSBVJBBWEGGUES'

  // Codes de redirection (configurés dans MyPVit - max 12 caractères)
  private readonly DEFAULT_SUCCESS_CODE = 'SUCCESS_URL'
  private readonly DEFAULT_FAILED_CODE = 'FAILED_URL'

  constructor() {
    this.httpClient = axios.create({
      baseURL: this.BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    })

    this.httpClient.interceptors.request.use(async (config) => {
      const secret = await MypvitSecretService.getSecret()
      config.headers['X-Secret'] = secret
      return config
    })

    this.httpClient.interceptors.response.use(
      (response) => response,
      async (error: AxiosError<ApiError>) => {
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
   * Lien WEB (Airtel Money / Moov Money)
   */
  public async generateWebLink(params: {
    agent?: string
    amount: number
    product?: string
    reference: string
    callback_url_code: string
    merchant_operation_account_code: string
    owner_charge: 'MERCHANT' | 'CUSTOMER'
    operator_owner_charge?: string
    free_info?: string
    failed_redirection_url_code?: string
    success_redirection_url_code?: string
    customer_account_number?: string
    operator_code?: string
  }): Promise<LinkResponse> {
    return this.generateLink({
      ...params,
      service: 'WEB',
    })
  }

  /**
   * Lien VISA_MASTERCARD
   */
  public async generateVisaMastercardLink(params: {
    agent?: string
    amount: number
    product?: string
    reference: string
    callback_url_code: string
    merchant_operation_account_code: string
    owner_charge: 'MERCHANT' | 'CUSTOMER'
    operator_owner_charge?: string
    free_info?: string
    failed_redirection_url_code?: string
    success_redirection_url_code?: string
    customer_account_number: string
  }): Promise<LinkResponse> {
    return this.generateLink({
      ...params,
      service: 'VISA_MASTERCARD',
    })
  }

  /**
   * Lien RESTLINK
   */
  public async generateRestLink(params: {
    agent?: string
    amount: number
    product?: string
    reference: string
    callback_url_code: string
    merchant_operation_account_code: string
    owner_charge: 'MERCHANT' | 'CUSTOMER'
    operator_owner_charge?: string
    free_info?: string
    failed_redirection_url_code?: string
    success_redirection_url_code?: string
    customer_account_number: string
    operator_code?: string
  }): Promise<LinkResponse> {
    return this.generateLink({
      ...params,
      service: 'RESTLINK',
    })
  }

  /**
   * Génère un lien de paiement
   */
  private async generateLink(data: LinkRequest): Promise<LinkResponse> {
    this.validateLinkData(data)

    const payload: any = {
      agent: data.agent,
      amount: data.amount,
      product: data.product,
      reference: data.reference,
      service: data.service,
      callback_url_code: data.callback_url_code,
      merchant_operation_account_code: data.merchant_operation_account_code,
      transaction_type: 'PAYMENT',
      owner_charge: data.owner_charge,
      operator_owner_charge: data.operator_owner_charge,
      free_info: data.free_info,
      // Ce sont des CODES configurés dans MyPVit (max 12 caractères), pas des URLs
      failed_redirection_url_code: data.failed_redirection_url_code || this.DEFAULT_FAILED_CODE,
      success_redirection_url_code: data.success_redirection_url_code || this.DEFAULT_SUCCESS_CODE,
      customer_account_number: data.customer_account_number,
      operator_code: data.operator_code,
    }

    // Supprimer les champs undefined
    Object.keys(payload).forEach(key => {
      if (payload[key] === undefined) {
        delete payload[key]
      }
    })

    console.log('📤 Payload lien:', JSON.stringify(payload, null, 2))

    try {
      const response = await this.httpClient.post<LinkResponse>(
        `/${this.CODE_URL}/link`,
        payload,
        {
          headers: {
            'X-Callback-MediaType': 'application/json',
          },
        }
      )

      return response.data

    } catch (error: any) {
      if (error.response?.data) {
        throw new Error(`Link generation failed: ${JSON.stringify(error.response.data)}`)
      }
      throw new Error(`Link generation failed: ${error.message}`)
    }
  }

  /**
   * Valide les données du lien selon le type de service
   */
  private validateLinkData(data: LinkRequest): void {
    const errors: string[] = []

    if (!data.amount || data.amount <= 500) {
      errors.push('Amount must be greater than 500 XAF')
    }

    if (!data.reference || data.reference.length > 15) {
      errors.push('Reference is required and must be max 15 characters')
    }

    if (!data.merchant_operation_account_code) {
      errors.push('Merchant operation account code is required')
    }

    if (!data.callback_url_code) {
      errors.push('Callback URL code is required')
    }

    // Vérifier la longueur des codes de redirection (max 12 caractères)
    if (data.success_redirection_url_code && data.success_redirection_url_code.length > 12) {
      errors.push('success_redirection_url_code must not exceed 12 characters')
    }

    if (data.failed_redirection_url_code && data.failed_redirection_url_code.length > 12) {
      errors.push('failed_redirection_url_code must not exceed 12 characters')
    }

    if (!['MERCHANT', 'CUSTOMER'].includes(data.owner_charge)) {
      errors.push('Owner charge must be MERCHANT or CUSTOMER')
    }

    switch (data.service) {
      case 'WEB':
        if (data.customer_account_number && data.customer_account_number.length > 23) {
          errors.push('Customer account number must be max 23 characters')
        }
        break

      case 'VISA_MASTERCARD':
        if (!data.customer_account_number) {
          errors.push('Customer account number is required for VISA_MASTERCARD')
        }
        break

      case 'RESTLINK':
        if (!data.customer_account_number) {
          errors.push('Customer account number is required for RESTLINK')
        }
        if (data.customer_account_number && data.customer_account_number.length > 23) {
          errors.push('Customer account number must be max 23 characters')
        }
        break

      default:
        errors.push('Invalid service type. Must be WEB, VISA_MASTERCARD, or RESTLINK')
    }

    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`)
    }
  }
}

export default new MypvitLinkService()