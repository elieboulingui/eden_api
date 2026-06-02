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
              phone: customer.phone || 'N/A',
            } : {
              name: 'Client',
              email: 'N/A',
              phone: 'N/A',
            },
            products,
            merchantAmount,
            totalProducts,
            orderDate,
            wallet: wallet ? {
              balance: wallet.balance,
              currency: wallet.currency,
            } : null,
            appName: env.get('APP_NAME', 'EdenMarket'),
            appUrl: env.get('APP_URL', 'https://edenmarket.com'),
            sellerDashboardUrl: `${env.get('APP_URL')}/seller/orders/${order.id}`,
            sellerProductsUrl: `${env.get('APP_URL')}/seller/products`,
          })
      })

      console.log(`✅ Email notification envoyé au marchand: ${merchantEmail}`)

    } catch (error) {
      console.error('❌ Erreur envoi email marchand:', error)
      throw error
    }
  }

  static async sendLowStockNotification(
    merchantEmail: string,
    merchantName: string,
    product: any
  ): Promise<void> {
    try {
      console.log('\n📧 ===== NOTIFICATION MARCHAND - STOCK BAS =====')
      console.log('📧 Email:', merchantEmail)
      console.log('👤 Marchand:', merchantName)
      console.log('📦 Produit:', product.name)
      console.log('📊 Stock restant:', product.stock)

      await mail.send((message) => {
        message
          .to(merchantEmail)
          .subject(`⚠️ Stock faible - ${product.name}`)
          .htmlView('emails/merchant_low_stock', {
            merchant: {
              name: merchantName,
              email: merchantEmail,
            },
            product: {
              id: product.id,
              name: product.name,
              stock: product.stock,
              price: product.price,
              image: product.image_url,
            },
            appName: env.get('APP_NAME', 'EdenMarket'),
            editProductUrl: `${env.get('APP_URL')}/seller/products/${product.id}/edit`,
          })
      })

      console.log(`✅ Notification stock faible envoyée à: ${merchantEmail}`)

    } catch (error) {
      console.error('❌ Erreur notification stock:', error)
      throw error
    }
  }

  static async sendWalletCreditNotification(
    merchantEmail: string,
    merchantName: string,
    amount: number,
    description: string,
    newBalance: number
  ): Promise<void> {
    try {
      console.log('\n📧 ===== NOTIFICATION MARCHAND - CRÉDIT WALLET =====')
      console.log('📧 Email:', merchantEmail)
      console.log('👤 Marchand:', merchantName)
      console.log('💰 Montant crédité:', amount, 'FCFA')
      console.log('📝 Description:', description)
      console.log('💼 Nouveau solde:', newBalance, 'FCFA')

      const creditDate = new Date().toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })

      await mail.send((message) => {
        message
          .to(merchantEmail)
          .subject(`💰 Crédit de ${amount} FCFA sur votre portefeuille`)
          .htmlView('emails/merchant_wallet_credit', {
            merchant: {
              name: merchantName,
              email: merchantEmail,
            },
            amount,
            description,
            newBalance,
            creditDate,
            appName: env.get('APP_NAME', 'EdenMarket'),
            walletUrl: `${env.get('APP_URL')}/seller/wallet`,
          })
      })

      console.log(`✅ Notification crédit wallet envoyée à: ${merchantEmail}`)

    } catch (error) {
      console.error('❌ Erreur notification crédit wallet:', error)
      throw error
    }
  }

  static async sendMonthlySalesReport(
    merchantEmail: string,
    merchantName: string,
    month: string,
    year: number,
    totalSales: number,
    totalOrders: number,
    topProducts: any[],
    monthlyEarnings: number
  ): Promise<void> {
    try {
      console.log('\n📧 ===== RAPPORT MENSUEL MARCHAND =====')
      console.log('📧 Email:', merchantEmail)
      console.log('👤 Marchand:', merchantName)
      console.log('📅 Période:', `${month} ${year}`)
      console.log('💰 Ventes:', totalSales, 'FCFA')
      console.log('📦 Commandes:', totalOrders)

      await mail.send((message) => {
        message
          .to(merchantEmail)
          .subject(`📊 Rapport mensuel - ${month} ${year}`)
          .htmlView('emails/merchant_monthly_report', {
            merchant: {
              name: merchantName,
              email: merchantEmail,
            },
            month,
            year,
            totalSales,
            totalOrders,
            topProducts,
            monthlyEarnings,
            appName: env.get('APP_NAME', 'EdenMarket'),
            dashboardUrl: `${env.get('APP_URL')}/seller/dashboard`,
          })
      })

      console.log(`✅ Rapport mensuel envoyé à: ${merchantEmail}`)

    } catch (error) {
      console.error('❌ Erreur rapport mensuel:', error)
      throw error
    }
  }

  static async sendWelcomeNotification(
    merchantEmail: string,
    merchantName: string
  ): Promise<void> {
    try {
      console.log('\n📧 ===== EMAIL BIENVENUE MARCHAND =====')
      console.log('📧 Email:', merchantEmail)
      console.log('👤 Marchand:', merchantName)

      await mail.send((message) => {
        message
          .to(merchantEmail)
          .subject(`🎉 Bienvenue sur ${env.get('APP_NAME', 'EdenMarket')} !`)
          .htmlView('emails/merchant_welcome', {
            merchant: {
              name: merchantName,
              email: merchantEmail,
            },
            appName: env.get('APP_NAME', 'EdenMarket'),
            appUrl: env.get('APP_URL', 'https://edenmarket.com'),
            sellerDashboardUrl: `${env.get('APP_URL')}/seller/dashboard`,
            addProductUrl: `${env.get('APP_URL')}/seller/products/create`,
            helpUrl: `${env.get('APP_URL')}/help/sellers`,
          })
      })

      console.log(`✅ Email de bienvenue envoyé à: ${merchantEmail}`)

    } catch (error) {
      console.error('❌ Erreur email bienvenue:', error)
      throw error
    }
  }
}
