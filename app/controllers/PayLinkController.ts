// app/controllers/PayLinkController.ts

import type { HttpContext } from '@adonisjs/core/http'
import Order from '#models/Order'
import OrderItem from '#models/OrderItem'
import OrderTracking from '#models/order_tracking'
import Cart from '#models/Cart'
import CartItem from '#models/CartItem'
import User from '#models/user'
import Product from '#models/Product'
import { DateTime } from 'luxon'
import MypvitSecretService from '../services/mypvit_secret_service.js'
import axios from 'axios'

const CALLBACK_URL_CODE = '9ZOXW'
const MYPVIT_CODE_URL = 'MTX1MTKQQCULKA3W'

const LINK_TYPES: Record<string, string> = {
  'web': 'WEB',
  'visa': 'VISA_MASTERCARD',
  'rest': 'RESTLINK'
}

function generateOrderNumber(): string {
  const value = `CMD-${Date.now()}-${Math.floor(Math.random() * 1000)}`
  console.log('[ORDER_NUMBER]', value)
  return value
}

export default class PayLinkController {

  private detectOperatorGabon(phoneNumber?: string): { name: string; code: string; accountCode: string } {
    console.log('[OPERATOR] ========== DETECTION OPERATEUR ==========')
    console.log('[OPERATOR] phoneNumber:', phoneNumber)
    
    if (!phoneNumber) {
      console.log('[OPERATOR] Pas de numéro, fallback GIMAC')
      return { name: 'GIMAC', code: 'GIMAC_PAY', accountCode: 'ACC_69FE0E1BC34B4' }
    }

    const clean = phoneNumber.replace(/[\s\+\.\-]/g, '')
    console.log('[OPERATOR] Clean:', clean)
    
    let local = clean
    if (clean.startsWith('241')) local = clean.substring(3)
    if (clean.startsWith('+241')) local = clean.substring(4)
    if (local.startsWith('0')) local = local.substring(1)

    console.log('[OPERATOR] Local final:', local)

    if (local.startsWith('06') || local.startsWith('6')) {
      console.log('[OPERATOR] ✅ Opérateur: MOOV_MONEY')
      return { name: 'MOOV_MONEY', code: 'MOOV_MONEY', accountCode: 'ACC_69EFB143D4F54' }
    }
    
    if (local.startsWith('07') || local.startsWith('7')) {
      console.log('[OPERATOR] ✅ Opérateur: AIRTEL_MONEY')
      return { name: 'AIRTEL_MONEY', code: 'AIRTEL_MONEY', accountCode: 'ACC_69EFB0E02FCA3' }
    }
    
    console.log('[OPERATOR] ⚠️ Fallback GIMAC')
    return { name: 'GIMAC', code: 'GIMAC_PAY', accountCode: 'ACC_69FE0E1BC34B4' }
  }

  private async renewSecretIfNeeded(phoneNumber?: string): Promise<void> {
    console.log('[SECRET] ========== RENOUVELLEMENT SECRET ==========')
    console.log('[SECRET] phoneNumber:', phoneNumber)
    
    try {
      console.log('[SECRET] Appel MypvitSecretService.renewSecret()...')
      await MypvitSecretService.renewSecret(phoneNumber)
      console.log('[SECRET] ✅ Clé renouvelée avec succès')
    } catch (error: any) {
      console.error('[SECRET] ❌ Erreur renouvellement:', error.message)
    }
    console.log('[SECRET] ========== FIN RENOUVELLEMENT ==========')
  }

  private async checkStock(userId: string): Promise<{ 
    ok: boolean
    errors: string[]
    cart: Cart | null
  }> {
    console.log('[STOCK] ========== VERIFICATION STOCK ==========')
    console.log('[STOCK] userId:', userId)
    
    const errors: string[] = []
    
    console.log('[STOCK] Recherche du panier...')
    const cart = await Cart.query()
      .where('user_id', userId)
      .preload('items')
      .first()

    if (!cart || !cart.items || cart.items.length === 0) {
      console.log('[STOCK] ❌ Panier vide')
      return { ok: false, errors: ['Panier vide'], cart: null }
    }

    console.log('[STOCK] Panier trouvé, articles:', cart.items.length)

    for (const item of cart.items) {
      console.log(`[STOCK] Vérification produit ${item.product_id}, quantité: ${item.quantity}`)
      const p = await Product.findBy('id', item.product_id)
      
      if (!p) { 
        console.log(`[STOCK] ❌ Produit ${item.product_id} introuvable`)
        errors.push(`Produit ${item.product_id} introuvable`)
        continue 
      }
      
      console.log(`[STOCK] Produit: ${p.name}, stock: ${p.stock}, archivé: ${p.isArchived}`)
      
      if (p.isArchived) { 
        console.log(`[STOCK] ❌ ${p.name} archivé`)
        errors.push(`${p.name} - Archivé`)
        continue 
      }
      if (p.stock <= 0) { 
        console.log(`[STOCK] ❌ ${p.name} rupture stock`)
        errors.push(`${p.name} - Rupture de stock`)
        continue 
      }
      if (p.stock < item.quantity) { 
        console.log(`[STOCK] ❌ ${p.name} stock ${p.stock} < ${item.quantity}`)
        errors.push(`${p.name}: stock ${p.stock} < ${item.quantity}`)
        continue 
      }
      
      console.log(`[STOCK] ✅ ${p.name} OK`)
    }

    console.log('[STOCK] Résultat:', errors.length === 0 ? '✅ OK' : '❌ ERREURS')
    console.log('[STOCK] ========== FIN VERIFICATION ==========')
    
    return { ok: errors.length === 0, errors, cart }
  }

