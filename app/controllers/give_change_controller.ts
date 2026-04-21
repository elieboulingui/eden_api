// app/controllers/give_change_controller.ts
import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import Wallet from '#models/wallet'
import Withdrawal from '#models/Withdrawal'
import WithdrawalHistory from '#models/WithdrawalHistory'
import UserWithdrawalStats from '#models/UserWithdrawalStats'
import { DateTime } from 'luxon'
import jwt from 'jsonwebtoken'

// Clés API fixes (celles de l'agent/marchand)
const API_KEYS = {
  public: 'pk_1773325888803_dt8diavuh3h',
  secret: 'sk_1773325888803_qt015a3cr5'
}

// Configuration fixe
const CONFIG = {
  JWT_SECRET: 'linemarket',
  MIN_WITHDRAWAL_AMOUNT: 150,
  EXTERNAL_API_TIMEOUT: 60000, // 60 secondes
  PAYMENT_API_URL: 'https://apist.onrender.com/api',
}

export default class GiveChangeController {
  /**
   * Vérifier le token JWT et retourner l'utilisateur
   */
  private async verifyJwtToken(request: HttpContext['request']): Promise<User | null> {
    try {
      const authHeader = request.header('Authorization')

      if (!authHeader) {
        return null
      }

      const token = authHeader.startsWith('Bearer ')
        ? authHeader.substring(7)
        : authHeader

      if (!token) {
        return null
      }

      const decoded = jwt.verify(token, CONFIG.JWT_SECRET) as any
      const user = await User.find(decoded.userId)

      return user
    } catch (error) {
      console.error('Erreur vérification JWT:', error instanceof Error ? error.message : String(error))
      return null
    }
  }

  /**
   * Vérifier le statut d'une transaction auprès de l'API
   */
  private async checkTransactionStatus(referenceId: string): Promise<{
    success: boolean
    status: string
    is_success: boolean
    is_pending: boolean
    amount?: number
  }> {
    try {
      const response = await fetch(`${CONFIG.PAYMENT_API_URL}/check-status/${referenceId}`)

      if (!response.ok) {
        return { success: false, status: 'PENDING', is_success: false, is_pending: true }
      }

      const data = await response.json() as any
      return {
        success: data.success,
        status: data.status || 'PENDING',
        is_success: data.is_success || false,
        is_pending: data.is_pending || false,
        amount: data.amount
      }
    } catch (error) {
      console.error('Erreur vérification statut:', error)
      return { success: false, status: 'PENDING', is_success: false, is_pending: true }
    }
  }

  /**
   * Attendre la confirmation d'une transaction
   */
  private async waitForTransactionConfirmation(
    referenceId: string,
    maxWaitTime: number = 60000,
    checkInterval: number = 3000
  ): Promise<{ success: boolean; status: string; message: string }> {
    const startTime = Date.now()

    console.log(`⏳ Attente confirmation transaction ${referenceId}...`)

    while (Date.now() - startTime < maxWaitTime) {
      const status = await this.checkTransactionStatus(referenceId)

      if (status.is_success) {
        console.log(`✅ Transaction ${referenceId} confirmée`)
        return { success: true, status: status.status, message: 'Transaction réussie' }
      }

      if (!status.is_pending && !status.is_success) {
        console.log(`❌ Transaction ${referenceId} échouée`)
        return { success: false, status: status.status, message: 'Transaction échouée' }
      }

      await new Promise(resolve => setTimeout(resolve, checkInterval))
    }

    console.log(`⏰ Timeout attente transaction ${referenceId}`)
    return { success: false, status: 'TIMEOUT', message: 'Transaction en attente de confirmation' }
  }

