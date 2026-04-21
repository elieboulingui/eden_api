// app/controllers/OrdersController.ts
import type { HttpContext } from '@adonisjs/core/http'
import Order from '#models/Order'
import OrderItem from '#models/OrderItem'
import OrderTracking from '#models/order_tracking'
import Cart from '#models/Cart'
import CartItem from '#models/CartItem'
import User from '#models/user'
import Product from '#models/Product'
import Wallet from '#models/wallet'
import axios from 'axios'
import { DateTime } from 'luxon'

// ==================== CONSTANTES ====================
const PAYMENT_API_URL = 'https://apist.onrender.com'
const API_KEYS = {
  public: 'pk_1773325888803_dt8diavuh3h',
  secret: 'sk_1773325888803_qt015a3cr5'
}

// ==================== INTERFACES ====================
interface PaymentInfo {
  reference_id: string
  x_secret: string
  status: string
  amount: number
  operator_simple: string
  transaction_type: string
  check_status_url: string
  code_url: string
  qr_code_url?: string
}

interface QRCodeResponse {
  success: boolean
  message?: string
  data?: {
    qr_code_url: string
    reference_id: string
    amount: number
    expires_in: number
    transaction_ref: string
  }
}

interface OrderData {
  userId: string
  items: Array<{
    productId?: string
    id?: string
    price: number
    quantity: number
  }>
  customerAccountNumber: string
  customerName: string
  customerEmail?: string
  deliveryMethod: string
  deliveryPrice: number
  shippingAddress: string
  notes?: string
  amount: number
}

// ==================== UTILITAIRES ====================
function isValidUuid(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)
}

function generateOrderNumber(): string {
  return `CMD-${Date.now()}-${Math.floor(Math.random() * 1000)}`
}

function getStatusDescription(status: string): string {
  const descriptions: Record<string, string> = {
    pending: 'Commande confirmée et en attente de traitement',
    processing: 'Votre commande est en cours de préparation',
    shipped: 'Votre commande a été expédiée',
    delivered: 'Votre commande a été livrée avec succès',
    paid: 'Paiement effectué avec succès',
    pending_payment: 'Paiement en attente de confirmation',
    payment_failed: 'Le paiement a échoué',
    cancelled: 'Votre commande a été annulée',
  }
  return descriptions[status] || `Statut mis à jour: ${status}`
}

export default class OrdersController {

