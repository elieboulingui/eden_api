// app/controllers/give_change_controller.ts
import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import Wallet from '#models/wallet'
import Withdrawal from '#models/Withdrawal'
import WithdrawalHistory from '#models/WithdrawalHistory'
import UserWithdrawalStats from '#models/UserWithdrawalStats'
import MypvitSecretService from '../services/mypvit_secret_service.js'
import MypvitTransactionService from '../services/mypvit_transaction_service.js'

const CALLBACK_URL_CODE = '4USEG'
const MIN_WITHDRAWAL_AMOUNT = 150

export default class GiveChangeController {

  /**
   * Détecte l'opérateur ET retourne le bon compte
   */
  private getOperatorInfo(phone: string): { 
    operator: string
    operatorCode: string
    accountCode: string 
  } {
    const clean = phone.replace(/[\s\+\.\-]/g, '')
    let local = clean
    if (clean.startsWith('241')) local = clean.substring(3)
    if (local.startsWith('0')) local = local.substring(1)

    // 06 = MOOV
    if (local.startsWith('6')) {
      return {
        operator: 'MOOV_MONEY',
        operatorCode: 'MOOV_MONEY',
        accountCode: 'ACC_69EFB143D4F54'
      }
    }
    
    // 07 = AIRTEL
    return {
      operator: 'AIRTEL_MONEY',
      operatorCode: 'AIRTEL_MONEY',
      accountCode: 'ACC_69EFB0E02FCA3'
    }
  }