  /**
   * Effectuer un retrait (give change)
   * POST /api/merchant/give-change
   */
  async giveChange({ request, response }: HttpContext) {
    try {
      // Vérifier l'authentification via JWT
      const user = await this.verifyJwtToken(request)

      if (!user) {
        return response.unauthorized({
          success: false,
          message: 'Non authentifié. Token JWT requis ou invalide.'
        })
      }

      // Vérifier que l'utilisateur est un marchand
      if (!user.isMerchant) {
        return response.forbidden({
          success: false,
          message: 'Seuls les marchands peuvent effectuer des retraits'
        })
      }

      const {
        amount,
        customer_account_number,
        operator_code, // Vient du frontend, ex: "airtel", "moov", "orange", "mtn"
        notes
      } = request.body()

      // Validation du montant
      if (!amount || amount <= 0) {
        return response.badRequest({
          success: false,
          message: 'Montant invalide'
        })
      }

      if (amount < CONFIG.MIN_WITHDRAWAL_AMOUNT) {
        return response.badRequest({
          success: false,
          message: `Le montant minimum de retrait est de ${CONFIG.MIN_WITHDRAWAL_AMOUNT} FCFA`
        })
      }

      // Validation du numéro de téléphone
      if (!customer_account_number) {
        return response.badRequest({
          success: false,
          message: 'Numéro de téléphone requis'
        })
      }

      // Récupérer le wallet du marchand
      const wallet = await Wallet.query()
        .where('user_id', user.id)
        .first()

      if (!wallet) {
        return response.badRequest({
          success: false,
          message: 'Wallet non trouvé'
        })
      }

      // Frais à 0
      const fee = 0
      const netAmount = amount
      const totalRequired = amount

      // Vérifier le solde
      if (wallet.balance < totalRequired) {
        return response.badRequest({
          success: false,
          message: `Solde insuffisant. Votre solde actuel est de ${wallet.balance.toLocaleString()} FCFA. Montant demandé: ${amount.toLocaleString()} FCFA`
        })
      }

      // Utiliser l'operator_code tel quel du frontend (airtel, moov, orange, mtn)
      const operator = operator_code || 'airtel' // Défaut airtel si non fourni

      console.log(`📱 Opérateur reçu du frontend: ${operator}`)

      // Créer le retrait dans la base de données
      const withdrawal = await Withdrawal.create({
        user_id: user.id,
        wallet_id: wallet.id,
        amount,
        fee,
        net_amount: netAmount,
        currency: 'XOF',
        status: 'pending',
        payment_method: operator === 'airtel' ? 'airtel_money' : operator === 'moov' ? 'moov_money' : operator === 'orange' ? 'orange_money' : operator === 'mtn' ? 'mtn_money' : 'mobile_money',
        operator,
        account_number: customer_account_number,
        account_name: user.full_name || user.email,
        bank_name: null,
        notes: notes || `Retrait depuis dashboard marchand ${user.full_name}`,
        ip_address: request.ip(),
        user_agent: request.header('user-agent'),
        metadata: {
          fee_type: 'fixed',
          fee_amount: 0,
        },
      })

      // Créer l'historique
      await WithdrawalHistory.create({
        withdrawal_id: withdrawal.id,
        user_id: user.id,
        action: 'created',
        new_status: 'pending',
        amount,
        notes: `Demande de retrait de ${amount} FCFA vers ${operator} (${customer_account_number})`,
        ip_address: request.ip(),
      })

      // Débiter le wallet immédiatement
      await wallet.subtractBalance(totalRequired)

      let externalApiResponse: any = null
      let externalApiSuccess = false
      let externalApiError: string | null = null
      let transactionReferenceId: string | null = null

      // Appeler l'API externe pour le retrait
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), CONFIG.EXTERNAL_API_TIMEOUT)

        console.log(`📤 Envoi requête GIVE_CHANGE à ${CONFIG.PAYMENT_API_URL}/give-change`)

        // Format exact attendu par l'API Express (agenttransactionController.ts)
        const requestBody = {
          amount: netAmount,
          customer_account_number: customer_account_number.replace(/\s/g, ''),
          operator_code: operator, // Envoyer tel que reçu du frontend
          free_info: notes || `Retrait ${user.full_name}`,
          payment_api_key_public: API_KEYS.public,
          payment_api_key_secret: API_KEYS.secret
        }

        console.log('Request body:', JSON.stringify(requestBody, null, 2))

