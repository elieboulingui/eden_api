// app/controllers/PayLinkController.ts
import type { HttpContext } from '@adonisjs/core/http'
import Order from '#models/Order'
import OrderItem from '#models/OrderItem'
import OrderTracking from '#models/order_tracking'
import Cart from '#models/Cart'
import CartItem from '#models/CartItem'
import User from '#models/user'
import Product from '#models/Product'
import Wallet from '#models/wallet'
import { DateTime } from 'luxon'
import MypvitSecretService from '../services/mypvit_secret_service.js'
import axios from 'axios'
import crypto from 'node:crypto'
import hash from '@adonisjs/core/services/hash'

const CALLBACK_URL_CODE = '9ZOXW'
const MYPVIT_CODE_URL = 'MTX1MTKQQCULKA3W'
const ADMIN_COMMISSION_RATE = 0.03 // 3% pour l'admin

const LINK_TYPES: Record<string, string> = {
  'web': 'WEB',
  'visa': 'VISA_MASTERCARD',
  'rest': 'RESTLINK'
}

function generateOrderNumber(): string {
  return `CMD-${Date.now()}-${Math.floor(Math.random() * 1000)}`
}

export default class PayLinkController {

  private detectOperatorGabon(phoneNumber?: string): { name: string; code: string; accountCode: string } {
    if (!phoneNumber) {
      return { name: 'GIMAC', code: 'GIMAC_PAY', accountCode: 'ACC_69FE0E1BC34B4' }
    }

    const clean = phoneNumber.replace(/[\s\+\.\-]/g, '')
    let local = clean
    if (clean.startsWith('241')) local = clean.substring(3)
    if (local.startsWith('0')) local = local.substring(1)

    if (local.startsWith('06') || local.startsWith('6')) {
      return { name: 'MOOV_MONEY', code: 'MOOV_MONEY', accountCode: 'ACC_69EFB143D4F54' }
    }
    
    if (local.startsWith('07') || local.startsWith('7')) {
      return { name: 'AIRTEL_MONEY', code: 'AIRTEL_MONEY', accountCode: 'ACC_69EFB0E02FCA3' }
    }
    
    return { name: 'GIMAC', code: 'GIMAC_PAY', accountCode: 'ACC_69FE0E1BC34B4' }
  }

  private async renewSecretIfNeeded(phoneNumber?: string): Promise<void> {
    try {
      console.log('🔄 Tentative de renouvellement du secret...')
      await MypvitSecretService.renewSecret(phoneNumber)
      console.log('✅ Clé renouvelée avec succès')
    } catch (error: any) {
      console.error('⚠️ Erreur renouvellement secret:', error.message)
    }
  }

