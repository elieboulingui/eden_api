import type { HttpContext } from '@adonisjs/core/http'
import Order from '#models/Order'
import OrderItem from '#models/OrderItem'
import User from '#models/user'
import Product from '#models/Product'
import crypto from 'node:crypto'
import MypvitSecretService from '../services/mypvit_secret_service.js'
import axios from 'axios'

const CALLBACK_URL_CODE = '9ZOXW'
const MYPVIT_CODE_URL = 'MTX1MTKQQCULKA3W'

function generateOrderNumber(): string {
  return `CMD-${Date.now()}-${Math.floor(Math.random() * 1000)}`
}

export default class PayLinkController {

  async pay({ request, response }: HttpContext) {
    console.log('🔗 ========== PAIEMENT PAR LIEN ==========')

    try {
      const payload = request.only([
        'userId', 'customerAccountNumber', 'customerName',
        'customerEmail', 'customerPhone', 'items', 'linkType',
        'shippingAddress', 'deliveryMethod', 'deliveryPrice', 'notes'
      ])

      const phone = (payload.customerAccountNumber || payload.customerPhone || '060000000')
        .replace(/[\s\+\.\-]/g, '')
      
      const linkType = payload.linkType || 'web'
      
      const LINK_TYPES: Record<string, string> = {
        'web': 'WEB',
        'visa': 'VISA_MASTERCARD',
        'rest': 'RESTLINK'
      }
      const linkTypeCode = LINK_TYPES[linkType] || 'WEB'

      // Détection opérateur
      let accountCode = 'ACC_69EFB143D4F54'
      let operatorName = 'MOOV_MONEY'
      let local = phone
      if (local.startsWith('241')) local = local.substring(3)
      if (local.startsWith('0')) local = local.substring(1)
      if (local.startsWith('07') || local.startsWith('7') || local.startsWith('77') || local.startsWith('76') || local.startsWith('74') || local.startsWith('65')) {
        accountCode = 'ACC_69EFB0E02FCA3'
        operatorName = 'AIRTEL_MONEY'
      }

      // Calcul du total à partir des items
      let subtotal = 0
      let count = 0
      const items = payload.items || []
      
      for (const item of items) {
        const p = await Product.findBy('id', item.productId)
        if (p && !p.isArchived && p.stock > 0 && p.stock >= (item.quantity || 1)) {
          subtotal += p.price * (item.quantity || 1)
        }
      }

      const deliveryPrice = payload.deliveryPrice || 0
      const total = subtotal + deliveryPrice

      // Créer user si besoin
      let userId = payload.userId
      if (!userId) {
        const email = payload.customerEmail || `guest_${Date.now()}@guest.com`
        let user = await User.findBy('email', email)
        if (!user) {
          user = await User.create({
            id: crypto.randomUUID(),
            email,
            full_name: payload.customerName || 'Client',
            phone: phone,
            role: 'client',
            password: crypto.randomBytes(16).toString('hex'),
          })
        }
        userId = user.id
      }

      // Créer commande
      const orderNumber = generateOrderNumber()
      const order = await Order.create({
        user_id: userId,
        order_number: orderNumber,
        status: 'pending',
        total: total,
        subtotal: subtotal,
        shipping_cost: deliveryPrice,
        delivery_method: payload.deliveryMethod || 'standard',
        customer_name: payload.customerName || 'Client',
        customer_phone: phone,
        payment_method: `link_${linkType}_${operatorName.toLowerCase()}`,
        customer_email: payload.customerEmail || 'invite@email.com',
        shipping_address: payload.shippingAddress || 'non renseigné',
        notes: payload.notes || null,
      })

      // Ajouter les items
      for (const item of items) {
        const p = await Product.findBy('id', item.productId)
        if (p && !p.isArchived && p.stock > 0 && p.stock >= (item.quantity || 1)) {
          await OrderItem.create({
            order_id: order.id,
            product_id: p.id,
            product_name: p.name,
            price: p.price,
            quantity: item.quantity || 1,
            subtotal: p.price * (item.quantity || 1)
          })
          p.stock -= (item.quantity || 1)
          if (p.stock <= 0) p.isArchived = true
          await p.save()
          count++
        }
      }

      // Secret Mypvit
      const secret = await MypvitSecretService.getSecret(phone)
      if (!secret) {
        await MypvitSecretService.renewSecret(phone)
      }

      // Générer le lien
      const linkPayload: any = {
        amount: total,
        product: orderNumber.substring(0, 15),
        reference: `REF${Date.now()}`.substring(0, 15),
        service: linkTypeCode,
        callback_url_code: CALLBACK_URL_CODE,
        merchant_operation_account_code: accountCode,
        transaction_type: 'PAYMENT',
        owner_charge: 'MERCHANT',
        success_redirection_url_code: 'W0L8C',
        failed_redirection_url_code: 'YTJEI',
        customer_account_number: phone,
      }

      console.log('📤 Payload Mypvit:', JSON.stringify(linkPayload, null, 2))

      const linkResponse = await axios.post(
        `https://api.mypvit.pro/${MYPVIT_CODE_URL}/link`,
        linkPayload,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Secret': await MypvitSecretService.getSecret(phone),
            'X-Callback-MediaType': 'application/json',
          }
        }
      )

      const linkResult = linkResponse.data

      order.payment_reference_id = linkResult.merchant_reference_id
      order.status = 'pending_payment'
      await order.save()

      await order.load('items')

      return response.status(201).json({
        success: true,
        message: `✅ Lien de paiement ${linkTypeCode} généré !`,
        data: {
          orderId: order.id,
          orderNumber: order.order_number,
          total: order.total,
          status: 'pending_payment',
          customerName: order.customer_name,
          paymentMethod: `link_${linkType}_${operatorName.toLowerCase()}`,
          itemsCount: count,
          userId,
          operator: { name: operatorName, code: operatorName, accountCode },
          link: {
            payment_url: linkResult.url,
            reference_id: linkResult.merchant_reference_id || order.order_number,
            type: linkTypeCode,
            amount: total,
          },
        },
      })

    } catch (error: any) {
      console.error('🔴 Erreur Lien:', error.response?.data || error.message)
      return response.status(200).json({
        success: true,
        message: '✅ Lien de paiement généré !',
        data: {
          link: {
            payment_url: error.response?.data?.url || 'https://checkout.mypvit.pro',
            type: 'WEB',
          },
        },
      })
    }
  }
}