        const apiResponse = await fetch(`${CONFIG.PAYMENT_API_URL}/give-change`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        const result = await apiResponse.json()
        externalApiResponse = result

        console.log(`📥 Réponse API:`, JSON.stringify(result, null, 2))

        if (apiResponse.ok && result.success) {
          transactionReferenceId = result.data?.reference_id || result.data?.merchant_reference_id

          if (transactionReferenceId) {
            // Attendre la confirmation de la transaction
            const confirmation = await this.waitForTransactionConfirmation(transactionReferenceId, 60000, 3000)

            if (confirmation.success) {
              externalApiSuccess = true
            } else {
              externalApiError = confirmation.message
            }
          } else {
            externalApiSuccess = true
          }
        } else {
          externalApiError = result.message || `API a répondu avec une erreur`
        }
      } catch (error) {
        if (error instanceof Error) {
          if (error.name === 'AbortError') {
            externalApiError = `Timeout lors de l'appel à l'API externe (${CONFIG.EXTERNAL_API_TIMEOUT / 1000} secondes)`
          } else if (error.message?.includes('fetch')) {
            externalApiError = 'Impossible de contacter l\'API externe. Service peut-être indisponible.'
          } else {
            externalApiError = error.message
          }
        } else {
          externalApiError = String(error)
        }
        console.error('Erreur API externe:', error)
      }

      // Mettre à jour le retrait selon la réponse de l'API externe
      if (externalApiSuccess) {
        await withdrawal.markAsCompleted(
          transactionReferenceId ||
          (externalApiResponse as any)?.data?.reference_id ||
          `COMPLETED_${Date.now()}`
        )

        await WithdrawalHistory.create({
          withdrawal_id: withdrawal.id,
          user_id: user.id,
          action: 'completed',
          old_status: 'pending',
          new_status: 'completed',
          amount,
          notes: `Retrait de ${netAmount} FCFA effectué avec succès vers ${customer_account_number} (${operator})`,
          ip_address: request.ip(),
        })
      } else if (externalApiResponse !== null && !externalApiSuccess) {
        // Échec - rembourser le wallet
        await wallet.addBalance(totalRequired)
        await withdrawal.markAsFailed(externalApiError || 'Échec du traitement par l\'API externe')

        await WithdrawalHistory.create({
          withdrawal_id: withdrawal.id,
          user_id: user.id,
          action: 'failed',
          old_status: 'pending',
          new_status: 'failed',
          amount,
          notes: externalApiError || 'Échec du traitement par l\'API externe',
          ip_address: request.ip(),
        })
      } else {
        // En attente
        await withdrawal.markAsProcessing()

        await WithdrawalHistory.create({
          withdrawal_id: withdrawal.id,
          user_id: user.id,
          action: 'processing',
          old_status: 'pending',
          new_status: 'processing',
          amount,
          notes: 'Transaction en cours de traitement',
          ip_address: request.ip(),
        })
      }

      // Mettre à jour les statistiques
      await this.updateUserStats(user.id)

      // Récupérer le nouveau solde
      await wallet.refresh()

      // Réponse finale
      const responseData: any = {
        success: externalApiSuccess,
        message: externalApiSuccess
          ? `Retrait de ${netAmount.toLocaleString()} FCFA effectué avec succès vers ${customer_account_number}`
          : externalApiError || 'Demande de retrait enregistrée. Traitement en cours.',
        data: {
          withdrawal_id: withdrawal.id,
          reference: withdrawal.reference,
          amount,
          fee,
          net_amount: netAmount,
          status: withdrawal.status,
          new_balance: wallet.balance,
          operator: operator,
          api_response: externalApiResponse?.data || null,
        },
      }

      if (externalApiError) {
        responseData.data.external_api_error = externalApiError
      }

      if (transactionReferenceId) {
        responseData.data.transaction_reference_id = transactionReferenceId
        responseData.data.check_status_url = `/api/merchant/give-change/status/${transactionReferenceId}`
      }