  /**
   * Effectuer un retrait (GIVE_CHANGE) via MyPVit
   * POST /api/merchant/give-change
   */
  async giveChange({ request, response }: HttpContext) {
    console.log('💰 ========== GIVE CHANGE DEMANDÉ ==========')
    
    try {
      const { userId, amount, customer_account_number, notes } = request.body()

      if (!userId) {
        return response.status(400).json({ success: false, message: 'ID utilisateur requis' })
      }

      const user = await User.find(userId)
      if (!user) {
        return response.status(404).json({ success: false, message: 'Utilisateur introuvable' })
      }

      if (!amount || Number(amount) < MIN_WITHDRAWAL_AMOUNT) {
        return response.status(400).json({ success: false, message: `Montant minimum: ${MIN_WITHDRAWAL_AMOUNT} FCFA` })
      }

      if (!customer_account_number) {
        return response.status(400).json({ success: false, message: 'Numéro de téléphone requis' })
      }

      const wallet = await Wallet.query().where('user_id', user.id).first()
      if (!wallet) {
        return response.status(400).json({ success: false, message: 'Wallet non trouvé' })
      }

      const currentBalance = Number(wallet.balance)
      if (currentBalance < Number(amount)) {
        return response.status(400).json({ success: false, message: `Solde insuffisant: ${currentBalance} FCFA` })
      }

      // Détecter l'opérateur
      const opInfo = this.getOperatorInfo(customer_account_number)
      console.log('📱 Opérateur détecté:', {
        phone: customer_account_number,
        operator: opInfo.operator,
        accountCode: opInfo.accountCode
      })

      // Créer le retrait
      const withdrawal = await Withdrawal.create({
        user_id: user.id,
        wallet_id: wallet.id,
        amount: Number(amount),
        fee: 0,
        net_amount: Number(amount),
        currency: 'XAF',
        status: 'pending',
        payment_method: opInfo.operator,
        operator: opInfo.operator,
        account_number: customer_account_number.replace(/\s/g, ''),
        account_name: user.full_name || user.email || 'Marchand',
        notes: notes || `Retrait ${user.full_name || 'Marchand'} - ${opInfo.operator}`,
        ip_address: request.ip(),
      })

      console.log('📝 Retrait créé:', withdrawal.id)

      // Historique
      await WithdrawalHistory.create({
        withdrawal_id: withdrawal.id,
        user_id: user.id,
        action: 'created',
        new_status: 'pending',
        amount: Number(amount),
        notes: `Demande de retrait ${amount} FCFA vers ${opInfo.operator} (${customer_account_number})`,
        ip_address: request.ip(),
      })

      // Débiter le wallet
      await wallet.subtractBalance(Number(amount))
      console.log('💸 Wallet débité:', wallet.balance, 'FCFA')

      try {
        // Renouveler le secret
        await MypvitSecretService.renewSecret()
        console.log('🔐 Secret MyPVit renouvelé')

        // Référence
        const reference = `GCH${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).substring(2, 5)}`.substring(0, 20)
        
        console.log('📤 Envoi GIVE_CHANGE:', {
          amount: Number(amount),
          reference,
          accountCode: opInfo.accountCode,
          operator: opInfo.operatorCode
        })

        // Appel MyPVit
        const paymentResult = await (MypvitTransactionService as any).processGiveChange({
          amount: Number(amount),
          reference: reference,
          callback_url_code: CALLBACK_URL_CODE,
          customer_account_number: customer_account_number.replace(/\s/g, ''),
          merchant_operation_account_code: opInfo.accountCode,
          owner_charge: 'MERCHANT',
          operator_code: opInfo.operatorCode,
          free_info: `Retrait ${user.full_name || 'Marchand'} - ${opInfo.operator}`,
        })

        console.log('📡 Réponse GIVE_CHANGE:', {
          status: paymentResult.status,
          reference: paymentResult.reference_id,
          message: paymentResult.message
        })

        // ✅ Mettre à jour le transaction_id
        if (paymentResult.reference_id) {
          withdrawal.transaction_id = paymentResult.reference_id
          await withdrawal.save()
        }

        if (paymentResult.status === 'SUCCESS') {
          await withdrawal.markAsCompleted(paymentResult.reference_id)

          await WithdrawalHistory.create({
            withdrawal_id: withdrawal.id,
            user_id: user.id,
            action: 'completed',
            old_status: 'pending',
            new_status: 'completed',
            amount: Number(amount),
            notes: `✅ Retrait réussi - ${opInfo.operator} - Réf: ${paymentResult.reference_id}`,
          })

          console.log('✅ Retrait SUCCESS')
          return response.status(200).json({
            success: true,
            message: `✅ Retrait de ${amount} FCFA effectué avec succès via ${opInfo.operator}`,
            data: {
              withdrawal_id: withdrawal.id,
              reference: withdrawal.reference,
              amount: Number(amount),
              status: 'completed',
              new_balance: wallet.balance,
              transaction_ref: paymentResult.reference_id,
              operator: opInfo.operator,
            },
          })

        } else if (paymentResult.status === 'PENDING') {
          withdrawal.status = 'processing'
          await withdrawal.save()

          await WithdrawalHistory.create({
            withdrawal_id: withdrawal.id,
            user_id: user.id,
            action: 'processing',
            old_status: 'pending',
            new_status: 'processing',
            amount: Number(amount),
            notes: `⏳ En attente - ${opInfo.operator} - Réf: ${paymentResult.reference_id || reference}`,
          })

          console.log('⏳ Retrait PENDING')
          return response.status(200).json({
            success: true,
            message: '⏳ Retrait en cours de traitement',
            data: {
              withdrawal_id: withdrawal.id,
              amount: Number(amount),
              status: 'processing',
              new_balance: wallet.balance,
              transaction_ref: paymentResult.reference_id || reference,
              operator: opInfo.operator,
            },
          })

        } else {
          // Échec - Rembourser
          await wallet.addBalance(Number(amount))
          withdrawal.status = 'failed'
          withdrawal.failure_reason = paymentResult.message || 'Échec du retrait'
          await withdrawal.save()

          await WithdrawalHistory.create({
            withdrawal_id: withdrawal.id,
            user_id: user.id,
            action: 'failed',
            old_status: 'pending',
            new_status: 'failed',
            amount: Number(amount),
            notes: `❌ Échec: ${paymentResult.message || 'Inconnu'}`,
          })

          console.log('❌ Retrait FAILED')
          return response.status(400).json({
            success: false,
            message: 'Retrait échoué',
            error: paymentResult.message,
            data: {
              withdrawal_id: withdrawal.id,
              refunded_amount: Number(amount),
              new_balance: wallet.balance,
            },
          })
        }

      } catch (error: any) {
        console.error('🔴 Erreur MyPVit:', error.message)
        
        await wallet.addBalance(Number(amount))
        withdrawal.status = 'failed'
        withdrawal.failure_reason = `Erreur: ${error.message}`
        await withdrawal.save()

        return response.status(500).json({
          success: false,
          message: 'Erreur lors du retrait',
          error: error.message,
          data: {
            withdrawal_id: withdrawal.id,
            refunded_amount: Number(amount),
            new_balance: wallet.balance,
          },
        })
      }

    } catch (error: any) {
      console.error('🔴 Erreur give-change:', error.message)
      return response.status(500).json({
        success: false,
        message: 'Erreur interne',
        error: error.message,
      })
    }
  }

