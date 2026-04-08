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

// Helper : vérifie si une chaîne est un UUID valide
function isValidUuid(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)
}

// Interface pour stocker les infos de paiement
interface PaymentInfo {
  reference_id: string
  x_secret: string
  status: string
  amount: number
  operator_simple: string
  transaction_type: string
  check_status_url: string
  code_url: string
}

export default class OrdersController {
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

  async store({ request, response }: HttpContext) {
    console.log('🔵 ========== DEBUT CREATION COMMANDE ==========')

    try {
      console.log('🔵 Récupération des données de la requête...')
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
        'paymentApiKeyPublic',
        'paymentApiKeySecret',
        'customerName',
        'customerEmail',
        'mobileOperatorCode',
        'mobileOperatorName',
      ])

      console.log('📦 Données reçues:', {
        userId,
        customerAccountNumber,
        deliveryMethod,
        deliveryPrice,
        mobileOperatorCode: mobileOperatorCode || '(non fourni)',
        mobileOperatorName: mobileOperatorName || '(non fourni)',
      })

      // ========== VALIDATION ==========
      if (!userId) {
        return response.status(400).json({ success: false, message: 'userId est requis' })
      }

      if (!customerAccountNumber) {
        return response.status(400).json({ success: false, message: 'customerAccountNumber est requis (numéro de téléphone)' })
      }

      // ========== ÉTAPE 1: APPELER L'API KYC ==========
      console.log('🔵 🌐 APPEL API KYC...')
      const kycUrl = `https://apist.onrender.com/api/mypvit/kyc/marchant?customerAccountNumber=${customerAccountNumber}`

      let operator = mobileOperatorCode || 'non renseigné'
      let fullName = customerNameFallback || 'non renseigné'
      let accountNumber = customerAccountNumber

      try {
        const kycResponse = await axios.get(kycUrl, { timeout: 10000 })
        if (kycResponse.data.success && kycResponse.data.data) {
          const kycData = kycResponse.data.data
          operator = mobileOperatorCode || kycData.detected_operator || kycData.operator || 'non renseigné'
          fullName = kycData.full_name || customerNameFallback || 'non renseigné'
          accountNumber = kycData.customer_account_number || customerAccountNumber
          console.log('✅ KYC OK - opérateur utilisé:', operator, '| nom:', fullName)
        } else {
          console.log('🟡 KYC success=false, fallback sur données frontend')
          operator = mobileOperatorCode || 'non renseigné'
        }
      } catch (kycError: any) {
        console.log('🟡 KYC injoignable (status', kycError?.response?.status ?? 'inconnu', '), fallback sur données frontend')
        operator = mobileOperatorCode || 'non renseigné'
      }

      // ========== ÉTAPE 2: RECHERCHE DE L'UTILISATEUR ==========
      let user: User | null = null
      const isGuest = !isValidUuid(userId)

      if (isGuest) {
        console.log('👤 Utilisateur invité (guest), pas de recherche en DB')
      } else {
        console.log('🔵 Recherche de l\'utilisateur avec UUID:', userId)
        user = await User.findBy('id', userId)
        console.log('👤 Utilisateur trouvé:', user ? { id: user.id, email: user.email } : 'Introuvable')
      }

      // ========== ÉTAPE 3: RÉCUPÉRATION DU PANIER ==========
      console.log('🔵 Récupération du panier de l\'utilisateur...')

      if (isGuest) {
        console.log('❌ Utilisateur invité : aucun panier en DB')
        return response.status(400).json({
          success: false,
          message: 'Les commandes en mode invité ne sont pas supportées. Veuillez vous connecter.',
        })
      }

      const cart = await Cart.query()
        .where('user_id', userId)
        .preload('items')
        .first()

      console.log('🛒 Panier trouvé:', cart ? { id: cart.id, itemsCount: cart.items.length } : 'Aucun')

      if (!cart || cart.items.length === 0) {
        console.log('❌ Panier vide ou inexistant')
        return response.status(400).json({ success: false, message: 'Votre panier est vide' })
      }