  private async buildItemsFromCart(order: Order, cart: Cart): Promise<{ subtotal: number; count: number }> {
    console.log('[ITEMS] ========== CREATION ITEMS ==========')
    console.log('[ITEMS] order_id:', order.id)
    console.log('[ITEMS] Nombre articles:', cart.items.length)
    
    let subtotal = 0
    let count = 0

    for (const item of cart.items) {
      const p = await Product.findBy('id', item.product_id)
      if (!p) continue

      const itemTotal = p.price * item.quantity
      subtotal += itemTotal
      
      console.log(`[ITEMS] ${p.name}: ${p.price} × ${item.quantity} = ${itemTotal}`)

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

    console.log('[ITEMS] Subtotal:', subtotal, 'Count:', count)
    console.log('[ITEMS] ========== FIN CREATION ==========')
    
    return { subtotal, count }
  }

  async pay({ request, response }: HttpContext) {
    console.log('\n')
    console.log('🔗 ========================================')
    console.log('🔗 ========== PAIEMENT PAR LIEN ==========')
    console.log('🔗 ========================================')
    console.log('[TIMESTAMP]', new Date().toISOString())

    try {
      const payload = request.only([
        'userId', 'customerAccountNumber', 'shippingAddress',
        'deliveryMethod', 'deliveryPrice', 'customerName',
        'customerEmail', 'customerPhone', 'linkType', 'notes'
      ])

      console.log('[PAYLOAD] Données reçues:', JSON.stringify(payload, null, 2))

      const userId = payload.userId
      const phoneNumber = payload.customerAccountNumber || payload.customerPhone

      console.log('[STEP 1] Validation données:')
      console.log('  - userId:', userId)
      console.log('  - phoneNumber:', phoneNumber)
      console.log('  - deliveryMethod:', payload.deliveryMethod)
      console.log('  - deliveryPrice:', payload.deliveryPrice)

      if (!userId) {
        console.log('[ERROR] ❌ userId requis manquant')
        return response.status(400).json({
          success: false,
          message: 'userId requis'
        })
      }

      if (!phoneNumber) {
        console.log('[ERROR] ❌ Numéro téléphone requis')
        return response.status(400).json({
          success: false,
          message: 'Numéro de téléphone requis'
        })
      }

      // 1. RÉCUPÉRER LE PANIER DE L'UTILISATEUR
      console.log('[STEP 2] Vérification stock...')
      const { ok, errors, cart } = await this.checkStock(userId)
      
      if (!ok) {
        console.log('[ERROR] ❌ Stock insuffisant:', errors)
        return response.status(400).json({
          success: false,
          message: 'Stock insuffisant ou panier vide',
          errors
        })
      }

      if (!cart) {
        console.log('[ERROR] ❌ Panier introuvable')
        return response.status(400).json({
          success: false,
          message: 'Panier introuvable'
        })
      }

      console.log(`[STEP 2] ✅ Panier trouvé avec ${cart.items.length} articles`)

      // 2. Détecter l'opérateur
      console.log('[STEP 3] Détection opérateur...')
      const operatorInfo = this.detectOperatorGabon(phoneNumber)
      const linkType = payload.linkType || 'web'
      const linkTypeCode = LINK_TYPES[linkType] || 'WEB'

      console.log(`[STEP 3] ✅ Opérateur: ${operatorInfo.name}`)
      console.log(`[STEP 3] ✅ Type lien: ${linkTypeCode}`)

      // 3. Renouveler le secret
      console.log('[STEP 4] Renouvellement secret...')
      await this.renewSecretIfNeeded(phoneNumber)

      // 4. Récupérer l'utilisateur
      console.log('[STEP 5] Récupération utilisateur...')
      const user = await User.findBy('id', userId)
      console.log('[USER] Trouvé:', !!user)
      if (user) {
        console.log('[USER] Nom:', user.full_name)
        console.log('[USER] Email:', user.email)
      }

      // 5. Calculer le total depuis le panier
      console.log('[STEP 6] Calcul du total...')
      let subtotal = 0
      for (const item of cart.items) {
        const product = await Product.findBy('id', item.product_id)
        if (product) {
          const itemTotal = product.price * item.quantity
          console.log(`  - ${product.name}: ${product.price} × ${item.quantity} = ${itemTotal}`)
          subtotal += itemTotal
        }
      }

      const deliveryPrice = Number(payload.deliveryPrice || 0)
      const total = subtotal + deliveryPrice
      const orderNumber = generateOrderNumber()

      console.log('[CALCUL] Résultat:')
      console.log('  - Subtotal:', subtotal)
      console.log('  - Livraison:', deliveryPrice)
      console.log('  - TOTAL:', total)

      // 6. Création commande - AVEC delivery_method
      console.log('[STEP 7] Création de la commande...')
      
      const deliveryMethod = payload.deliveryMethod || 'standard'
      console.log('[ORDER] delivery_method utilisé:', deliveryMethod)
      console.log('[ORDER] shippingAddress:', payload.shippingAddress || 'Non fourni')
      
      const order = await Order.create({
        user_id: userId,
        order_number: orderNumber,
        status: 'pending',
        total: total,
        subtotal: subtotal,
        shipping_cost: deliveryPrice,
        delivery_method: deliveryMethod, // ✅ AJOUT OBLIGATOIRE
        delivery_address: payload.shippingAddress || null, // Ajout pour sécurité
        customer_name: user?.full_name || payload.customerName || 'Client',
        customer_phone: phoneNumber,
        payment_method: `link_${linkType}_${operatorInfo.name.toLowerCase()}`,
        customer_email: user?.email || payload.customerEmail || 'invite@email.com',
        notes: payload.notes || null,
        payment_operator_simple: operatorInfo.name
      })

      console.log('[ORDER] ✅ Commande créée:')
      console.log('  - ID:', order.id)
      console.log('  - Order number:', order.order_number)
      console.log('  - Delivery method:', order.delivery_method)
      console.log('  - Total:', order.total)

      // 7. Créer les OrderItems à partir du panier
      console.log('[STEP 8] Création des items...')
      const { count } = await this.buildItemsFromCart(order, cart)

      // 8. Vider le panier après création de la commande
      console.log('[STEP 9] Vidage du panier...')
      const deleted = await CartItem.query().where('cart_id', cart.id).delete()
      console.log('[CART] Items supprimés:', deleted)

      // 9. Tracking initial
      console.log('[STEP 10] Création tracking...')
      await OrderTracking.create({
        order_id: order.id,
        status: 'pending',
        description: `🔗 Lien ${linkTypeCode} - ${operatorInfo.name} - ${count} articles`,
        tracked_at: DateTime.now(),
      })
      console.log('[TRACKING] ✅ Tracking créé')

      // 10. Générer le lien de paiement
      console.log('[STEP 11] Génération du lien de paiement...')
      console.log(`[LINK] Type: ${linkTypeCode}`)

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
        console.log('[LINK] Ajout phoneNumber pour VISA/RESTLINK')
      } else if (linkTypeCode === 'WEB' && phoneNumber) {
        linkPayload.customer_account_number = phoneNumber
        console.log('[LINK] Ajout phoneNumber pour WEB')
      }

      console.log('[LINK] Payload envoyé:', JSON.stringify(linkPayload, null, 2))

      const secret = await MypvitSecretService.getSecret(phoneNumber)
      console.log('[LINK] Secret récupéré:', secret ? '✅ OUI' : '❌ NON')
      
      console.log('[API] Appel à Mypvit...')
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
      console.log('[API] ✅ Réponse reçue:', JSON.stringify(linkResult, null, 2))

      // 11. Mettre à jour la commande avec la référence de paiement
      console.log('[STEP 12] Mise à jour commande...')
      if (linkResult.merchant_reference_id) {
        order.payment_reference_id = linkResult.merchant_reference_id
        order.payment_operator_simple = operatorInfo.name
        order.payment_amount = total
        order.payment_initiated_at = DateTime.now()
        order.status = 'pending_payment'
        await order.save()
        console.log('[ORDER] Référence paiement:', linkResult.merchant_reference_id)
      }

      await OrderTracking.create({
        order_id: order.id,
        status: 'pending_payment',
        description: `⏳ Lien ${linkTypeCode} - ${operatorInfo.name} - Réf: ${linkResult.merchant_reference_id || order.order_number}`,
        tracked_at: DateTime.now(),
      })

      await order.load('items')

      console.log('✅ ========== PAIEMENT LIEN SUCCÈS ========== ✅\n')

      return response.status(201).json({
        success: true,
        message: `✅ Lien de paiement ${linkTypeCode} généré !`,
        data: {
          orderId: order.id,
          orderNumber: order.order_number,
          total: order.total,
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
      console.log('\n')
      console.log('💥 ========== ERREUR PAIEMENT LIEN ========== 💥')
      console.error('[ERROR] Message:', error.message)
      console.error('[ERROR] Response:', error.response?.data)
      console.error('[ERROR] Status:', error.response?.status)
      console.log('💥 ========================================== 💥\n')
      
      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la génération du lien de paiement',
        error: error.response?.data?.message || error.message
      })
    }
  }
}