  /**
   * Vérifier le statut d'un retrait
   */
  async checkStatus({ params, request, response }: HttpContext) {
    try {
      const { userId } = request.qs()
      const { reference } = params

      if (!userId) {
        return response.status(400).json({ success: false, message: 'ID utilisateur requis' })
      }

      const withdrawal = await Withdrawal.query()
        .where('reference', reference)
        .where('user_id', userId)
        .first()

      if (!withdrawal) {
        return response.status(404).json({ success: false, message: 'Retrait non trouvé' })
      }

      const wallet = await Wallet.query().where('user_id', userId).first()

      return response.status(200).json({
        success: true,
        data: {
          id: withdrawal.id,
          reference: withdrawal.reference,
          amount: withdrawal.amount,
          fee: withdrawal.fee,
          net_amount: withdrawal.net_amount,
          status: withdrawal.status,
          payment_method: withdrawal.payment_method,
          operator: withdrawal.operator,
          account_number: withdrawal.account_number,
          created_at: withdrawal.created_at,
          processed_at: withdrawal.processed_at,
          failure_reason: withdrawal.failure_reason,
          transaction_reference: withdrawal.transaction_id,
          notes: withdrawal.notes,
          new_balance: wallet?.balance || 0,
        },
      })
    } catch (error) {
      console.error('Erreur checkStatus:', error)
      return response.status(500).json({ success: false, message: 'Erreur interne' })
    }
  }

  /**
   * Historique des retraits
   */
  async history({ request, response }: HttpContext) {
    try {
      const { userId, page = 1, limit = 20, status } = request.qs()

      if (!userId) {
        return response.status(400).json({ success: false, message: 'ID utilisateur requis' })
      }

      const query = Withdrawal.query()
        .where('user_id', userId)
        .orderBy('created_at', 'desc')

      if (status) query.where('status', status)

      const withdrawals = await query.paginate(Number(page), Number(limit))
      const stats = await UserWithdrawalStats.query().where('user_id', userId).first()
      const wallet = await Wallet.query().where('user_id', userId).first()

      return response.status(200).json({
        success: true,
        data: withdrawals.map(w => ({
          id: w.id,
          reference: w.reference,
          amount: w.amount,
          fee: w.fee,
          net_amount: w.net_amount,
          status: w.status,
          payment_method: w.payment_method,
          operator: w.operator,
          account_number: w.account_number,
          created_at: w.created_at,
          processed_at: w.processed_at,
          failure_reason: w.failure_reason,
          transaction_reference: w.transaction_id,
        })),
        meta: withdrawals.getMeta(),
        stats: stats || { total_withdrawals: 0, total_amount: 0 },
        current_balance: wallet?.balance || 0,
      })
    } catch (error) {
      console.error('Erreur history:', error)
      return response.status(500).json({ success: false, message: 'Erreur interne' })
    }
  }

  /**
   * Statistiques des retraits
   */
  async stats({ request, response }: HttpContext) {
    try {
      const { userId } = request.qs()

      if (!userId) {
        return response.status(400).json({ success: false, message: 'ID utilisateur requis' })
      }

      const stats = await UserWithdrawalStats.query().where('user_id', userId).first()
      const wallet = await Wallet.query().where('user_id', userId).first()

      return response.status(200).json({
        success: true,
        data: {
          summary: stats || { total_withdrawals: 0, total_amount: 0 },
          current_balance: wallet?.balance || 0,
        },
      })
    } catch (error) {
      console.error('Erreur stats:', error)
      return response.status(500).json({ success: false, message: 'Erreur interne' })
    }
  }

  /**
   * Annuler un retrait
   */
  async cancel({ params, request, response }: HttpContext) {
    try {
      const { userId } = request.body()
      const { id } = params

      if (!userId) {
        return response.status(400).json({ success: false, message: 'ID utilisateur requis' })
      }

      const withdrawal = await Withdrawal.query()
        .where('id', id)
        .where('user_id', userId)
        .first()

      if (!withdrawal) {
        return response.status(404).json({ success: false, message: 'Retrait non trouvé' })
      }

      if (withdrawal.status !== 'pending' && withdrawal.status !== 'processing') {
        return response.status(400).json({ 
          success: false, 
          message: 'Seuls les retraits en attente ou en cours peuvent être annulés' 
        })
      }

      const wallet = await Wallet.query().where('user_id', userId).first()
      if (!wallet) {
        return response.status(400).json({ success: false, message: 'Wallet non trouvé' })
      }

      await wallet.addBalance(withdrawal.amount)
      await withdrawal.markAsCancelled('Annulé par l\'utilisateur')

      await WithdrawalHistory.create({
        withdrawal_id: withdrawal.id,
        user_id: userId,
        action: 'cancelled',
        old_status: 'pending',
        new_status: 'cancelled',
        amount: withdrawal.amount,
        notes: 'Retrait annulé par l\'utilisateur',
        ip_address: request.ip(),
      })

      return response.status(200).json({
        success: true,
        message: 'Retrait annulé et remboursé',
        data: {
          withdrawal_id: withdrawal.id,
          refunded_amount: withdrawal.amount,
          new_balance: wallet.balance,
        },
      })
    } catch (error) {
      console.error('Erreur cancel:', error)
      return response.status(500).json({ success: false, message: 'Erreur interne' })
    }
  }
}
