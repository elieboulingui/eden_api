// app/services/mypvit_balance_service.ts
import axios, { type AxiosInstance, type AxiosError } from 'axios'
import MypvitSecretService from './mypvit_secret_service.js'

interface BalanceResponse {
  balance: number
  merchant_operation_account_code: string
}

interface BalanceError {
  date: string
  status_code: number
  error: string
  message: string
  path: string
}

export class MypvitBalanceService {
  private httpClient: AxiosInstance
  private readonly BASE_URL = 'https://api.mypvit.pro'
  private readonly CODE_URL = 'DBMMTBAOKTFOIZQR'

  constructor() {
    this.httpClient = axios.create({
      baseURL: this.BASE_URL,
      timeout: 10000,
      headers: {
        'Accept': 'application/json',
      },
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
      async (error: AxiosError<BalanceError>) => {
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
   * Récupère le solde d'un compte d'opération
   */
  public async getBalance(accountOperationCode: string): Promise<BalanceResponse> {
    try {
      if (!accountOperationCode) {
        throw new Error('Account operation code is required')
      }

      const response = await this.httpClient.get<BalanceResponse>(
        `/${this.CODE_URL}/balance`,
        {
          params: {
            accountOperationCode: accountOperationCode,
          },
        }
      )

      return response.data

    } catch (error: any) {
      const axiosError = error as AxiosError<BalanceError>

      if (axiosError.response?.data) {
        throw new Error(`Balance check failed: ${axiosError.response.data.message || axiosError.message}`)
      }

      throw new Error(`Balance check failed: ${error.message}`)
    }
  }

  /**
   * Récupère le solde formaté avec la devise
   */
  public async getFormattedBalance(accountOperationCode: string): Promise<{
    balance: number
    currency: string
    formatted: string
    account_code: string
  }> {
    const balanceData = await this.getBalance(accountOperationCode)

    return {
      balance: balanceData.balance,
      currency: 'XAF',
      formatted: `${balanceData.balance.toLocaleString()} XAF`,
      account_code: balanceData.merchant_operation_account_code,
    }
  }

  /**
   * Vérifie si le solde est suffisant pour un montant donné
   */
  public async hasSufficientBalance(
    accountOperationCode: string,
    requiredAmount: number
  ): Promise<{
    sufficient: boolean
    balance: number
    required: number
    deficit: number
  }> {
    const balanceData = await this.getBalance(accountOperationCode)
    const deficit = requiredAmount - balanceData.balance

    return {
      sufficient: balanceData.balance >= requiredAmount,
      balance: balanceData.balance,
      required: requiredAmount,
      deficit: deficit > 0 ? deficit : 0,
    }
  }
}

export default new MypvitBalanceService()