      // ========== ÉTAPE 4: CALCUL DU TOTAL ET RÉCUPÉRATION DES PRODUITS ==========
      console.log('🔵 Calcul du total et récupération des produits...')
      let subtotal = 0
      const orderItems: any[] = []

      // Stocker les ventes par vendeur pour les crédits wallet
      const sellerSales: Map<string, { sellerId: string; amount: number; products: any[] }> = new Map()

      for (const cartItem of cart.items) {
        if (!cartItem.product_id) {
          console.log(`⚠️ Item avec product_id null ignoré`)
          continue
        }

        const product = await Product.findBy('id', cartItem.product_id)

        if (!product) {
          console.log(`❌ Produit avec UUID ${cartItem.product_id} non trouvé`)
          return response.status(400).json({
            success: false,
            message: `Produit avec UUID ${cartItem.product_id} non trouvé`,
          })
        }

        const itemTotal = product.price * cartItem.quantity
        subtotal += itemTotal

        // Stocker les informations pour le crédit du vendeur
        const sellerId = product.user_id
        if (!sellerSales.has(sellerId)) {
          sellerSales.set(sellerId, {
            sellerId: sellerId,
            amount: 0,
            products: []
          })
        }

        const sellerData = sellerSales.get(sellerId)!
        sellerData.amount += itemTotal
        sellerData.products.push({
          product_id: product.id,
          product_name: product.name,
          quantity: cartItem.quantity,
          price: product.price,
          subtotal: itemTotal
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

        console.log(`✅ Item: ${product.name} x ${cartItem.quantity} = ${itemTotal} (vendeur: ${sellerId})`)
      }

      if (orderItems.length === 0) {
        return response.status(400).json({ success: false, message: 'Aucun produit valide dans le panier' })
      }

      const total = subtotal + deliveryPrice
      console.log(`🔵 Total: subtotal=${subtotal} + livraison=${deliveryPrice} = ${total}`)

      // ========== ÉTAPE 5: APPEL API DE PAIEMENT (AVANT CRÉATION COMMANDE) ==========
      let paymentResult: any = null
      let paymentInfo: PaymentInfo | null = null
      let paymentSuccess = false
      let paymentFailed = false

      try {
        console.log('🔵 🌐 APPEL API PAIEMENT...')

        const paymentBody: Record<string, any> = {
          amount: total,
          customer_account_number: accountNumber,
          payment_api_key_public: "pk_1773325888803_dt8diavuh3h",
          payment_api_key_secret: "sk_1773325888803_qt015a3cr5",
        }

        if (mobileOperatorCode) {
          paymentBody.operator_code = mobileOperatorCode
          console.log(`✅ Opérateur fourni par le frontend: ${mobileOperatorCode} (${mobileOperatorName || 'nom non fourni'})`)
        } else {
          console.log('🟡 Aucun opérateur fourni, l\'API payment détectera via le numéro')
        }

        console.log('📤 Body envoyé à /api/payment:', JSON.stringify(paymentBody, null, 2))

        const paymentResponse = await axios.post(
          'https://apist.onrender.com/api/payment',
          paymentBody,
          { headers: { 'Content-Type': 'application/json' }, timeout: 30000 }
        )

        paymentResult = paymentResponse.data
        console.log('✅ Réponse paiement reçue:', JSON.stringify(paymentResult, null, 2))

        if (paymentResult.success && paymentResult.data) {
          paymentInfo = {
            reference_id: paymentResult.data.reference_id,
            x_secret: paymentResult.data.x_secret || 'not_provided',
            status: paymentResult.data.status,
            amount: paymentResult.data.amount,
            operator_simple: paymentResult.data.operator_simple,
            transaction_type: paymentResult.data.transaction_type,
            check_status_url: paymentResult.data.check_status_url,
            code_url: paymentResult.data.code_url || 'O2S57GKG1BQIE3RF'
          }

          console.log('🔑 reference_id:', paymentInfo.reference_id)

          // ========== VÉRIFICATION DU STATUT PENDANT 4 MINUTES (VÉRIFICATION CHAQUE SECONDE) ==========
          console.log('🔍 Vérification du statut du paiement pendant max 4 minutes...')
          const referenceId = paymentResult.data.reference_id
          
          const startTime = Date.now()
          const maxWaitTime = 4 * 60 * 1000 // 4 minutes en millisecondes
          const checkInterval = 1000 // 1 seconde entre chaque vérification
          
          let attemptCount = 0
          let lastStatus = 'unknown'

          while (Date.now() - startTime < maxWaitTime) {
            attemptCount++
            const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000)
            
            console.log(`📡 Vérification #${attemptCount} - Temps écoulé: ${elapsedSeconds}s / 240s`)

            try {
              const statusResponse = await axios.get(
                `https://apist.onrender.com/api/check-status/${referenceId}`,
                { timeout: 15000 }
              )

              const statusData = statusResponse.data
              
              // Log simplifié pour ne pas surcharger la console
              if (attemptCount % 10 === 0 || statusData.is_success === true || statusData.is_failed === true) {
                console.log(`📊 Statut vérification #${attemptCount}:`, {
                  success: statusData.success,
                  is_success: statusData.is_success || false,
                  is_pending: statusData.is_pending || false,
                  is_failed: statusData.is_failed || false,
                  status: statusData.status || 'unknown'
                })
              }

              if (statusData.success && statusData.is_success === true) {
                console.log('✅✅✅ PAIEMENT RÉUSSI ! ✅✅✅')
                console.log(`💰 Montant: ${statusData.amount} FCFA`)
                console.log(`⏱️ Temps de confirmation: ${elapsedSeconds} secondes`)
                paymentSuccess = true
                paymentFailed = false
                break
              } else if (statusData.success && statusData.is_failed === true) {
                console.log(`❌ Paiement échoué après ${elapsedSeconds} secondes`)
                paymentSuccess = false
                paymentFailed = true
                break
              } else if (statusData.success && statusData.is_pending === true) {
                lastStatus = 'pending'
                // Continue la boucle
              } else {
                lastStatus = statusData.status || 'unknown'
                // Continue la boucle
              }
            } catch (statusError: any) {
              console.error(`❌ Erreur vérification #${attemptCount}:`, statusError.message)
              // Continue malgré l'erreur réseau
            }

            // Attendre 1 seconde avant la prochaine vérification
            await new Promise(resolve => setTimeout(resolve, checkInterval))
          }

          // Vérification finale du résultat
          if (!paymentSuccess && !paymentFailed) {
            console.log(`⏰ Timeout atteint après 4 minutes - Statut final: ${lastStatus}`)
            
            // Une dernière vérification pour être sûr
            try {
              const finalStatusResponse = await axios.get(
                `https://apist.onrender.com/api/check-status/${referenceId}`,
                { timeout: 15000 }
              )
              
              const finalStatusData = finalStatusResponse.data
              
              if (finalStatusData.success && finalStatusData.is_success === true) {
                console.log('✅ Paiement confirmé lors de la vérification finale !')
                paymentSuccess = true
              } else {
                console.log('❌ Paiement non confirmé après 4 minutes')
                paymentSuccess = false
              }
            } catch (finalError: any) {
              console.error('❌ Erreur lors de la vérification finale:', finalError.message)
              paymentSuccess = false
            }
          }

          if (!paymentSuccess) {
            console.log('❌ Paiement non confirmé - Annulation de la commande')
            return response.status(400).json({
              success: false,
              message: '❌ Paiement non confirmé après 4 minutes. Veuillez réessayer.',
              payment_status: paymentFailed ? 'failed' : 'timeout',
              attempts: attemptCount,
              time_elapsed_seconds: Math.floor((Date.now() - startTime) / 1000)
            })
          }
        } else {
          console.log('❌ Paiement échoué:', paymentResult.message)
          return response.status(400).json({
            success: false,
            message: paymentResult.message || '❌ Paiement échoué',
            payment_status: 'failed'
          })
        }
      } catch (paymentErr: any) {
        console.error('❌ Erreur paiement:', paymentErr.message)
        return response.status(500).json({
          success: false,
          message: '❌ Erreur lors du traitement du paiement',
          error: paymentErr.message
        })
      }

      // ========== ⚠️ ICI : ON N'ARRIVE QUE SI LE PAIEMENT EST RÉUSSI ==========
      if (!paymentSuccess) {
        return response.status(400).json({
          success: false,
          message: '❌ Paiement non confirmé. Commande non créée.'
        })
      }

      console.log('💰 PAIEMENT CONFIRMÉ - CRÉATION DE LA COMMANDE...')

      // ========== ÉTAPE 6: CRÉATION DE LA COMMANDE (SEULEMENT SI PAIEMENT OK) ==========
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

      // ========== ÉTAPE 7: CRÉATION DES ITEMS ET DÉCRÉMENTATION DU STOCK ==========
      for (const item of orderItems) {
        // Créer l'item de commande
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
        console.log(`✅ Item créé: ${item.productName} x ${item.quantity}`)

        // ✅ DÉCRÉMENTER LE STOCK DU PRODUIT
        const product = await Product.findBy('id', item.product_id)
        if (product) {
          const oldStock = product.stock
          product.stock = product.stock - item.quantity
          await product.save()
          console.log(`📦 Stock mis à jour: ${item.productName} - ancien: ${oldStock} → nouveau: ${product.stock}`)
        }
      }

      // ========== ÉTAPE 8: SUIVI INITIAL ==========
      await OrderTracking.create({
        order_id: order.id,
        status: 'paid',
        description: `Paiement effectué avec succès - Réf: ${paymentInfo?.reference_id} - Montant: ${total} FCFA`,
        tracked_at: DateTime.now(),
      })

      // ========== ÉTAPE 9: VIDAGE DU PANIER ==========
      await CartItem.query().where('cart_id', cart.id).delete()
      console.log('✅ Panier vidé')

      // ========== ÉTAPE 10: PRÉLÈVEMENT 0.5% POUR SUPERADMIN ==========
      const superAdminFee = total * 0.005  // 0.5% du total
      console.log(`💰 Prélèvement superadmin: ${superAdminFee} FCFA (0.5% de ${total})`)

      try {
        const superAdmin = await User.query()
          .where('role', 'superadmin')
          .first()

        if (superAdmin) {
          let superAdminWallet = await Wallet.query()
            .where('user_id', superAdmin.id)
            .first()

          if (!superAdminWallet) {
            superAdminWallet = await Wallet.create({
              user_id: superAdmin.id,
              balance: 0,
              currency: 'XAF',
              status: 'active'
            })
            console.log(`✅ Wallet superadmin créé pour ${superAdmin.email}`)
          }

          const previousBalance = superAdminWallet.balance || 0
          superAdminWallet.balance = previousBalance + superAdminFee
          await superAdminWallet.save()

          console.log(`✅ ${superAdminFee.toLocaleString()} FCFA ajouté au wallet superadmin`)
        } else {
          console.log('⚠️ Superadmin non trouvé, prélèvement non effectué')
        }
      } catch (walletError: any) {
        console.error('❌ Erreur lors du prélèvement superadmin:', walletError.message)
      }

      // ========== ÉTAPE 11: CRÉDITER CHAQUE VENDEUR DANS SON WALLET ==========
      console.log('💰 CRÉDIT DES VENDEURS...')
      const sellerCredits: any[] = []

      for (const [sellerId, saleData] of sellerSales.entries()) {
        try {
          // Récupérer ou créer le wallet du vendeur
          let sellerWallet = await Wallet.query()
            .where('user_id', sellerId)
            .first()

          if (!sellerWallet) {
            sellerWallet = await Wallet.create({
              user_id: sellerId,
              balance: 0,
              currency: 'XAF',
              status: 'active'
            })
            console.log(`✅ Wallet créé pour le vendeur ${sellerId}`)
          }

          const previousBalance = sellerWallet.balance || 0
          sellerWallet.balance = previousBalance + saleData.amount
          await sellerWallet.save()

          sellerCredits.push({
            seller_id: sellerId,
            amount: saleData.amount,
            products_count: saleData.products.length,
            previous_balance: previousBalance,
            new_balance: sellerWallet.balance,
          })

          console.log(`✅ Vendeur ${sellerId} crédité de ${saleData.amount.toLocaleString()} FCFA`)
          console.log(`   📊 Ancien solde: ${previousBalance.toLocaleString()} FCFA → Nouveau: ${sellerWallet.balance.toLocaleString()} FCFA`)

          // Enregistrer la transaction dans une table (optionnel)
          for (const product of saleData.products) {
            console.log(`   📦 Produit: ${product.product_name} x${product.quantity} = ${product.subtotal.toLocaleString()} FCFA`)
          }
        } catch (sellerError: any) {
          console.error(`❌ Erreur lors du crédit du vendeur ${sellerId}:`, sellerError.message)
        }
      }

      // ========== ÉTAPE 12: RECHARGEMENT ==========
      await order.load('items')
      console.log('🟢 ========== COMMANDE CREEE AVEC SUCCES ==========')

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
          admin_fee: superAdminFee,
          seller_credits: sellerCredits,
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
      console.error('🔴 ========== ERREUR CREATION COMMANDE ==========')
      console.error('🔴 Message:', error.message)
      console.error('🔴 Stack:', error.stack)
      return response.status(500).json({
        success: false,
        message: '❌ Erreur lors de la création de la commande',
        error: error.message,
      })
    }
  }

  // Méthode pour vérifier le statut d'une transaction via notre API
  async checkPaymentStatus({ params, response }: HttpContext) {
    try {
      const { referenceId } = params

      if (!referenceId) {
        return response.status(400).json({ success: false, message: 'referenceId est requis' })
      }

      console.log(`🔍 Vérification du statut via API externe pour: ${referenceId}`)

      const statusResponse = await axios.get(
        `https://apist.onrender.com/api/check-status/${referenceId}`,
        { timeout: 15000 }
      )

      const statusData = statusResponse.data

      return response.status(200).json({
        success: true,
        message: 'Statut vérifié avec succès',
        data: statusData
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

  // Récupérer toutes les commandes d'un utilisateur
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

      return response.status(200).json({ success: true, message: 'Commandes récupérées avec succès', data: orders })
    } catch (error: any) {
      return response.status(500).json({ success: false, message: 'Erreur lors de la récupération des commandes', error: error.message })
    }
  }

  // Récupérer une commande spécifique
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

      return response.status(200).json({ success: true, message: 'Commande récupérée avec succès', data: order })
    } catch (error: any) {
      return response.status(500).json({ success: false, message: 'Erreur lors de la récupération de la commande', error: error.message })
    }
  }

  // Mettre à jour le statut d'une commande (admin)
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

      order.status = status
      if (trackingNumber) order.tracking_number = trackingNumber
      if (estimatedDelivery) order.estimated_delivery = estimatedDelivery
      if (status === 'delivered') order.delivered_at = DateTime.now()
      await order.save()

      return response.status(200).json({ success: true, message: `✅ Statut mis à jour : ${status}`, data: order })
    } catch (error: any) {
      return response.status(500).json({ success: false, message: 'Erreur lors de la mise à jour du statut', error: error.message })
    }
  }

  // Annuler une commande
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

      if (order.status !== 'pending') {
        return response.status(400).json({ success: false, message: 'Cette commande ne peut plus être annulée' })
      }

      order.status = 'cancelled'
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

  // Générer une facture
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
      return response.status(500).json({ success: false, message: 'Erreur lors de la génération de la facture', error: error.message })
    }
  }

  // Récupérer le suivi d'une commande
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

      return response.status(200).json({ success: true, message: 'Suivi récupéré avec succès', data: tracking })
    } catch (error: any) {
      return response.status(500).json({ success: false, message: 'Erreur lors de la récupération du suivi', error: error.message })
    }
  }

  // Description des statuts
  private getStatusDescription(status: string): string {
    const descriptions: Record<string, string> = {
      pending: 'Commande confirmée et en attente de traitement',
      processing: 'Votre commande est en cours de préparation',
      shipped: 'Votre commande a été expédiée',
      delivered: 'Votre commande a été livrée avec succès',
      paid: 'Paiement effectué avec succès',
      payment_pending: 'Paiement en attente de confirmation',
      payment_failed: 'Le paiement a échoué',
      cancelled: 'Votre commande a été annulée',
    }
    return descriptions[status] || `Statut mis à jour: ${status}`
  }
}
