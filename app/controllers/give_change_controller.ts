import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import Wallet from '#models/wallet'
import Withdrawal from '#models/Withdrawal'
import WithdrawalHistory from '#models/WithdrawalHistory'
import UserWithdrawalStats from '#models/UserWithdrawalStats'
import jwt from 'jsonwebtoken'
import MypvitSecretService from '../services/mypvit_secret_service.js'
import MypvitTransactionService from '../services/mypvit_transaction_service.js'

const ACCOUNT_OPERATION_CODE = 'ACC_69EA59CBC7495'
const CALLBACK_URL_CODE = '9ZOXW'
const JWT_SECRET = 'linemarket'
const MIN_WITHDRAWAL_AMOUNT = 150

export default class GiveChangeController {

  private async verifyJwtToken(request: HttpContext['request']): Promise<User | null> {
    try {
      const authHeader = request.header('Authorization')
      if (!authHeader) return null
      const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : authHeader
      if (!token) return null
      const decoded = jwt.verify(token, JWT_SECRET) as any
      return await User.find(decoded.userId)
    } catch (error) {
      return null
    }
  }

  private detectOperator(phone: string): string {
    const clean = phone.replace(/[\s\+\.\-]/g, '')
    let local = clean
    if (clean.startsWith('241')) local = clean.substring(3)
    if (local.startsWith('0')) local = local.substring(1)
    if (local.startsWith('6')) return 'MOOV_MONEY'
    if (local.startsWith('7')) return 'AIRTEL_MONEY'
    return 'AIRTEL_MONEY'
  }

