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

function isValidUuid(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)
}

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

export default class OrdersController {

  // ========== GÉNÉRER QR CODE SANS CRÉER DE COMMANDE ==========
  async generateQRCode({ request, response }: HttpContext) {
    console.log('🔵 [QRCode] ========== GÉNÉRATION QR CODE ==========')
    
    try {
      const {
        amount,
        customerAccountNumber,
        customerName,
        customerEmail,
        items,
        deliveryMethod,
        deliveryPrice,
        shippingAddress,
        notes,
        userId
      } = request.only([
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

      if (!amount || amount <= 0) {
        return response.status(400).json({
          success: false,
          message: 'Le montant est requis et doit être supérieur à 0'
        })
      }

      if (!customerAccountNumber) {
        return response.status(400).json({
          success: false,
          message: 'Le numéro de téléphone est requis'
        })
      }

      console.log('📊 Données reçues:', {
        amount,
        customerAccountNumber,
        customerName,
        itemsCount: items?.length || 0
      })

      const transactionRef = `QR-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`

      console.log('🔵 Appel API génération QR Code...')
      
      const qrResponse = await axios.post(
        'https://apist.onrender.com/api/mypvit/qr-code/direct/generate',
        {
          amount: amount,
          payment_api_key_public: "pk_1773325888803_dt8diavuh3h",
          payment_api_key_secret: "sk_1773325888803_qt015a3cr5",
          customer_account_number: customerAccountNumber,
          description: `Commande e-commerce - ${items?.length || 0} article(s)`,
          external_reference: transactionRef
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 30000
        }
      )

      const qrData = qrResponse.data
      console.log('📡 Réponse QR Code:', {
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
            amount: amount,
            expires_in: 600,
            transaction_ref: transactionRef,
            order_data: {
              userId,
              items,
              customerAccountNumber,
              customerName,
              customerEmail,
              deliveryMethod,
              deliveryPrice,
              shippingAddress,
              notes,
              amount
            }
          }
        })
      } else {
        return response.status(400).json({
          success: false,
          message: qrData.message || 'Échec de la génération du QR Code'
        })
      }

    } catch (error: any) {
      console.error('❌ [QRCode] Erreur:', error.message)
      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la génération du QR Code',
        error: error.message
      })
    }
  }

  // ========== VÉRIFIER STATUT QR CODE ET CRÉER COMMANDE ==========
  async confirmQRPayment({ request, response }: HttpContext) {
    console.log('🔵 [QRCode] ========== CONFIRMATION PAIEMENT QR ==========')
    
    try {
      const {
        reference_id,
        order_data
      } = request.only(['reference_id', 'order_data'])

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
        `https://apist.onrender.com/api/check-status/${reference_id}`,
        { timeout: 10000 }
      )

      const statusData = statusResponse.data
      console.log('📊 Statut paiement:', {
        success: statusData.success,
        is_success: statusData.is_success,
        status: statusData.status
      })

      if (statusData.is_success === true) {
        console.log('✅ PAIEMENT QR CONFIRMÉ - CRÉATION DE LA COMMANDE...')
        
        const {
          userId,
          items,
          customerAccountNumber,
          customerName,
          customerEmail,
          deliveryMethod,
          deliveryPrice,
          shippingAddress,
          notes,
        } = order_data

        const user = await User.findBy('id', userId)
        if (!user) {
          return response.status(400).json({
            success: false,
            message: 'Utilisateur non trouvé'
          })
        }

        let subtotal = 0
        for (const item of items) {
          subtotal += item.price * item.quantity
        }

        const total = subtotal + (deliveryPrice || 0)
        const orderNumber = `CMD-${Date.now()}-${Math.floor(Math.random() * 1000)}`

        const order = await Order.create({
          user_id: userId,
          order_number: orderNumber,
          status: 'paid',
          total: total,
          subtotal: subtotal,
          shipping_cost: deliveryPrice || 0,
          delivery_method: deliveryMethod || 'standard',
          customer_name: customerName || user.full_name || 'Client',
          customer_phone: customerAccountNumber,
          payment_method: 'QR Code',
          customer_email: customerEmail || user.email,
          shipping_address: shippingAddress || 'Non renseigné',
          billing_address: shippingAddress || 'Non renseigné',
          notes: notes || null,
        })

        console.log(`✅ Commande créée: ${order.order_number}`)

        for (const item of items) {
          const product = await Product.findBy('id', item.productId || item.id)
          
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
            console.log(`📦 Stock mis à jour: ${product.name} → ${product.stock}`)
          }
        }

        await OrderTracking.create({
          order_id: order.id,
          status: 'paid',
          description: `Paiement QR Code confirmé - Réf: ${reference_id} - Montant: ${total} FCFA`,
          tracked_at: DateTime.now(),
        })

        const cart = await Cart.query()
          .where('user_id', userId)
          .first()
        
        if (cart) {
          await CartItem.query().where('cart_id', cart.id).delete()
          console.log('✅ Panier vidé')
        }

        await this.creditSellersAndAdmin(order.id, total)

        await order.load('items')

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
            itemsCount: order.items.length,
            payment: {
              success: true,
              reference_id: reference_id,
              status: statusData.status,
              amount: statusData.amount
            }
          }
        })

      } else if (statusData.is_pending === true) {
        return response.status(202).json({
          success: true,
          is_pending: true,
          message: 'Paiement en attente. Veuillez scanner le QR Code avec votre application Mobile Money.',
          data: {
            reference_id: reference_id,
            status: statusData.status
          }
        })
      } else {
        return response.status(400).json({
          success: false,
          is_failed: true,
          message: 'Le paiement a échoué ou a expiré.',
          data: {
            reference_id: reference_id,
            status: statusData.status
          }
        })
      }

    } catch (error: any) {
      console.error('❌ [QRCode] Erreur confirmation:', error.message)
      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la confirmation du paiement QR',
        error: error.message
      })
    }
  }

  // ========== MÉTHODE UTILITAIRE : CRÉDITER VENDEURS ET ADMIN ==========
  private async creditSellersAndAdmin(orderId: string, totalAmount: number) {
    try {
      const order = await Order.find(orderId)
      if (!order) return

      const items = await OrderItem.query().where('order_id', orderId)
      
      const sellerSales: Map<string, number> = new Map()
      
      for (const item of items) {
        const product = await Product.findBy('id', item.product_id)
        if (product) {
          const sellerId = product.user_id
          const currentAmount = sellerSales.get(sellerId) || 0
          sellerSales.set(sellerId, currentAmount + item.subtotal)
        }
      }

      const superAdminFee = totalAmount * 0.005
      const superAdmin = await User.query().where('role', 'superadmin').first()
      
      if (superAdmin) {
        let wallet = await Wallet.query().where('user_id', superAdmin.id).first()
        if (!wallet) {
          wallet = await Wallet.create({
            user_id: superAdmin.id,
            balance: 0,
            currency: 'XAF',
            status: 'active'
          })
        }
        wallet.balance = (wallet.balance || 0) + superAdminFee
        await wallet.save()
        console.log(`✅ Superadmin crédité: ${superAdminFee} FCFA`)
      }

      for (const [sellerId, amount] of sellerSales.entries()) {
        let wallet = await Wallet.query().where('user_id', sellerId).first()
        if (!wallet) {
          wallet = await Wallet.create({
            user_id: sellerId,
            balance: 0,
            currency: 'XAF',
            status: 'active'
          })
        }
        wallet.balance = (wallet.balance || 0) + amount
        await wallet.save()
        console.log(`✅ Vendeur ${sellerId} crédité: ${amount} FCFA`)
      }

    } catch (error: any) {
      console.error('❌ Erreur crédit vendeurs:', error.message)
    }
  }

  // ========== VÉRIFIER STATUT PAIEMENT D'UNE COMMANDE ==========
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

  // ========== PROXY CHECK-STATUS ==========
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
        `https://apist.onrender.com/api/check-status/${referenceId}`,
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

  // ========== TOUTES LES COMMANDES (ADMIN) ==========
  public async allOrders({ response }: HttpContext) {
    const orders = await Order.query()
      .preload('items')
      .preload('tracking')
      .orderBy('created_at', 'desc')

    return response.ok({
      success: true,
      data: orders,
    })
  }

  // ========== CRÉATION DE COMMANDE (STANDARD - MOBILE MONEY) ==========
  async store({ request, response }: HttpContext) {
    console.log('🔵 ========== DEBUT CREATION COMMANDE (MOBILE MONEY) ==========')

    try {
      const {
        userId,
        customerAccountNumber,
        shippingAddress,
        billingAddress,
        notes,
        deliveryMethod = 'standard',
        deliveryPrice = 2500,
        customerName: customerNameFallback,
        customerEmail: customerEmailFallback,
        mobileOperatorCode,
        mobileOperatorName,
      } = request.only([
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

      if (!userId) {
        return response.status(400).json({ success: false, message: 'userId est requis' })
      }
      if (!customerAccountNumber) {
        return response.status(400).json({ success: false, message: 'customerAccountNumber est requis' })
      }

      console.log('🔵 Appel API KYC...')
      const kycUrl = `https://apist.onrender.com/api/mypvit/kyc/marchant?customerAccountNumber=${customerAccountNumber}`

      let operator = mobileOperatorName || mobileOperatorCode || 'non renseigné'
      let fullName = customerNameFallback || 'non renseigné'
      let accountNumber = customerAccountNumber

      try {
        const kycResponse = await axios.get(kycUrl, { timeout: 10000 })
        if (kycResponse.data.success && kycResponse.data.data) {
          const kycData = kycResponse.data.data
          operator = mobileOperatorName || mobileOperatorCode || kycData.detected_operator || kycData.operator || 'non renseigné'
          fullName = kycData.full_name || customerNameFallback || 'non renseigné'
          accountNumber = kycData.customer_account_number || customerAccountNumber
          console.log('✅ KYC OK - opérateur:', operator, '| nom:', fullName)
        }
      } catch (kycError: any) {
        console.log('🟡 KYC injoignable, fallback sur données frontend')
      }

      const isGuest = !isValidUuid(userId)
      if (isGuest) {
        return response.status(400).json({
          success: false,
          message: 'Les commandes en mode invité ne sont pas supportées. Veuillez vous connecter.',
        })
      }

      const user = await User.findBy('id', userId)
      console.log('👤 Utilisateur:', user ? user.email : 'Introuvable')

      const cart = await Cart.query()
        .where('user_id', userId)
        .preload('items')
        .first()

      if (!cart || cart.items.length === 0) {
        return response.status(400).json({ success: false, message: 'Votre panier est vide' })
      }

      let subtotal = 0
      const orderItems: any[] = []
      const sellerSales: Map<string, { sellerId: string; amount: number; products: any[] }> = new Map()

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
          sellerSales.set(sellerId, { sellerId, amount: 0, products: [] })
        }

        const sellerData = sellerSales.get(sellerId)!
        sellerData.amount += itemTotal
        sellerData.products.push({
          product_id: product.id,
          product_name: product.name,
          quantity: cartItem.quantity,
          price: product.price,
          subtotal: itemTotal,
        })

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

      const total = subtotal + deliveryPrice
      console.log(`🔵 Total: ${subtotal} + ${deliveryPrice} = ${total}`)

      let paymentResult: any = null
      let paymentInfo: PaymentInfo | null = null
      let paymentSuccess = false

      try {
        console.log('🔵 Appel API paiement Mobile Money...')

        const paymentBody: Record<string, any> = {
          amount: total,
          customer_account_number: accountNumber,
          payment_api_key_public: "pk_1773325888803_dt8diavuh3h",
          payment_api_key_secret: "sk_1773325888803_qt015a3cr5",
        }

        if (mobileOperatorCode) {
          paymentBody.operator_code = mobileOperatorCode
          console.log(`✅ Opérateur code: ${mobileOperatorCode} | nom: ${mobileOperatorName}`)
        }

        const paymentResponse = await axios.post(
          'https://apist.onrender.com/api/payment',
          paymentBody,
          {
            headers: { 'Content-Type': 'application/json' },
            timeout: 0,
          }
        )

        paymentResult = paymentResponse.data
        console.log('✅ Réponse paiement:', JSON.stringify(paymentResult, null, 2))

        if (paymentResult.success && paymentResult.data) {
          const referenceId = paymentResult.data.reference_id

          if (!referenceId) {
            return response.status(400).json({
              success: false,
              message: '❌ referenceId absent dans la réponse du service de paiement',
            })
          }

          console.log(`🔑 referenceId reçu: ${referenceId}`)
          console.log('🔍 Attente confirmation paiement...')

          let attemptCount = 0

          while (true) {
            attemptCount++

            try {
              const statusResponse = await axios.get(
                `https://apist.onrender.com/api/check-status/${referenceId}`,
                { timeout: 10000 }
              )

              const statusData = statusResponse.data

              if (attemptCount % 10 === 0) {
                console.log(`📡 Tentative #${attemptCount} - statut: ${statusData.status}`)
              }

              if (statusData.is_success === true) {
                console.log(`✅ PAIEMENT CONFIRMÉ après ${attemptCount} tentatives`)
                paymentSuccess = true
                paymentInfo = {
                  reference_id: referenceId,
                  x_secret: paymentResult.data.x_secret || '',
                  status: statusData.status,
                  amount: statusData.amount,
                  operator_simple: mobileOperatorName || paymentResult.data.operator_simple,
                  transaction_type: paymentResult.data.transaction_type,
                  check_status_url: paymentResult.data.check_status_url,
                  code_url: paymentResult.data.code_url || '',
                }
                break
              }

              if (statusData.is_failed === true) {
                console.log(`❌ Paiement échoué après ${attemptCount} tentatives: ${statusData.status}`)
                paymentSuccess = false
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
              message: '❌ Paiement échoué ou refusé.',
              payment_status: 'failed',
              attempts: attemptCount,
            })
          }

        } else {
          return response.status(400).json({
            success: false,
            message: paymentResult.message || '❌ Échec de l\'initiation du paiement',
            payment_status: 'failed',
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

      console.log('💰 PAIEMENT CONFIRMÉ - CRÉATION DE LA COMMANDE...')

      const orderNumber = `CMD-${Date.now()}-${Math.floor(Math.random() * 1000)}`

      const order = await Order.create({
        user_id: userId,
        order_number: orderNumber,
        status: 'paid',
        total,
        subtotal,
        shipping_cost: deliveryPrice,
        delivery_method: deliveryMethod,
        customer_name: fullName,
        customer_phone: accountNumber,
        payment_method: operator,
        customer_email: user?.email || customerEmailFallback || 'non-renseigné@email.com',
        shipping_address: shippingAddress || 'non renseigné',
        billing_address: billingAddress || shippingAddress || 'non renseigné',
        notes: notes || null,
      })

      console.log(`✅ Commande créée: ${order.order_number}`)

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
          console.log(`📦 Stock mis à jour: ${item.productName} → ${product.stock}`)
        }
      }

      await OrderTracking.create({
        order_id: order.id,
        status: 'paid',
        description: `Paiement Mobile Money effectué - Réf: ${paymentInfo?.reference_id} - Montant: ${total} FCFA`,
        tracked_at: DateTime.now(),
      })

      await CartItem.query().where('cart_id', cart.id).delete()
      console.log('✅ Panier vidé')

      await this.creditSellersAndAdmin(order.id, total)

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

  // ========== COMMANDES D'UN UTILISATEUR ==========
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
      return response.status(500).json({ success: false, message: 'Erreur lors de la récupération des commandes', error: error.message })
    }
  }

  // ========== UNE COMMANDE SPÉCIFIQUE ==========
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
      return response.status(500).json({ success: false, message: 'Erreur lors de la récupération de la commande', error: error.message })
    }
  }

  // ========== MISE À JOUR STATUT (ADMIN) ==========
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
        description: description || this.getStatusDescription(status),
        location: location || null,
        tracked_at: DateTime.now(),
      })

      order.status = status as typeof order.status
      if (trackingNumber) order.tracking_number = trackingNumber
      if (estimatedDelivery) order.estimated_delivery = estimatedDelivery
      if (status === 'delivered') order.delivered_at = DateTime.now()
      await order.save()

      return response.status(200).json({ success: true, message: `✅ Statut mis à jour : ${status}`, data: order })
    } catch (error: any) {
      return response.status(500).json({ success: false, message: 'Erreur lors de la mise à jour du statut', error: error.message })
    }
  }

  // ========== ANNULER UNE COMMANDE ==========
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

      return response.status(200).json({ success: true, message: '✅ Commande annulée avec succès', data: order })
    } catch (error: any) {
      return response.status(500).json({ success: false, message: 'Erreur lors de l\'annulation', error: error.message })
    }
  }

  // ========== FACTURE ==========
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
      return response.status(500).json({ success: false, message: 'Erreur lors de la génération de la facture', error: error.message })
    }
  }

  // ========== SUIVI D'UNE COMMANDE ==========
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
      return response.status(500).json({ success: false, message: 'Erreur lors de la récupération du suivi', error: error.message })
    }
  }

  // ========== DESCRIPTIONS DES STATUTS ==========
  private getStatusDescription(status: string): string {
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
}
