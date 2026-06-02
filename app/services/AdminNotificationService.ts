// app/services/AdminNotificationService.ts

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

      const orderItems = await OrderItem.query().where('order_id', order.id)
      const customer = await User.findBy('id', order.user_id)
      const adminCommission = amount * 0.03

      // ✅ CORRIGÉ : created_at au lieu de createdAt
      const orderDate = order.created_at 
        ? order.created_at.toFormat('dd/MM/yyyy à HH:mm')
        : new Date().toLocaleDateString('fr-FR')

      for (const admin of admins) {
        try {
          console.log(`📧 Envoi à l'admin: ${admin.full_name} (${admin.email})`)

          await mail.send((message) => {
            message
              .to(admin.email)
              .subject(`💰 Paiement reçu - Commande #${order.order_number} - ${amount} FCFA`)
              .htmlView('emails/admin_payment_notification', {
                admin: { name: admin.full_name, email: admin.email },
                order: {
                  id: order.id,
                  order_number: order.order_number,
                  total: order.total,
                },
                customer: customer ? {
                  name: customer.full_name,
                  email: customer.email,
                } : null,
                amount,
                adminCommission,
                orderDate,
                appName: env.get('APP_NAME', 'EdenMarket'),
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
      
      // ✅ CORRIGÉ : created_at au lieu de createdAt
      const orderDate = order.created_at 
        ? order.created_at.toFormat('dd/MM/yyyy à HH:mm')
        : new Date().toLocaleDateString('fr-FR')

      for (const admin of admins) {
        try {
          await mail.send((message) => {
            message
              .to(admin.email)
              .subject(`⚠️ Échec paiement - Commande #${order.order_number}`)
              .htmlView('emails/admin_payment_failed', {
                admin: { name: admin.full_name },
                order: {
                  id: order.id,
                  order_number: order.order_number,
                  total: order.total,
                },
                customer: customer ? {
                  name: customer.full_name,
                  email: customer.email,
                } : null,
                errorMessage,
                orderDate,
                appName: env.get('APP_NAME', 'EdenMarket'),
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
}
