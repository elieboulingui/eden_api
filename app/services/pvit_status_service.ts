// app/services/pvit_status_service.ts
// ✅ Service SIMPLE - reçoit tout en paramètres

import axios from 'axios'

interface StatusResponse {
  date: string
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'AMBIGUOUS'
  amount: number
  fees: number
  operator: string
  merchant_reference_id: string
  customer_account_number: string
  merchant_operation_account_code: string
}

export class PvitStatusService {
  private readonly BASE_URL = 'https://api.mypvit.pro'
  private readonly CODE_URL = 'FQDQOGFLKGT9BV0M'

  /**
   * Vérifie le statut d'une transaction
   * @param xSecret - Le X-Secret récupéré par le controller
   * @param transactionId - L'ID de la transaction
   * @param accountOperationCode - Le code compte opération
   */
  async checkStatus(
    xSecret: string,
    transactionId: string,
    accountOperationCode: string
  ): Promise<{
    success: boolean
    status?: string
    data?: StatusResponse
    message?: string
  }> {
    try {
      const response = await axios.get(`${this.BASE_URL}/${this.CODE_URL}/status`, {
        headers: {
          'X-Secret': xSecret,
          'Content-Type': 'application/json'
        },
        params: {
          transactionId,
          accountOperationCode,
          transactionOperation: 'PAYMENT'
        },
        timeout: 15000
      })

      const data = response.data

      console.log('✅ Statut:', data.status)
      console.log('   Montant:', data.amount)
      console.log('   Opérateur:', data.operator)
      console.log('   Frais:', data.fees)

      return {
        success: true,
        status: data.status,
        data
      }

    } catch (error: any) {
      console.error('❌ Erreur statut:', error.message)
      return {
        success: false,
        message: error.message
      }
    }
  }
}

export default new PvitStatusService()