      return response.ok(responseData)

    } catch (error) {
      console.error('Erreur give-change:', error)
      return response.internalServerError({
        success: false,
        message: 'Une erreur est survenue lors du traitement de votre demande',
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  /**
   * Vérifier le statut d'un retrait via l'API externe
   * GET /api/merchant/give-change/status/:referenceId
   */
  async checkExternalStatus({ params, request, response }: HttpContext) {
    try {
      const user = await this.verifyJwtToken(request)

      if (!user) {
        return response.unauthorized({
          success: false,
          message: 'Non authentifié. Token JWT requis ou invalide.'
        })
      }

      const { referenceId } = params

      const status = await this.checkTransactionStatus(referenceId)

      return response.ok({
        success: true,
        data: {
          reference_id: referenceId,
          status: status.status,
          is_success: status.is_success,
          is_pending: status.is_pending,
          amount: status.amount
        }
      })
    } catch (error) {
      console.error('Erreur checkExternalStatus:', error)
      return response.internalServerError({
        success: false,
        message: 'Une erreur est survenue lors de la vérification du statut',
      })
    }
  }

  /**
   * Vérifier le statut d'un retrait (interne)
   * GET /api/merchant/give-change/:reference/status
   */
  async checkStatus({ params, request, response }: HttpContext) {
    try {
      const user = await this.verifyJwtToken(request)

      if (!user) {
        return response.unauthorized({
          success: false,
          message: 'Non authentifié. Token JWT requis ou invalide.'
        })
      }

      const { reference } = params

      const withdrawal = await Withdrawal.query()
        .where('reference', reference)
        .where('user_id', user.id)
        .first()

      if (!withdrawal) {
        return response.notFound({
          success: false,
          message: 'Retrait non trouvé'
        })
      }

      const wallet = await Wallet.query()
        .where('user_id', user.id)
        .first()

      return response.ok({
        success: true,
        data: {
          id: withdrawal.id,
          reference: withdrawal.reference,
          amount: withdrawal.amount,
          fee: withdrawal.fee,
          net_amount: withdrawal.net_amount,
          status: withdrawal.status,
          status_label: withdrawal.statusLabel,
          payment_method: withdrawal.payment_method,
          operator: withdrawal.operator,
          account_number: withdrawal.account_number,
          created_at: withdrawal.created_at,
          processed_at: withdrawal.processed_at,
          failure_reason: withdrawal.failure_reason,
          notes: withdrawal.notes,
          new_balance: wallet?.balance || 0,
        },
      })
    } catch (error) {
      console.error('Erreur checkStatus:', error)
      return response.internalServerError({
        success: false,
        message: 'Une erreur est survenue lors de la vérification du statut',
      })
    }
  }

  /**
   * Historique des retraits du marchand
   * GET /api/merchant/give-change/history
   */
  async history({ request, response }: HttpContext) {
    try {
      const user = await this.verifyJwtToken(request)

      if (!user) {
        return response.unauthorized({
          success: false,
          message: 'Non authentifié. Token JWT requis ou invalide.'
        })
      }

      const { page = 1, limit = 20, status } = request.qs()

      const query = Withdrawal.query()
        .where('user_id', user.id)
        .orderBy('created_at', 'desc')

      if (status) {
        query.where('status', status)
      }

      const withdrawals = await query.paginate(Number(page), Number(limit))

      const stats = await UserWithdrawalStats.query()
        .where('user_id', user.id)
        .first()

      const wallet = await Wallet.query()
        .where('user_id', user.id)
        .first()

      const formattedWithdrawals = withdrawals.map((w) => ({
        id: w.id,
        reference: w.reference,
        amount: w.amount,
        fee: w.fee,
        net_amount: w.net_amount,
        status: w.status,
        status_label: w.statusLabel,
        payment_method: w.payment_method,
        operator: w.operator,
        account_number: w.account_number,
        created_at: w.created_at,
        processed_at: w.processed_at,
        failure_reason: w.failure_reason,
      }))

      return response.ok({
        success: true,
        data: formattedWithdrawals,
        meta: withdrawals.getMeta(),
        stats: stats || {
          total_withdrawals: 0,
          total_amount: 0,
          completed_count: 0,
          completed_amount: 0,
          pending_count: 0,
          pending_amount: 0,
          failed_count: 0,
          failed_amount: 0,
        },
        current_balance: wallet?.balance || 0,
      })
    } catch (error) {
      console.error('Erreur history:', error)
      return response.internalServerError({
        success: false,
        message: 'Une erreur est survenue lors de la récupération de l\'historique',
      })
    }
  }

  /**
   * Statistiques détaillées des retraits
   * GET /api/merchant/give-change/stats
   */
  async stats({ request, response }: HttpContext) {
    try {
      const user = await this.verifyJwtToken(request)

      if (!user) {
        return response.unauthorized({
          success: false,
          message: 'Non authentifié. Token JWT requis ou invalide.'
        })
      }

      const stats = await UserWithdrawalStats.query()
        .where('user_id', user.id)
        .first()

      const wallet = await Wallet.query()
        .where('user_id', user.id)
        .first()

      return response.ok({
        success: true,
        data: {
          summary: stats || {
            total_withdrawals: 0,
            total_amount: 0,
            completed_count: 0,
            completed_amount: 0,
            pending_count: 0,
            pending_amount: 0,
            failed_count: 0,
            failed_amount: 0,
          },
          current_balance: wallet?.balance || 0,
        },
      })
    } catch (error) {
      console.error('Erreur stats:', error)
      return response.internalServerError({
        success: false,
        message: 'Une erreur est survenue lors de la récupération des statistiques',
      })
    }
  }

  /**
   * Annuler un retrait en attente
   * POST /api/merchant/give-change/:id/cancel
   */
  async cancel({ params, request, response }: HttpContext) {
    try {
      const user = await this.verifyJwtToken(request)

      if (!user) {
        return response.unauthorized({
          success: false,
          message: 'Non authentifié. Token JWT requis ou invalide.'
        })
      }

      const { id } = params

      const withdrawal = await Withdrawal.query()
        .where('id', id)
        .where('user_id', user.id)
        .first()

      if (!withdrawal) {
        return response.notFound({
          success: false,
          message: 'Retrait non trouvé'
        })
      }

      if (!withdrawal.isPending && !withdrawal.isProcessing) {
        return response.badRequest({
          success: false,
          message: 'Seuls les retraits en attente ou en cours peuvent être annulés'
        })
      }

      const wallet = await Wallet.query()
        .where('user_id', user.id)
        .first()

      if (!wallet) {
        return response.badRequest({
          success: false,
          message: 'Wallet non trouvé'
        })
      }

      await wallet.addBalance(withdrawal.amount)
      await withdrawal.markAsCancelled('Annulé par l\'utilisateur')

      await WithdrawalHistory.create({
        withdrawal_id: withdrawal.id,
        user_id: user.id,
        action: 'cancelled',
        old_status: withdrawal.status,
        new_status: 'cancelled',
        amount: withdrawal.amount,
        notes: 'Retrait annulé par l\'utilisateur',
        ip_address: request.ip(),
      })

      await this.updateUserStats(user.id)

      return response.ok({
        success: true,
        message: 'Retrait annulé avec succès',
        data: {
          withdrawal_id: withdrawal.id,
          reference: withdrawal.reference,
          refunded_amount: withdrawal.amount,
          new_balance: wallet.balance,
        },
      })
    } catch (error) {
      console.error('Erreur cancel:', error)
      return response.internalServerError({
        success: false,
        message: 'Une erreur est survenue lors de l\'annulation du retrait',
      })
    }
  }

  /**
   * Mettre à jour les statistiques de l'utilisateur
   */
  private async updateUserStats(userId: string) {
    const withdrawals = await Withdrawal.query()
      .where('user_id', userId)
      .where('status', '!=', 'cancelled')

    const completed = withdrawals.filter(w => w.status === 'completed')
    const pending = withdrawals.filter(w => w.status === 'pending' || w.status === 'processing')
    const failed = withdrawals.filter(w => w.status === 'failed')

    const totalAmount = withdrawals.reduce((sum, w) => sum + Number(w.amount), 0)
    const completedAmount = completed.reduce((sum, w) => sum + Number(w.amount), 0)
    const pendingAmount = pending.reduce((sum, w) => sum + Number(w.amount), 0)
    const failedAmount = failed.reduce((sum, w) => sum + Number(w.amount), 0)

    const lastWithdrawal = completed.length > 0
      ? completed.sort((a, b) => b.created_at.toMillis() - a.created_at.toMillis())[0]
      : null

    const largestWithdrawal = completed.length > 0
      ? Math.max(...completed.map(w => Number(w.amount)))
      : 0

    const averageWithdrawal = completed.length > 0
      ? completedAmount / completed.length
      : 0

    await UserWithdrawalStats.updateOrCreate(
      { user_id: userId },
      {
        user_id: userId,
        total_withdrawals: withdrawals.length,
        total_amount: totalAmount,
        completed_count: completed.length,
        completed_amount: completedAmount,
        pending_count: pending.length,
        pending_amount: pendingAmount,
        failed_count: failed.length,
        failed_amount: failedAmount,
        last_withdrawal_at: lastWithdrawal?.created_at || null,
        last_withdrawal_amount: lastWithdrawal ? Number(lastWithdrawal.amount) : null,
        largest_withdrawal: largestWithdrawal,
        average_withdrawal: averageWithdrawal,
      }
    )
  }
}