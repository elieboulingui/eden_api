// app/controllers/CallbackController.ts

import type { HttpContext } from '@adonisjs/core/http'
import Order from '#models/Order'
import OrderItem from '#models/OrderItem'
import OrderTracking from '#models/order_tracking'
import User from '#models/user'
import Product from '#models/Product'
import Wallet from '#models/wallet'
import { DateTime } from 'luxon'
import OrderEmailService from '../services/OrderEmailService.js'
import AdminNotificationService from '../services/AdminNotificationService.js'
import MerchantNotificationService from '../services/MerchantNotificationService.js'
import crypto from 'node:crypto'

export default class CallbackController {

  private mapPaymentStatus(status: string): string {
    switch (status?.toUpperCase()) {
      case 'SUCCESS': return 'paid'
      case 'FAILED':
      case 'CANCELLED': return 'failed'
      case 'PENDING': return 'pending'
      default: return 'pending'
    }
  }

  async handle({ request, response }: HttpContext) {
    try {
      const data = request.body()

      const refId = data.merchantReferenceId || data.merchant_reference_id || data.reference_id || data.referenceId || data.reference || ''
      const txId = data.transactionId || data.transaction_id || data.id || ''
      const rawStatus = data.status || data.transactionStatus || 'UNKNOWN'
      const status = this.mapPaymentStatus(rawStatus)
      const operator = data.operator || data.operator_name || ''
      const code = data.code || data.status_code || ''
      const message = data.message || data.error_message || ''
      const amount = data.amount || data.total_amount || 0

      let order: Order | null = null

      if (refId) {
        order = await Order.query().where('payment_reference_id', refId).first()
      }

      if (!order && txId) {
        order = await Order.query().where('payment_reference_id', txId).first()
      }

      if (!order) {
        const searchTerm = refId || txId
        if (searchTerm) {
          const tracking = await OrderTracking.query().where('description', 'like', `%${searchTerm}%`).first()
          if (tracking) {
            order = await Order.find(tracking.order_id)
          }
        }
      }

      if (order) {
        if (order.payment_status === 'paid') {
          return response.ok({ message: 'Déjà traité' })
        }

        order.payment_status = status
        order.payment_transaction_id = txId || refId
        order.payment_operator_simple = operator
        order.payment_amount = amount

        if (status === 'paid') {
          order.status = 'paid'
          order.payment_completed_at = DateTime.now()
          await order.save()

          await OrderTracking.create({
            order_id: order.id,
            status: 'paid',
            description: `✅ Paiement confirmé ${amount} FCFA`,
            tracked_at: DateTime.now(),
          })

          const merchantEmails = await this.distributeMoney(order)

          try {
            await OrderEmailService.sendOrderConfirmation(order.id)

            if (merchantEmails && merchantEmails.length > 0) {
              const orderItems = await OrderItem.query().where('order_id', order.id)
              const merchantProductsMap: any = {}

              for (const item of orderItems) {
                const product = await Product.find(item.product_id)
                if (product && product.user_id) {
                  const merchant = await User.findBy('id', product.user_id)
                  const email: any = merchant?.email
                  if (email) {
                    if (!merchantProductsMap[email]) {
                      merchantProductsMap[email] = []
                    }
                    merchantProductsMap[email as string].push({
                      id: product.id,
                      name: product.name,
                      quantity: item.quantity,
                      price: item.price,
                      subtotal: item.subtotal,
                    } as any)
                  }
                }
              }

              for (const email of Object.keys(merchantProductsMap)) {
                const merchant = await User.query().where('email', email).first()
                if (merchant && merchant.email) {
                  const products = merchantProductsMap[email]
                  const merchantAmount = products.reduce((sum: number, p: any) => sum + (p.subtotal || 0), 0)
                  await MerchantNotificationService.sendNewSaleNotification(merchant.email, merchant.full_name ?? '', order, products, merchantAmount)
                }
              }
            }

            await AdminNotificationService.sendPaymentNotification(order, amount)
          } catch (emailError: any) {
            console.error('Erreur envoi emails:', emailError.message)
          }

        } else if (status === 'failed') {
          order.status = 'payment_failed'
          order.payment_error_message = `${code} - ${message}`
          await order.save()

          await OrderTracking.create({
            order_id: order.id,
            status: 'payment_failed',
            description: `❌ Paiement échoué`,
            tracked_at: DateTime.now(),
          })

          try {
            await AdminNotificationService.sendPaymentFailedNotification(order, `${code} - ${message}`)
          } catch (failedEmailError: any) {
            console.error('Erreur notification échec:', failedEmailError.message)
          }

        } else {
          await OrderTracking.create({
            order_id: order.id,
            status: 'pending_payment',
            description: `⏳ En attente`,
            tracked_at: DateTime.now(),
          })
        }
      }

      return response.ok({ responseCode: 200, transactionId: txId || refId || 'unknown' })

    } catch (error: any) {
      console.error('Erreur callback:', error.message)
      return response.ok({ responseCode: 200 })
    }
  }

