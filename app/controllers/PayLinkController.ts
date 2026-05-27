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
import MypvitSecretService from '../services/mypvit_secret_services.js'
import MypvitLinkService from '../services/mypvit_link_service.js'
import db from '@adonisjs/lucid/services/db'

const CALLBACK_URL_CODE = '9ZOXW'

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
    console.log('[DETECT_OPERATOR] phoneNumber:', phoneNumber)
    
    if (!phoneNumber) {
      return { name: 'GIMAC', code: 'GIMAC_PAY', accountCode: 'ACC_69FE0E1BC34B4' }
    }

    const clean = phoneNumber.replace(/[\s\+\.\-]/g, '')
    let local = clean
    if (clean.startsWith('241')) local = clean.substring(3)
    if (clean.startsWith('+241')) local = clean.substring(4)
    if (local.startsWith('0')) local = local.substring(1)

    console.log('[DETECT_OPERATOR] Utilisation de GIMAC (compte unique)')
    return { name: 'GIMAC', code: 'GIMAC_PAY', accountCode: 'ACC_69FE0E1BC34B4' }
  }

  private async renewSecretIfNeeded(): Promise<void> {
    try {
      console.log('[RENEW_SECRET] Tentative de renouvellement du secret...')
      await MypvitSecretService.renewSecret()
      console.log('[RENEW_SECRET] ✅ Clé renouvelée avec succès')
    } catch (error: any) {
      console.error('[RENEW_SECRET] ⚠️ Erreur:', error.message)
    }
  }

  /**
   * Vérification améliorée du stock avec logs détaillés
   */
  private async checkStock(userId: string): Promise<{ 
    ok: boolean
    errors: string[]
    cart: Cart | null
  }> {
    const errors: string[] = []
    
    console.log('\n[STOCK] ==================================================')
    console.log('[STOCK] ========== DÉBUT VÉRIFICATION STOCK ==========')
    console.log('[STOCK] ==================================================')
    console.log('[STOCK] Récupération du panier pour userId:', userId)
    
    // 1. Vérifier si l'utilisateur existe
    const userExists = await User.findBy('id', userId)
    if (!userExists) {
      console.log('[STOCK] ❌ Utilisateur introuvable:', userId)
      return { ok: false, errors: ['Utilisateur introuvable'], cart: null }
    }
    
    console.log('[STOCK] ✅ Utilisateur trouvé:', {
      id: userExists.id,
      name: userExists.full_name,
      email: userExists.email
    })

    // 2. Récupérer TOUS les paniers de l'utilisateur
    const allCarts = await Cart.query()
      .where('user_id', userId)
      .orderBy('updated_at', 'desc')
      .preload('items', (query) => {
        query.orderBy('created_at', 'desc')
      })
    
    console.log(`[STOCK] Nombre de paniers trouvés: ${allCarts.length}`)
    
    // 3. Logger chaque panier trouvé
    for (const c of allCarts) {
      console.log(`[STOCK] Panier ID: ${c.id}`, {
        created_at: c.createdAt?.toISO(),
        updated_at: c.updatedAt?.toISO(),
        items_count: c.items?.length || 0
      })
      
      // Logger chaque item du panier
      if (c.items && c.items.length > 0) {
        for (const item of c.items) {
          console.log(`[STOCK]   Item: ${item.id}`, {
            product_id: item.product_id,
            quantity: item.quantity,
            created_at: item.createdAt?.toISO()
          })
        }
      }
    }
    
    // 4. Chercher le panier avec des items
    let cart: Cart | null = null
    
    if (allCarts.length === 0) {
      console.log('[STOCK] ❌ Aucun panier trouvé pour cet utilisateur')
      
      // Option: Créer un nouveau panier automatiquement
      console.log('[STOCK] Création d\'un nouveau panier vide...')
      try {
        cart = await Cart.create({
          user_id: userId,
        })
        console.log('[STOCK] ✅ Nouveau panier créé:', cart.id)
      } catch (createError) {
        console.error('[STOCK] ❌ Erreur création panier:', createError)
      }
      
      return { ok: false, errors: ['Aucun panier trouvé'], cart: null }
    }
    
    // 5. Prendre le premier panier qui a des items
    for (const c of allCarts) {
      if (c.items && c.items.length > 0) {
        cart = c
        console.log(`[STOCK] ✅ Panier avec items sélectionné: ${cart.id} (${cart.items.length} items)`)
        break
      }
    }
    
    // 6. Si aucun panier n'a d'items
    if (!cart) {
      console.log('[STOCK] ⚠️ Des paniers existent mais tous sont vides')
      
      // Prendre le panier le plus récent
      cart = allCarts[0]
      console.log(`[STOCK] Utilisation du panier le plus récent: ${cart.id}`)
      
      return { ok: false, errors: ['Panier vide - Aucun article dans le panier'], cart: null }
    }

    // 7. Vérification détaillée du stock pour chaque item
    console.log(`\n[STOCK] Vérification du stock pour ${cart.items.length} articles:`)
    console.log('[STOCK] ------------------------------------')
    
    for (const item of cart.items) {
      console.log(`[STOCK] Vérification item ${item.id}:`)
      console.log(`[STOCK]   Product ID: ${item.product_id}`)
      console.log(`[STOCK]   Quantity: ${item.quantity}`)
      
      // Récupérer le produit
      const product = await Product.find(item.product_id)
      
      if (!product) {
        const errorMsg = `Produit ${item.product_id} introuvable dans la base de données`
        console.log(`[STOCK]   ❌ ${errorMsg}`)
        errors.push(errorMsg)
        continue
      }
      
      console.log(`[STOCK]   Produit: ${product.name}`)
      console.log(`[STOCK]   Prix: ${product.price} XAF`)
      console.log(`[STOCK]   Stock disponible: ${product.stock}`)
      console.log(`[STOCK]   Archivé: ${product.isArchived}`)
      
      if (product.isArchived) {
        const errorMsg = `${product.name} - Ce produit est archivé et n'est plus disponible`
        console.log(`[STOCK]   ❌ ${errorMsg}`)
        errors.push(errorMsg)
        continue
      }
      
      if (product.stock <= 0) {
        const errorMsg = `${product.name} - Rupture de stock (stock: 0)`
        console.log(`[STOCK]   ❌ ${errorMsg}`)
        errors.push(errorMsg)
        continue
      }
      
      if (product.stock < item.quantity) {
        const errorMsg = `${product.name}: stock insuffisant - Demandé: ${item.quantity}, Disponible: ${product.stock}`
        console.log(`[STOCK]   ❌ ${errorMsg}`)
        errors.push(errorMsg)
        continue
      }
      
      console.log(`[STOCK]   ✅ OK - ${product.name}: stock ${product.stock} >= ${item.quantity} demandé`)
    }
    
    console.log('[STOCK] ------------------------------------')
    console.log(`[STOCK] Résultat final: ${errors.length === 0 ? '✅ VALIDE' : '❌ INVALIDE'}`)
    console.log(`[STOCK] Erreurs: ${errors.length > 0 ? errors.join(' | ') : 'Aucune'}`)
    console.log('[STOCK] ==================================================\n')

    return { 
      ok: errors.length === 0, 
      errors, 
      cart: errors.length === 0 ? cart : null 
    }
  }

  /**
   * Construction des OrderItems à partir du panier
   */
  private async buildItemsFromCart(order: Order, cart: Cart): Promise<{ subtotal: number; count: number }> {
    let subtotal = 0
    let count = 0

    console.log(`\n[BUILD_ITEMS] Construction des items pour la commande ${order.id}`)
    console.log(`[BUILD_ITEMS] Nombre d'items dans le panier: ${cart.items.length}`)

    for (const item of cart.items) {
      const product = await Product.findBy('id', item.product_id)
      if (!product) {
        console.log(`[BUILD_ITEMS] ⚠️ Produit ${item.product_id} non trouvé, ignoré`)
        continue
      }

      const itemTotal = product.price * item.quantity
      subtotal += itemTotal

      console.log(`[BUILD_ITEMS] Création OrderItem:`, {
        product: product.name,
        price: product.price,
        quantity: item.quantity,
        subtotal: itemTotal
      })

      await OrderItem.create({
        order_id: order.id,
        product_id: product.id,
        product_name: product.name,
        price: product.price,
        quantity: item.quantity,
        subtotal: itemTotal
      })

      count++
    }

    console.log(`[BUILD_ITEMS] Total items créés: ${count}, Sous-total: ${subtotal} XAF\n`)
    return { subtotal, count }
  }

  /**
   * Endpoint de débogage pour vérifier l'état du panier
   */
  async debugCart({ params, response }: HttpContext) {
    try {
      const userId = params.userId
      
      console.log('\n[DEBUG_CART] ==================================================')
      console.log('[DEBUG_CART] Vérification panier pour userId:', userId)
      
      // Vérifier l'utilisateur
      const user = await User.find(userId)
      if (!user) {
        return response.status(404).json({
          success: false,
          message: 'Utilisateur non trouvé'
        })
      }
      
      // Récupérer tous les paniers
      const allCarts = await Cart.query()
        .where('user_id', userId)
        .orderBy('updated_at', 'desc')
        .preload('items')
      
      // Récupérer les items avec les produits
      const cartsWithProducts = []
      
      for (const cart of allCarts) {
        const itemsWithProducts = []
        
        for (const item of cart.items) {
          const product = await Product.find(item.product_id)
          itemsWithProducts.push({
            id: item.id,
            product_id: item.product_id,
            quantity: item.quantity,
            product: product ? {
              id: product.id,
              name: product.name,
              price: product.price,
              stock: product.stock,
              is_archived: product.isArchived
            } : null,
            created_at: item.createdAt,
            updated_at: item.updatedAt
          })
        }
        
        cartsWithProducts.push({
          id: cart.id,
          user_id: cart.user_id,
          items_count: cart.items.length,
          items: itemsWithProducts,
          created_at: cart.createdAt,
          updated_at: cart.updatedAt
        })
      }
      
      // Faire une requête SQL directe pour vérifier
      const rawCartItems = await db.rawQuery(
        'SELECT ci.*, p.name as product_name, p.stock, p.price, p.is_archived FROM cart_items ci LEFT JOIN products p ON ci.product_id = p.id WHERE ci.cart_id IN (SELECT id FROM carts WHERE user_id = ?)',
        [userId]
      )
      
      console.log('[DEBUG_CART] Résultat brut SQL:', rawCartItems.rows)
      console.log('[DEBUG_CART] ==================================================\n')
      
      return response.json({
        success: true,
        user: {
          id: user.id,
          name: user.full_name,
          email: user.email
        },
        carts: cartsWithProducts,
        raw_sql_items: rawCartItems.rows,
        total_carts: allCarts.length,
        has_items: allCarts.some(cart => cart.items && cart.items.length > 0)
      })
      
    } catch (error) {
      console.error('[DEBUG_CART] Erreur:', error)
      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la vérification du panier',
        error: error.message
      })
    }
  }

  /**
   * Endpoint pour créer un panier de test
   */
  async createTestCart({ request, response }: HttpContext) {
    try {
      const { userId, productId, quantity = 1 } = request.only(['userId', 'productId', 'quantity'])
      
      console.log('\n[CREATE_TEST_CART] ==================================================')
      console.log('[CREATE_TEST_CART] Création panier test')
      console.log('[CREATE_TEST_CART] userId:', userId)
      console.log('[CREATE_TEST_CART] productId:', productId)
      console.log('[CREATE_TEST_CART] quantity:', quantity)
      
      if (!userId || !productId) {
        return response.status(400).json({
          success: false,
          message: 'userId et productId requis'
        })
      }
      
      // Vérifier que le produit existe
      const product = await Product.find(productId)
      if (!product) {
        return response.status(404).json({
          success: false,
          message: 'Produit non trouvé'
        })
      }
      
      // Chercher ou créer un panier
      let cart = await Cart.query()
        .where('user_id', userId)
        .first()
      
      if (!cart) {
        cart = await Cart.create({ user_id: userId })
        console.log('[CREATE_TEST_CART] Nouveau panier créé:', cart.id)
      } else {
        console.log('[CREATE_TEST_CART] Panier existant:', cart.id)
      }
      
      // Vérifier si l'item existe déjà
      let cartItem = await CartItem.query()
        .where('cart_id', cart.id)
        .where('product_id', productId)
        .first()
      
      if (cartItem) {
        // Mettre à jour la quantité
        cartItem.quantity += quantity
        await cartItem.save()
        console.log('[CREATE_TEST_CART] Item mis à jour:', cartItem.id, 'nouvelle quantité:', cartItem.quantity)
      } else {
        // Créer un nouvel item
        cartItem = await CartItem.create({
          cart_id: cart.id,
          product_id: productId,
          quantity: quantity
        })
        console.log('[CREATE_TEST_CART] Nouvel item créé:', cartItem.id)
      }
      
      console.log('[CREATE_TEST_CART] ==================================================\n')
      
      return response.json({
        success: true,
        message: 'Panier test créé avec succès',
        data: {
          cart_id: cart.id,
          item: {
            id: cartItem.id,
            product_id: cartItem.product_id,
            product_name: product.name,
            quantity: cartItem.quantity,
            price: product.price
          }
        }
      })
      
    } catch (error) {
      console.error('[CREATE_TEST_CART] Erreur:', error)
      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la création du panier test',
        error: error.message
      })
    }
  }

  /**
   * Méthode principale de paiement par lien
   */
  async pay({ request, response }: HttpContext) {
    console.log('\n')
    console.log('🔗 =========================================================')
    console.log('🔗 ========== PAIEMENT PAR LIEN (GIMAC) ==========')
    console.log('🔗 =========================================================')
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
      const linkType = payload.linkType || 'web'
      const linkTypeCode = LINK_TYPES[linkType] || 'WEB'

      // Validation des données requises
      if (!userId) {
        console.log('[ERROR] ❌ userId requis')
        return response.status(400).json({
          success: false,
          message: 'userId requis'
        })
      }

      if (!phoneNumber) {
        console.log('[ERROR] ❌ Numéro de téléphone requis')
        return response.status(400).json({
          success: false,
          message: 'Numéro de téléphone requis'
        })
      }

      console.log('[INFO] userId:', userId)
      console.log('[INFO] phoneNumber:', phoneNumber)
      console.log('[INFO] linkType:', linkType, '→ code:', linkTypeCode)

      // 1. Vérification améliorée du stock
      const { ok, errors, cart } = await this.checkStock(userId)
      
      if (!ok) {
        console.log('[ERROR] ❌ Stock insuffisant ou panier vide')
        console.log('[ERROR] Détails des erreurs:', errors)
        
        return response.status(400).json({
          success: false,
          message: 'Stock insuffisant ou panier vide',
          errors: errors,
          help: 'Utilisez /api/debug-cart/:userId pour vérifier l\'état du panier'
        })
      }

      if (!cart) {
        console.log('[ERROR] ❌ Panier introuvable après validation')
        return response.status(400).json({
          success: false,
          message: 'Panier introuvable'
        })
      }

      console.log(`[CART] ✅ Panier validé: ${cart.id} avec ${cart.items.length} articles`)

      // 2. Détection opérateur (toujours GIMAC pour le Gabon)
      const operatorInfo = this.detectOperatorGabon(phoneNumber)
      console.log(`[OPERATOR] Compte utilisé: ${operatorInfo.name}`)
      console.log(`[OPERATOR] AccountCode: ${operatorInfo.accountCode}`)

      // 3. Renouvellement du secret si nécessaire
      await this.renewSecretIfNeeded()

      // 4. Récupération des informations utilisateur
      const user = await User.findBy('id', userId)
      console.log('[USER] Utilisateur trouvé:', user ? 'Oui' : 'Non')
      if (user) {
        console.log('[USER] Nom:', user.full_name)
        console.log('[USER] Email:', user.email)
      }

      // 5. Calcul du total
      let subtotal = 0
      const itemsDetails = []
      
      for (const item of cart.items) {
        const product = await Product.findBy('id', item.product_id)
        if (product) {
          const itemTotal = product.price * item.quantity
          subtotal += itemTotal
          itemsDetails.push({
            product: product.name,
            price: product.price,
            quantity: item.quantity,
            total: itemTotal
          })
        }
      }

      const deliveryPrice = Number(payload.deliveryPrice) || 0
      const total = subtotal + deliveryPrice
      const orderNumber = generateOrderNumber()

      console.log('\n[RESUME] Résumé de la commande:')
      console.log('[RESUME] --------------------------------')
      itemsDetails.forEach(item => {
        console.log(`[RESUME] ${item.product} x${item.quantity} = ${item.total} XAF`)
      })
      console.log('[RESUME] --------------------------------')
      console.log(`[RESUME] Sous-total: ${subtotal} XAF`)
      console.log(`[RESUME] Livraison: ${deliveryPrice} XAF`)
      console.log(`[RESUME] TOTAL: ${total} XAF`)
      console.log(`[RESUME] Numéro commande: ${orderNumber}\n`)

      // 6. Création de la commande
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
        payment_method: `gimac_${linkType}`,
        customer_email: user?.email || payload.customerEmail || 'invite@email.com',
        shipping_address: payload.shippingAddress || 'non renseigné',
        notes: payload.notes || null,
        payment_operator_simple: 'GIMAC'
      })

      console.log('[ORDER] ✅ Commande créée:', {
        id: order.id,
        number: order.order_number,
        total: order.total,
        status: order.status
      })

      // 7. Création des OrderItems
      const { count } = await this.buildItemsFromCart(order, cart)
      console.log('[ITEMS] ✅ Items créés:', count)

      // 8. Vidage du panier
      await CartItem.query().where('cart_id', cart.id).delete()
      console.log('[CART] ✅ Panier vidé:', cart.id)

      // 9. Tracking initial
      await OrderTracking.create({
        order_id: order.id,
        status: 'pending',
        description: `🔗 Lien ${linkTypeCode} - GIMAC - ${count} articles - Total: ${total} XAF`,
        tracked_at: DateTime.now(),
      })
      console.log('[TRACKING] ✅ Tracking initial créé')

      // 10. Génération du lien de paiement
      console.log(`\n[LINK] Génération du lien ${linkTypeCode}...`)
      console.log('[LINK] Paramètres:', {
        amount: total,
        product: orderNumber.substring(0, 15),
        accountCode: operatorInfo.accountCode,
        customerNumber: phoneNumber
      })

      let linkResult
      
      switch (linkTypeCode) {
        case 'WEB':
          linkResult = await MypvitLinkService.generateWebLink({
            amount: total,
            product: orderNumber.substring(0, 15),
            reference: `REF${Date.now()}`.substring(0, 15),
            callback_url_code: CALLBACK_URL_CODE,
            merchant_operation_account_code: operatorInfo.accountCode,
            owner_charge: 'MERCHANT',
            customer_account_number: phoneNumber,
            success_redirection_url_code: 'W0L8C',
            failed_redirection_url_code: 'YTJEI',
          })
          break
          
        case 'VISA_MASTERCARD':
          linkResult = await MypvitLinkService.generateVisaMastercardLink({
            amount: total,
            product: orderNumber.substring(0, 15),
            reference: `REF${Date.now()}`.substring(0, 15),
            callback_url_code: CALLBACK_URL_CODE,
            merchant_operation_account_code: operatorInfo.accountCode,
            owner_charge: 'MERCHANT',
            customer_account_number: phoneNumber,
            success_redirection_url_code: 'W0L8C',
            failed_redirection_url_code: 'YTJEI',
          })
          break
          
        case 'RESTLINK':
          linkResult = await MypvitLinkService.generateRestLink({
            amount: total,
            product: orderNumber.substring(0, 15),
            reference: `REF${Date.now()}`.substring(0, 15),
            callback_url_code: CALLBACK_URL_CODE,
            merchant_operation_account_code: operatorInfo.accountCode,
            owner_charge: 'MERCHANT',
            customer_account_number: phoneNumber,
            success_redirection_url_code: 'W0L8C',
            failed_redirection_url_code: 'YTJEI',
          })
          break
          
        default:
          throw new Error(`Type de lien non supporté: ${linkTypeCode}`)
      }

      console.log('[LINK] ✅ Lien généré avec succès:', {
        status: linkResult.status,
        reference_id: linkResult.merchant_reference_id,
        has_url: !!linkResult.url
      })

      // 11. Mise à jour de la commande avec les infos de paiement
      if (linkResult.merchant_reference_id) {
        order.payment_reference_id = linkResult.merchant_reference_id
        order.payment_amount = total
        order.payment_initiated_at = DateTime.now()
        order.status = 'pending_payment'
        await order.save()
        console.log('[UPDATE] ✅ Commande mise à jour:', {
          reference_id: linkResult.merchant_reference_id,
          status: 'pending_payment'
        })
      }

      // 12. Tracking de génération du lien
      await OrderTracking.create({
        order_id: order.id,
        status: 'pending_payment',
        description: `⏳ Lien ${linkTypeCode} généré - GIMAC - Réf: ${linkResult.merchant_reference_id || order.order_number} - URL: ${linkResult.url?.substring(0, 50)}...`,
        tracked_at: DateTime.now(),
      })

      // 13. Charger les items de la commande pour la réponse
      await order.load('items')

      console.log('\n✅ =========================================================')
      console.log('✅ ========== PAIEMENT PAR LIEN GÉNÉRÉ AVEC SUCCÈS ==========')
      console.log('✅ =========================================================')
      console.log('✅ Commande:', order.order_number)
      console.log('✅ Total:', total, 'XAF')
      console.log('✅ Items:', count)
      console.log('✅ Lien:', linkResult.url?.substring(0, 80) + '...')
      console.log('✅ =========================================================\n')

      // 14. Réponse finale
      return response.status(201).json({
        success: true,
        message: `✅ Lien de paiement ${linkTypeCode} généré avec succès !`,
        data: {
          orderId: order.id,
          orderNumber: order.order_number,
          total: order.total,
          subtotal: order.subtotal,
          shippingCost: order.shipping_cost,
          status: 'pending_payment',
          customerName: order.customer_name,
          customerPhone: order.customer_phone,
          customerEmail: order.customer_email,
          paymentMethod: `gimac_${linkType}`,
          paymentOperator: 'GIMAC',
          itemsCount: count,
          items: order.items.map(item => ({
            id: item.id,
            productName: item.product_name,
            price: item.price,
            quantity: item.quantity,
            subtotal: item.subtotal
          })),
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
          delivery: {
            method: order.delivery_method,
            address: order.shipping_address,
            price: order.shipping_cost
          },
          createdAt: order.createdAt,
        },
      })

    } catch (error: any) {
      console.log('\n')
      console.log('💥 =========================================================')
      console.log('💥 ========== ERREUR LORS DU PAIEMENT ==========')
      console.log('💥 =========================================================')
      console.error('[ERROR] Type:', error.constructor.name)
      console.error('[ERROR] Message:', error.message)
      console.error('[ERROR] Stack:', error.stack?.split('\n').slice(0, 5).join('\n'))
      
      if (error.response) {
        console.error('[ERROR] Response status:', error.response.status)
        console.error('[ERROR] Response data:', JSON.stringify(error.response.data, null, 2))
      }
      
      if (error.cause) {
        console.error('[ERROR] Cause:', error.cause)
      }
      
      console.log('💥 =========================================================\n')
      
      // Déterminer le message d'erreur approprié
      let errorMessage = 'Erreur lors de la génération du lien de paiement'
      let errorDetails = error.message
      
      if (error.response?.data?.message) {
        errorDetails = error.response.data.message
      }
      
      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        errorMessage = 'Impossible de contacter le service de paiement'
        errorDetails = 'Le service de paiement est momentanément indisponible'
      }
      
      return response.status(500).json({
        success: false,
        message: errorMessage,
        error: errorDetails,
        errorCode: error.code || 'UNKNOWN',
        timestamp: new Date().toISOString(),
        ...(process.env.NODE_ENV === 'development' && {
          stack: error.stack?.split('\n')
        })
      })
    }
  }
}
