// app/services/MerchantNotificationService.ts

import mail from '@adonisjs/mail/services/main'
import User from '#models/user'
import Order from '#models/Order'
import Wallet from '#models/wallet'
import env from '#start/env'

export default class MerchantNotificationService {

  static async sendNewSaleNotification(
    merchantEmail: string,
    merchantName: string,
    order: Order,
    products: any[],
    merchantAmount: number
  ): Promise<void> {
    try {
      console.log('\n📧 ===== SERVICE NOTIFICATION MARCHAND =====')
      console.log('📧 Email:', merchantEmail)
      console.log('👤 Marchand:', merchantName)
      console.log('📦 Commande #:', order.order_number)
      console.log('💰 Montant vendeur:', merchantAmount, 'FCFA')

      // ✅ CORRIGÉ : created_at au lieu de createdAt
      const orderDate = order.created_at 
        ? order.created_at.toFormat('dd/MM/yyyy à HH:mm')
        : new Date().toLocaleDateString('fr-FR')

      await mail.send((message) => {
        message
          .to(merchantEmail)
          .subject(`🛍️ Nouvelle vente ! +${merchantAmount} FCFA - Commande #${order.order_number}`)
          .htmlView('emails/merchant_sale_notification', {
            merchant: { name: merchantName, email: merchantEmail },
            order: {
              id: order.id,
              order_number: order.order_number,
              total: order.total,
            },
            products,
            merchantAmount,
            orderDate,
            appName: env.get('APP_NAME', 'EdenMarket'),
          })
      })

      console.log(`✅ Email notification envoyé au marchand: ${merchantEmail}`)
    } catch (error) {
      console.error('❌ Erreur envoi email marchand:', error)
      throw error
    }
  }
}
