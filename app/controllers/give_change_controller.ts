// app/controllers/give_change_controller.ts
import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import User from '#models/user'
import Wallet from '#models/wallet'
import Withdrawal from '#models/Withdrawal'
import WithdrawalHistory from '#models/WithdrawalHistory'
import UserWithdrawalStats from '#models/UserWithdrawalStats'
import MypvitSecretService from '../services/mypvit_secret_service.js'
import MypvitTransactionService from '../services/mypvit_transaction_service.js'

const MIN_WITHDRAWAL_AMOUNT = 150

export default class GiveChangeController {

  private getOperatorInfo(phone: string): { 
    operator: string; operatorCode: string; accountCode: string 
  } {
    const clean = phone.replace(/[\s\+\.\-]/g, '')
    let local = clean
    if (clean.startsWith('241')) local = clean.substring(3)
    if (local.startsWith('0')) local = local.substring(1)

    if (local.startsWith('6')) {
      return { operator: 'MOOV_MONEY', operatorCode: 'MOOV_MONEY', accountCode: 'ACC_69EFB143D4F54' }
    }
    return { operator: 'AIRTEL_MONEY', operatorCode: 'AIRTEL_MONEY', accountCode: 'ACC_69EFB0E02FCA3' }
  }

  async giveChange({ request, response }: HttpContext) {
    console.log('💰 ========== GIVE CHANGE DEMANDÉ ==========')
    
    try {
      const { userId, amount, customer_account_number, notes } = request.body()

      // ==========================================
      // ÉTAPE 1: VALIDATION DES PARAMÈTRES DE BASE
      // ==========================================
      
      if (!userId) {
        return response.status(400).json({ 
          success: false, 
          message: 'ID utilisateur requis',
          code: 'MISSING_USER_ID'
        })
      }

      const user = await User.find(userId)
      if (!user) {
        return response.status(404).json({ 
          success: false, 
          message: 'Utilisateur introuvable',
          code: 'USER_NOT_FOUND'
        })
      }

      // ==========================================
      // ÉTAPE 2: VÉRIFICATION KYC DU MARCHAND
      // ==========================================
      
      // Vérifier si le compte est vérifié (is_verified = true)
      if (!user.is_verified) {
        console.log('❌ Compte non vérifié (is_verified = false):', user.id)
        return response.status(403).json({
          success: false,
          message: 'Votre compte n\'est pas vérifié. Les retraits sont réservés aux marchands vérifiés.',
          code: 'ACCOUNT_NOT_VERIFIED',
          data: {
            user_id: user.id,
            is_verified: false,
            verification_status: user.verification_status,
            required_action: 'complete_verification'
          }
        })
      }

      // Vérifier si le statut de vérification est "approved"
      if (user.verification_status !== 'approved') {
        console.log('❌ Vérification non approuvée:', user.id, 'Status:', user.verification_status)
        
        let message = 'Votre vérification n\'a pas encore été approuvée.'
        let requiredAction = 'wait_for_approval'
        
        if (user.verification_status === 'pending') {
          message = 'Votre demande de vérification est en attente d\'approbation. Vous ne pouvez pas encore effectuer de retraits.'
          requiredAction = 'wait_for_approval'
        } else if (user.verification_status === 'rejected') {
          message = 'Votre demande de vérification a été rejetée. Veuillez contacter le support pour plus d\'informations.'
          requiredAction = 'contact_support'
        } else if (!user.verification_status) {
          message = 'Vous n\'avez pas encore soumis de demande de vérification. Veuillez compléter votre profil KYC.'
          requiredAction = 'submit_kyc'
        }

        return response.status(403).json({
          success: false,
          message: message,
          code: 'VERIFICATION_NOT_APPROVED',
          data: {
            user_id: user.id,
            is_verified: user.is_verified,
            verification_status: user.verification_status,
            required_action: requiredAction
          }
        })
      }

      // Vérifier si le rôle de l'utilisateur permet les retraits
      if (user.role !== 'marchant' && user.role !== 'merchant') {
        console.log('❌ Rôle non autorisé:', user.role)
        return response.status(403).json({
          success: false,
          message: 'Seuls les marchands vérifiés peuvent effectuer des retraits.',
          code: 'ROLE_NOT_AUTHORIZED',
          data: {
            user_id: user.id,
            role: user.role,
            required_action: 'upgrade_account'
          }
        })
      }

      // Vérifier si le compte est actif
      if (user.status !== 'active') {
        console.log('❌ Compte non actif:', user.id, 'Status:', user.status)
        return response.status(403).json({
          success: false,
          message: 'Votre compte n\'est pas actif. Veuillez contacter le support.',
          code: 'ACCOUNT_NOT_ACTIVE',
          data: {
            user_id: user.id,
            status: user.status,
            required_action: 'contact_support'
          }
        })
      }

      console.log('✅ KYC validé - is_verified:', user.is_verified, 'verification_status:', user.verification_status)

      // ==========================================
      // ÉTAPE 3: VALIDATION DU MONTANT
      // ==========================================

      if (!amount || Number(amount) < MIN_WITHDRAWAL_AMOUNT) {
        return response.status(400).json({ 
          success: false, 
          message: `Le montant minimum de retrait est de ${MIN_WITHDRAWAL_AMOUNT} FCFA`,
          code: 'AMOUNT_TOO_LOW',
          data: {
            minimum_amount: MIN_WITHDRAWAL_AMOUNT,
            requested_amount: Number(amount)
          }
        })
      }

      if (!customer_account_number) {
        return response.status(400).json({ 
          success: false, 
          message: 'Numéro de téléphone requis',
          code: 'MISSING_PHONE_NUMBER'
        })
      }

      // ==========================================
      // ÉTAPE 4: VÉRIFICATION DU WALLET
      // ==========================================

      const wallet = await Wallet.query().where('user_id', user.id).first()
      if (!wallet) {
        return response.status(400).json({ 
          success: false, 
          message: 'Wallet non trouvé',
          code: 'WALLET_NOT_FOUND'
        })
      }

      if (Number(wallet.balance) < Number(amount)) {
        return response.status(400).json({ 
          success: false, 
          message: `Solde insuffisant. Votre solde actuel est de ${Number(wallet.balance).toLocaleString()} FCFA.`,
          code: 'INSUFFICIENT_BALANCE',
          data: {
            current_balance: Number(wallet.balance),
            requested_amount: Number(amount),
            deficit: Number(amount) - Number(wallet.balance)
          }
        })
      }

      // ==========================================
      // ÉTAPE 5: TRAITEMENT DU PAIEMENT
      // ==========================================

      const opInfo = this.getOperatorInfo(customer_account_number)
      console.log('📱 Opérateur détecté:', { phone: customer_account_number, operator: opInfo.operator, accountCode: opInfo.accountCode })

      await MypvitSecretService.renewSecret(customer_account_number)
      console.log('🔐 Secret MyPVit renouvelé')

      const reference = `GCH${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).substring(2, 5)}`.substring(0, 20)

      const paymentResult = await (MypvitTransactionService as any).processGiveChange({
        amount: Number(amount),
        reference: reference,
        callback_url_code: '4USEG',
        customer_account_number: customer_account_number.replace(/\s/g, ''),
        merchant_operation_account_code: opInfo.accountCode,
        owner_charge: 'MERCHANT',
        operator_code: opInfo.operatorCode,
        free_info: `Retrait ${opInfo.operator}`.substring(0, 15),
      })

      console.log('📡 Réponse MyPVit:', paymentResult)

      // ==========================================
      // ÉTAPE 6: TRAITEMENT DU RÉSULTAT
      // ==========================================

      if (paymentResult.status === 'SUCCESS') {
        await wallet.subtractBalance(Number(amount))
        
        const withdrawal = await Withdrawal.create({
          user_id: user.id, 
          wallet_id: wallet.id, 
          amount: Number(amount), 
          fee: 0,
          net_amount: Number(amount), 
          currency: 'XAF', 
          status: 'completed',
          payment_method: opInfo.operator, 
          operator: opInfo.operator,
          account_number: customer_account_number.replace(/\s/g, ''),
          account_name: user.full_name || user.email || 'Marchand',
          notes: notes || `Retrait ${user.full_name || 'Marchand'} - ${opInfo.operator}`,
          ip_address: request.ip(),
          transaction_id: paymentResult.reference_id,
          processed_at: DateTime.now(),
        })

        await WithdrawalHistory.create({
          withdrawal_id: withdrawal.id, 
          user_id: user.id, 
          action: 'completed',
          new_status: 'completed', 
          amount: Number(amount),
          notes: `✅ Retrait réussi - ${opInfo.operator} - Réf: ${paymentResult.reference_id} - Marchand vérifié`,
          ip_address: request.ip(),
        })

        console.log('✅ Retrait réussi pour marchand vérifié:', user.id)

        return response.status(200).json({
          success: true,
          message: `✅ Retrait de ${Number(amount).toLocaleString()} FCFA effectué avec succès via ${opInfo.operator}`,
          data: {
            withdrawal_id: withdrawal.id, 
            amount: Number(amount), 
            status: 'completed',
            new_balance: Number(wallet.balance), 
            operator: opInfo.operator,
            reference: reference,
            processed_at: DateTime.now().toISO()
          },
        })
      } else {
        console.log('❌ Retrait refusé par MyPVit:', paymentResult.message)

        return response.status(400).json({
          success: false,
          message: `❌ Retrait refusé: ${paymentResult.message || 'Échec du traitement'}`,
          code: 'PAYMENT_FAILED',
          operator: opInfo.operator,
        })
      }

    } catch (error: any) {
      console.error('🔴 Erreur give-change:', error.message)
      
      // Gestion spécifique des erreurs de connexion
      if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
        return response.status(503).json({ 
          success: false, 
          message: 'Service de paiement temporairement indisponible. Veuillez réessayer plus tard.',
          code: 'SERVICE_UNAVAILABLE'
        })
      }

      return response.status(500).json({ 
        success: false, 
        message: 'Erreur interne lors du traitement du retrait',
        code: 'INTERNAL_ERROR',
        error: error.message 
      })
    }
  }

  async checkStatus({ params, request, response }: HttpContext) {
    try {
      const { userId } = request.qs()
      const { reference } = params
      if (!userId) return response.status(400).json({ success: false, message: 'ID utilisateur requis' })
      const withdrawal = await Withdrawal.query().where('reference', reference).where('user_id', userId).first()
      if (!withdrawal) return response.status(404).json({ success: false, message: 'Retrait non trouvé' })
      const wallet = await Wallet.query().where('user_id', userId).first()
      return response.status(200).json({
        success: true,
        data: {
          id: withdrawal.id, reference: withdrawal.reference, amount: withdrawal.amount,
          fee: withdrawal.fee, net_amount: withdrawal.net_amount, status: withdrawal.status,
          payment_method: withdrawal.payment_method, operator: withdrawal.operator,
          account_number: withdrawal.account_number, created_at: withdrawal.created_at,
          processed_at: withdrawal.processed_at, failure_reason: withdrawal.failure_reason,
          transaction_reference: withdrawal.transaction_id, notes: withdrawal.notes,
          new_balance: wallet?.balance || 0,
        },
      })
    } catch (error) {
      return response.status(500).json({ success: false, message: 'Erreur interne' })
    }
  }

  async history({ request, response }: HttpContext) {
    try {
      const { userId, page = 1, limit = 20, status } = request.qs()
      if (!userId) return response.status(400).json({ success: false, message: 'ID utilisateur requis' })
      const query = Withdrawal.query().where('user_id', userId).orderBy('created_at', 'desc')
      if (status) query.where('status', status)
      const withdrawals = await query.paginate(Number(page), Number(limit))
      const stats = await UserWithdrawalStats.query().where('user_id', userId).first()
      const wallet = await Wallet.query().where('user_id', userId).first()
      return response.status(200).json({
        success: true,
        data: withdrawals.map(w => ({
          id: w.id, reference: w.reference, amount: w.amount, fee: w.fee,
          net_amount: w.net_amount, status: w.status, payment_method: w.payment_method,
          operator: w.operator, account_number: w.account_number, created_at: w.created_at,
          processed_at: w.processed_at, failure_reason: w.failure_reason,
          transaction_reference: w.transaction_id,
        })),
        meta: withdrawals.getMeta(),
        stats: stats || { total_withdrawals: 0, total_amount: 0 },
        current_balance: wallet?.balance || 0,
      })
    } catch (error) {
      return response.status(500).json({ success: false, message: 'Erreur interne' })
    }
  }

  async stats({ request, response }: HttpContext) {
    try {
      const { userId } = request.qs()
      if (!userId) return response.status(400).json({ success: false, message: 'ID utilisateur requis' })
      const stats = await UserWithdrawalStats.query().where('user_id', userId).first()
      const wallet = await Wallet.query().where('user_id', userId).first()
      return response.status(200).json({
        success: true,
        data: { summary: stats || { total_withdrawals: 0, total_amount: 0 }, current_balance: wallet?.balance || 0 },
      })
    } catch (error) {
      return response.status(500).json({ success: false, message: 'Erreur interne' })
    }
  }

  async cancel({ params, request, response }: HttpContext) {
    try {
      const { userId } = request.body()
      const { id } = params
      if (!userId) return response.status(400).json({ success: false, message: 'ID utilisateur requis' })
      const withdrawal = await Withdrawal.query().where('id', id).where('user_id', userId).first()
      if (!withdrawal) return response.status(404).json({ success: false, message: 'Retrait non trouvé' })
      if (withdrawal.status !== 'pending' && withdrawal.status !== 'processing') {
        return response.status(400).json({ success: false, message: 'Seuls les retraits en attente ou en cours peuvent être annulés' })
      }
      const wallet = await Wallet.query().where('user_id', userId).first()
      if (!wallet) return response.status(400).json({ success: false, message: 'Wallet non trouvé' })
      await wallet.addBalance(withdrawal.amount)
      await withdrawal.markAsCancelled("Annulé par l'utilisateur")
      await WithdrawalHistory.create({
        withdrawal_id: withdrawal.id, user_id: userId, action: 'cancelled',
        old_status: 'pending', new_status: 'cancelled', amount: withdrawal.amount,
        notes: 'Retrait annulé par l\'utilisateur', ip_address: request.ip(),
      })
      return response.status(200).json({
        success: true, message: 'Retrait annulé et remboursé',
        data: { withdrawal_id: withdrawal.id, refunded_amount: withdrawal.amount, new_balance: wallet.balance },
      })
    } catch (error) {
      return response.status(500).json({ success: false, message: 'Erreur interne' })
    }
  }
}
