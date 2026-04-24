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
import { DateTime } from 'luxon'
import MypvitSecretService from '../services/mypvit_secret_service.js'
import MypvitTransactionService from '../services/mypvit_transaction_service.js'
import MypvitQRCodeService from '../services/mypvit_qrcode_service.js'
import MypvitLinkService from '../services/mypvit_link_service.js'
import MypvitKYCService from '../services/mypvit_kyc_service.js'

// ==================== CONSTANTES ====================
const ACCOUNT_OPERATION_CODE = 'ACC_69EA59CBC7495'
const TERMINAL_ID = 'TERMINAL_001'
const CALLBACK_URL_CODE = 'CALLBACK_001'

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

type PaymentMethod = 'mobile_money' | 'qr_code' | 'link'

// ==================== UTILITAIRES ====================
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

  private async renewSecretIfNeeded(): Promise<void> {
    try {
      await MypvitSecretService.renewSecret()
      console.log('🔐 Clé secrète renouvelée')
    } catch (error) {
      console.error('❌ Erreur renouvellement clé:', error)
      throw error
    }
  }

  private async performKYCAndSave(
    phoneNumber: string,
    fallbackOperatorCode?: string,
    fallbackOperatorName?: string,
    fallbackFullName?: string
  ): Promise<KYCInfo> {
    console.log('🔵 [KYC] MyPVit pour:', phoneNumber)

    try {
      await this.renewSecretIfNeeded()
      const kycData = await MypvitKYCService.getKYCInfo(phoneNumber)

      const operator = fallbackOperatorCode || fallbackOperatorName || 'non renseigné'
      const fullName = kycData.full_name || fallbackFullName || 'non renseigné'
      const accountNumber = kycData.customer_account_number || phoneNumber

      console.log('✅ [KYC] Opérateur:', operator, '| Nom:', fullName)

      try {
        const existingKYC = await KYC.findBy('numeroTelephone', phoneNumber)

        if (existingKYC) {
          existingKYC.nomComplet = fullName
          existingKYC.operateur = operator
          await existingKYC.save()
          console.log('📦 [KYC] Mis à jour, ID:', existingKYC.id)
          return { operator, fullName, accountNumber, kycRecordId: existingKYC.id }
        } else {
          const newKYC = await KYC.create({
            nomComplet: fullName,
            numeroTelephone: phoneNumber,
            operateur: operator
          })
          console.log('📦 [KYC] Créé, ID:', newKYC.id)
          return { operator, fullName, accountNumber, kycRecordId: newKYC.id }
        }
      } catch (dbError) {
        console.error('❌ [KYC] Erreur BDD:', dbError)
        return { operator, fullName, accountNumber }
      }
    } catch (error) {
      console.log('🟡 [KYC] API injoignable, fallback')
    }

    const operator = fallbackOperatorCode || fallbackOperatorName || 'non renseigné'
    const fullName = fallbackFullName || 'non renseigné'

    try {
      const existingKYC = await KYC.findBy('numeroTelephone', phoneNumber)
      if (!existingKYC) {
        await KYC.create({
          nomComplet: fullName,
          numeroTelephone: phoneNumber,
          operateur: operator
        })
        console.log('📦 [KYC] Fallback créé')
      }
    } catch (dbError) {
      console.error('❌ [KYC] Erreur fallback:', dbError)
    }

    return { operator, fullName, accountNumber: phoneNumber }
  }

  private async verifyPaymentStatus(
    referenceId: string,
    order: Order,
    maxRetries: number = 12,
    retryDelay: number = 5000
  ): Promise<boolean> {
    console.log('🔍 Vérification statut paiement MyPVit...')

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      console.log(`📡 Tentative ${attempt}/${maxRetries} - Réf: ${referenceId}`)

      try {
        await this.renewSecretIfNeeded()
        const statusData = await MypvitTransactionService.checkTransactionStatus(referenceId)
        console.log(`✅ Statut tentative ${attempt}:`, statusData.status)

        if (statusData.status === 'SUCCESS') {
          console.log('✅✅✅ Transaction réussie !')
          order.status = 'paid'
          await order.save()

          await OrderTracking.create({
            order_id: order.id,
            status: 'paid',
            description: `Paiement effectué - Réf: ${referenceId}`,
            tracked_at: DateTime.now(),
          })
          return true
        }

        if (statusData.status === 'FAILED') {
          console.log('❌ Transaction échouée')
          await OrderTracking.create({
            order_id: order.id,
            status: 'payment_failed',
            description: `Paiement échoué - Réf: ${referenceId}`,
            tracked_at: DateTime.now(),
          })
          return false
        }

        if (statusData.status === 'PENDING' && attempt < maxRetries) {
          console.log(`⏳ En attente, retry dans ${retryDelay}ms`)
          await new Promise(resolve => setTimeout(resolve, retryDelay))
          continue
        }

        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, retryDelay))
        }
      } catch (error) {
        console.error(`❌ Erreur tentative ${attempt}:`, error)
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, retryDelay))
        }
      }
    }

    console.log('⚠️ Transaction toujours en attente')
    await OrderTracking.create({
      order_id: order.id,
      status: 'payment_pending',
      description: `Paiement en attente - Réf: ${referenceId}`,
      tracked_at: DateTime.now(),
    })

    return false
  }

  // ==================== MÉTHODES DE PAIEMENT ====================

  private async payWithMobileMoney(
    amount: number,
    accountNumber: string,
    operatorCode?: string,
    agent?: string
  ): Promise<{ success: boolean; paymentInfo?: PaymentInfo; error?: string }> {
    console.log('🔵 Paiement MyPVit TRANSACTION REST...')

    try {
      await this.renewSecretIfNeeded()

      const paymentResult = await MypvitTransactionService.processPayment({
        agent: agent || 'AGENT_DEFAULT',
        amount: amount,
        reference: `REF${Date.now()}`.substring(0, 15),
        callback_url_code: CALLBACK_URL_CODE,
        customer_account_number: accountNumber,
        merchant_operation_account_code: ACCOUNT_OPERATION_CODE,
        owner_charge: 'CUSTOMER',
        operator_code: operatorCode || 'AUTO_DETECT',
      })

      console.log('✅ Réponse MyPVit:', paymentResult)

      if (paymentResult.status !== 'FAILED' && paymentResult.reference_id) {
        const paymentInfo: PaymentInfo = {
          reference_id: paymentResult.reference_id,
          x_secret: '',
          status: paymentResult.status,
          amount: amount,
          operator_simple: paymentResult.operator,
          transaction_type: 'PAYMENT',
          check_status_url: '',
          code_url: paymentResult.merchant_operation_account_code,
        }

        console.log('🔑 reference_id:', paymentInfo.reference_id)
        return { success: true, paymentInfo }
      }

      return {
        success: false,
        error: paymentResult.message || 'Échec de l\'initiation du paiement'
      }

    } catch (error) {
      console.error('❌ Erreur paiement MyPVit:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue'
      }
    }
  }

  private async payWithQRCode(
    amount: number
  ): Promise<{ success: boolean; qrData?: any; error?: string }> {
    console.log('🔵 Génération QR Code MyPVit...')

    try {
      await this.renewSecretIfNeeded()

      const qrResult = await MypvitQRCodeService.generateStaticQRCode({
        accountOperationCode: ACCOUNT_OPERATION_CODE,
        terminalId: TERMINAL_ID,
        callbackUrlCode: CALLBACK_URL_CODE,
      })

      console.log('✅ QR Code généré')

      return {
        success: true,
        qrData: {
          qr_data: qrResult.data,
          reference_id: qrResult.reference_id || `QR-${Date.now()}`,
          amount: amount,
          expires_in: 600,
        }
      }
    } catch (error) {
      console.error('❌ Erreur QR Code:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue'
      }
    }
  }

  // Dans OrdersController, méthode payWithLink
  private async payWithLink(
    amount: number,
    accountNumber: string,
    serviceType: string = 'WEB'
  ): Promise<{ success: boolean; linkData?: any; error?: string }> {
    console.log(`🔵 Génération lien de paiement ${serviceType}...`)

    try {
      await this.renewSecretIfNeeded()

      // URLs de redirection (à configurer selon votre frontend)
      const successUrl = 'https://votresite.com/payment/success'
      const failedUrl = 'https://votresite.com/payment/failed'

      let linkResult

      if (serviceType === 'WEB') {
        linkResult = await MypvitLinkService.generateWebLink({
          amount: amount,
          reference: `REF${Date.now()}`.substring(0, 15),
          callback_url_code: CALLBACK_URL_CODE,
          merchant_operation_account_code: ACCOUNT_OPERATION_CODE,
          owner_charge: 'CUSTOMER',
          customer_account_number: accountNumber,
          success_redirection_url_code: successUrl,
          failed_redirection_url_code: failedUrl,
        })
      } else if (serviceType === 'RESTLINK') {
        linkResult = await MypvitLinkService.generateRestLink({
          amount: amount,
          reference: `REF${Date.now()}`.substring(0, 15),
          callback_url_code: CALLBACK_URL_CODE,
          merchant_operation_account_code: ACCOUNT_OPERATION_CODE,
          owner_charge: 'CUSTOMER',
          customer_account_number: accountNumber,
          success_redirection_url_code: successUrl,
          failed_redirection_url_code: failedUrl,
        })
      } else if (serviceType === 'VISA_MASTERCARD') {
        linkResult = await MypvitLinkService.generateVisaMastercardLink({
          amount: amount,
          reference: `REF${Date.now()}`.substring(0, 15),
          callback_url_code: CALLBACK_URL_CODE,
          merchant_operation_account_code: ACCOUNT_OPERATION_CODE,
          owner_charge: 'CUSTOMER',
          customer_account_number: accountNumber,
          success_redirection_url_code: successUrl,
          failed_redirection_url_code: failedUrl,
        })
      } else {
        return { success: false, error: 'Type de service invalide' }
      }

      console.log('✅ Lien généré:', linkResult.url)

      return {
        success: true,
        linkData: {
          url: linkResult.url,
          reference_id: linkResult.merchant_reference_id,
          amount: amount,
          service_type: serviceType,
        }
      }
    } catch (error) {
      console.error('❌ Erreur lien:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue'
      }
    }
  }

  // ==================== GESTION COMMANDE ====================

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

      await this.updateStockAndArchive(product.id, item.quantity)
      itemsCount++
    }

    return { subtotal, itemsCount }
  }

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

      await this.updateStockAndArchive(product.id, cartItem.quantity)
      itemsCount++
      console.log(`✅ Item: ${product.name} x ${cartItem.quantity} = ${itemTotal}`)
    }

    return { subtotal, itemsCount }
  }

  private async updateStockAndArchive(productId: string, quantity: number): Promise<void> {
    try {
      const product = await Product.findBy('id', productId)
      if (!product) {
        console.error(`❌ [Stock] Produit ${productId} non trouvé`)
        return
      }

      product.stock = Math.max(0, product.stock - quantity)
      if (product.stock === 0) {
        product.isArchived = true
        product.status = 'inactive'
        console.log(`📦 [Stock] Produit "${product.name}" archivé (stock épuisé)`)
      }

      await product.save()
      console.log(`✅ [Stock] ${product.name}: mis à jour`)
    } catch (error) {
      console.error('❌ [Stock] Erreur mise à jour stock:', error)
      throw error
    }
  }

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

      const superAdminFee = totalAmount * 0.005
      const superAdmin = await User.query().where('role', 'superadmin').first()
      if (superAdmin) {
        await this.creditWallet(superAdmin.id, superAdminFee)
        console.log(`✅ Superadmin crédité: ${superAdminFee} FCFA`)
      }

      for (const [sellerId, amount] of sellerSales.entries()) {
        await this.creditWallet(sellerId, amount)
        console.log(`✅ Vendeur ${sellerId} crédité: ${amount} FCFA`)
      }
    } catch (error) {
      console.error('❌ Erreur crédit vendeurs:', error)
    }
  }

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

  // ==================== ENDPOINT PRINCIPAL ====================

  /**
   * Créer une commande avec le mode de paiement choisi
   * POST /api/orders
   * 
   * Logique:
   * - Si le panier est plein → utilise le panier
   * - Si le panier est vide → utilise les items fournis dans le JSON
   */
  async store({ request, response }: HttpContext) {
    console.log('🔵 ========== DEBUT CREATION COMMANDE ==========')

    try {
      const payload = request.only([
        'userId', 'isGuest', 'guestId', 'customerAccountNumber',
        'shippingAddress', 'billingAddress', 'notes', 'deliveryMethod',
        'deliveryPrice', 'customerName', 'customerEmail', 'customerPhone',
        'mobileOperatorCode', 'mobileOperatorName', 'agent',
        'payment_method', 'link_service_type', 'items',
      ])

      const isGuest = payload.isGuest || !payload.userId
      const paymentMethod: PaymentMethod = payload.payment_method || 'mobile_money'

      // Validations
      if (!isGuest && !payload.userId) {
        return response.status(400).json({
          success: false,
          message: 'userId est requis pour les utilisateurs connectés'
        })
      }

      if (!payload.customerAccountNumber) {
        return response.status(400).json({
          success: false,
          message: 'customerAccountNumber est requis'
        })
      }

      // 1. RENOUVELER LA CLÉ
      await this.renewSecretIfNeeded()

      // 2. KYC
      const kycInfo = await this.performKYCAndSave(
        payload.customerAccountNumber,
        payload.mobileOperatorCode,
        payload.mobileOperatorName,
        payload.customerName
      )

      // 3. GUEST ORDER
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

      // 4. USER
      let user = null
      if (!isGuest && payload.userId) {
        user = await User.findBy('id', payload.userId)
        console.log('👤 Utilisateur:', user ? user.email : 'Introuvable')
      }

      // 5. CRÉER COMMANDE
      const deliveryPrice = payload.deliveryPrice || 2500
      const orderNumber = generateOrderNumber()

      const order = await Order.create({
        user_id: payload.userId || null,
        guestOrderId: guestOrder?.id || null,
        order_number: orderNumber,
        status: 'pending',
        total: 0,
        subtotal: 0,
        shipping_cost: deliveryPrice,
        delivery_method: payload.deliveryMethod || 'standard',
        customer_name: kycInfo.fullName,
        customer_phone: kycInfo.accountNumber,
        payment_method: paymentMethod,
        customer_email: user?.email || payload.customerEmail || 'invite@email.com',
        shipping_address: payload.shippingAddress || 'non renseigné',
        billing_address: payload.billingAddress || payload.shippingAddress || 'non renseigné',
        notes: payload.notes || null,
      })

      console.log(`✅ Commande créée: ${order.order_number}`)

      // 6. GÉRER LES ITEMS
      // LOGIQUE: Panier plein → utilise le panier | Panier vide → utilise les items JSON
      let subtotal = 0
      let itemsCount = 0
      let itemsSource = ''

      if (!isGuest && payload.userId) {
        // Vérifier le panier d'abord
        const cart = await Cart.query()
          .where('user_id', payload.userId)
          .preload('items')
          .first()

        if (cart && cart.items.length > 0) {
          // PANIER PLEIN → Utiliser le panier
          console.log('🛒 Panier plein → Utilisation du panier')
          const result = await this.createOrderItemsFromCart(cart, order)
          subtotal = result.subtotal
          itemsCount = result.itemsCount
          itemsSource = 'cart'

          // Vider le panier après
          await CartItem.query().where('cart_id', cart.id).delete()
          console.log('✅ Panier vidé')
        } else if (payload.items && Array.isArray(payload.items) && payload.items.length > 0) {
          // PANIER VIDE → Utiliser les items du JSON
          console.log('📦 Panier vide → Utilisation des items fournis')
          const result = await this.createOrderItems(order, payload.items)
          subtotal = result.subtotal
          itemsCount = result.itemsCount
          itemsSource = 'provided'
        } else {
          // PANIER VIDE ET PAS D'ITEMS → Erreur
          return response.status(400).json({
            success: false,
            message: 'Votre panier est vide et aucun item n\'a été fourni. Ajoutez des articles au panier ou fournissez des items dans la requête.'
          })
        }
      } else if (payload.items && Array.isArray(payload.items) && payload.items.length > 0) {
        // INVITÉ ou pas de userId → Utiliser les items fournis
        console.log('📦 Items fournis dans la requête')
        const result = await this.createOrderItems(order, payload.items)
        subtotal = result.subtotal
        itemsCount = result.itemsCount
        itemsSource = 'provided'
      } else {
        return response.status(400).json({
          success: false,
          message: 'Aucun article fourni. Ajoutez des items ou remplissez votre panier.'
        })
      }

      const total = subtotal + deliveryPrice
      order.subtotal = subtotal
      order.total = total
      await order.save()

      console.log(`💰 Total: ${total} FCFA (subtotal=${subtotal} + livraison=${deliveryPrice}) | Source: ${itemsSource}`)

      // 7. SUIVI INITIAL
      await OrderTracking.create({
        order_id: order.id,
        status: 'pending',
        description: 'Commande confirmée et en attente de traitement',
        tracked_at: DateTime.now(),
      })

      if (guestOrder) {
        guestOrder.orderId = order.id
        await guestOrder.save()
      }

      // 8. PAIEMENT SELON LA MÉTHODE CHOISIE
      let paymentResult: any = { success: false, error: 'Aucune méthode de paiement' }
      let paymentStatus: 'success' | 'pending' | 'failed' = 'pending'
      let paymentInfo: PaymentInfo | null = null
      let qrCodeData: any = null
      let linkData: any = null

      switch (paymentMethod) {
        case 'mobile_money':
          paymentResult = await this.payWithMobileMoney(
            total,
            kycInfo.accountNumber,
            payload.mobileOperatorCode,
            payload.agent
          )
          if (paymentResult.success && paymentResult.paymentInfo) {
            paymentInfo = paymentResult.paymentInfo
            const verified = await this.verifyPaymentStatus(paymentInfo.reference_id, order)
            paymentStatus = verified ? 'success' : 'pending'
            if (verified && guestOrder) {
              guestOrder.status = 'paid'
              await guestOrder.save()
            }
          } else {
            paymentStatus = 'failed'
            await OrderTracking.create({
              order_id: order.id,
              status: 'payment_failed',
              description: `Erreur paiement: ${paymentResult.error}`,
              tracked_at: DateTime.now(),
            })
          }
          break

        case 'qr_code':
          paymentResult = await this.payWithQRCode(total)
          if (paymentResult.success) {
            qrCodeData = paymentResult.qrData
            paymentStatus = 'pending'
            await OrderTracking.create({
              order_id: order.id,
              status: 'pending_payment',
              description: `QR Code généré - En attente de scan - Réf: ${qrCodeData.reference_id}`,
              tracked_at: DateTime.now(),
            })
          } else {
            paymentStatus = 'failed'
          }
          break

        case 'link':
          const linkServiceType = payload.link_service_type || 'WEB'
          paymentResult = await this.payWithLink(total, kycInfo.accountNumber, linkServiceType)
          if (paymentResult.success) {
            linkData = paymentResult.linkData
            paymentStatus = 'pending'
            await OrderTracking.create({
              order_id: order.id,
              status: 'pending_payment',
              description: `Lien de paiement généré - En attente - Réf: ${linkData.reference_id}`,
              tracked_at: DateTime.now(),
            })
          } else {
            paymentStatus = 'failed'
          }
          break
      }

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
          paymentMethod: paymentMethod,
          isGuest,
          guestOrderId: guestOrder?.id || null,
          itemsCount,
          itemsSource,
          payment: {
            method: paymentMethod,
            status: paymentStatus,
            ...(paymentInfo && {
              reference_id: paymentInfo.reference_id,
              operator: paymentInfo.operator_simple,
              amount: paymentInfo.amount,
            }),
            ...(qrCodeData && {
              qr_code: qrCodeData,
            }),
            ...(linkData && {
              payment_link: linkData,
            }),
            error: paymentResult.error || null,
          },
        },
      })

    } catch (error) {
      console.error('🔴 ========== ERREUR CRÉATION COMMANDE ==========')
      console.error('🔴 Message:', error instanceof Error ? error.message : String(error))
      console.error('🔴 Stack:', error instanceof Error ? error.stack : 'N/A')

      return response.status(500).json({
        success: false,
        message: '❌ Erreur lors de la création de la commande',
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      })
    }
  }

  // ==================== CALLBACK ====================

  async paymentCallback({ request, response }: HttpContext) {
    console.log('📞 [Callback MyPVit] ========== CALLBACK REÇU ==========')

    try {
      const callbackData = request.body()
      console.log('📦 Données callback:', callbackData)

      const callbackResponse = MypvitTransactionService.handleCallback(callbackData)

      if (callbackData.status === 'SUCCESS' && callbackData.merchantReferenceId) {
        const orders = await Order.query()
          .where('status', 'pending_payment')
          .whereHas('tracking', (query) => {
            query.where('description', 'like', `%${callbackData.merchantReferenceId}%`)
          })
          .first()

        if (orders) {
          orders.status = 'paid'
          await orders.save()

          await OrderTracking.create({
            order_id: orders.id,
            status: 'paid',
            description: `Paiement confirmé par callback - Réf: ${callbackData.transactionId}`,
            tracked_at: DateTime.now(),
          })

          await this.creditSellersAndAdminByOrder(orders.id, orders.total)
          console.log('✅ Commande mise à jour via callback:', orders.order_number)
        }
      }

      return response.status(200).json(callbackResponse)

    } catch (error) {
      console.error('❌ [Callback] Erreur:', error)
      return response.status(500).json({
        responseCode: 500,
        transactionId: request.body().transactionId || 'unknown',
      })
    }
  }

  // ==================== CONSULTATION ====================

  async checkPaymentStatus({ params, response }: HttpContext) {
    try {
      const { referenceId } = params
      if (!referenceId) {
        return response.status(400).json({
          success: false,
          message: 'referenceId est requis'
        })
      }

      await this.renewSecretIfNeeded()
      const statusData = await MypvitTransactionService.checkTransactionStatus(referenceId)
      return response.status(200).json({ success: true, data: statusData })
    } catch (error) {
      return response.status(500).json({
        success: false,
        message: 'Erreur vérification',
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      })
    }
  }

  async getPaymentStatus({ params, response }: HttpContext) {
    try {
      const { orderId } = params

      let order: Order | null = null
      if (orderId.startsWith('CMD-')) {
        order = await Order.query().where('order_number', orderId).first()
      } else {
        order = await Order.find(orderId)
      }

      if (!order) {
        return response.status(404).json({ success: false, message: 'Commande non trouvée' })
      }

      let paymentStatus = 'unknown'
      let isPaid = false

      if (['paid', 'processing', 'shipped', 'delivered'].includes(order.status)) {
        paymentStatus = 'paid'
        isPaid = true
      } else if (order.status === 'pending_payment') {
        paymentStatus = 'pending'
      } else if (order.status === 'payment_failed') {
        paymentStatus = 'failed'
      }

      return response.status(200).json({
        success: true,
        data: {
          orderId: order.order_number,
          payment_status: paymentStatus,
          is_paid: isPaid,
          amount: order.total,
          status: order.status,
        }
      })
    } catch (error) {
      return response.status(500).json({
        success: false,
        message: 'Erreur',
        error: error instanceof Error ? error.message : 'Erreur inconnue'
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
      const orders = await Order.query()
        .where('user_id', userId)
        .preload('items')
        .orderBy('created_at', 'desc')
      return response.status(200).json({ success: true, data: orders })
    } catch (error) {
      return response.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue'
      })
    }
  }

  async show({ params, response }: HttpContext) {
    try {
      const { orderId, userId } = params
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
    } catch (error) {
      return response.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue'
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
        order = await Order.query().where('order_number', orderId).first()
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
    } catch (error) {
      return response.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue'
      })
    }
  }

  async cancel({ params, request, response }: HttpContext) {
    try {
      const { orderId } = params
      const { userId } = request.only(['userId'])

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
    } catch (error) {
      return response.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue'
      })
    }
  }

  async invoice({ params, response }: HttpContext) {
    try {
      const { orderId, userId } = params
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
            paymentMethod: order.payment_method,
            trackingNumber: order.tracking_number,
            estimatedDelivery: order.estimated_delivery,
            deliveredAt: order.delivered_at,
            notes: order.notes,
          },
          items: order.items,
        },
      })
    } catch (error) {
      return response.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue'
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

    try {
      await this.renewSecretIfNeeded()
      const statusData = await MypvitTransactionService.checkTransactionStatus(referenceId)
      return response.status(200).json(statusData)
    } catch (error) {
      return response.status(200).json({
        success: false,
        reference_id: referenceId,
        status: 'SERVICE_UNAVAILABLE',
      })
    }
  }
}