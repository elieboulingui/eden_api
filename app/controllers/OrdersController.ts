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
import KYC from '#models/kyc'
import GuestOrder from '#models/GuestOrder'
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

interface KYCInfo {
  operator: string
  fullName: string
  accountNumber: string
  kycRecordId?: string
}

interface OrderData {
  userId: string | null
  isGuest?: boolean
  guestId?: string
  items: Array<{
    productId?: string
    id?: string
    price: number
    quantity: number
  }>
  customerAccountNumber: string
  customerName: string
  customerEmail?: string
  customerPhone?: string
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

  // ==================== MÉTHODES PRIVÉES ====================

  /**
   * Appel API KYC et sauvegarde en base de données
   */
  private async performKYCAndSave(
    phoneNumber: string,
    fallbackOperatorCode?: string,
    fallbackOperatorName?: string,
    fallbackFullName?: string
  ): Promise<KYCInfo> {
    console.log('🔵 [KYC] Appel API KYC pour:', phoneNumber)

    try {
      // 1. Appel à l'API KYC externe
      const kycResponse = await axios.get(
        `${PAYMENT_API_URL}/api/mypvit/kyc/marchant`,
        {
          params: { customerAccountNumber: phoneNumber },
          timeout: 10000
        }
      )

      if (kycResponse.data.success && kycResponse.data.data) {
        const kycData = kycResponse.data.data
        const operator = fallbackOperatorCode || fallbackOperatorName ||
          kycData.detected_operator || kycData.operator || 'non renseigné'
        const fullName = kycData.full_name || fallbackFullName || 'non renseigné'
        const accountNumber = kycData.customer_account_number || phoneNumber

        console.log('✅ [KYC] Données récupérées - Opérateur:', operator, '| Nom:', fullName)

        // 2. Sauvegarde en base de données KYC
        try {
          const existingKYC = await KYC.findBy('numeroTelephone', phoneNumber)

          if (existingKYC) {
            existingKYC.nomComplet = fullName
            existingKYC.operateur = operator
            await existingKYC.save()
            console.log('📦 [KYC] Enregistrement mis à jour, ID:', existingKYC.id)

            return {
              operator,
              fullName,
              accountNumber,
              kycRecordId: existingKYC.id
            }
          } else {
            const newKYC = await KYC.create({
              nomComplet: fullName,
              numeroTelephone: phoneNumber,
              operateur: operator
            })
            console.log('📦 [KYC] Nouvel enregistrement créé, ID:', newKYC.id)

            return {
              operator,
              fullName,
              accountNumber,
              kycRecordId: newKYC.id
            }
          }
        } catch (dbError: any) {
          console.error('❌ [KYC] Erreur sauvegarde BDD:', dbError.message)
          // Continuer même si la sauvegarde échoue
          return { operator, fullName, accountNumber }
        }
      }
    } catch (error: any) {
      console.log('🟡 [KYC] API injoignable, fallback sur données frontend')
    }

    // Fallback avec les données fournies
    const operator = fallbackOperatorCode || fallbackOperatorName || 'non renseigné'
    const fullName = fallbackFullName || 'non renseigné'

    // Sauvegarde quand même en BDD avec les données de fallback
    try {
      const existingKYC = await KYC.findBy('numeroTelephone', phoneNumber)
      if (!existingKYC) {
        await KYC.create({
          nomComplet: fullName,
          numeroTelephone: phoneNumber,
          operateur: operator
        })
        console.log('📦 [KYC] Enregistrement fallback créé')
      }
    } catch (dbError) {
      console.error('❌ [KYC] Erreur sauvegarde fallback:', dbError.message)
    }

    return { operator, fullName, accountNumber: phoneNumber }
  }

  /**
   * Mettre à jour le stock et archiver les produits épuisés
   */
  private async updateStockAndArchive(productId: string, quantity: number): Promise<void> {
    try {
      const product = await Product.findBy('id', productId)

      if (!product) {
        console.error(`❌ [Stock] Produit ${productId} non trouvé`)
        return
      }

      // Décrémenter le stock
      product.stock = Math.max(0, product.stock - quantity)

      // Si le stock atteint 0, archiver le produit
      if (product.stock === 0) {
        product.isArchived = true
        product.status = 'inactive'
        console.log(`📦 [Stock] Produit "${product.name}" archivé (stock épuisé)`)
      }

      await product.save()
      console.log(`✅ [Stock] ${product.name}: ${product.stock + quantity} → ${product.stock}`)

    } catch (error: any) {
      console.error('❌ [Stock] Erreur mise à jour stock:', error.message)
      throw error
    }
  }

