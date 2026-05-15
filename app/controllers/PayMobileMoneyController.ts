// app/controllers/PayMobileMoneyController.ts
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
import { DateTime } from 'luxon'
import MypvitSecretService from '../services/mypvit_secret_service.js'
import MypvitTransactionService from '../services/mypvit_transaction_service.js'
import MypvitKYCService from '../services/mypvit_kyc_service.js'
import crypto from 'node:crypto'

const CALLBACK_URL_CODE = '9ZOXW'
const ADMIN_COMMISSION_RATE = 0.03 // 3% pour l'admin

function generateOrderNumber(): string {
  return `CMD-${Date.now()}-${Math.floor(Math.random() * 1000)}`
}

export default class PayMobileMoneyController {

  private async renewSecretIfNeeded(phoneNumber?: string): Promise<void> {
    try {
      console.log('🔄 Tentative de renouvellement du secret...')
      await MypvitSecretService.renewSecret(phoneNumber)
      console.log('✅ Clé renouvelée avec succès')
    } catch (error: any) {
      console.error('⚠️ Erreur renouvellement secret:', error.message)
    }
  }

  private detectOperatorGabon(phoneNumber: string): { name: string; code: string; accountCode: string } {
    console.log('🔍 Détection opérateur pour:', phoneNumber)
    
    const clean = phoneNumber.replace(/[\s\+\.\-]/g, '')
    let local = clean
    
    if (clean.startsWith('+241')) local = clean.substring(4)
    else if (clean.startsWith('241')) local = clean.substring(3)
    
    if (local.startsWith('0')) local = local.substring(1)
    
    console.log('📱 Numéro nettoyé:', local)
    console.log('🔢 Premier chiffre:', local.charAt(0))

    if (local.startsWith('06') || local.startsWith('6')) {
      console.log('✅ MOOV_MONEY détecté')
      return { name: 'MOOV_MONEY', code: 'MOOV_MONEY', accountCode: 'ACC_69EFB143D4F54' }
    }

    if (local.startsWith('07') || local.startsWith('7')) {
      console.log('✅ AIRTEL_MONEY détecté')
      return { name: 'AIRTEL_MONEY', code: 'AIRTEL_MONEY', accountCode: 'ACC_69EFB0E02FCA3' }
    }
    
    console.log('✅ GIMAC détecté (par défaut)')
    return { name: 'GIMAC', code: 'GIMAC_PAY', accountCode: 'ACC_69FE0E1BC34B4' }
  }

  private async performKYC(phoneNumber: string): Promise<{
    operator: string
    fullName: string
    accountNumber: string
    operatorCode: string
    accountCode: string
    isActive: boolean
  }> {
    console.log('🆔 Démarrage KYC pour:', phoneNumber)
    
    const detected = this.detectOperatorGabon(phoneNumber)
    let fullName = 'Client'

    try {
      await this.renewSecretIfNeeded(phoneNumber)
      const kycData = await MypvitKYCService.getKYCInfo(phoneNumber, detected.code)
      fullName = kycData.firstname || kycData.full_name || 'Client'
      console.log('✅ KYC réussi, nom:', fullName)
    } catch (error: any) {
      console.log('🟡 KYC fallback:', error.message)
    }

    try {
      const existingKYC = await KYC.findBy('numeroTelephone', phoneNumber)
      if (existingKYC) {
        existingKYC.nomComplet = fullName
        existingKYC.operateur = detected.name
        await existingKYC.save()
      } else {
        await KYC.create({
          nomComplet: fullName,
          numeroTelephone: phoneNumber,
          operateur: detected.name
        })
      }
    } catch (error: any) {
      console.log('🟡 KYC save error:', error.message)
    }

    return {
      operator: detected.name,
      fullName,
      accountNumber: phoneNumber,
      operatorCode: detected.code,
      accountCode: detected.accountCode,
      isActive: true
    }
  }

  private async checkCartStock(userId: string): Promise<{
    ok: boolean
    errors: string[]
    cart: Cart | null
  }> {
    const errors: string[] = []
    
    const cart = await Cart.query()
      .where('user_id', userId)
      .preload('items')
      .first()

    if (!cart || !cart.items || cart.items.length === 0) {
      return { ok: false, errors: ['Panier vide'], cart: null }
    }

    for (const item of cart.items) {
      const p = await Product.findBy('id', item.product_id)
      if (!p) { errors.push(`Produit ${item.product_id} introuvable`); continue }
      if (p.isArchived) { errors.push(`${p.name} - Archivé`); continue }
      if (p.stock <= 0) { errors.push(`${p.name} - Rupture de stock`); continue }
      if (p.stock < item.quantity) { errors.push(`${p.name}: stock ${p.stock} < ${item.quantity}`); continue }
    }

    return { ok: errors.length === 0, errors, cart }
  }

