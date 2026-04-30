// app/controllers/RenduMoneyCallbackController.ts
import type { HttpContext } from '@adonisjs/core/http'
import Withdrawal from '#models/Withdrawal'
import WithdrawalHistory from '#models/WithdrawalHistory'
import Wallet from '#models/wallet'
import User from '#models/user'
import { DateTime } from 'luxon'

export default class RenduMoneyCallbackController {

  /**
   * Callback pour les retraits (GIVE_CHANGE)
   * POST /api/mypvit/callback/rendu-money
   */
  async handle({ request, response }: HttpContext) {
    console.log('💰 ========== CALLBACK RENDU-MONEY REÇU ==========')
    
    try {
      const data = request.body()
      console.log('📦 Données brutes:', JSON.stringify(data, null, 2))

      // Extraire les références (toutes les variations possibles)
      const refId = data.merchantReferenceId 
        || data.merchant_reference_id 
        || data.reference_id 
        || data.referenceId
        || data.reference
        || ''

      const txId = data.transactionId 
        || data.transaction_id 
        || data.id 
        || ''

      const status = data.status || data.transactionStatus || 'UNKNOWN'
      const operator = data.operator || data.operator_name || ''
      const code = data.code || data.status_code || ''
      const message = data.message || data.error_message || ''
      const amount = data.amount || data.total_amount || 0

      console.log('🔍 Paramètres extraits:')
      console.log('   refId:', refId)
      console.log('   txId:', txId)
      console.log('   status:', status)
      console.log('   operator:', operator)
      console.log('   amount:', amount)

      // ==================== RECHERCHE DU RETRAIT ====================
      let withdrawal: any = null

      // Méthode 1 : Chercher par reference (GCH...)
      if (refId) {
        withdrawal = await Withdrawal.query()
          .where('reference', refId)
          .first()
        if (withdrawal) console.log('✅ Retrait trouvé via reference = refId')
      }

      // Méthode 2 : Chercher par transaction_reference
      if (!withdrawal && refId) {
        withdrawal = await Withdrawal.query()
          .where('transaction_reference', refId)
          .first()
        if (withdrawal) console.log('✅ Retrait trouvé via transaction_reference = refId')
      }

      // Méthode 3 : Chercher par txId
      if (!withdrawal && txId) {
        withdrawal = await Withdrawal.query()
          .where('transaction_reference', txId)
          .first()
        if (withdrawal) console.log('✅ Retrait trouvé via transaction_reference = txId')
      }

      // Méthode 4 : Chercher dans les retraits récents en pending
      if (!withdrawal) {
        const recentWithdrawals = await Withdrawal.query()
          .where('status', 'pending')
          .orWhere('status', 'processing')
          .orderBy('created_at', 'desc')
          .limit(50)

        for (const w of recentWithdrawals) {
          // Vérifier correspondance téléphone
          const wPhone = w.account_number?.replace(/\D/g, '')
          const dataPhone = data.customer_account_number?.replace(/\D/g, '')
          
          if (wPhone && dataPhone && wPhone.includes(dataPhone.slice(-8))) {
            withdrawal = w
            console.log('✅ Retrait trouvé via correspondance téléphone')
            break
          }

          // Vérifier correspondance montant
          if (Math.abs(Number(w.amount) - Number(amount)) < 10) {
            withdrawal = w
            console.log('✅ Retrait trouvé via correspondance montant')
            break
          }
        }
      }

      // ==================== TRAITEMENT DU RETRAIT ====================
      if (withdrawal) {
        console.log(`💸 Retrait: ${withdrawal.id} (ref: ${withdrawal.reference})`)
        console.log(`   Statut avant: ${withdrawal.status}`)
        console.log(`   Montant: ${withdrawal.amount} FCFA`)
        console.log(`   Opérateur: ${withdrawal.operator}`)

        // Mettre à jour la référence de transaction si manquante
        if (!withdrawal.transaction_reference && (txId || refId)) {
          withdrawal.transaction_reference = txId || refId
          console.log('📝 transaction_reference mise à jour:', txId || refId)
        }

        if (status === 'SUCCESS') {
          // ========== RETRAIT RÉUSSI ==========
          withdrawal.status = 'completed'
          withdrawal.processed_at = DateTime.now()
          withdrawal.transaction_reference = txId || refId || withdrawal.transaction_reference
          await withdrawal.save()

          console.log('✅ Retrait marqué comme complété')

          // Créer l'historique
          await WithdrawalHistory.create({
            withdrawal_id: withdrawal.id,
            user_id: withdrawal.user_id,
            action: 'completed',
            old_status: 'processing',
            new_status: 'completed',
            amount: withdrawal.amount,
            notes: `✅ Retrait confirmé - ${operator} - ${txId || refId}`,
            ip_address: '0.0.0.0',
          })

          console.log('✅ [Rendu-Money] Retrait SUCCESS traité')

        } else if (status === 'FAILED' || status === 'CANCELLED') {
          // ========== RETRAIT ÉCHOUÉ ==========
          // Rembourser le wallet
          const wallet = await Wallet.query()
            .where('user_id', withdrawal.user_id)
            .first()

          if (wallet) {
            const currentBalance = Number(wallet.balance)
            wallet.balance = currentBalance + Number(withdrawal.amount)
            await wallet.save()
            console.log(`🔄 Wallet remboursé: +${withdrawal.amount} FCFA → ${wallet.balance} FCFA`)
          }

          withdrawal.status = 'failed'
          withdrawal.failure_reason = `Code: ${code} - ${message || 'Échec du retrait'}`
          await withdrawal.save()

          console.log('❌ Retrait marqué comme échoué')

          // Créer l'historique
          await WithdrawalHistory.create({
            withdrawal_id: withdrawal.id,
            user_id: withdrawal.user_id,
            action: 'failed',
            old_status: 'processing',
            new_status: 'failed',
            amount: withdrawal.amount,
            notes: `❌ Échec (${code}) - ${operator} - ${message || ''}`,
            ip_address: '0.0.0.0',
          })

          console.log('❌ [Rendu-Money] Retrait FAILED traité')

        } else if (status === 'PENDING') {
          // ========== RETRAIT EN ATTENTE ==========
          if (withdrawal.status === 'pending') {
            withdrawal.status = 'processing'
            await withdrawal.save()
          }

          // Créer l'historique
          await WithdrawalHistory.create({
            withdrawal_id: withdrawal.id,
            user_id: withdrawal.user_id,
            action: 'processing',
            old_status: withdrawal.status,
            new_status: 'processing',
            amount: withdrawal.amount,
            notes: `⏳ En attente - ${operator} - ${txId || refId}`,
            ip_address: '0.0.0.0',
          })

          console.log('⏳ [Rendu-Money] Retrait en attente')
        }

        // ✅ Mettre à jour les stats de retrait
        await this.updateWithdrawalStats(withdrawal.user_id)

      } else {
        console.log('⚠️ [Rendu-Money] AUCUN retrait trouvé !')
        console.log('   refId:', refId)
        console.log('   txId:', txId)

        // Afficher les derniers retraits pour debug
        const recentWithdrawals = await Withdrawal.query()
          .orderBy('created_at', 'desc')
          .limit(10)

        console.log('📋 10 derniers retraits:')
        for (const w of recentWithdrawals) {
          console.log(`   ${w.id} | ref: ${w.reference} | status: ${w.status} | amount: ${w.amount} | phone: ${w.account_number}`)
        }
      }

      // ✅ Toujours renvoyer 200
      return response.status(200).json({
        responseCode: 200,
        transactionId: txId || refId || 'unknown',
        message: 'Callback rendu-money traité'
      })

    } catch (error: any) {
      console.error('❌ [Rendu-Money] Erreur:', error.message)
      console.error('❌ Stack:', error.stack)

      return response.status(200).json({
        responseCode: 200,
        transactionId: 'error',
        message: 'Callback traité avec erreur'
      })
    }
  }

  /**
   * Mettre à jour les statistiques de retrait
   */
  private async updateWithdrawalStats(userId: string): Promise<void> {
    try {
      const stats = await UserWithdrawalStats.query()
        .where('user_id', userId)
        .first()

      if (stats) {
        const withdrawals = await Withdrawal.query()
          .where('user_id', userId)
          .where('status', 'completed')

        const totalAmount = withdrawals.reduce((sum: number, w: any) => sum + Number(w.amount), 0)

        stats.total_withdrawals = withdrawals.length
        stats.total_amount = totalAmount
        await stats.save()
      }
    } catch (error: any) {
      console.error('❌ [Stats] Erreur:', error.message)
    }
  }
}