  // ==================== QR CODE : GÉNÉRATION ====================
  /**
   * Générer un QR Code de paiement (sans créer la commande)
   * POST /api/orders/generate-qr
   */
  async generateQRCode({ request, response }: HttpContext) {
    console.log('🔵 [QRCode] ========== GÉNÉRATION QR CODE ==========')

    try {
      const payload = request.only([
        'amount',
        'customerAccountNumber',
        'customerName',
        'customerEmail',
        'items',
        'deliveryMethod',
        'deliveryPrice',
        'shippingAddress',
        'notes',
        'userId'
      ])

      // Validation
      if (!payload.amount || payload.amount <= 0) {
        return response.status(400).json({
          success: false,
          message: 'Le montant est requis et doit être supérieur à 0'
        })
      }

      if (!payload.customerAccountNumber) {
        return response.status(400).json({
          success: false,
          message: 'Le numéro de téléphone est requis'
        })
      }

      console.log('📊 Données QR:', {
        amount: payload.amount,
        customerAccountNumber: payload.customerAccountNumber,
        itemsCount: payload.items?.length || 0
      })

      const transactionRef = `QR-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`

      // Appel à l'API de génération QR Code
      const qrResponse = await axios.post<QRCodeResponse>(
        `${PAYMENT_API_URL}/api/mypvit/qr-code/direct/generate`,
        {
          amount: payload.amount,
          payment_api_key_public: API_KEYS.public,
          payment_api_key_secret: API_KEYS.secret,
          customer_account_number: payload.customerAccountNumber,
          description: `Commande e-commerce - ${payload.items?.length || 0} article(s)`,
          external_reference: transactionRef
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 30000
        }
      )

      const qrData = qrResponse.data
      console.log('📡 Réponse QR:', {
        success: qrData.success,
        hasQrCode: !!qrData.data?.qr_code_url,
        referenceId: qrData.data?.reference_id
      })

      if (qrData.success && qrData.data) {
        return response.status(200).json({
          success: true,
          message: 'QR Code généré avec succès',
          data: {
            qr_code_url: qrData.data.qr_code_url,
            reference_id: qrData.data.reference_id || transactionRef,
            amount: payload.amount,
            expires_in: 600,
            transaction_ref: transactionRef,
            order_data: {
              userId: payload.userId,
              items: payload.items,
              customerAccountNumber: payload.customerAccountNumber,
              customerName: payload.customerName,
              customerEmail: payload.customerEmail,
              deliveryMethod: payload.deliveryMethod,
              deliveryPrice: payload.deliveryPrice,
              shippingAddress: payload.shippingAddress,
              notes: payload.notes,
              amount: payload.amount
            }
          }
        })
      }

      return response.status(400).json({
        success: false,
        message: qrData.message || 'Échec de la génération du QR Code'
      })

    } catch (error: any) {
      console.error('❌ [QRCode] Erreur:', error.message)
      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la génération du QR Code',
        error: error.message
      })
    }
  }

  // ==================== QR CODE : CONFIRMATION ====================
  /**
   * Confirmer un paiement QR et créer la commande
   * POST /api/orders/confirm-qr-payment
   */
  async confirmQRPayment({ request, response }: HttpContext) {
    console.log('🔵 [QRCode] ========== CONFIRMATION PAIEMENT QR ==========')

    try {
      const { reference_id, order_data } = request.only(['reference_id', 'order_data'])

      if (!reference_id) {
        return response.status(400).json({
          success: false,
          message: 'reference_id est requis'
        })
      }

      if (!order_data) {
        return response.status(400).json({
          success: false,
          message: 'order_data est requis'
        })
      }

      console.log('🔑 Vérification référence:', reference_id)

      // Vérifier le statut du paiement
      const statusResponse = await axios.get(
        `${PAYMENT_API_URL}/api/check-status/${reference_id}`,
        { timeout: 10000 }
      )

      const statusData = statusResponse.data
      console.log('📊 Statut paiement:', {
        success: statusData.success,
        is_success: statusData.is_success,
        status: statusData.status
      })

      // Paiement en attente
      if (statusData.is_pending === true) {
        return response.status(202).json({
          success: true,
          is_pending: true,
          message: 'Paiement en attente. Veuillez scanner le QR Code.',
          data: { reference_id, status: statusData.status }
        })
      }

      // Paiement échoué
      if (statusData.is_success !== true) {
        return response.status(400).json({
          success: false,
          is_failed: true,
          message: 'Le paiement a échoué ou a expiré.',
          data: { reference_id, status: statusData.status }
        })
      }

      // Paiement réussi → Créer la commande
      console.log('✅ PAIEMENT QR CONFIRMÉ - CRÉATION DE LA COMMANDE...')
      
      const orderData = order_data as OrderData
      const order = await this.createOrderFromQRPayment(
        orderData,
        reference_id,
        statusData
      )

      return response.status(201).json({
        success: true,
        message: '✅ Paiement confirmé et commande créée avec succès !',
        data: {
          orderId: order.id,
          orderNumber: order.order_number,
          total: order.total,
          status: order.status,
          customerName: order.customer_name,
          paymentMethod: order.payment_method,
          itemsCount: order.items?.length || 0,
          payment: {
            success: true,
            reference_id,
            status: statusData.status,
            amount: statusData.amount
          }
        }
      })

    } catch (error: any) {
      console.error('❌ [QRCode] Erreur confirmation:', error.message)
      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la confirmation du paiement QR',
        error: error.message
      })
    }
  }

  // ==================== QR CODE : VÉRIFICATION STATUT ====================
  /**
   * Vérifier le statut d'un paiement QR
   * GET /api/orders/check-qr-payment/:referenceId
   */
  async checkQRPaymentStatus({ params, response }: HttpContext) {
    try {
      const { referenceId } = params

      if (!referenceId) {
        return response.status(400).json({
          success: false,
          message: 'referenceId est requis'
        })
      }

      console.log(`🔍 Vérification statut QR: ${referenceId}`)

      const statusResponse = await axios.get(
        `${PAYMENT_API_URL}/api/check-status/${referenceId}`,
        { timeout: 10000 }
      )

      const statusData = statusResponse.data

      return response.status(200).json({
        success: true,
        data: {
          reference_id: referenceId,
          status: statusData.status,
          is_success: statusData.is_success === true,
          is_pending: statusData.is_pending === true,
          is_failed: statusData.is_failed === true,
          amount: statusData.amount,
          message: statusData.message || null
        }
      })

    } catch (error: any) {
      console.error('❌ Erreur vérification statut QR:', error.message)
      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la vérification du statut',
        error: error.message
      })
    }
  }

  // ==================== MÉTHODE PRIVÉE : CRÉER COMMANDE DEPUIS QR ====================
  private async createOrderFromQRPayment(
    orderData: OrderData,
    referenceId: string,
    _paymentStatus: any  // ✅ FIX TS6133: préfixe _ pour paramètre intentionnellement inutilisé
  ): Promise<Order> {
    const user = await User.findBy('id', orderData.userId)
    if (!user) {
      throw new Error('Utilisateur non trouvé')
    }

    let subtotal = 0
    for (const item of orderData.items) {
      subtotal += item.price * item.quantity
    }

    const total = subtotal + (orderData.deliveryPrice || 0)
    const orderNumber = generateOrderNumber()

    const order = await Order.create({
      user_id: orderData.userId,
      order_number: orderNumber,
      status: 'paid',
      total,
      subtotal,
      shipping_cost: orderData.deliveryPrice || 0,
      delivery_method: orderData.deliveryMethod || 'standard',
      customer_name: orderData.customerName || user.full_name || 'Client',
      customer_phone: orderData.customerAccountNumber,
      payment_method: 'QR Code',
      customer_email: orderData.customerEmail || user.email,
      shipping_address: orderData.shippingAddress || 'Non renseigné',
      billing_address: orderData.shippingAddress || 'Non renseigné',
      notes: orderData.notes || null,
    })

    console.log(`✅ Commande créée: ${order.order_number}`)

    // Sauvegarder les items et mettre à jour le stock
    for (const item of orderData.items) {
      const productId = item.productId || item.id
      const product = await Product.findBy('id', productId)

      if (product) {
        await OrderItem.create({
          order_id: order.id,
          product_id: product.id,
          product_name: product.name,
          product_description: product.description,
          price: item.price,
          quantity: item.quantity,
          category: product.category,
          image: product.image_url,
          subtotal: item.price * item.quantity,
        })

        product.stock = product.stock - item.quantity
        await product.save()
        console.log(`📦 Stock: ${product.name} → ${product.stock}`)
      }
    }

    // Tracking
    await OrderTracking.create({
      order_id: order.id,
      status: 'paid',
      description: `Paiement QR Code confirmé - Réf: ${referenceId} - Montant: ${total} FCFA`,
      tracked_at: DateTime.now(),
    })

    // Vider le panier
    const cart = await Cart.query().where('user_id', orderData.userId).first()
    if (cart) {
      await CartItem.query().where('cart_id', cart.id).delete()
      console.log('✅ Panier vidé')
    }

    // Créditer vendeurs et admin
    await this.creditSellersAndAdminByOrder(order.id, total)

    await order.load('items')
    return order
  }

  // ==================== MÉTHODE PRIVÉE : CRÉDITER VENDEURS ET ADMIN ====================
  private async creditSellersAndAdminByOrder(orderId: string, totalAmount: number): Promise<void> {
    try {
      const items = await OrderItem.query().where('order_id', orderId)
      const sellerSales = new Map<string, number>()

      for (const item of items) {
        const product = await Product.findBy('id', item.product_id)
        if (product) {
          const current = sellerSales.get(product.user_id) || 0
          sellerSales.set(product.user_id, current + item.subtotal)
        }
      }

      // Superadmin (0.5%)
      const superAdminFee = totalAmount * 0.005
      const superAdmin = await User.query().where('role', 'superadmin').first()
      
      if (superAdmin) {
        await this.creditWallet(superAdmin.id, superAdminFee)
        console.log(`✅ Superadmin crédité: ${superAdminFee} FCFA`)
      }

      // Vendeurs
      for (const [sellerId, amount] of sellerSales.entries()) {
        await this.creditWallet(sellerId, amount)
        console.log(`✅ Vendeur ${sellerId} crédité: ${amount} FCFA`)
      }

    } catch (error: any) {
      console.error('❌ Erreur crédit vendeurs:', error.message)
    }
  }

  // ==================== MÉTHODE PRIVÉE : CRÉDITER WALLET ====================
  private async creditWallet(userId: string, amount: number): Promise<void> {
    let wallet = await Wallet.query().where('user_id', userId).first()
    
    if (!wallet) {
      wallet = await Wallet.create({
        user_id: userId,
        balance: 0,
        currency: 'XAF',
        status: 'active'
      })
    }

    wallet.balance = (wallet.balance || 0) + amount
    await wallet.save()
  }

  // ==================== KYC ====================
  private async performKYC(
    phoneNumber: string,
    fallbackOperatorName?: string,
    fallbackOperatorCode?: string,
    fallbackFullName?: string
  ): Promise<{ operator: string; fullName: string; accountNumber: string }> {
    console.log('🔵 Appel API KYC...')
    
    try {
      const kycResponse = await axios.get(
        `${PAYMENT_API_URL}/api/mypvit/kyc/marchant?customerAccountNumber=${phoneNumber}`,
        { timeout: 10000 }
      )

      if (kycResponse.data.success && kycResponse.data.data) {
        const kycData = kycResponse.data.data
        const operator = fallbackOperatorName || fallbackOperatorCode || 
                       kycData.detected_operator || kycData.operator || 'non renseigné'
        const fullName = kycData.full_name || fallbackFullName || 'non renseigné'
        const accountNumber = kycData.customer_account_number || phoneNumber
        
        console.log('✅ KYC OK - opérateur:', operator, '| nom:', fullName)
        return { operator, fullName, accountNumber }
      }
    } catch (error) {
      console.log('🟡 KYC injoignable, fallback sur données frontend')
    }

    return {
      operator: fallbackOperatorName || fallbackOperatorCode || 'non renseigné',
      fullName: fallbackFullName || 'non renseigné',
      accountNumber: phoneNumber
    }
  }

  // ==================== COMMANDE STANDARD (MOBILE MONEY) ====================
  async store({ request, response }: HttpContext) {
    console.log('🔵 ========== DEBUT CREATION COMMANDE (MOBILE MONEY) ==========')

    try {
      const payload = request.only([
        'userId',
        'customerAccountNumber',
        'shippingAddress',
        'billingAddress',
        'notes',
        'deliveryMethod',
        'deliveryPrice',
        'customerName',
        'customerEmail',
        'mobileOperatorCode',
        'mobileOperatorName',
      ])

      // Validations
      if (!payload.userId) {
        return response.status(400).json({ success: false, message: 'userId est requis' })
      }
      if (!payload.customerAccountNumber) {
        return response.status(400).json({ success: false, message: 'customerAccountNumber est requis' })
      }

      // KYC
      const kycInfo = await this.performKYC(
        payload.customerAccountNumber,
        payload.mobileOperatorName,
        payload.mobileOperatorCode,
        payload.customerName
      )

      // Utilisateur
      const isGuest = !isValidUuid(payload.userId)
      if (isGuest) {
        return response.status(400).json({
          success: false,
          message: 'Les commandes en mode invité ne sont pas supportées. Veuillez vous connecter.',
        })
      }

      const user = await User.findBy('id', payload.userId)
      console.log('👤 Utilisateur:', user ? user.email : 'Introuvable')

      // Panier
      const cart = await Cart.query()
        .where('user_id', payload.userId)
        .preload('items')
        .first()

      if (!cart || cart.items.length === 0) {
        return response.status(400).json({ success: false, message: 'Votre panier est vide' })
      }

      // Calcul total
      let subtotal = 0
      const orderItems: any[] = []
      const sellerSales: Map<string, { sellerId: string; amount: number }> = new Map()

      for (const cartItem of cart.items) {
        if (!cartItem.product_id) continue

        const product = await Product.findBy('id', cartItem.product_id)
        if (!product) {
          return response.status(400).json({
            success: false,
            message: `Produit avec UUID ${cartItem.product_id} non trouvé`,
          })
        }

        const itemTotal = product.price * cartItem.quantity
        subtotal += itemTotal

        const sellerId = product.user_id
        if (!sellerSales.has(sellerId)) {
          sellerSales.set(sellerId, { sellerId, amount: 0 })
        }
        sellerSales.get(sellerId)!.amount += itemTotal

        orderItems.push({
          product_id: product.id,
          productName: product.name,
          productDescription: product.description,
          price: product.price,
          quantity: cartItem.quantity,
          category: product.category,
          image: product.image_url,
          subtotal: itemTotal,
          seller_id: sellerId,
        })

        console.log(`✅ Item: ${product.name} x ${cartItem.quantity} = ${itemTotal}`)
      }

      if (orderItems.length === 0) {
        return response.status(400).json({ success: false, message: 'Aucun produit valide dans le panier' })
      }

      const deliveryPrice = payload.deliveryPrice || 2500
      const total = subtotal + deliveryPrice
      console.log(`💰 Total: ${subtotal} + ${deliveryPrice} = ${total}`)

      // Paiement
      let paymentInfo: PaymentInfo | null = null

      try {
        console.log('🔵 Appel API paiement Mobile Money...')

        const paymentBody: Record<string, any> = {
          amount: total,
          customer_account_number: kycInfo.accountNumber,
          payment_api_key_public: API_KEYS.public,
          payment_api_key_secret: API_KEYS.secret,
        }

        if (payload.mobileOperatorCode) {
          paymentBody.operator_code = payload.mobileOperatorCode
        }

        const paymentResponse = await axios.post(
          `${PAYMENT_API_URL}/api/payment`,
          paymentBody,
          { headers: { 'Content-Type': 'application/json' }, timeout: 0 }
        )

        const paymentResult = paymentResponse.data

        if (!paymentResult.success || !paymentResult.data?.reference_id) {
          return response.status(400).json({
            success: false,
            message: paymentResult.message || 'Échec de l\'initiation du paiement',
            payment_status: 'failed',
          })
        }

        const referenceId = paymentResult.data.reference_id
        console.log(`🔑 referenceId: ${referenceId}`)

        // Attendre confirmation
        let attemptCount = 0
        let paymentSuccess = false

        while (attemptCount < 120) {
          attemptCount++

          try {
            const statusResponse = await axios.get(
              `${PAYMENT_API_URL}/api/check-status/${referenceId}`,
              { timeout: 10000 }
            )

            const statusData = statusResponse.data

            if (statusData.is_success === true) {
              console.log(`✅ PAIEMENT CONFIRMÉ après ${attemptCount} tentatives`)
              paymentSuccess = true
              paymentInfo = {
                reference_id: referenceId,
                x_secret: paymentResult.data.x_secret || '',
                status: statusData.status,
                amount: statusData.amount,
                operator_simple: payload.mobileOperatorName || paymentResult.data.operator_simple,
                transaction_type: paymentResult.data.transaction_type,
                check_status_url: paymentResult.data.check_status_url,
                code_url: paymentResult.data.code_url || '',
              }
              break
            }

            if (statusData.is_failed === true) {
              console.log(`❌ Paiement échoué: ${statusData.status}`)
              break
            }

          } catch (pollError: any) {
            if (attemptCount % 20 === 0) {
              console.error(`⚠️ Erreur polling #${attemptCount}:`, pollError.message)
            }
          }

          await new Promise(resolve => setTimeout(resolve, 3000))
        }

        if (!paymentSuccess) {
          return response.status(400).json({
            success: false,
            message: '❌ Paiement échoué ou délai expiré.',
            payment_status: 'failed',
            attempts: attemptCount,
          })
        }

      } catch (paymentErr: any) {
        console.error('❌ Erreur paiement:', paymentErr.message)
        return response.status(500).json({
          success: false,
          message: '❌ Erreur lors du traitement du paiement',
          error: paymentErr.message,
        })
      }

      // Création commande
      console.log('💰 PAIEMENT CONFIRMÉ - CRÉATION DE LA COMMANDE...')

      const orderNumber = generateOrderNumber()

      const order = await Order.create({
        user_id: payload.userId,
        order_number: orderNumber,
        status: 'paid',
        total,
        subtotal,
        shipping_cost: deliveryPrice,
        delivery_method: payload.deliveryMethod || 'standard',
        customer_name: kycInfo.fullName,
        customer_phone: kycInfo.accountNumber,
        payment_method: kycInfo.operator,
        customer_email: user?.email || payload.customerEmail || 'non-renseigné@email.com',
        shipping_address: payload.shippingAddress || 'non renseigné',
        billing_address: payload.billingAddress || payload.shippingAddress || 'non renseigné',
        notes: payload.notes || null,
      })

      console.log(`✅ Commande créée: ${order.order_number}`)

      // Items + stock
      for (const item of orderItems) {
        await OrderItem.create({
          order_id: order.id,
          product_id: item.product_id,
          product_name: item.productName,
          product_description: item.productDescription,
          price: item.price,
          quantity: item.quantity,
          category: typeof item.category === 'string' ? item.category : null,
          image: item.image,
          subtotal: item.subtotal,
        })

        const product = await Product.findBy('id', item.product_id)
        if (product) {
          product.stock = product.stock - item.quantity
          await product.save()
          console.log(`📦 Stock: ${item.productName} → ${product.stock}`)
        }
      }

      // Tracking
      await OrderTracking.create({
        order_id: order.id,
        status: 'paid',
        description: `Paiement Mobile Money - Réf: ${paymentInfo?.reference_id} - Montant: ${total} FCFA`,
        tracked_at: DateTime.now(),
      })

      // Vider panier
      await CartItem.query().where('cart_id', cart.id).delete()
      console.log('✅ Panier vidé')

      // Créditer
      await this.creditSellersAndAdminByOrder(order.id, total)

      await order.load('items')
      console.log('🟢 ========== COMMANDE CRÉÉE AVEC SUCCÈS ==========')

      return response.status(201).json({
        success: true,
        message: '✅ Commande créée avec succès !',
        data: {
          orderId: order.id,
          orderNumber: order.order_number,
          total: order.total,
          status: order.status,
          customerName: order.customer_name,
          customerPhone: order.customer_phone,
          paymentMethod: order.payment_method,
          estimatedDelivery: order.estimated_delivery,
          itemsCount: order.items.length,
          payment: paymentInfo ? {
            success: true,
            reference_id: paymentInfo.reference_id,
            status: paymentInfo.status,
            operator: paymentInfo.operator_simple,
            amount: paymentInfo.amount,
          } : null,
        },
      })

    } catch (error: any) {
      console.error('🔴 ========== ERREUR CRÉATION COMMANDE ==========')
      console.error('🔴 Message:', error.message)
      console.error('🔴 Stack:', error.stack)
      return response.status(500).json({
        success: false,
        message: '❌ Erreur lors de la création de la commande',
        error: error.message,
      })
    }
  }

  // ==================== MÉTHODES DE CONSULTATION ====================
  
  async getPaymentStatus({ params, response }: HttpContext) {
    try {
      const { orderId } = params
      
      let order: Order | null = null
      
      if (orderId.startsWith('CMD-')) {
        order = await Order.findBy('order_number', orderId)
      } else {
        order = await Order.find(orderId)
      }
      
      if (!order) {
        return response.status(404).json({
          success: false,
          message: 'Commande non trouvée'
        })
      }
      
      const lastPaymentTracking = await OrderTracking.query()
        .where('order_id', order.id)
        .whereIn('status', ['paid', 'pending_payment', 'payment_failed'])
        .orderBy('tracked_at', 'desc')
        .first()
      
      let paymentStatus = 'unknown'
      let isPaid = false
      let isPending = false
      let isFailed = false
      
      if (order.status === 'paid' || order.status === 'processing' || 
          order.status === 'shipped' || order.status === 'delivered') {
        paymentStatus = 'paid'
        isPaid = true
      } else if (order.status === 'pending_payment') {
        paymentStatus = 'pending'
        isPending = true
      } else if (order.status === 'payment_failed') {
        paymentStatus = 'failed'
        isFailed = true
      }
      
      return response.status(200).json({
        success: true,
        data: {
          orderId: order.order_number,
          order_id: order.id,
          payment_status: paymentStatus,
          is_paid: isPaid,
          is_pending: isPending,
          is_failed: isFailed,
          payment_method: order.payment_method,
          payment_reference: lastPaymentTracking?.description?.match(/Réf: (\S+)/)?.[1] || null,
          amount: order.total,
          status: order.status,
          last_update: order.updated_at
        }
      })
      
    } catch (error: any) {
      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la vérification du statut de paiement',
        error: error.message
      })
    }
  }

  async giveAllWithoutId({ params, response }: HttpContext) {
    const { referenceId } = params

    if (!referenceId) {
      return response.status(400).json({
        success: false,
        message: 'referenceId est requis'
      })
    }

    console.log(`📡 [giveAllWithoutId] Proxy check-status pour: ${referenceId}`)

    try {
      const apiResponse = await axios.get(
        `${PAYMENT_API_URL}/api/check-status/${referenceId}`,
        { timeout: 10000 }
      )
      return response.status(200).json(apiResponse.data)

    } catch (error: any) {
      return response.status(200).json({
        success: false,
        reference_id: referenceId,
        status: 'SERVICE_UNAVAILABLE',
        is_success: false,
        is_pending: false,
        is_failed: true,
        last_update: new Date().toISOString(),
        error_message: error.message,
      })
    }
  }

  async checkPaymentStatus({ params, response }: HttpContext) {
    try {
      const { referenceId } = params

      if (!referenceId) {
        return response.status(400).json({ success: false, message: 'referenceId est requis' })
      }

      const statusResponse = await axios.get(
        `${PAYMENT_API_URL}/api/check-status/${referenceId}`,
        { timeout: 15000 }
      )

      return response.status(200).json({
        success: true,
        data: statusResponse.data,
      })

    } catch (error: any) {
      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la vérification du statut',
        error: error.message,
      })
    }
  }

  async allOrders({ response }: HttpContext) {
    const orders = await Order.query()
      .preload('items')
      .preload('tracking')
      .orderBy('created_at', 'desc')

    return response.ok({ success: true, data: orders })
  }

  async index({ params, response }: HttpContext) {
    try {
      const { userId } = params
      if (!userId) {
        return response.status(400).json({ success: false, message: 'userId est requis' })
      }

      const orders = await Order.query()
        .where('user_id', userId)
        .preload('items')
        .orderBy('created_at', 'desc')

      return response.status(200).json({ success: true, data: orders })
    } catch (error: any) {
      return response.status(500).json({ 
        success: false, 
        message: 'Erreur lors de la récupération des commandes', 
        error: error.message 
      })
    }
  }

  async show({ params, response }: HttpContext) {
    try {
      const { orderId, userId } = params
      if (!userId || !orderId) {
        return response.status(400).json({ success: false, message: 'userId et orderId sont requis' })
      }

      let order: Order | null = null

      if (orderId.startsWith('CMD-')) {
        order = await Order.query()
          .where('order_number', orderId)
          .where('user_id', userId)
          .preload('items')
          .first()
      } else {
        order = await Order.query()
          .where('id', orderId)
          .where('user_id', userId)
          .preload('items')
          .first()
      }

      if (!order) {
        return response.status(404).json({ success: false, message: 'Commande non trouvée' })
      }

      return response.status(200).json({ success: true, data: order })
    } catch (error: any) {
      return response.status(500).json({ 
        success: false, 
        message: 'Erreur lors de la récupération de la commande', 
        error: error.message 
      })
    }
  }

  async updateStatus({ params, request, response }: HttpContext) {
    try {
      const { orderId } = params
      const { status, trackingNumber, estimatedDelivery, location, description } = request.only([
        'status', 'trackingNumber', 'estimatedDelivery', 'location', 'description',
      ])

      let order: Order | null = null

      if (orderId.startsWith('CMD-')) {
        order = await Order.findBy('order_number', orderId)
      } else {
        order = await Order.find(orderId)
      }

      if (!order) {
        return response.status(404).json({ success: false, message: 'Commande non trouvée' })
      }

      await OrderTracking.create({
        order_id: order.id,
        status,
        description: description || getStatusDescription(status),
        location: location || null,
        tracked_at: DateTime.now(),
      })

      order.status = status as typeof order.status
      if (trackingNumber) order.tracking_number = trackingNumber
      if (estimatedDelivery) order.estimated_delivery = estimatedDelivery
      if (status === 'delivered') order.delivered_at = DateTime.now()
      await order.save()

      return response.status(200).json({ 
        success: true, 
        message: `✅ Statut mis à jour : ${status}`, 
        data: order 
      })
    } catch (error: any) {
      return response.status(500).json({ 
        success: false, 
        message: 'Erreur lors de la mise à jour du statut', 
        error: error.message 
      })
    }
  }

  async cancel({ params, request, response }: HttpContext) {
    try {
      const { orderId } = params
      const { userId } = request.only(['userId'])

      if (!userId) {
        return response.status(400).json({ success: false, message: 'userId est requis' })
      }

      let order: Order | null = null

      if (orderId.startsWith('CMD-')) {
        order = await Order.query()
          .where('order_number', orderId)
          .where('user_id', userId)
          .first()
      } else {
        order = await Order.query()
          .where('id', orderId)
          .where('user_id', userId)
          .first()
      }

      if (!order) {
        return response.status(404).json({ success: false, message: 'Commande non trouvée' })
      }

      const cancellableStatuses = ['pending', 'paid', 'pending_payment']
      if (!cancellableStatuses.includes(order.status)) {
        return response.status(400).json({
          success: false,
          message: 'Cette commande ne peut plus être annulée',
          current_status: order.status,
        })
      }

      order.status = 'cancelled' as typeof order.status
      await order.save()

      await OrderTracking.create({
        order_id: order.id,
        status: 'cancelled',
        description: 'Commande annulée par le client',
        tracked_at: DateTime.now(),
      })

      return response.status(200).json({ 
        success: true, 
        message: '✅ Commande annulée avec succès', 
        data: order 
      })
    } catch (error: any) {
      return response.status(500).json({ 
        success: false, 
        message: 'Erreur lors de l\'annulation', 
        error: error.message 
      })
    }
  }

  async invoice({ params, response }: HttpContext) {
    try {
      const { orderId, userId } = params
      if (!userId || !orderId) {
        return response.status(400).json({ success: false, message: 'userId et orderId sont requis' })
      }

      let order: Order | null = null

      if (orderId.startsWith('CMD-')) {
        order = await Order.query()
          .where('order_number', orderId)
          .where('user_id', userId)
          .preload('items')
          .first()
      } else {
        order = await Order.query()
          .where('id', orderId)
          .where('user_id', userId)
          .preload('items')
          .first()
      }

      if (!order) {
        return response.status(404).json({ success: false, message: 'Commande non trouvée' })
      }

      return response.status(200).json({
        success: true,
        data: {
          order: {
            number: order.order_number,
            date: order.created_at,
            status: order.status,
            subtotal: order.subtotal,
            shippingCost: order.shipping_cost,
            total: order.total,
            deliveryMethod: order.delivery_method,
            customerName: order.customer_name,
            customerEmail: order.customer_email,
            customerPhone: order.customer_phone,
            shippingAddress: order.shipping_address,
            billingAddress: order.billing_address,
            paymentMethod: order.payment_method,
            trackingNumber: order.tracking_number,
            estimatedDelivery: order.estimated_delivery,
            deliveredAt: order.delivered_at,
            notes: order.notes,
          },
          items: order.items,
        },
      })
    } catch (error: any) {
      return response.status(500).json({ 
        success: false, 
        message: 'Erreur lors de la génération de la facture', 
        error: error.message 
      })
    }
  }

  async getTracking({ params, response }: HttpContext) {
    try {
      const { orderId, userId } = params
      if (!userId || !orderId) {
        return response.status(400).json({ success: false, message: 'userId et orderId sont requis' })
      }

      let order: Order | null = null

      if (orderId.startsWith('CMD-')) {
        order = await Order.query()
          .where('order_number', orderId)
          .where('user_id', userId)
          .first()
      } else {
        order = await Order.query()
          .where('id', orderId)
          .where('user_id', userId)
          .first()
      }

      if (!order) {
        return response.status(404).json({ success: false, message: 'Commande non trouvée' })
      }

      const tracking = await OrderTracking.query()
        .where('order_id', order.id)
        .orderBy('tracked_at', 'asc')

      return response.status(200).json({ success: true, data: tracking })
    } catch (error: any) {
      return response.status(500).json({ 
        success: false, 
        message: 'Erreur lors de la récupération du suivi', 
        error: error.message 
      })
    }
  }
}