  private async buildItemsFromCart(order: Order, cart: Cart): Promise<{ 
    subtotal: number
    count: number
    merchantIds: string[]
    merchantProducts: Map<string, { productId: string; productName: string; price: number; quantity: number; subtotal: number }[]>
  }> {
    let subtotal = 0
    let count = 0
    const merchantIds = new Set<string>()
    const merchantProducts = new Map<string, { productId: string; productName: string; price: number; quantity: number; subtotal: number }[]>()

    for (const item of cart.items) {
      const p = await Product.findBy('id', item.product_id)
      if (!p) continue

      // 🆕 Récupérer l'ID du propriétaire
      merchantIds.add(p.user_id)
      
      if (!merchantProducts.has(p.user_id)) {
        merchantProducts.set(p.user_id, [])
      }

      const itemTotal = p.price * item.quantity
      merchantProducts.get(p.user_id)!.push({
        productId: p.id,
        productName: p.name,
        price: p.price,
        quantity: item.quantity,
        subtotal: itemTotal
      })

      subtotal += itemTotal

      await OrderItem.create({
        order_id: order.id,
        product_id: p.id,
        product_name: p.name,
        price: p.price,
        quantity: item.quantity,
        subtotal: itemTotal
      })

      count++
    }

    return { subtotal, count, merchantIds: Array.from(merchantIds), merchantProducts }
  }

  // 🆕 Créer un livreur Eden automatiquement
  private async createEdenLivreur(): Promise<User> {
    console.log('🆕 Création d\'un nouveau livreur Eden...')
    
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
    
    console.log(`✅ Livreur Eden créé: ${livreur.full_name} (${livreur.id})`)
    
    // Créer son wallet
    await Wallet.create({
      user_id: livreur.id,
      balance: 0,
      currency: 'XAF',
      status: 'active',
    })
    
    console.log(`💼 Wallet créé pour ${livreur.full_name}`)
    
    return livreur
  }

  // 🆕 Crédite le wallet d'un utilisateur
  private async creditWallet(userId: string, amount: number, description: string): Promise<void> {
    try {
      let wallet = await Wallet.findBy('user_id', userId)
      
      if (!wallet) {
        wallet = await Wallet.create({
          user_id: userId,
          balance: 0,
          currency: 'XAF',
          status: 'active',
        })
        console.log(`  💼 Nouveau wallet créé pour ${userId}`)
      }

      const oldBalance = wallet.balance
      wallet.balance += amount
      await wallet.save()

      console.log(`  💰 Wallet ${userId}: ${oldBalance} → ${wallet.balance} XAF (${description})`)
    } catch (error: any) {
      console.error(`  🔴 Erreur crédit wallet ${userId}:`, error.message)
      throw error
    }
  }

