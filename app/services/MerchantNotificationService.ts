// app/services/MerchantNotificationService.ts

import mail from '@adonisjs/mail/services/main'
import User from '#models/user'
import Order from '#models/order'
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
      console.log('📦 Nombre de produits:', products.length)

      const customer = await User.findBy('id', order.user_id)

      const merchant = await User.query()
        .where('email', merchantEmail)
        .first()
      
      const wallet = merchant ? await Wallet.findBy('user_id', merchant.id) : null

      const orderDate = order.createdAt 
        ? order.createdAt.toFormat('dd/MM/yyyy à HH:mm')
        : new Date().toLocaleDateString('fr-FR')

      const totalProducts = products.reduce((sum, p) => sum + p.quantity, 0)

      await mail.send((message) => {
        message
          .to(merchantEmail)
          .subject(`🛍️ Nouvelle vente ! +${merchantAmount} FCFA - Commande #${order.order_number}`)
          .htmlView('emails/merchant_sale_notification', {
            merchant: {
              name: merchantName,
              email: merchantEmail,
            },
            order: {
              id: order.id,
              order_number: order.order_number,
              total: order.total,
              shipping_cost: order.shipping_cost,
              payment_method: order.payment_method,
            },
            customer: customer ? {
              name: customer.full_name,
              email: customer.email,
              phone:
