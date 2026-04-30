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

interface PaymentParams {
  agent?: string
  amount: number
  reference: string
  callback_url_code: string
  customer_account_number: string
  merchant_operation_account_code: string
  owner_charge: 'MERCHANT' | 'CUSTOMER'
  operator_code: string
  product?: string
  free_info?: string
}

export class MypvitTransactionService {
  private httpClient: AxiosInstance
  private readonly BASE_URL_V2 = 'https://api.mypvit.pro/v2'
  
  // ✅ Tous les endpoints en V2
  private readonly TRANSACTION_CODE_URL = 'O4PLVRSGUW90JGCY'  // Pour /rest
  private readonly STATUS_CODE_URL = 'FQDQOGFLKGT9BV0M'      // Pour /status
  
  // ✅ Callback configuré dans MyPVit
  private readonly SUBSCRIPTION_CALLBACK_CODE = 'T2D7X'
  public readonly SUBSCRIPTION_CALLBACK_URL = 'https://eden-api-zklf.onrender.com/api/mypvit/callback/subscription'

  constructor() {
    this.httpClient = axios.create({ 
      baseURL: this.BASE_URL_V2, 
      timeout: 30000, 
      headers: { 'Content-Type': 'application/json' } 
    })
    
    // Interceptor pour ajouter le secret automatiquement
    this.httpClient.interceptors.request.use(async (config) => {
      config.headers['X-Secret'] = await MypvitSecretService.getSecret()
      return config
    })
    
    // Interceptor pour gérer les erreurs 401 (secret expiré)
    this.httpClient.interceptors.response.use(
      (r) => r,
      async (error: AxiosError) => {
        if (error.response?.status === 401 && error.config) {
          console.log('🔄 [TransactionService] Secret expiré, renouvellement...')
          await MypvitSecretService.forceRenewal()
          const newSecret = await MypvitSecretService.getSecret()
          error.config.headers['X-Secret'] = newSecret
          return this.httpClient.request(error.config)
        }
        return Promise.reject(error)
      }
    )
  }

  /**
   * Traitement d'un paiement pour abonnement
   */
  async processSubscriptionPayment(params: {
    amount: number
    reference: string
    customer_account_number: string
    operator_code: string
    product?: string
  }): Promise<TransactionResponse> {
    // Détecter l'opérateur pour obtenir le bon compte
    const operatorInfo = MypvitSecretService.getOperatorInfo(params.customer_account_number)
    
    console.log('📱 [TransactionService] Opérateur détecté:', {
      phone: params.customer_account_number,
      operator: operatorInfo.operator,
      accountCode: operatorInfo.accountCode
    })

    const paymentParams: PaymentParams = {
      amount: params.amount,
      reference: params.reference.substring(0, 15),
      callback_url_code: this.SUBSCRIPTION_CALLBACK_CODE,
      customer_account_number: params.customer_account_number.replace(/\s/g, '').substring(0, 23),
      merchant_operation_account_code: operatorInfo.accountCode,
      transaction_type: 'PAYMENT',
      owner_charge: 'CUSTOMER',
      operator_code: params.operator_code || operatorInfo.operator,
      product: params.product || 'Abonnement Boost',
      free_info: `Sub-${params.reference}`
    }

    return this.executePayment(paymentParams)
  }

  /**
   * Exécute un paiement standard
   */
  async processPayment(params: PaymentParams): Promise<TransactionResponse> {
    return this.executePayment(params)
  }