  private async distributeMoney(order: Order): Promise<string[]> {
    const merchantEmails: string[] = []
    const items = await OrderItem.query().where('order_id', order.id)

    const merchantProducts = new Map<string, { productId: string; productName: string; price: number; quantity: number; subtotal: number }[]>()

    for (const item of items) {
      const product = await Product.find(item.product_id)
      if (!product || !product.user_id) continue

      const merchant = await User.findBy('id', product.user_id)
      if (merchant && merchant.email && !merchantEmails.includes(merchant.email)) {
        merchantEmails.push(merchant.email)
      }

      if (!merchantProducts.has(product.user_id)) {
        merchantProducts.set(product.user_id, [])
      }

      merchantProducts.get(product.user_id)!.push({
        productId: product.id,
        productName: product.name,
        price: Number(item.price),
        quantity: item.quantity,
        subtotal: Number(item.subtotal),
      })

      product.stock = Math.max(0, product.stock - item.quantity)
      if (product.stock === 0) product.isArchived = true
      await product.save()
    }

    const merchantIds = Array.from(merchantProducts.keys())
    const ADMIN_COMMISSION_RATE = 0.03
    const adminCommission = order.total * ADMIN_COMMISSION_RATE

    await this.creditAdminWallet(adminCommission)

    const totalAfterCommission = order.total - adminCommission
    const commissionRatio = totalAfterCommission / order.total

    for (const merchantId of merchantIds) {
      const merchant = await User.findBy('id', merchantId)
      if (!merchant) continue

      const products = merchantProducts.get(merchantId) || []
      let merchantTotal = 0
      for (const product of products) {
        merchantTotal += product.subtotal
      }

      const merchantAmount = merchantTotal * commissionRatio
      await this.creditWallet(merchant.id, merchantAmount)
    }

    if (order.shipping_cost > 0) {
      let needEdenLivreur = false

      for (const merchantId of merchantIds) {
        const merchant = await User.findBy('id', merchantId)
        if (merchant) {
          if (merchant.has_livreur) {
            const deliveryShare = order.shipping_cost / merchantIds.length
            await this.creditWallet(merchant.id, deliveryShare)
          } else {
            needEdenLivreur = true
          }
        }
      }

      if (needEdenLivreur) {
        let edenLivreur = await User.query().where('role', 'edenlivreur').where('is_verified', true).first()
        if (!edenLivreur) {
          edenLivreur = await this.createEdenLivreur()
        }

        await this.creditWallet(edenLivreur.id, order.shipping_cost)
        order.livreur_id = edenLivreur.id
        await order.save()

        await OrderTracking.create({
          order_id: order.id,
          status: 'paid',
          description: `🛵 Livreur Eden assigné: ${edenLivreur.full_name}`,
          tracked_at: DateTime.now(),
        })
      }
    }

    return merchantEmails
  }

  private async createEdenLivreur(): Promise<User> {
    const livreurId = crypto.randomUUID()
    const email = `edenlivreur_${Date.now()}@edenmarket.com`
    const password = crypto.randomUUID()

    const livreur = await User.create({
      id: livreurId,
      full_name: `Livreur Eden ${Date.now().toString().slice(-6)}`,
      email: email,
      password: password,
      role: 'edenlivreur',
      is_verified: true,
      is_available: true,
      is_online: true,
      verification_status: 'approved',
      total_deliveries: 0,
      total_earnings: 0,
      rating: 0,
      total_ratings: 0,
      is_phone_verified: false,
      is_email_verified: false,
      certify_truth: true,
      accept_escrow: true,
    })

    await Wallet.create({ user_id: livreur.id, balance: 0, currency: 'XAF', status: 'active' })
    return livreur
  }

  private async creditAdminWallet(amount: number): Promise<void> {
    try {
      const adminUser = await User.query().where('role', 'superadmin').orWhere('role', 'admin').first()
      if (!adminUser) return

      let wallet = await Wallet.findBy('user_id', adminUser.id)
      if (!wallet) {
        wallet = await Wallet.create({ user_id: adminUser.id, balance: 0, currency: 'XAF', status: 'active' })
      }

      wallet.balance += amount
      await wallet.save()
    } catch (error: any) {
      console.error('Erreur credit admin:', error)
    }
  }

  private async creditWallet(userId: string, amount: number): Promise<void> {
    try {
      let wallet = await Wallet.findBy('user_id', userId)
      if (!wallet) {
        wallet = await Wallet.create({ user_id: userId, balance: 0, currency: 'XAF', status: 'active' })
      }

      wallet.balance += amount
      await wallet.save()
    } catch (error: any) {
      console.error('Erreur credit wallet:', error)
      throw error
    }
  }
}
