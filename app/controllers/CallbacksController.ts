// app/services/AdminNotificationService.ts - VERSION CORRIGÉE

import mail from '@adonisjs/mail/services/main'
import User from '#models/user'
import Order from '#models/Order'
import OrderItem from '#models/OrderItem'
import Product from '#models/Product'
import env from '#start/env'

export default class AdminNotificationService {

  static async sendPaymentNotification(
    order: Order,
    amount: number
  ): Promise<void> {
    try {
      console.log('\n📧 ===== SERVICE NOTIFICATION ADMIN =====')
      console.log('📦 Commande #:', order.order_number)
      console.log('💰 Montant:', amount, 'FCFA')

      const admins = await User.query()
        .where('role', 'superadmin')
        .orWhere('role', 'admin')
        .whereNotNull('email')
        .where('is_verified', true)

      if (admins.length === 0) {
        console.log('⚠️ Aucun admin trouvé pour notification')
        return
      }

      console.log(`📊 ${admins.length} admin(s) trouvé(s)`)

      const orderItems = await OrderItem.query()
        .where('order_id', order.id)

      const customer = await User.findBy('id', order.user_id)

      const adminCommission = amount * 0.03

      const orderDate = order.createdAt 
        ? order.createdAt.toFormat('dd/MM/yyyy à HH:mm')
        : new Date().toLocaleDateString('fr-FR')

      const sellerProducts = new Map()
      
      for (const item of orderItems) {
        const product = await Product.find(item.product_id)
        
        if (product) {
          const seller = await User.findBy('id', product.user_id)
          const sellerId = seller?.id || 'unknown'
          
          if (!sellerProducts.has(sellerId)) {
            sellerProducts.set(sellerId, {
              seller: seller ? {
                id: seller.id,
                name: seller.full_name,
                email: seller.email,
              } : { id: 'unknown', name: 'Inconnu', email: 'N/A' },
              products: [],
              total: 0
            })
          }
          
          sellerProducts.get(sellerId).products.push({
            name: product.name,
            quantity: item.quantity,
            price: item.price,
            subtotal: item.subtotal,
          })
          
          sellerProducts.get(sellerId).total += item.subtotal
        }
      }

      for (const admin of admins) {
        try {
          console.log(`📧 Envoi à l'admin: ${admin.full_name} (${admin.email})`)

          await mail.send((message) => {
            message
              .to(admin.email)
              .subject(`💰 Paiement reçu - Commande #${order.order_number} - ${amount} FCFA`)
              .htmlView('emails/admin_payment_notification', {
                admin: {
                  name: admin.full_name,
                  email: admin.email,
                },
                order: {
                  id: order.id,
                  order_number: order.order_number,
                  total: order.total,
                  subtotal: order.subtotal,
                  shipping_cost: order.shipping_cost,
                  payment_method: order.payment_method,
                  payment_transaction_id: order.payment_transaction_id,
                },
                customer: customer ? {
                  name: customer.full_name,
                  email: customer.email,
                  phone: customer.phone || 'N/A',
                } : null,
                amount,
                adminCommission,
                commissionRate: '3%',
                sellerProducts: Array.from(sellerProducts.values()),
                orderDate,
                totalSellers: sellerProducts.size,
                appName: env.get('APP_NAME', 'EdenMarket'),
                appUrl: env.get('APP_URL', 'https://edenmarket.com'),
                adminDashboardUrl: `${env.get('APP_URL')}/admin/orders/${order.id}`,
              })
          })

          console.log(`✅ Email envoyé à l'admin: ${admin.email}`)

        } catch (error) {
          console.error(`❌ Erreur envoi admin ${admin.email}:`, error)
        }
      }

      console.log('✅ Service notification admin terminé')

    } catch (error) {
      console.error('❌ Erreur service notification admin:', error)
      throw error
    }
  }