  /**
   * Méthode interne pour exécuter le paiement
   */
  private async executePayment(params: PaymentParams): Promise<TransactionResponse> {
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
    if (params.product) payload.product = params.product
    if (params.free_info) payload.free_info = params.free_info

    try {
      console.log('💳 [TransactionService] Paiement initié v2:', {
        reference: params.reference,
        amount: params.amount,
        operator: params.operator_code,
        callback: params.callback_url_code
      })

      const response = await this.httpClient.post<TransactionResponse>(
        `/${this.TRANSACTION_CODE_URL}/rest`, 
        payload,
        { headers: { 'X-Callback-MediaType': 'application/json' } }
      )
      
      console.log('✅ [TransactionService] Réponse v2:', {
        status: response.data.status,
        referenceId: response.data.reference_id,
        message: response.data.message
      })
      
      return response.data
    } catch (error: any) {
      console.error('❌ [TransactionService] Erreur paiement v2:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message
      })
      
      if (error.response?.data) {
        const d = error.response.data
        throw new Error(`[${d.error || 'PAYMENT_ERROR'}] ${d.messages?.join('|') || d.message || 'Erreur de paiement'}`)
      }
      throw error
    }
  }

  /**
   * Vérifie le statut d'une transaction - ENDPOINT V2
   * GET https://api.mypvit.pro/v2/{codeUrl}/status
   */
  async checkTransactionStatus(
    transactionId: string,
    accountOperationCode?: string
  ): Promise<TransactionStatusResponse> {
    try {
      // Si pas de code compte fourni, utiliser celui d'AIRTEL par défaut
      const accountCode = accountOperationCode || 'ACC_69EFB0E02FCA3'
      
      console.log('🔍 [TransactionService] Vérification statut v2:', {
        transactionId,
        accountCode
      })

      // ✅ Utilisation de l'API v2
      const response = await axios.get<TransactionStatusResponse>(
        `${this.BASE_URL_V2}/${this.STATUS_CODE_URL}/status`,
        {
          headers: {
            'X-Secret': await MypvitSecretService.getSecret(),
            'Accept': 'application/json'
          },
          params: {
            transactionId,
            accountOperationCode: accountCode,
            transactionOperation: 'PAYMENT'
          }
        }
      )

      console.log('✅ [TransactionService] Statut v2:', {
        id: transactionId,
        status: response.data.status,
        amount: response.data.amount,
        operator: response.data.operator
      })
      
      return response.data
    } catch (error: any) {
      console.error('❌ [TransactionService] Erreur vérification statut v2:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data
      })
      
      if (error.response?.data) {
        const d = error.response.data
        throw new Error(`[${d.error || 'STATUS_ERROR'}] ${d.message || 'Erreur vérification statut'}`)
      }
      throw error
    }
  }

  /**
   * Vérifie le solde d'un compte - ENDPOINT V2
   * GET https://api.mypvit.pro/v2/{codeUrl}/balance
   */
  async checkBalance(accountOperationCode?: string): Promise<any> {
    try {
      const accountCode = accountOperationCode || 'ACC_69EFB0E02FCA3'
      
      console.log('💰 [TransactionService] Vérification solde v2:', {
        accountCode
      })

      const response = await axios.get(
        `${this.BASE_URL_V2}/${this.STATUS_CODE_URL}/balance`,
        {
          headers: {
            'X-Secret': await MypvitSecretService.getSecret(),
            'Accept': 'application/json'
          },
          params: {
            accountOperationCode: accountCode
          }
        }
      )

      console.log('✅ [TransactionService] Solde v2:', response.data)
      return response.data
    } catch (error: any) {
      console.error('❌ [TransactionService] Erreur vérification solde v2:', error.message)
      throw error
    }
  }

  /**
   * Récupère les frais de transaction - ENDPOINT V2
   * GET https://api.mypvit.pro/v2/{codeUrl}/get-fees
   */
  async getFees(params: {
    amount: number
    operator_code: string
    accountOperationCode?: string
  }): Promise<any> {
    try {
      const accountCode = params.accountOperationCode || 'ACC_69EFB0E02FCA3'
      
      console.log('💸 [TransactionService] Calcul frais v2:', {
        amount: params.amount,
        operator: params.operator_code
      })

      const response = await axios.get(
        `${this.BASE_URL_V2}/${this.STATUS_CODE_URL}/get-fees`,
        {
          headers: {
            'X-Secret': await MypvitSecretService.getSecret(),
            'Accept': 'application/json'
          },
          params: {
            amount: params.amount,
            operator_code: params.operator_code,
            accountOperationCode: accountCode
          }
        }
      )

      console.log('✅ [TransactionService] Frais v2:', response.data)
      return response.data
    } catch (error: any) {
      console.error('❌ [TransactionService] Erreur calcul frais v2:', error.message)
      throw error
    }
  }

  /**
   * Récupère la liste des opérateurs - ENDPOINT V2
   * GET https://api.mypvit.pro/v2/{codeUrl}/get-operators
   */
  async getOperators(): Promise<any> {
    try {
      console.log('📡 [TransactionService] Récupération opérateurs v2')

      const response = await axios.get(
        `${this.BASE_URL_V2}/${this.STATUS_CODE_URL}/get-operators`,
        {
          headers: {
            'X-Secret': await MypvitSecretService.getSecret(),
            'Accept': 'application/json'
          }
        }
      )

      console.log('✅ [TransactionService] Opérateurs v2:', response.data)
      return response.data
    } catch (error: any) {
      console.error('❌ [TransactionService] Erreur récupération opérateurs v2:', error.message)
      throw error
    }
  }

  /**
   * Vérifie la santé du service - ENDPOINT V2
   * GET https://api.mypvit.pro/v2/{codeUrl}/services/health
   */
  async checkServiceHealth(): Promise<any> {
    try {
      console.log('🏥 [TransactionService] Vérification santé service v2')

      const response = await axios.get(
        `${this.BASE_URL_V2}/${this.STATUS_CODE_URL}/services/health`,
        {
          headers: {
            'X-Secret': await MypvitSecretService.getSecret(),
            'Accept': 'application/json'
          }
        }
      )

      console.log('✅ [TransactionService] Santé service v2:', response.data)
      return response.data
    } catch (error: any) {
      console.error('❌ [TransactionService] Service santé erreur v2:', error.message)
      throw error
    }
  }

  /**
   * Génère un lien de paiement - ENDPOINT V2
   * POST https://api.mypvit.pro/v2/{codeUrl}/link
   */
  async generatePaymentLink(params: {
    amount: number
    reference: string
    customer_account_number: string
    service: 'WEB' | 'VISA_MASTERCARD' | 'RESTLINK'
    success_redirection_url_code?: string
    failed_redirection_url_code?: string
  }): Promise<any> {
    try {
      const operatorInfo = MypvitSecretService.getOperatorInfo(params.customer_account_number)

      const payload = {
        amount: params.amount,
        reference: params.reference.substring(0, 15),
        customer_account_number: params.customer_account_number.replace(/\s/g, ''),
        service: params.service,
        callback_url_code: this.SUBSCRIPTION_CALLBACK_CODE,
        merchant_operation_account_code: operatorInfo.accountCode,
        transaction_type: 'PAYMENT',
        owner_charge: 'CUSTOMER',
        operator_owner_charge: 'MERCHANT',
        operator_code: operatorInfo.operator,
      }

      if (params.success_redirection_url_code) {
        (payload as any).success_redirection_url_code = params.success_redirection_url_code
      }
      if (params.failed_redirection_url_code) {
        (payload as any).failed_redirection_url_code = params.failed_redirection_url_code
      }

      console.log('🔗 [TransactionService] Génération lien v2:', payload)

      const response = await axios.post(
        `${this.BASE_URL_V2}/${this.TRANSACTION_CODE_URL}/link`,
        payload,
        {
          headers: {
            'X-Secret': await MypvitSecretService.getSecret(),
            'Content-Type': 'application/json',
            'X-Callback-MediaType': 'application/json'
          }
        }
      )

      console.log('✅ [TransactionService] Lien v2 généré:', response.data)
      return response.data
    } catch (error: any) {
      console.error('❌ [TransactionService] Erreur génération lien v2:', error.message)
      throw error
    }
  }

  /**
   * Gère le callback de paiement
   */
  handleCallback(data: any) {
    return { 
      responseCode: data.code || 200, 
      transactionId: data.transactionId || data.reference_id || 'unknown' 
    }
  }
}

export default new MypvitTransactionService()