  // ==================== MÉTHODE PRINCIPALE ====================
  async pay({ request, response }: HttpContext) {
    console.log('📱 ========== PAIEMENT MOBILE MONEY ==========')

    try {
      const payload = request.only([
        'userId', 'customerAccountNumber', 'shippingAddress', 'deliveryMethod',
        'deliveryPrice', 'customerName', 'customerEmail', 'customerPhone', 'agent', 'linkType', 'notes'
      ])

      console.log('📦 Données reçues:', payload)

      const userId = payload.userId
      const phoneNumber = payload.customerAccountNumber || payload.customerPhone

      if (!userId) {
        return response.status(400).json({ success: false, message: 'userId requis' })
      }

      if (!phoneNumber) {
        return response.status(400).json({ success: false, message: 'Numéro de téléphone requis' })
      }

      // 1. Récupérer le panier
      console.log('🛒 Récupération du panier pour userId:', userId)
      
      const { ok, errors, cart } = await this.checkCartStock(userId)
      
      if (!ok) {
        return response.status(400).json({
          success: false,
          message: 'Stock insuffisant ou panier vide',
          errors
        })
      }

      if (!cart) {
        return response.status(400).json({ success: false, message: 'Panier introuvable' })
      }

      console.log(`🛒 Panier trouvé avec ${cart.items.length} articles`)

      // 2. KYC et détection opérateur
      const kyc = await this.performKYC(phoneNumber)
      console.log(`📱 Opérateur: ${kyc.operator} | Code: ${kyc.operatorCode} | Compte: ${kyc.accountCode}`)

      // 3. Renouveler le secret
      await this.renewSecretIfNeeded(phoneNumber)

      // 4. Récupérer l'utilisateur
      const user = await User.findBy('id', userId)

      // 5. Calculer le total
      let subtotal = 0
      for (const item of cart.items) {
        const product = await Product.findBy('id', item.product_id)
        if (product) {
          subtotal += product.price * item.quantity
        }
      }

      const shippingCost = payload.deliveryPrice || 1
      const total = subtotal + shippingCost

      console.log('💰 Subtotal:', subtotal, '| Livraison:', shippingCost, '| Total:', total)

      // 6. Création commande
      const order = await Order.create({
        user_id: userId,
        order_number: generateOrderNumber(),
        status: 'pending',
        total: total,
        subtotal: subtotal,
        shipping_cost: shippingCost,
        delivery_method: payload.deliveryMethod || 'standard',
        customer_name: user?.full_name || payload.customerName || kyc.fullName,
        customer_phone: phoneNumber,
        payment_method: kyc.operator,
        customer_email: user?.email || payload.customerEmail || '',
        shipping_address: payload.shippingAddress || 'non renseigné',
        payment_operator_simple: kyc.operator
      })

      // 7. Créer les OrderItems et récupérer les infos marchands
      const { count, merchantIds, merchantProducts } = await this.buildItemsFromCart(order, cart)

      console.log('🏪 Marchands dans la commande:', merchantIds)

      // 8. Tracking initial
      await OrderTracking.create({
        order_id: order.id,
        status: 'pending',
        description: `🛒 Commande initiée - ${kyc.operator} - ${count} articles`,
        tracked_at: DateTime.now(),
      })

      // 9. PAIEMENT
      console.log(`💳 Paiement ${kyc.operator} via compte ${kyc.accountCode}...`)

      const payment = await MypvitTransactionService.processPayment({
        agent: payload.agent || 'AGENT_DEFAULT',
        amount: total,
        reference: `REF${Date.now()}`.substring(0, 15),
        callback_url_code: CALLBACK_URL_CODE,
        customer_account_number: kyc.accountNumber,
        merchant_operation_account_code: kyc.accountCode,
        owner_charge: 'CUSTOMER',
        operator_code: kyc.operatorCode,
      })

      console.log('💳 Résultat paiement COMPLET:', JSON.stringify(payment, null, 2))
      console.log('🔍 payment.reference_id:', payment.reference_id)
      console.log('🔍 payment.merchant_reference_id:', payment.merchant_reference_id)
      console.log('🔍 payment.status:', payment.status)

      // ✅ 10. RÉCUPÉRER LE X-SECRET ACTIF
      console.log('🔑 Récupération du X-Secret...')
      const xSecret = await MypvitSecretService.getSecret()
      console.log('   X-Secret:', xSecret.substring(0, 15) + '...')

      // 11. Traitement résultat
      if (payment.status !== 'FAILED' && payment.reference_id) {
        order.payment_reference_id = payment.reference_id
        order.payment_operator_simple = kyc.operator
        order.payment_amount = total
        order.payment_initiated_at = DateTime.now()
        order.status = 'pending_payment'
        await order.save()

        await OrderTracking.create({
          order_id: order.id,
          status: 'pending_payment',
          description: `⏳ En attente - ${kyc.operator} - Réf: ${payment.reference_id}`,
          tracked_at: DateTime.now(),
        })

        // ============================================================
        // 🆕 DISTRIBUTION DE L'ARGENT (après paiement réussi)
        // ============================================================
        
        const adminCommission = total * ADMIN_COMMISSION_RATE
        console.log(`\n💼 ===== DISTRIBUTION FINANCIÈRE =====`)
        console.log(`📊 Total commande: ${total} XAF`)
        console.log(`📦 Sous-total produits: ${subtotal} XAF`)
        console.log(`🚚 Frais livraison: ${shippingCost} XAF`)
        console.log(`🏛️ Commission admin (3%): ${adminCommission} XAF`)
        
        // Créditer l'admin
        const adminUser = await User.query()
          .where('role', 'superadmin')
          .orWhere('role', 'admin')
          .first()
        
        if (adminUser) {
          await this.creditWallet(adminUser.id, adminCommission, `Commission 3% - Commande #${order.order_number}`)
        }

        // Distribuer le prix des produits aux marchands
        console.log(`\n📦 DISTRIBUTION AUX MARCHANDS:`)
        
        const totalAfterCommission = total - adminCommission
        const commissionRatio = totalAfterCommission / total
        
        for (const merchantId of merchantIds) {
          const merchant = await User.findBy('id', merchantId)
          if (!merchant) continue

          const products = merchantProducts.get(merchantId) || []
          let merchantTotal = 0
          
          for (const product of products) {
            merchantTotal += product.subtotal
          }
          
          const merchantAmount = merchantTotal * commissionRatio
          
          console.log(`  👤 ${merchant.full_name}:`)
          console.log(`     - Produits: ${products.map(p => p.productName).join(', ')}`)
          console.log(`     - Montant: ${merchantAmount.toFixed(0)} XAF`)
          
          await this.creditWallet(merchant.id, merchantAmount, `Vente produits - Commande #${order.order_number}`)
        }

        // Distribuer les frais de livraison
        if (shippingCost > 0) {
          console.log(`\n🚚 FRAIS DE LIVRAISON: ${shippingCost} XAF`)
          
          let needEdenLivreur = false
          
          for (const merchantId of merchantIds) {
            const merchant = await User.findBy('id', merchantId)
            
            if (merchant) {
              console.log(`  👤 ${merchant.full_name} | has_livreur: ${merchant.has_livreur}`)
              
              if (merchant.has_livreur) {
                const deliveryShare = shippingCost / merchantIds.length
                console.log(`  ✅ Livreur personnel → +${deliveryShare} XAF`)
                await this.creditWallet(merchant.id, deliveryShare, `Frais livraison (livreur personnel) - Commande #${order.order_number}`)
              } else {
                needEdenLivreur = true
              }
            }
          }
          
          if (needEdenLivreur) {
            console.log(`  🔍 Recherche d'un edenlivreur...`)
            
            let edenLivreur = await User.query()
              .where('role', 'edenlivreur')
              .where('is_verified', true)
              .first()
            
            if (!edenLivreur) {
              console.log(`  ⚠️ Aucun edenlivreur trouvé → Création automatique...`)
              edenLivreur = await this.createEdenLivreur()
            } else {
              console.log(`  🛵 EdenLivreur trouvé: ${edenLivreur.full_name} (${edenLivreur.id})`)
            }
            
            await this.creditWallet(edenLivreur.id, shippingCost, `Frais livraison - Commande #${order.order_number}`)
            
            order.livreur_id = edenLivreur.id
            await order.save()
            
            await OrderTracking.create({
              order_id: order.id,
              status: 'pending',
              description: `🛵 Livreur Eden assigné: ${edenLivreur.full_name}`,
              tracked_at: DateTime.now(),
            })
          }
        }

        console.log(`\n✅ Distribution terminée`)

        await order.load('items')

        // ✅ 12. VIDER LE PANIER
        console.log('🗑️ Vidage du panier (après paiement initié avec succès)...')
        await CartItem.query().where('cart_id', cart.id).delete()
        console.log('🗑️ Panier vidé avec succès')

        return response.status(201).json({
          success: true,
          message: '⏳ Vérifiez votre téléphone pour confirmer le paiement',
          data: {
            orderId: order.id,
            orderNumber: order.order_number,
            total: order.total,
            subtotal: order.subtotal,
            shippingCost: order.shipping_cost,
            adminCommission: adminCommission,
            status: 'pending_payment',
            customerName: order.customer_name,
            paymentMethod: kyc.operator,
            itemsCount: count,
            userId,
            operator: {
              name: kyc.operator,
              code: kyc.operatorCode,
              accountCode: kyc.accountCode,
              phoneNumber: phoneNumber
            },
            x_secret: xSecret,
            merchant_reference_id: payment.merchant_reference_id,
            pvit_reference_id: payment.reference_id,
            payment: {
              reference_id: payment.reference_id,
              merchant_reference_id: payment.merchant_reference_id,
              status: payment.status || 'PENDING',
              transaction_id: payment.reference_id
            },
          },
        })
      } else {
        // Paiement échoué - ON NE VIDE PAS LE PANIER
        console.log('❌ Paiement échoué, le panier est conservé')
        
        order.status = 'payment_failed'
        order.payment_error_message = payment.message || 'Erreur inconnue'
        await order.save()

        await OrderTracking.create({
          order_id: order.id,
          status: 'payment_failed',
          description: `❌ Échec ${kyc.operator}: ${payment.message}`,
          tracked_at: DateTime.now(),
        })

        return response.status(400).json({
          success: false,
          message: 'Paiement échoué',
          error: payment.message,
          operator: {
            name: kyc.operator,
            code: kyc.operatorCode,
            accountCode: kyc.accountCode
          }
        })
      }
    } catch (error: any) {
      console.error('🔴 Erreur paiement:', error.message)
      
      if (error.response) {
        console.error('🔴 Status:', error.response.status)
        console.error('🔴 Data:', JSON.stringify(error.response.data))
      }
      
      return response.status(500).json({
        success: false,
        message: 'Erreur lors du paiement',
        error: error.message,
        details: error.response?.data || null
      })
    }
  }
}