  /**
   * Vérifier le statut d'un paiement avec retry
   */
  private async verifyPaymentStatus(
    referenceId: string,
    order: Order,
    maxRetries: number = 12,
    retryDelay: number = 3000
  ): Promise<boolean> {
    console.log('🔍 Vérification du statut de paiement...')

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      console.log(`📡 Tentative ${attempt}/${maxRetries} - Réf: ${referenceId}`)

      try {
        const statusResponse = await axios.get(
          `${PAYMENT_API_URL}/api/check-status/${referenceId}`,
          { timeout: 15000 }
        )

        const statusData = statusResponse.data
        console.log(`✅ Réponse statut tentative ${attempt}:`, {
          success: statusData.success,
          is_success: statusData.is_success,
          is_pending: statusData.is_pending,
          status: statusData.status
        })

        // Paiement réussi
        if (statusData.success && statusData.is_success === true) {
          console.log('✅✅✅ Transaction réussie !')
          console.log(`💰 Montant: ${statusData.amount} FCFA`)

          order.status = 'paid'
          await order.save()

          await OrderTracking.create({
            order_id: order.id,
            status: 'paid',
            description: `Paiement effectué avec succès - Réf: ${referenceId} - Montant: ${statusData.amount} FCFA`,
            tracked_at: DateTime.now(),
          })

          return true
        }

        // Paiement échoué
        if (statusData.success && statusData.is_failed === true) {
          console.log('❌ Transaction échouée')
          await OrderTracking.create({
            order_id: order.id,
            status: 'payment_failed',
            description: `Paiement échoué - Réf: ${referenceId} - Statut: ${statusData.status}`,
            tracked_at: DateTime.now(),
          })
          return false
        }

        // Paiement en attente - continuer
        if (statusData.success && statusData.is_pending === true) {
          console.log(`⏳ Transaction en attente`)
          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, retryDelay))
          }
          continue
        }

        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, retryDelay))
        }

      } catch (error: any) {
        console.error(`❌ Erreur vérification (tentative ${attempt}):`, error.message)
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, retryDelay))
        }
      }
    }

    // Timeout - toujours en attente
    console.log('⚠️ Transaction toujours en attente après vérifications')
    await OrderTracking.create({
      order_id: order.id,
      status: 'payment_pending',
      description: `Paiement en attente de confirmation - Réf: ${referenceId}`,
      tracked_at: DateTime.now(),
    })

    return false
  }

  /**
   * Traiter le paiement Mobile Money
   */
  private async processMobileMoneyPayment(
    amount: number,
    accountNumber: string,
    mobileOperatorCode?: string,
    mobileOperatorName?: string
  ): Promise<{ success: boolean; paymentInfo?: PaymentInfo; error?: string }> {
    console.log('🔵 Appel API paiement Mobile Money...')

    const paymentBody: Record<string, any> = {
      amount,
      customer_account_number: accountNumber,
      payment_api_key_public: API_KEYS.public,
      payment_api_key_secret: API_KEYS.secret,
    }

    if (mobileOperatorCode) {
      paymentBody.operator_code = mobileOperatorCode
      console.log(`✅ Opérateur fourni: ${mobileOperatorCode} (${mobileOperatorName || 'nom non fourni'})`)
    } else {
      console.log('🟡 Aucun opérateur fourni, détection automatique')
    }

    try {
      const paymentResponse = await axios.post(
        `${PAYMENT_API_URL}/api/payment`,
        paymentBody,
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 0
        }
      )

      const paymentResult = paymentResponse.data
      console.log('✅ Réponse paiement reçue')

      if (paymentResult.success && paymentResult.data?.reference_id) {
        const paymentInfo: PaymentInfo = {
          reference_id: paymentResult.data.reference_id,
          x_secret: paymentResult.data.x_secret || 'not_provided',
          status: paymentResult.data.status,
          amount: paymentResult.data.amount,
          operator_simple: mobileOperatorName || paymentResult.data.operator_simple,
          transaction_type: paymentResult.data.transaction_type,
          check_status_url: paymentResult.data.check_status_url,
          code_url: paymentResult.data.code_url || '',
        }

        console.log('🔑 reference_id:', paymentInfo.reference_id)
        return { success: true, paymentInfo }
      }

      return {
        success: false,
        error: paymentResult.message || 'Échec de l\'initiation du paiement'
      }

    } catch (error: any) {
      console.error('❌ Erreur paiement:', error.message)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * Créer les items de la commande et mettre à jour le stock
   */
  private async createOrderItems(
    order: Order,
    items: Array<{ productId?: string; id?: string; price: number; quantity: number }>
  ): Promise<{ subtotal: number; itemsCount: number }> {
    let subtotal = 0
    let itemsCount = 0

    for (const item of items) {
      const productId = item.productId || item.id
      if (!productId) continue

      const product = await Product.findBy('id', productId)
      if (!product) {
        throw new Error(`Produit avec UUID ${productId} non trouvé`)
      }

      const itemTotal = item.price * item.quantity
      subtotal += itemTotal

      await OrderItem.create({
        order_id: order.id,
        product_id: product.id,
        product_name: product.name,
        product_description: product.description,
        price: item.price,
        quantity: item.quantity,
        category: typeof product.category === 'string' ? product.category : null,
        image: product.image_url,
        subtotal: itemTotal,
      })

      // ✅ Mise à jour du stock et archivage automatique
      await this.updateStockAndArchive(product.id, item.quantity)

      itemsCount++
    }

    return { subtotal, itemsCount }
  }

  /**
   * Créer les items de la commande depuis le panier
   */
  private async createOrderItemsFromCart(
    cart: Cart,
    order: Order
  ): Promise<{ subtotal: number; itemsCount: number }> {
    let subtotal = 0
    let itemsCount = 0

    for (const cartItem of cart.items) {
      if (!cartItem.product_id) continue

      const product = await Product.findBy('id', cartItem.product_id)
      if (!product) {
        throw new Error(`Produit avec UUID ${cartItem.product_id} non trouvé`)
      }

      const itemTotal = product.price * cartItem.quantity
      subtotal += itemTotal

      await OrderItem.create({
        order_id: order.id,
        product_id: product.id,
        product_name: product.name,
        product_description: product.description,
        price: product.price,
        quantity: cartItem.quantity,
        category: typeof product.category === 'string' ? product.category : null,
        image: product.image_url,
        subtotal: itemTotal,
      })

      // ✅ Mise à jour du stock et archivage automatique
      await this.updateStockAndArchive(product.id, cartItem.quantity)

      itemsCount++
      console.log(`✅ Item: ${product.name} x ${cartItem.quantity} = ${itemTotal}`)
    }

    return { subtotal, itemsCount }
  }

  /**
   * Créer une commande depuis un paiement QR Code
   */
  private async createOrderFromQRPayment(
    orderData: OrderData,
    referenceId: string,
    _paymentStatus: any
  ): Promise<Order> {
    const isGuest = orderData.isGuest || !orderData.userId

    // Créer une commande invité si nécessaire
    let guestOrder = null
    if (isGuest && orderData.customerEmail) {
      guestOrder = await GuestOrder.create({
        guestId: orderData.guestId || `guest_${Date.now()}`,
        customerName: orderData.customerName,
        customerEmail: orderData.customerEmail,
        customerPhone: orderData.customerPhone || orderData.customerAccountNumber,
        status: 'paid',
      })
      console.log('👤 [Guest] Commande invité créée, ID:', guestOrder.id)
    }

    let subtotal = 0
    for (const item of orderData.items) {
      subtotal += item.price * item.quantity
    }

    const total = subtotal + (orderData.deliveryPrice || 0)
    const orderNumber = generateOrderNumber()

    const order = await Order.create({
      user_id: orderData.userId || null,
      guest_order_id: guestOrder?.id || null,
      order_number: orderNumber,
      status: 'paid',
      total,
      subtotal,
      shipping_cost: orderData.deliveryPrice || 0,
      delivery_method: orderData.deliveryMethod || 'standard',
      customer_name: orderData.customerName,
      customer_phone: orderData.customerPhone || orderData.customerAccountNumber,
      payment_method: 'QR Code',
      customer_email: orderData.customerEmail || 'invite@email.com',
      shipping_address: orderData.shippingAddress || 'Non renseigné',
      billing_address: orderData.shippingAddress || 'Non renseigné',
      notes: orderData.notes || null,
    })

    console.log(`✅ Commande créée: ${order.order_number}`)

    // Sauvegarder les items et mettre à jour le stock
    await this.createOrderItems(order, orderData.items)

    // Tracking
    await OrderTracking.create({
      order_id: order.id,
      status: 'paid',
      description: `Paiement QR Code confirmé - Réf: ${referenceId} - Montant: ${total} FCFA`,
      tracked_at: DateTime.now(),
    })

    // Vider le panier si utilisateur connecté
    if (!isGuest && orderData.userId) {
      const cart = await Cart.query().where('user_id', orderData.userId).first()
      if (cart) {
        await CartItem.query().where('cart_id', cart.id).delete()
        console.log('✅ Panier vidé')
      }
    }

    // Créditer vendeurs et admin
    await this.creditSellersAndAdminByOrder(order.id, total)

    await order.load('items')
    return order
  }

  /**
   * Créditer les vendeurs et l'admin après une commande
   */
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

  /**
   * Créditer le wallet d'un utilisateur
   */
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

  // ==================== MÉTHODES PUBLIQUES - QR CODE ====================

  /**
   * Générer un QR Code de paiement
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
        'customerPhone',
        'items',
        'deliveryMethod',
        'deliveryPrice',
        'shippingAddress',
        'notes',
        'userId',
        'isGuest',
        'guestId'
      ])

      // Validation
      if (!payload.amount || payload.amount <= 0) {
        return response.status(400).json({
          success: false,
          message: 'Le montant est requis et doit être supérieur à 0'
        })
      }

      console.log('📊 Données QR:', {
        amount: payload.amount,
        customerAccountNumber: payload.customerAccountNumber,
        itemsCount: payload.items?.length || 0,
        isGuest: payload.isGuest || false
      })

      const transactionRef = `QR-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`

      // Appel à l'API Express qui génère le QR Code
      console.log('📡 Appel API GET pour génération QR Code...')

      const qrResponse = await axios.get(
        `${PAYMENT_API_URL}/api/mypvit/qr-code/direct/generate`,
        {
          params: {
            amount: payload.amount,
            payment_api_key_public: API_KEYS.public,
            payment_api_key_secret: API_KEYS.secret
          },
          responseType: 'arraybuffer',
          timeout: 30000
        }
      )

      const contentType = qrResponse.headers['content-type']
      console.log('📡 Type de réponse:', contentType)

      // Si c'est une image PNG
      if (contentType && contentType.includes('image/png')) {
        const base64Image = Buffer.from(qrResponse.data).toString('base64')
        const qrCodeDataUrl = `data:image/png;base64,${base64Image}`

        const reference = qrResponse.headers['x-reference'] || transactionRef
        const merchantId = qrResponse.headers['x-merchant-id'] || null
        const merchantName = qrResponse.headers['x-merchant-name'] || null
        const terminalId = qrResponse.headers['x-terminal-id'] || null
        const responseAmount = qrResponse.headers['x-amount'] || payload.amount

        console.log('✅ QR Code généré avec succès')
        console.log('📋 Headers:', { reference, merchantId, terminalId, amount: responseAmount })

        return response.status(200).json({
          success: true,
          message: 'QR Code généré avec succès',
          data: {
            qr_code_url: qrCodeDataUrl,
            reference_id: reference,
            amount: Number(responseAmount),
            expires_in: 600,
            transaction_ref: transactionRef,
            merchant_id: merchantId,
            merchant_name: merchantName,
            terminal_id: terminalId,
            order_data: {
              userId: payload.userId || null,
              isGuest: payload.isGuest || false,
              guestId: payload.guestId || null,
              items: payload.items,
              customerAccountNumber: payload.customerAccountNumber,
              customerName: payload.customerName,
              customerEmail: payload.customerEmail,
              customerPhone: payload.customerPhone,
              deliveryMethod: payload.deliveryMethod,
              deliveryPrice: payload.deliveryPrice,
              shippingAddress: payload.shippingAddress,
              notes: payload.notes,
              amount: payload.amount
            }
          }
        })
      }

      // Si ce n'est pas une image, c'est probablement une erreur JSON
      let errorData = null
      try {
        const jsonString = Buffer.from(qrResponse.data).toString('utf8')
        errorData = JSON.parse(jsonString)
        console.error('❌ Erreur API (JSON):', errorData)
      } catch (e) {
        console.error('❌ Réponse non-JSON reçue')
      }

      return response.status(400).json({
        success: false,
        message: errorData?.message || 'Échec de la génération du QR Code',
        details: errorData
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

      // ✅ Si invité, enregistrer KYC
      if (orderData.isGuest && orderData.customerAccountNumber) {
        await this.performKYCAndSave(
          orderData.customerAccountNumber,
          undefined,
          undefined,
          orderData.customerName
        )
      }

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
          isGuest: orderData.isGuest || false,
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

  // ==================== MÉTHODES PUBLIQUES - COMMANDE STANDARD ====================

  /**
   * Créer une commande avec paiement Mobile Money
   * POST /api/orders
   */
  async store({ request, response }: HttpContext) {
    console.log('🔵 ========== DEBUT CREATION COMMANDE ==========')

    try {
      const payload = request.only([
        'userId',
        'isGuest',
        'guestId',
        'customerAccountNumber',
        'shippingAddress',
        'billingAddress',
        'notes',
        'deliveryMethod',
        'deliveryPrice',
        'customerName',
        'customerEmail',
        'customerPhone',
        'mobileOperatorCode',
        'mobileOperatorName',
      ])

      // ========== VALIDATION ==========
      const isGuest = payload.isGuest || !payload.userId

      if (!isGuest && !payload.userId) {
        return response.status(400).json({
          success: false,
          message: 'userId est requis pour les utilisateurs connectés'
        })
      }

      if (!payload.customerAccountNumber) {
        return response.status(400).json({
          success: false,
          message: 'customerAccountNumber est requis (numéro de téléphone)'
        })
      }

      if (isGuest && !payload.customerEmail) {
        return response.status(400).json({
          success: false,
          message: 'customerEmail est requis pour les commandes invité'
        })
      }

      console.log('📦 Données reçues:', {
        userId: payload.userId || 'INVITÉ',
        isGuest,
        customerAccountNumber: payload.customerAccountNumber,
        deliveryMethod: payload.deliveryMethod || 'standard',
        deliveryPrice: payload.deliveryPrice || 2500,
        mobileOperatorCode: payload.mobileOperatorCode || '(non fourni)',
      })

      // ========== KYC ET SAUVEGARDE ==========
      const kycInfo = await this.performKYCAndSave(
        payload.customerAccountNumber,
        payload.mobileOperatorCode,
        payload.mobileOperatorName,
        payload.customerName
      )

      // ========== CRÉATION COMMANDE INVITÉ (si nécessaire) ==========
      let guestOrder = null
      if (isGuest) {
        guestOrder = await GuestOrder.create({
          guestId: payload.guestId || `guest_${Date.now()}`,
          customerName: kycInfo.fullName,
          customerEmail: payload.customerEmail!,
          customerPhone: payload.customerPhone || kycInfo.accountNumber,
          kycId: kycInfo.kycRecordId || null,
          status: 'pending',
        })
        console.log('👤 [Guest] Commande invité créée, ID:', guestOrder.id)
      }

      // ========== VÉRIFICATION UTILISATEUR (si connecté) ==========
      let user = null
      if (!isGuest && payload.userId) {
        user = await User.findBy('id', payload.userId)
        console.log('👤 Utilisateur:', user ? user.email : 'Introuvable')
      }

      // ========== RÉCUPÉRATION PANIER (si connecté) ==========
      let items: Array<{ productId: string; quantity: number; price: number }> = []

      if (!isGuest && payload.userId) {
        const cart = await Cart.query()
          .where('user_id', payload.userId)
          .preload('items')
          .first()

        if (!cart || cart.items.length === 0) {
          return response.status(400).json({
            success: false,
            message: 'Votre panier est vide'
          })
        }

        console.log('🛒 Panier:', { id: cart.id, itemsCount: cart.items.length })

        // Récupérer les items du panier
        for (const item of cart.items) {
          const product = await Product.findBy('id', item.product_id)
          if (product) {
            items.push({
              productId: item.product_id,
              quantity: item.quantity,
              price: product.price
            })
          }
        }
      }

      // ========== CRÉATION COMMANDE ==========
      const deliveryPrice = payload.deliveryPrice || 2500
      const orderNumber = generateOrderNumber()

      const order = await Order.create({
        user_id: payload.userId || null,
        guest_order_id: guestOrder?.id || null,
        order_number: orderNumber,
        status: 'pending',
        total: 0,
        subtotal: 0,
        shipping_cost: deliveryPrice,
        delivery_method: payload.deliveryMethod || 'standard',
        customer_name: kycInfo.fullName,
        customer_phone: kycInfo.accountNumber,
        payment_method: kycInfo.operator,
        customer_email: user?.email || payload.customerEmail || 'invite@email.com',
        shipping_address: payload.shippingAddress || 'non renseigné',
        billing_address: payload.billingAddress || payload.shippingAddress || 'non renseigné',
        notes: payload.notes || null,
      })

      console.log(`✅ Commande créée: ${order.order_number}`)

      // ========== CRÉATION ITEMS ==========
      let subtotal = 0
      let itemsCount = 0

      if (!isGuest && payload.userId) {
        const cart = await Cart.query()
          .where('user_id', payload.userId)
          .preload('items')
          .first()

        if (cart) {
          const result = await this.createOrderItemsFromCart(cart, order)
          subtotal = result.subtotal
          itemsCount = result.itemsCount

          // Vider le panier
          await CartItem.query().where('cart_id', cart.id).delete()
          console.log('✅ Panier vidé')
        }
      }

      // Mise à jour du total
      const total = subtotal + deliveryPrice
      order.subtotal = subtotal
      order.total = total
      await order.save()

      console.log(`💰 Total: subtotal=${subtotal} + livraison=${deliveryPrice} = ${total}`)

      // ========== SUIVI INITIAL ==========
      await OrderTracking.create({
        order_id: order.id,
        status: 'pending',
        description: 'Commande confirmée et en attente de traitement',
        tracked_at: DateTime.now(),
      })

      // Mettre à jour le statut de la commande invité
      if (guestOrder) {
        guestOrder.orderId = order.id
        await guestOrder.save()
      }

      // ========== PAIEMENT ==========
      const paymentResult = await this.processMobileMoneyPayment(
        total,
        kycInfo.accountNumber,
        payload.mobileOperatorCode,
        payload.mobileOperatorName
      )

      let paymentStatus: 'success' | 'pending' | 'failed' = 'pending'
      let paymentInfo: PaymentInfo | null = null
      let paymentError: string | null = null

      if (paymentResult.success && paymentResult.paymentInfo) {
        paymentInfo = paymentResult.paymentInfo;
        const verified = await this.verifyPaymentStatus(paymentInfo.reference_id, order);
        paymentStatus = verified ? 'success' : 'pending';

        if (verified && guestOrder) {
          guestOrder.status = 'paid';
          await guestOrder.save();
        }
      } else {
        paymentStatus = 'failed';
        paymentError = paymentResult.error || 'Erreur inconnue';

        await OrderTracking.create({
          order_id: order.id,
          status: 'payment_pending',
          description: `Erreur lors de l'initiation du paiement: ${paymentError}`,
          tracked_at: DateTime.now(),
        });
      }

      // ========== RECHARGEMENT ==========
      await order.load('items')
      console.log('🟢 ========== COMMANDE CRÉÉE AVEC SUCCÈS ==========')

      return response.status(201).json({
        success: true,
        message: '✅ Commande créée avec succès !',
        data: {
          orderId: order.id,
          orderNumber: order.order_number,
          total: order.total,
          subtotal: order.subtotal,
          shippingCost: order.shipping_cost,
          status: order.status,
          customerName: order.customer_name,
          customerPhone: order.customer_phone,
          customerEmail: order.customer_email,
          paymentMethod: order.payment_method,
          isGuest,
          guestOrderId: guestOrder?.id || null,
          itemsCount,
          payment: paymentInfo ? {
            success: paymentStatus === 'success',
            pending: paymentStatus === 'pending',
            reference_id: paymentInfo.reference_id,
            status: paymentInfo.status,
            operator: paymentInfo.operator_simple,
            amount: paymentInfo.amount,
            check_status_url: `${PAYMENT_API_URL}/api/check-status/${paymentInfo.reference_id}`
          } : {
            success: false,
            error: paymentError
          },
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

  // ==================== MÉTHODES PUBLIQUES - CONSULTATION ====================

  /**
   * Vérifier le statut d'un paiement
   * GET /api/orders/check-payment/:referenceId
   */
  async checkPaymentStatus({ params, response }: HttpContext) {
    try {
      const { referenceId } = params

      if (!referenceId) {
        return response.status(400).json({
          success: false,
          message: 'referenceId est requis'
        })
      }

      console.log(`🔍 Vérification statut: ${referenceId}`)

      const statusResponse = await axios.get(
        `${PAYMENT_API_URL}/api/check-status/${referenceId}`,
        { timeout: 15000 }
      )

      return response.status(200).json({
        success: true,
        message: 'Statut vérifié avec succès',
        data: statusResponse.data
      })

    } catch (error: any) {
      console.error('❌ Erreur vérification statut:', error.message)

      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la vérification du statut',
        error: error.message,
        details: error.response?.data || null
      })
    }
  }

  /**
   * Récupérer le statut de paiement d'une commande
   * GET /api/orders/:orderId/payment-status
   */
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

  /**
   * Récupérer toutes les commandes (admin)
   * GET /api/orders/all
   */
  async allOrders({ response }: HttpContext) {
    const orders = await Order.query()
      .preload('items')
      .preload('tracking')
      .orderBy('created_at', 'desc')

    return response.ok({ success: true, data: orders })
  }

  /**
   * Récupérer toutes les commandes d'un utilisateur
   * GET /api/orders/user/:userId
   */
  async index({ params, response }: HttpContext) {
    try {
      const { userId } = params

      if (!userId) {
        return response.status(400).json({
          success: false,
          message: 'userId est requis'
        })
      }

      const orders = await Order.query()
        .where('user_id', userId)
        .preload('items')
        .orderBy('created_at', 'desc')

      return response.status(200).json({
        success: true,
        message: 'Commandes récupérées avec succès',
        data: orders
      })
    } catch (error: any) {
      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des commandes',
        error: error.message
      })
    }
  }

  /**
   * Récupérer une commande spécifique
   * GET /api/orders/:orderId/user/:userId
   */
  async show({ params, response }: HttpContext) {
    try {
      const { orderId, userId } = params

      if (!userId || !orderId) {
        return response.status(400).json({
          success: false,
          message: 'userId et orderId sont requis'
        })
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
        return response.status(404).json({
          success: false,
          message: 'Commande non trouvée'
        })
      }

      return response.status(200).json({
        success: true,
        message: 'Commande récupérée avec succès',
        data: order
      })
    } catch (error: any) {
      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération de la commande',
        error: error.message
      })
    }
  }

  /**
   * Mettre à jour le statut d'une commande (admin)
   * PUT /api/orders/:orderId/status
   */
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
        return response.status(404).json({
          success: false,
          message: 'Commande non trouvée'
        })
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

  /**
   * Annuler une commande
   * POST /api/orders/:orderId/cancel
   */
  async cancel({ params, request, response }: HttpContext) {
    try {
      const { orderId } = params
      const { userId } = request.only(['userId'])

      if (!userId) {
        return response.status(400).json({
          success: false,
          message: 'userId est requis'
        })
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
        return response.status(404).json({
          success: false,
          message: 'Commande non trouvée'
        })
      }

      const cancellableStatuses = ['pending', 'paid', 'pending_payment']
      if (!cancellableStatuses.includes(order.status)) {
        return response.status(400).json({
          success: false,
          message: 'Cette commande ne peut plus être annulée',
          current_status: order.status
        })
      }

      order.status = 'cancelled'
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

  /**
   * Générer une facture
   * GET /api/orders/:orderId/invoice/user/:userId
   */
  async invoice({ params, response }: HttpContext) {
    try {
      const { orderId, userId } = params

      if (!userId || !orderId) {
        return response.status(400).json({
          success: false,
          message: 'userId et orderId sont requis'
        })
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
        return response.status(404).json({
          success: false,
          message: 'Commande non trouvée'
        })
      }

      return response.status(200).json({
        success: true,
        message: 'Facture générée avec succès',
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

  /**
   * Proxy pour check-status sans référence (compatibilité)
   * GET /api/orders/give-all-without-id/:referenceId
   */
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
}