  private async checkStock(userId: string): Promise<{ 
    ok: boolean
    errors: string[]
    cart: Cart | null
  }> {
    const errors: string[] = []
    
    console.log('🛒 Récupération du panier pour userId:', userId)
    
    const cart = await Cart.query()
      .where('user_id', userId)
      .preload('items')
      .first()

    if (!cart || !cart.items || cart.items.length === 0) {
      return { ok: false, errors: ['Panier vide'], cart: null }
    }

    for (const item of cart.items) {
      const p = await Product.findBy('id', item.product_id)
      if (!p) { 
        errors.push(`Produit ${item.product_id} introuvable`)
        continue 
      }
      if (p.isArchived) { 
        errors.push(`${p.name} - Archivé`)
        continue 
      }
      if (p.stock <= 0) { 
        errors.push(`${p.name} - Rupture de stock`)
        continue 
      }
      if (p.stock < item.quantity) { 
        errors.push(`${p.name}: stock ${p.stock} < ${item.quantity}`)
        continue 
      }
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

  // Crédite le wallet d'un utilisateur
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

  async pay({ request, response }: HttpContext) {
    console.log('🔗 ========== PAIEMENT PAR LIEN ==========')

    try {
      const payload = request.only([
        'userId', 'customerAccountNumber', 'shippingAddress',
        'deliveryMethod', 'deliveryPrice', 'customerName',
        'customerEmail', 'customerPhone', 'linkType', 'notes'
      ])

      console.log('📦 Données reçues:', payload)

      const userId = payload.userId
      const phoneNumber = payload.customerAccountNumber || payload.customerPhone

      if (!userId) {
        return response.status(400).json({
          success: false,
          message: 'userId requis'
        })
      }

      if (!phoneNumber) {
        return response.status(400).json({
          success: false,
          message: 'Numéro de téléphone requis'
        })
      }

      // 1. RÉCUPÉRER LE PANIER DE L'UTILISATEUR
      const { ok, errors, cart } = await this.checkStock(userId)
      
      if (!ok) {
        return response.status(400).json({
          success: false,
          message: 'Stock insuffisant ou panier vide',
          errors
        })
      }

      if (!cart) {
        return response.status(400).json({
          success: false,
          message: 'Panier introuvable'
        })
      }

      console.log(`🛒 Panier trouvé avec ${cart.items.length} articles`)

      // 2. Détecter l'opérateur
      const operatorInfo = this.detectOperatorGabon(phoneNumber)
      const linkType = payload.linkType || 'web'
      const linkTypeCode = LINK_TYPES[linkType] || 'WEB'

      console.log(`📱 Opérateur: ${operatorInfo.name} | Compte: ${operatorInfo.accountCode}`)
      console.log(`🔗 Type de lien: ${linkTypeCode}`)

      // 3. Renouveler le secret
      await this.renewSecretIfNeeded(phoneNumber)

      // 4. Récupérer l'utilisateur (pour son nom/email)
      const user = await User.findBy('id', userId)

      // 5. Calculer le total depuis le panier
      let subtotal = 0
      for (const item of cart.items) {
        const product = await Product.findBy('id', item.product_id)
        if (product) {
          subtotal += product.price * item.quantity
        }
      }

      const deliveryPrice = payload.deliveryPrice || 0
      const total = subtotal + deliveryPrice
      const orderNumber = generateOrderNumber()

      console.log('💰 Subtotal:', subtotal, '| Livraison:', deliveryPrice, '| Total:', total)

      // 6. Création commande
      const order = await Order.create({
        user_id: userId,
        order_number: orderNumber,
        status: 'pending',
        total: total,
        subtotal: subtotal,
        shipping_cost: deliveryPrice,
        delivery_method: payload.deliveryMethod || 'standard',
        customer_name: user?.full_name || payload.customerName || 'Client',
        customer_phone: phoneNumber,
        payment_method: `link_${linkType}_${operatorInfo.name.toLowerCase()}`,
        customer_email: user?.email || payload.customerEmail || 'invite@email.com',
        shipping_address: payload.shippingAddress || 'non renseigné',
        notes: payload.notes || null,
        payment_operator_simple: operatorInfo.name
      })

      // 7. Créer les OrderItems et récupérer les infos par marchand
      const { count, merchantIds, merchantProducts } = await this.buildItemsFromCart(order, cart)

      console.log('🏪 Marchands dans la commande:', merchantIds)

      // ============================================================
      // 8. DISTRIBUTION DE L'ARGENT
      // ============================================================
      
      // 8a. Commission admin (3% du total)
      const adminCommission = total * ADMIN_COMMISSION_RATE
      console.log(`\n💼 ===== DISTRIBUTION FINANCIÈRE =====`)
      console.log(`📊 Total commande: ${total} XAF`)
      console.log(`🏛️ Commission admin (3%): ${adminCommission} XAF`)
      
      // Créditer l'admin
      const adminUser = await User.query()
        .where('role', 'superadmin')
        .orWhere('role', 'admin')
        .first()
      
      if (adminUser) {
        await this.creditWallet(adminUser.id, adminCommission, `Commission 3% - Commande #${orderNumber}`)
      }

      // 8b. Distribuer le prix des produits aux marchands
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
        
        await this.creditWallet(merchant.id, merchantAmount, `Vente produits - Commande #${orderNumber}`)
      }

      // 8c. Distribuer les frais de livraison
      if (deliveryPrice > 0) {
        console.log(`\n🚚 FRAIS DE LIVRAISON: ${deliveryPrice} XAF`)
        
        let needEdenLivreur = false
        
        for (const merchantId of merchantIds) {
          const merchant = await User.findBy('id', merchantId)
          
          if (merchant) {
            console.log(`  👤 ${merchant.full_name} | has_livreur: ${merchant.has_livreur}`)
            
            if (merchant.has_livreur) {
              // ✅ Le marchand a son propre livreur → lui envoyer les frais
              const deliveryShare = deliveryPrice / merchantIds.length
              console.log(`  ✅ Livreur personnel → +${deliveryShare} XAF`)
              await this.creditWallet(merchant.id, deliveryShare, `Frais livraison (livreur personnel) - Commande #${orderNumber}`)
            } else {
              // ❌ Pas de livreur → il faut un livreur Eden
              needEdenLivreur = true
            }
          }
        }
        
        // Si au moins un marchand n'a pas de livreur → chercher/créer un edenlivreur
        if (needEdenLivreur) {
          console.log(`  🔍 Recherche d'un edenlivreur...`)
          
          let edenLivreur = await User.query()
            .where('role', 'edenlivreur')
            .where('is_verified', true)
            .first()
          
          // Si aucun edenlivreur trouvé → en créer un
          if (!edenLivreur) {
            console.log(`  ⚠️ Aucun edenlivreur trouvé → Création automatique...`)
            edenLivreur = await this.createEdenLivreur()
          } else {
            console.log(`  🛵 EdenLivreur trouvé: ${edenLivreur.full_name} (${edenLivreur.id})`)
          }
          
          // Envoyer les frais de livraison au edenlivreur
          await this.creditWallet(edenLivreur.id, deliveryPrice, `Frais livraison - Commande #${orderNumber}`)
          
          // Mettre à jour la commande avec l'ID du livreur
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

      // 9. Vider le panier
      await CartItem.query().where('cart_id', cart.id).delete()
      console.log('🛒 Panier vidé')

      // 10. Tracking initial
      await OrderTracking.create({
        order_id: order.id,
        status: 'pending',
        description: `🔗 Lien ${linkTypeCode} - ${operatorInfo.name} - ${count} articles`,
        tracked_at: DateTime.now(),
      })

      // 11. Générer le lien de paiement
      console.log(`\n🔑 Génération lien ${linkTypeCode}...`)

      const linkPayload: any = {
        amount: total,
        product: orderNumber.substring(0, 15),
        reference: `REF${Date.now()}`.substring(0, 15),
        service: linkTypeCode,
        callback_url_code: CALLBACK_URL_CODE,
        merchant_operation_account_code: operatorInfo.accountCode,
        transaction_type: 'PAYMENT',
        owner_charge: 'MERCHANT',
        success_redirection_url_code: 'W0L8C',
        failed_redirection_url_code: 'YTJEI',
      }

      if (linkTypeCode === 'VISA_MASTERCARD' || linkTypeCode === 'RESTLINK') {
        linkPayload.customer_account_number = phoneNumber
      } else if (linkTypeCode === 'WEB' && phoneNumber) {
        linkPayload.customer_account_number = phoneNumber
      }

      console.log('📤 Payload Mypvit:', JSON.stringify(linkPayload, null, 2))

      const secret = await MypvitSecretService.getSecret(phoneNumber)
      
      const linkResponse = await axios.post(
        `https://api.mypvit.pro/${MYPVIT_CODE_URL}/link`,
        linkPayload,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Secret': secret,
            'X-Callback-MediaType': 'application/json',
          },
          timeout: 30000
        }
      )

      const linkResult = linkResponse.data

      console.log('✅ Lien généré:', {
        status: linkResult.status,
        reference_id: linkResult.merchant_reference_id,
        url: linkResult.url
      })

      // 12. Mettre à jour la commande
      if (linkResult.merchant_reference_id) {
        order.payment_reference_id = linkResult.merchant_reference_id
        order.payment_operator_simple = operatorInfo.name
        order.payment_amount = total
        order.payment_initiated_at = DateTime.now()
        order.status = 'pending_payment'
        await order.save()
      }

      await OrderTracking.create({
        order_id: order.id,
        status: 'pending_payment',
        description: `⏳ Lien ${linkTypeCode} - ${operatorInfo.name} - Réf: ${linkResult.merchant_reference_id || order.order_number}`,
        tracked_at: DateTime.now(),
      })

      await order.load('items')

      return response.status(201).json({
        success: true,
        message: `✅ Lien de paiement ${linkTypeCode} généré !`,
        data: {
          orderId: order.id,
          orderNumber: order.order_number,
          total: order.total,
          subtotal: order.subtotal,
          shippingCost: order.shipping_cost,
          adminCommission: adminCommission,
          status: 'pending_payment',
          customerName: order.customer_name,
          paymentMethod: `link_${linkType}_${operatorInfo.name.toLowerCase()}`,
          itemsCount: count,
          userId,
          operator: {
            name: operatorInfo.name,
            code: operatorInfo.code,
            accountCode: operatorInfo.accountCode
          },
          link: {
            payment_url: linkResult.url,
            reference_id: linkResult.merchant_reference_id || order.order_number,
            type: linkTypeCode,
            amount: total,
          },
        },
      })

    } catch (error: any) {
      console.error('🔴 Erreur Lien:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      })
      
      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la génération du lien de paiement',
        error: error.response?.data?.message || error.message
      })
    }
  }
}