  static async sendPaymentFailedNotification(
    order: Order,
    errorMessage: string
  ): Promise<void> {
    try {
      console.log('\n📧 ===== NOTIFICATION ADMIN - PAIEMENT ÉCHOUÉ =====')
      console.log('📦 Commande #:', order.order_number)
      console.log('❌ Erreur:', errorMessage)

      const admins = await User.query()
        .where('role', 'superadmin')
        .orWhere('role', 'admin')
        .whereNotNull('email')
        .where('is_verified', true)

      if (admins.length === 0) {
        console.log('⚠️ Aucun admin trouvé pour notification')
        return
      }

      const customer = await User.findBy('id', order.user_id)
      const orderDate = order.createdAt 
        ? order.createdAt.toFormat('dd/MM/yyyy à HH:mm')
        : new Date().toLocaleDateString('fr-FR')

      for (const admin of admins) {
        try {
          await mail.send((message) => {
            message
              .to(admin.email)
              .subject(`⚠️ Échec paiement - Commande #${order.order_number}`)
              .htmlView('emails/admin_payment_failed', {
                admin: {
                  name: admin.full_name,
                  email: admin.email,
                },
                order: {
                  id: order.id,
                  order_number: order.order_number,
                  total: order.total,
                },
                customer: customer ? {
                  name: customer.full_name,
                  email: customer.email,
                  phone: customer.phone || 'N/A',
                } : null,
                errorMessage,
                orderDate,
                appName: env.get('APP_NAME', 'EdenMarket'),
                adminUrl: `${env.get('APP_URL')}/admin/orders/${order.id}`,
              })
          })

          console.log(`✅ Notification échec envoyée à: ${admin.email}`)

        } catch (error) {
          console.error(`❌ Erreur notification admin ${admin.email}:`, error)
        }
      }

    } catch (error) {
      console.error('❌ Erreur notification échec admin:', error)
      throw error
    }
  }

  static async sendNewSellerNotification(seller: User): Promise<void> {
    try {
      console.log('\n📧 ===== NOTIFICATION ADMIN - NOUVEAU VENDEUR =====')
      console.log('👤 Vendeur:', seller.full_name)
      console.log('📧 Email:', seller.email)

      const admins = await User.query()
        .where('role', 'superadmin')
        .orWhere('role', 'admin')
        .whereNotNull('email')
        .where('is_verified', true)

      for (const admin of admins) {
        try {
          await mail.send((message) => {
            message
              .to(admin.email)
              .subject(`🆕 Nouveau vendeur inscrit - ${seller.full_name}`)
              .htmlView('emails/admin_new_seller', {
                admin: {
                  name: admin.full_name,
                },
                seller: {
                  name: seller.full_name,
                  email: seller.email,
                  phone: seller.phone || 'N/A',
                  registrationDate: seller.created_at 
                    ? seller.created_at.toFormat('dd/MM/yyyy à HH:mm')
                    : new Date().toLocaleDateString('fr-FR'),
                },
                appName: env.get('APP_NAME', 'EdenMarket'),
                adminUrl: `${env.get('APP_URL')}/admin/sellers/${seller.id}`,
              })
          })

          console.log(`✅ Notification envoyée à: ${admin.email}`)

        } catch (error) {
          console.error(`❌ Erreur notification admin ${admin.email}:`, error)
        }
      }

    } catch (error) {
      console.error('❌ Erreur notification nouveau vendeur:', error)
      throw error
    }
  }

  static async sendDailySalesReport(
    date: string,
    totalSales: number,
    totalOrders: number,
    totalCommission: number,
    topSellers: any[]
  ): Promise<void> {
    try {
      console.log('\n📧 ===== RAPPORT JOURNALIER ADMINS =====')
      console.log('📅 Date:', date)
      console.log('💰 Ventes totales:', totalSales, 'FCFA')
      console.log('📦 Commandes:', totalOrders)
      console.log('💸 Commissions:', totalCommission, 'FCFA')

      const admins = await User.query()
        .where('role', 'superadmin')
        .orWhere('role', 'admin')
        .whereNotNull('email')
        .where('is_verified', true)

      for (const admin of admins) {
        try {
          await mail.send((message) => {
            message
              .to(admin.email)
              .subject(`📊 Rapport journalier - ${date}`)
              .htmlView('emails/admin_daily_report', {
                admin: {
                  name: admin.full_name,
                },
                date,
                totalSales,
                totalOrders,
                totalCommission,
                topSellers,
                appName: env.get('APP_NAME', 'EdenMarket'),
                adminDashboardUrl: `${env.get('APP_URL')}/admin/dashboard`,
              })
          })

          console.log(`✅ Rapport envoyé à: ${admin.email}`)

        } catch (error) {
          console.error(`❌ Erreur rapport admin ${admin.email}:`, error)
        }
      }

    } catch (error) {
      console.error('❌ Erreur rapport journalier:', error)
      throw error
    }
  }
}
