// app/controllers/give_change_controller.ts
import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import Wallet from '#models/wallet'
import Withdrawal from '#models/Withdrawal'
import WithdrawalHistory from '#models/WithdrawalHistory'
import UserWithdrawalStats from '#models/UserWithdrawalStats'
import { DateTime } from 'luxon'
import env from '#start/env'
import jwt, { type JwtPayload } from 'jsonwebtoken'

// Clés API fixes
const API_KEYS = {
  public: 'pk_1773325888803_dt8diavuh3h',
  secret: 'sk_1773325888803_qt015a3cr5'
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

      // Extraire le token (format: "Bearer <token>")
      const token = authHeader.startsWith('Bearer ')
        ? authHeader.substring(7)
        : authHeader

      if (!token) {
        return null
      }

      // Vérifier et décoder le token
      const JWT_SECRET = env.get('JWT_SECRET')

      const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload & { userId: string; email: string }

      // Récupérer l'utilisateur
      const user = await User.find(decoded.userId)

      return user
    } catch (error) {
      console.error('Erreur vérification JWT:', error instanceof Error ? error.message : String(error))
      return null
    }
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
        operator_code,
        notes
      } = request.body()

      // Récupérer les configurations
      const MIN_WITHDRAWAL_AMOUNT = env.get('MIN_WITHDRAWAL_AMOUNT', 150)
      const EXTERNAL_API_TIMEOUT = env.get('EXTERNAL_API_TIMEOUT', 30000)

      // Validation du montant
      if (!amount || amount <= 0) {
        return response.badRequest({
          success: false,
          message: 'Montant invalide'
        })
      }

      if (amount < MIN_WITHDRAWAL_AMOUNT) {
        return response.badRequest({
          success: false,
          message: `Le montant minimum de retrait est de ${MIN_WITHDRAWAL_AMOUNT} FCFA`
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

      // Déterminer l'opérateur
      let operator = operator_code
      if (!operator || operator === 'auto') {
        if (customer_account_number.startsWith('074') || customer_account_number.startsWith('075') || customer_account_number.startsWith('070')) {
          operator = 'airtel'
        } else if (customer_account_number.startsWith('066') || customer_account_number.startsWith('067') || customer_account_number.startsWith('065')) {
          operator = 'moov'
        } else {
          operator = 'unknown'
        }
      }

      // Créer le retrait dans la base de données
      const withdrawal = await Withdrawal.create({
        user_id: user.id,
        wallet_id: wallet.id,
        amount,
        fee,
        net_amount: netAmount,
        currency: 'XOF',
        status: 'pending',
        payment_method: operator === 'airtel' ? 'airtel_money' : operator === 'moov' ? 'moov_money' : 'mobile_money',
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
        notes: `Demande de retrait de ${amount} FCFA`,
        ip_address: request.ip(),
      })

      // Débiter le wallet immédiatement
      await wallet.subtractBalance(totalRequired)

      let externalApiResponse: any = null
      let externalApiSuccess = false
      let externalApiError: string | null = null

      // Essayer d'appeler l'API externe si configurée
      const externalApiUrl = env.get('PAYMENT_API_URL')

      if (externalApiUrl) {
        try {
          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), EXTERNAL_API_TIMEOUT)

          const apiResponse = await fetch(externalApiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': request.header('Authorization') || '',
              'X-API-Public-Key': API_KEYS.public,
              'X-API-Secret-Key': API_KEYS.secret,
            },
            body: JSON.stringify({
              userId: user.id,
              amount: netAmount,
              customer_account_number,
              operator_code: operator,
              notes: notes || `Retrait depuis dashboard marchand ${user.full_name}`,
              reference: withdrawal.reference,
            }),
            signal: controller.signal,
          })

          clearTimeout(timeoutId)

          if (apiResponse.ok) {
            const result = await apiResponse.json()
            externalApiResponse = result
            externalApiSuccess = (result as any).success || (result as any).status === 'success' || false
          } else {
            externalApiError = `API externe a répondu avec le statut ${apiResponse.status}`
            console.error('API externe erreur:', await apiResponse.text())
          }
        } catch (error) {
          if (error instanceof Error) {
            if (error.name === 'AbortError') {
              externalApiError = `Timeout lors de l'appel à l'API externe (${EXTERNAL_API_TIMEOUT / 1000} secondes)`
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
      } else {
        externalApiError = 'URL de l\'API externe non configurée'
      }

      // Mettre à jour le retrait selon la réponse de l'API externe
      if (externalApiSuccess) {
        await withdrawal.markAsCompleted(
          (externalApiResponse as any)?.transaction_id ||
          (externalApiResponse as any)?.reference
        )

        await WithdrawalHistory.create({
          withdrawal_id: withdrawal.id,
          user_id: user.id,
          action: 'completed',
          old_status: 'pending',
          new_status: 'completed',
          amount,
          notes: `Retrait de ${netAmount} FCFA effectué avec succès vers ${customer_account_number}`,
          ip_address: request.ip(),
        })
      } else if (externalApiResponse !== null) {
        await withdrawal.markAsFailed(externalApiError || 'Échec du traitement par l\'API externe')

        // Rembourser le wallet
        await wallet.addBalance(totalRequired)

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
        await withdrawal.markAsProcessing()

        await WithdrawalHistory.create({
          withdrawal_id: withdrawal.id,
          user_id: user.id,
          action: 'processing',
          old_status: 'pending',
          new_status: 'processing',
          amount,
          notes: 'En attente de traitement manuel (API externe indisponible)',
          ip_address: request.ip(),
        })

        externalApiError = 'API externe indisponible. Votre retrait sera traité manuellement dans les 24-48 heures.'
      }

      // Mettre à jour les statistiques
      await this.updateUserStats(user.id)

      // Récupérer le nouveau solde
      await wallet.refresh()

      // Réponse finale
      const responseData: any = {
        success: true,
        message: externalApiSuccess
          ? `Retrait de ${netAmount.toLocaleString()} FCFA effectué avec succès vers ${customer_account_number}`
          : 'Demande de retrait enregistrée. Traitement en cours.',
        data: {
          withdrawal_id: withdrawal.id,
          reference: withdrawal.reference,
          amount,
          fee,
          net_amount: netAmount,
          status: withdrawal.status,
          new_balance: wallet.balance,
          external_api_used: externalApiResponse !== null,
          external_api_success: externalApiSuccess,
        },
      }

      if (externalApiError) {
        responseData.data.external_api_error = externalApiError
        responseData.data.estimated_processing_time = '24-48 heures'
      }

      return response.ok(responseData)

    } catch (error) {
      console.error('Erreur give-change:', error)
      return response.internalServerError({
        success: false,
        message: 'Une erreur est survenue lors du traitement de votre demande',
        error: env.get('NODE_ENV') === 'development' ? (error instanceof Error ? error.message : String(error)) : null,
      })
    }
  }

  /**
   * Vérifier le statut d'un retrait
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
          last_withdrawal_at: null,
          last_withdrawal_amount: null,
          largest_withdrawal: 0,
          average_withdrawal: 0,
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

      const twelveMonthsAgo = DateTime.now().minus({ months: 12 }).toSQL()
      const monthlyWithdrawals = await Withdrawal.query()
        .where('user_id', user.id)
        .where('status', 'completed')
        .where('created_at', '>=', twelveMonthsAgo)
        .select('created_at', 'amount')

      const monthlyStats: Record<string, { count: number; amount: number }> = {}
      monthlyWithdrawals.forEach((w) => {
        const month = w.created_at.toFormat('yyyy-MM')
        if (!monthlyStats[month]) {
          monthlyStats[month] = { count: 0, amount: 0 }
        }
        monthlyStats[month].count++
        monthlyStats[month].amount += Number(w.amount)
      })

      const methodStats = await Withdrawal.query()
        .where('user_id', user.id)
        .where('status', 'completed')
        .select('payment_method', 'operator')
        .count('* as count')
        .sum('amount as total_amount')
        .groupBy('payment_method', 'operator')

      const statusStats = await Withdrawal.query()
        .where('user_id', user.id)
        .select('status')
        .count('* as count')
        .sum('amount as total_amount')
        .groupBy('status')

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
          monthly: Object.entries(monthlyStats).map(([month, data]) => ({
            month,
            count: data.count,
            amount: data.amount,
          })).sort((a, b) => b.month.localeCompare(a.month)),
          by_method: methodStats.map((m) => ({
            payment_method: m.payment_method,
            operator: m.operator,
            count: Number(m.$extras.count),
            total_amount: Number(m.$extras.total_amount) || 0,
          })),
          by_status: statusStats.map((s) => ({
            status: s.status,
            count: Number(s.$extras.count),
            total_amount: Number(s.$extras.total_amount) || 0,
          })),
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