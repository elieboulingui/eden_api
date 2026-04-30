// app/services/mypvit_transaction_service.ts
import axios, { type AxiosInstance, type AxiosError } from 'axios'
import MypvitSecretService from './mypvit_secret_service.js'

interface TransactionResponse {
  status: 'PENDING' | 'FAILED' | 'SUCCESS'
  status_code: string
  operator: string
  reference_id: string
  merchant_reference_id: string
  merchant_operation_account_code: string
  message: string
}

interface TransactionStatusResponse {
  date: string
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'AMBIGUOUS'
  amount: number
  fees: number
  operator: string
  merchant_reference_id: string
  customer_account_number: string
  merchant_operation_account_code: string
}

export class MypvitTransactionService {
  private httpClient: AxiosInstance
  private readonly BASE_URL = 'https://api.mypvit.pro/v2'
  private readonly BASE_URL_V1 = 'https://api.mypvit.pro'
  private readonly CODE_URL = 'O4PLVRSGUW90JGCY'
  private readonly STATUS_CODE_URL = 'FQDQOGFLKGT9BV0M'

  constructor() {
    this.httpClient = axios.create({ baseURL: this.BASE_URL, timeout: 30000, headers: { 'Content-Type': 'application/json' } })
    this.httpClient.interceptors.request.use(async (config) => {
      config.headers['X-Secret'] = await MypvitSecretService.getSecret()
      return config
    })
    this.httpClient.interceptors.response.use(
      (r) => r,
      async (error: AxiosError) => {
        if (error.response?.status === 401 && error.config) {
          await MypvitSecretService.renewSecret()
          error.config.headers['X-Secret'] = await MypvitSecretService.getSecret()
          return this.httpClient.request(error.config)
        }
        return Promise.reject(error)
      }
    )
  }

  async processPayment(params: {
    agent?: string; amount: number; reference: string; callback_url_code: string
    customer_account_number: string; merchant_operation_account_code: string
    owner_charge: 'MERCHANT' | 'CUSTOMER'; operator_code: string
  }): Promise<TransactionResponse> {
    const payload: any = {
      amount: params.amount,
      reference: params.reference.substring(0, 15),
      service: 'RESTFUL',
      callback_url_code: params.callback_url_code,
      customer_account_number: params.customer_account_number.substring(0, 23),
      merchant_operation_account_code: params.merchant_operation_account_code,
      transaction_type: 'PAYMENT',
      owner_charge: params.owner_charge,
      operator_code: params.operator_code,
    }
    if (params.agent) payload.agent = params.agent

    try {
      const response = await this.httpClient.post<TransactionResponse>(
        `/${this.CODE_URL}/rest`, payload,
        { headers: { 'X-Callback-MediaType': 'application/json' } }
      )
      return response.data
    } catch (error: any) {
      if (error.response?.data) {
        const d = error.response.data
        throw new Error(`[${d.error}] ${d.messages?.join('|') || d.message}`)
      }
      throw error
    }
  }

  /**
   * ✅ GIVE_CHANGE (RETRAIT) - Méthode manquante
   */
  async processGiveChange(params: {
    amount: number
    reference: string
    callback_url_code: string
    customer_account_number: string
    merchant_operation_account_code: string
    owner_charge: 'MERCHANT' | 'CUSTOMER'
    operator_code: string
    free_info?: string
  }): Promise<TransactionResponse> {
    console.log('💸 [TransactionService] GIVE_CHANGE initié:', {
      amount: params.amount,
      reference: params.reference,
      operator: params.operator_code
    })

    const payload: any = {
      amount: params.amount,
      reference: params.reference.substring(0, 15),
      service: 'RESTFUL',
      callback_url_code: params.callback_url_code,
      customer_account_number: params.customer_account_number.substring(0, 23),
      merchant_operation_account_code: params.merchant_operation_account_code,
      transaction_type: 'GIVE_CHANGE',
      owner_charge: params.owner_charge,
      operator_code: params.operator_code,
    }

    if (params.free_info) payload.free_info = params.free_info

    try {
      const response = await this.httpClient.post<TransactionResponse>(
        `/${this.CODE_URL}/rest`,
        payload,
        { headers: { 'X-Callback-MediaType': 'application/json' } }
      )

      console.log('✅ [TransactionService] GIVE_CHANGE réponse:', {
        status: response.data.status,
        referenceId: response.data.reference_id,
        message: response.data.message
      })

      return response.data
    } catch (error: any) {
      console.error('❌ [TransactionService] Erreur GIVE_CHANGE:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message
      })

      if (error.response?.data) {
        const d = error.response.data
        throw new Error(`[${d.error || 'GIVE_CHANGE_ERROR'}] ${d.messages?.join('|') || d.message || 'Erreur de retrait'}`)
      }
      throw error
    }
  }

  /**
   * Vérifie le statut d'une transaction


   
   */

  async processGiveChange(params: {
  amount: number
  reference: string
  callback_url_code: string
  customer_account_number: string
  merchant_operation_account_code: string
  owner_charge: 'MERCHANT' | 'CUSTOMER'
  operator_code: string
  free_info?: string
}): Promise<TransactionResponse> {
  console.log('💸 [TransactionService] GIVE_CHANGE initié:', {
    amount: params.amount,
    reference: params.reference,
    operator: params.operator_code
  })

  const payload: any = {
    amount: params.amount,
    reference: params.reference.substring(0, 15),
    service: 'RESTFUL',
    callback_url_code: params.callback_url_code,
    customer_account_number: params.customer_account_number.substring(0, 23),
    merchant_operation_account_code: params.merchant_operation_account_code,
    transaction_type: 'GIVE_CHANGE',
    owner_charge: params.owner_charge,
    operator_code: params.operator_code,
  }

  if (params.free_info) payload.free_info = params.free_info

  try {
    const response = await this.httpClient.post<TransactionResponse>(
      `/${this.CODE_URL}/rest`,
      payload,
      { headers: { 'X-Callback-MediaType': 'application/json' } }
    )

    console.log('✅ [TransactionService] GIVE_CHANGE réponse:', {
      status: response.data.status,
      referenceId: response.data.reference_id
    })

    return response.data
  } catch (error: any) {
    console.error('❌ [TransactionService] Erreur GIVE_CHANGE:', error.message)
    throw error
  }
} 
  async checkTransactionStatus(
    transactionId: string,
    accountOperationCode: string
  ): Promise<TransactionStatusResponse> {
    try {
      const secret = await MypvitSecretService.getSecret()

      const response = await axios.get<TransactionStatusResponse>(
        `${this.BASE_URL_V1}/${this.STATUS_CODE_URL}/status`,
        {
          headers: {
            'X-Secret': secret,
            'Accept': 'application/json'
          },
          params: {
            transactionId,
            accountOperationCode,
            transactionOperation: 'PAYMENT'
          }
        }
      )

      console.log('✅ [TransactionService] Statut:', response.data.status)
      return response.data
    } catch (error: any) {
      if (error.response?.data) {
        const d = error.response.data
        console.error('❌ [TransactionService] Erreur statut:', d)
        throw new Error(`[${d.error || 'STATUS_ERROR'}] ${d.message || 'Erreur vérification statut'}`)
      }
      throw error
    }
  }

  handleCallback(data: any) {
    return { responseCode: data.code || 200, transactionId: data.transactionId || 'unknown' }
  }
}

export default new MypvitTransactionService()