  /**
   * Effectuer un retrait (GIVE_CHANGE) via MyPVit
   * POST /api/merchant/give-change
   */
  async giveChange({ request, response }: HttpContext) {
    try {
      const user = await this.verifyJwtToken(request)
      if (!user) {
        return response.unauthorized({ success: false, message: 'Token JWT requis' })
      }
      if (!(user as any).isMerchant) {
        return response.forbidden({ success: false, message: 'Marchands uniquement' })
      }

      const { amount, customer_account_number, operator_code, notes } = request.body()

      if (!amount || amount < MIN_WITHDRAWAL_AMOUNT) {
        return response.badRequest({ success: false, message: `Montant minimum: ${MIN_WITHDRAWAL_AMOUNT} FCFA` })
      }
      if (!customer_account_number) {
        return response.badRequest({ success: false, message: 'Numéro de téléphone requis' })
      }

      const wallet = await Wallet.query().where('user_id', user.id).first()
      if (!wallet) {
        return response.badRequest({ success: false, message: 'Wallet non trouvé' })
      }
      if (Number(wallet.balance) < amount) {
        return response.badRequest({ success: false, message: `Solde insuffisant: ${wallet.balance} FCFA` })
      }

      // Détecter l'opérateur
      const operator = operator_code || this.detectOperator(customer_account_number)
      console.log(`📱 Give Change - Opérateur: ${operator} | Montant: ${amount} | Tel: ${customer_account_number}`)

      // Créer le retrait
      const withdrawal = await Withdrawal.create({
        user_id: user.id,
        wallet_id: wallet.id,
        amount,
        fee: 0,
        net_amount: amount,
        currency: 'XAF',
        status: 'pending',
        payment_method: operator,
        operator: operator,
        account_number: customer_account_number,
        account_name: user.full_name || user.email,
        notes: notes || `Retrait ${user.full_name}`,
        ip_address: request.ip(),
      })

      await WithdrawalHistory.create({
        withdrawal_id: withdrawal.id, user_id: user.id,
        action: 'created', new_status: 'pending', amount,
        notes: `Demande de retrait ${amount} FCFA vers ${operator} (${customer_account_number})`,
        ip_address: request.ip(),
      })

      // Débiter le wallet
      await wallet.subtractBalance(amount)

      try {
        // ✅ Appel MyPVit GIVE_CHANGE
        await MypvitSecretService.renewSecret()

        // ✅ CORRECTION : Appel correct de processGiveChange
        const paymentResult = await (MypvitTransactionService as any).processGiveChange({
          amount: amount,
          reference: `GCH${Date.now().toString(36).toUpperCase()}`.substring(0, 15),
          callback_url_code: CALLBACK_URL_CODE,
          customer_account_number: customer_account_number,
          merchant_operation_account_code: ACCOUNT_OPERATION_CODE,
          owner_charge: 'MERCHANT',
          operator_code: operator,
          free_info: `Retrait marchand ${user.full_name}`,
        })

        console.log('📡 Réponse GIVE_CHANGE:', paymentResult.status)

        if (paymentResult.status === 'SUCCESS') {
          await withdrawal.markAsCompleted(paymentResult.reference_id)
          await WithdrawalHistory.create({
            withdrawal_id: withdrawal.id, user_id: user.id,
            action: 'completed', old_status: 'pending', new_status: 'completed',
            amount, notes: `Retrait réussi - Réf: ${paymentResult.reference_id}`,
          })
          return response.ok({
            success: true,
            message: `✅ Retrait de ${amount} FCFA effectué avec succès`,
            data: {
              withdrawal_id: withdrawal.id,
              reference: withdrawal.reference,
              amount,
              status: 'completed',
              new_balance: wallet.balance,
              transaction_ref: paymentResult.reference_id,
            },
          })
        } else if (paymentResult.status === 'PENDING') {
          await withdrawal.markAsProcessing()
          return response.ok({
            success: true,
            message: '⏳ Retrait en cours de traitement',
            data: {
              withdrawal_id: withdrawal.id,
              amount,
              status: 'processing',
              new_balance: wallet.balance,
              transaction_ref: paymentResult.reference_id,
            },
          })
        } else {
          // Échec - rembourser
          await wallet.addBalance(amount)
          await withdrawal.markAsFailed(paymentResult.message)
          await WithdrawalHistory.create({
            withdrawal_id: withdrawal.id, user_id: user.id,
            action: 'failed', old_status: 'pending', new_status: 'failed',
            amount, notes: `Échec: ${paymentResult.message}`,
          })
          return response.badRequest({
            success: false,
            message: 'Retrait échoué',
            error: paymentResult.message,
          })
        }
      } catch (error: any) {
        // Rembourser en cas d'erreur
        await wallet.addBalance(amount)
        await withdrawal.markAsFailed(error.message)
        return response.internalServerError({
          success: false,
          message: 'Erreur lors du retrait',
          error: error.message,
        })
      }

    } catch (error: any) {
      console.error('🔴 Erreur give-change:', error.message)
      return response.internalServerError({
        success: false,
        message: 'Erreur',
        error: error.message,
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
      if (!user) return response.unauthorized({ success: false, message: 'Token JWT requis' })

      const { reference } = params
      const withdrawal = await Withdrawal.query()
        .where('reference', reference).where('user_id', user.id).first()

      if (!withdrawal) return response.notFound({ success: false, message: 'Retrait non trouvé' })

      const wallet = await Wallet.query().where('user_id', user.id).first()

      return response.ok({
        success: true,
        data: {
          id: withdrawal.id, reference: withdrawal.reference,
          amount: withdrawal.amount, fee: withdrawal.fee,
          net_amount: withdrawal.net_amount, status: withdrawal.status,
          status_label: (withdrawal as any).statusLabel,
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
      return response.internalServerError({ success: false, message: 'Erreur' })
    }
  }

  /**
   * Historique des retraits
   * GET /api/merchant/give-change/history
   */
  async history({ request, response }: HttpContext) {
    try {
      const user = await this.verifyJwtToken(request)
      if (!user) return response.unauthorized({ success: false, message: 'Token JWT requis' })

      const { page = 1, limit = 20, status } = request.qs()
      const query = Withdrawal.query().where('user_id', user.id).orderBy('created_at', 'desc')
      if (status) query.where('status', status)

      const withdrawals = await query.paginate(Number(page), Number(limit))
      const stats = await UserWithdrawalStats.query().where('user_id', user.id).first()
      const wallet = await Wallet.query().where('user_id', user.id).first()

      return response.ok({
        success: true,
        data: withdrawals.map(w => ({
          id: w.id, reference: w.reference, amount: w.amount,
          fee: w.fee, net_amount: w.net_amount, status: w.status,
          status_label: (w as any).statusLabel, payment_method: w.payment_method,
          operator: w.operator, account_number: w.account_number,
          created_at: w.created_at, processed_at: w.processed_at,
          failure_reason: w.failure_reason,
        })),
        meta: withdrawals.getMeta(),
        stats: stats || { total_withdrawals: 0, total_amount: 0 },
        current_balance: wallet?.balance || 0,
      })
    } catch (error) {
      console.error('Erreur history:', error)
      return response.internalServerError({ success: false, message: 'Erreur' })
    }
  }

  /**
   * Statistiques des retraits
   * GET /api/merchant/give-change/stats
   */
  async stats({ request, response }: HttpContext) {
    try {
      const user = await this.verifyJwtToken(request)
      if (!user) return response.unauthorized({ success: false, message: 'Token JWT requis' })

      const stats = await UserWithdrawalStats.query().where('user_id', user.id).first()
      const wallet = await Wallet.query().where('user_id', user.id).first()

      return response.ok({
        success: true,
        data: {
          summary: stats || { total_withdrawals: 0, total_amount: 0 },
          current_balance: wallet?.balance || 0,
        },
      })
    } catch (error) {
      console.error('Erreur stats:', error)
      return response.internalServerError({ success: false, message: 'Erreur' })
    }
  }

  /**
   * Annuler un retrait
   * POST /api/merchant/give-change/:id/cancel
   */
  async cancel({ params, request, response }: HttpContext) {
    try {
      const user = await this.verifyJwtToken(request)
      if (!user) return response.unauthorized({ success: false, message: 'Token JWT requis' })

      const { id } = params
      const withdrawal = await Withdrawal.query().where('id', id).where('user_id', user.id).first()

      if (!withdrawal) return response.notFound({ success: false, message: 'Retrait non trouvé' })
      if (!(withdrawal as any).isPending && !(withdrawal as any).isProcessing) {
        return response.badRequest({ success: false, message: 'Seuls les retraits en attente peuvent être annulés' })
      }

      const wallet = await Wallet.query().where('user_id', user.id).first()
      if (!wallet) return response.badRequest({ success: false, message: 'Wallet non trouvé' })

      await wallet.addBalance(withdrawal.amount)
      await (withdrawal as any).markAsCancelled('Annulé par l\'utilisateur')

      await WithdrawalHistory.create({
        withdrawal_id: withdrawal.id, user_id: user.id,
        action: 'cancelled', old_status: withdrawal.status, new_status: 'cancelled',
        amount: withdrawal.amount, notes: 'Retrait annulé', ip_address: request.ip(),
      })

      return response.ok({
        success: true,
        message: 'Retrait annulé',
        data: { withdrawal_id: withdrawal.id, refunded_amount: withdrawal.amount, new_balance: wallet.balance },
      })
    } catch (error) {
      console.error('Erreur cancel:', error)
      return response.internalServerError({ success: false, message: 'Erreur' })
    }
  }
}
