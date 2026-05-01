// app/controllers/PayQRCodeController.ts - COMPLET, CORRIGÉ ET FONCTIONNEL
import type { HttpContext } from '@adonisjs/core/http'
import Order from '#models/Order'
import OrderItem from '#models/OrderItem'
import OrderTracking from '#models/order_tracking'
import Cart from '#models/Cart'
import CartItem from '#models/CartItem'
import User from '#models/user'
import Product from '#models/Product'
import { DateTime } from 'luxon'
import crypto from 'node:crypto'
import MypvitSecretService from '../services/mypvit_secret_service.js'
import MypvitQRCodeService from '../services/mypvit_qrcode_service.js'

const CALLBACK_URL_CODE = '9ZOXW'

function generateOrderNumber(): string {
  return `CMD-${Date.now()}-${Math.floor(Math.random() * 1000)}`
}

function generateRandomPassword(): string {
  return crypto.randomBytes(16).toString('hex')
}

export default class PayQRCodeController {

  private async renewSecretIfNeeded(phoneNumber?: string): Promise<void> {
    try {
      console.log('🔄 Tentative de renouvellement du secret QR...')
      await MypvitSecretService.renewSecret(phoneNumber)
      console.log('✅ Clé QR renouvelée avec succès')
    } catch (error: any) {
      console.error('⚠️ Erreur renouvellement secret QR:', error.message)
      // On ne bloque pas le processus si le renouvellement échoue
    }
  }

  private detectOperatorGabon(phoneNumber?: string): { name: string; code: string; accountCode: string } {
    if (!phoneNumber) {
      console.log('⚠️ Pas de numéro, utilisation MOOV par défaut')
      return {
        name: 'MOOV_MONEY',
        code: 'MOOV_MONEY',
        accountCode: 'ACC_69EFB143D4F54'
      }
    }

    console.log('🔍 Détection opérateur QR pour:', phoneNumber)
    
    // Nettoyage complet du numéro
    const clean = phoneNumber.replace(/[\s\+\.\-]/g, '')
    let local = clean
    
    // Enlever le préfixe international
    if (clean.startsWith('+241')) local = clean.substring(4)
    else if (clean.startsWith('241')) local = clean.substring(3)
    
    // Enlever le 0 initial si présent
    if (local.startsWith('0')) local = local.substring(1)
    
    console.log('📱 Numéro nettoyé:', local)
    console.log('🔢 Premier chiffre:', local.charAt(0))

    // Détection basée sur le premier chiffre APRÈS nettoyage
    if (local.startsWith('6')) {
      console.log('✅ MOOV_MONEY détecté')
      return {
        name: 'MOOV_MONEY',
        code: 'MOOV_MONEY',
        accountCode: 'ACC_69EFB143D4F54'
      }
    }
    
    if (local.startsWith('7')) {
      console.log('✅ AIRTEL_MONEY détecté')
      return {
        name: 'AIRTEL_MONEY',
        code: 'AIRTEL_MONEY',
        accountCode: 'ACC_69EFB0E02FCA3'
      }
    }
    
    // Autres préfixes ou non reconnu
    console.log('⚠️ Opérateur non reconnu, utilisation MOOV par défaut')
    return {
      name: 'MOOV_MONEY',
      code: 'MOOV_MONEY',
      accountCode: 'ACC_69EFB143D4F54'
    }
  }

  // ==================== CRÉER UN USER SI PAS D'ID ====================
  private async getOrCreateUser(payload: {
    customerName: string
    customerEmail: string
    customerPhone: string
  }): Promise<User> {
    const email = payload.customerEmail || `guest_${Date.now()}@guest.com`
    const phone = payload.customerPhone || ''
    const fullName = payload.customerName || 'Client'

    console.log('👤 Recherche/Création utilisateur QR:', { email, phone })

    let user = await User.findBy('email', email)

    if (user) {
      console.log('👤 Utilisateur existant trouvé:', user.id)
      user.full_name = fullName
      if (!user.phone) user.phone = phone
      await user.save()
      console.log('👤 Utilisateur mis à jour:', user.id)
    } else {
      user = await User.create({
        id: crypto.randomUUID(),
        email: email,
        full_name: fullName,
        phone: phone,
        role: 'client',
        password: generateRandomPassword(),
      })
      console.log('✅ Nouvel utilisateur créé:', user.id, '|', user.email, '|', user.full_name)
    }

    return user
  }

  // ==================== VÉRIFICATION DU STOCK ====================
  private async checkStockAvailability(items: any[], isCart: boolean = false, userId?: string): Promise<{
    available: boolean
    outOfStockProducts: string[]
    message?: string
  }> {
    console.log('📦 Vérification stock QR...')
    const outOfStockProducts: string[] = []
    let productsToCheck: any[] = []

    if (isCart && userId) {
      const cart = await Cart.query().where('user_id', userId).preload('items').first()
      if (cart) {
        productsToCheck = cart.items.map((item: any) => ({
          productId: item.product_id,
          quantity: item.quantity
        }))
        console.log(`🛒 ${productsToCheck.length} articles du panier`)
      }
    } else if (items && items.length > 0) {
      productsToCheck = items.map((item: any) => ({
        productId: item.productId || item.id,
        quantity: item.quantity
      }))
      console.log(`📦 ${productsToCheck.length} articles directs`)
    }

    if (productsToCheck.length === 0) {
      console.log('❌ Aucun produit à vérifier')
      return { available: false, outOfStockProducts: ['Aucun produit'], message: 'Aucun produit' }
    }

    console.log(`📦 Vérification de ${productsToCheck.length} produit(s)...`)

    for (const item of productsToCheck) {
      if (!item.productId) continue
      const product = await Product.findBy('id', item.productId)
      if (!product) { 
        outOfStockProducts.push(`Produit ${item.productId} introuvable`)
        continue 
      }
      if (product.isArchived) { 
        outOfStockProducts.push(`${product.name} - Archivé`)
        continue 
      }
      if (product.stock <= 0) { 
        outOfStockProducts.push(`${product.name} - RUPTURE`)
        continue 
      }
      if (product.stock < item.quantity) { 
        outOfStockProducts.push(`${product.name}: stock ${product.stock} < ${item.quantity} demandé`)
        continue 
      }
      console.log(`✅ ${product.name}: stock ${product.stock} ≥ ${item.quantity}`)
    }

    const available = outOfStockProducts.length === 0
    console.log(`📊 Stock QR: ${available ? 'OK' : 'PROBLÈME'}`)
    if (!available) console.log('❌ Produits problématiques:', outOfStockProducts)

    return {
      available,
      outOfStockProducts,
      message: outOfStockProducts.length > 0 ? `Indisponible: ${outOfStockProducts.join(' | ')}` : undefined
    }
  }

  private async updateProductStock(productId: string, quantity: number): Promise<void> {
    const product = await Product.findBy('id', productId)
    if (product) {
      product.stock = Math.max(0, product.stock - quantity)
      if (product.stock === 0) product.isArchived = true
      await product.save()
      console.log(`📉 Stock QR décrémenté: ${product.name} -${quantity} (reste: ${product.stock})`)
    }
  }

  private async restoreProductStock(orderId: string): Promise<void> {
    console.log('🔄 Restauration stock QR pour commande:', orderId)
    const orderItems = await OrderItem.query().where('order_id', orderId)
    for (const item of orderItems) {
      const product = await Product.findBy('id', item.product_id)
      if (product) {
        product.stock += item.quantity
        if (product.isArchived && product.stock > 0) product.isArchived = false
        await product.save()
        console.log(`📈 Stock QR restauré: ${product.name} +${item.quantity} (total: ${product.stock})`)
      }
    }
  }

  private async createOrderItems(order: Order, items: any[]): Promise<{ subtotal: number; itemsCount: number }> {
    console.log('🏗️ Création items QR directs')
    let subtotal = 0
    let itemsCount = 0

    for (const item of items) {
      const productId = item.productId || item.id
      if (!productId) {
        console.log('⚠️ Item sans ID, ignoré')
        continue
      }

      const product = await Product.findBy('id', productId)
      if (!product) {
        console.log(`⚠️ Produit ${productId} non trouvé, ignoré`)
        continue
      }

      const qty = item.quantity || 1
      const itemTotal = product.price * qty
      subtotal += itemTotal

      await OrderItem.create({
        order_id: order.id,
        product_id: product.id,
        product_name: product.name,
        price: product.price,
        quantity: qty,
        subtotal: itemTotal
      })

      console.log(`➕ ${product.name} x${qty} = ${itemTotal} FCFA`)
      await this.updateProductStock(product.id, qty)
      itemsCount++
    }

    console.log(`💰 Sous-total QR: ${subtotal} FCFA | ${itemsCount} articles`)
    return { subtotal, itemsCount }
  }

  private async createOrderItemsFromCart(cart: any, order: Order): Promise<{ subtotal: number; itemsCount: number }> {
    console.log('🛒 Création items QR depuis panier')
    let subtotal = 0
    let itemsCount = 0

    for (const cartItem of cart.items) {
      if (!cartItem.product_id) {
        console.log('⚠️ Item panier sans product_id, ignoré')
        continue
      }

      const product = await Product.findBy('id', cartItem.product_id)
      if (!product) {
        console.log(`⚠️ Produit ${cartItem.product_id} non trouvé, ignoré`)
        continue
      }

      const qty = cartItem.quantity || 1
      const itemTotal = product.price * qty
      subtotal += itemTotal

      await OrderItem.create({
        order_id: order.id,
        product_id: product.id,
        product_name: product.name,
        price: product.price,
        quantity: qty,
        subtotal: itemTotal
      })

      console.log(`➕ ${product.name} x${qty} = ${itemTotal} FCFA`)
      await this.updateProductStock(product.id, qty)
      itemsCount++
    }

    console.log(`💰 Sous-total panier QR: ${subtotal} FCFA | ${itemsCount} articles`)
    return { subtotal, itemsCount }
  }

  // ==================== PAIEMENT QR CODE ====================
  async pay({ request, response }: HttpContext) {
    console.log('📷 ========== NOUVEAU PAIEMENT QR CODE ==========')
    console.log('🕐 Heure:', new Date().toISOString())

    try {
      const payload = request.only([
        'userId', 'isGuest', 'customerAccountNumber',
        'shippingAddress', 'deliveryMethod', 'deliveryPrice',
        'customerName', 'customerEmail', 'customerPhone', 'items',
      ])

      console.log('📦 Payload QR reçu:', JSON.stringify(payload, null, 2))

      const isGuest = payload.isGuest === true || !payload.userId || payload.userId === 'guest'
      const phoneNumber = payload.customerAccountNumber || payload.customerPhone

      console.log(`👤 Mode: ${isGuest ? 'INVITÉ' : 'CONNECTÉ'}`)
      console.log(`📱 Téléphone: ${phoneNumber || 'N/A'}`)
      console.log(`📦 Items: ${payload.items?.length || 0}`)

      // ✅ Détection de l'opérateur selon le numéro (06=MOOV, 07=AIRTEL)
      const operatorInfo = this.detectOperatorGabon(phoneNumber)
      console.log('📡 Opérateur QR détecté:')
      console.log(`   Nom: ${operatorInfo.name}`)
      console.log(`   Code: ${operatorInfo.code}`)
      console.log(`   Compte: ${operatorInfo.accountCode}`)

      // Vérification stock
      const useCart = !isGuest && payload.userId && (!payload.items || payload.items.length === 0)
      console.log('🛒 Mode panier:', useCart)
      
      const stockCheck = await this.checkStockAvailability(payload.items || [], useCart, payload.userId)

      if (!stockCheck.available) {
        console.log('❌ Échec vérification stock QR')
        return response.status(400).json({
          success: false,
          message: 'Produits indisponibles',
          error: 'STOCK_INSUFFISANT',
          details: {
            outOfStockProducts: stockCheck.outOfStockProducts,
            message: stockCheck.message
          }
        })
      }

      console.log('✅ Stock QR disponible')

      // Renouveler le secret avec le bon opérateur
      await this.renewSecretIfNeeded(phoneNumber)

      // ==================== USER ID ====================
      let userId = payload.userId

      if (!userId) {
        console.log('👤 Création utilisateur QR nécessaire...')
        try {
          const newUser = await this.getOrCreateUser({
            customerName: payload.customerName || 'Client',
            customerEmail: payload.customerEmail || '',
            customerPhone: phoneNumber || '',
          })
          userId = newUser.id
          console.log('✅ Utilisateur QR créé:', userId)
        } catch (error: any) {
          console.error('❌ Erreur création utilisateur QR:', error)
          return response.status(500).json({
            success: false,
            message: 'Erreur lors de la création du compte utilisateur',
            error: error.message
          })
        }
      } else {
        console.log('👤 Utilisation ID existant:', userId)
      }

      const deliveryPrice = payload.deliveryPrice || 1
      const orderNumber = generateOrderNumber()

      // ✅ Création commande SANS guestOrderId
      console.log('📝 Création commande QR...')
      const order = await Order.create({
        user_id: userId,
        order_number: orderNumber,
        status: 'pending',
        total: 0,
        subtotal: 0,
        shipping_cost: deliveryPrice,
        delivery_method: payload.deliveryMethod || 'standard',
        customer_name: payload.customerName || 'Client',
        customer_phone: phoneNumber || '',
        payment_method: `qr_code_${operatorInfo.name.toLowerCase()}`,
        customer_email: payload.customerEmail || 'invite@email.com',
        shipping_address: payload.shippingAddress || 'non renseigné',
        payment_operator_simple: operatorInfo.name
      })

      console.log('✅ Commande QR créée:', order.id, order.order_number)

      let subtotal = 0
      let itemsCount = 0

      if (payload.items && payload.items.length > 0) {
        console.log('📦 Traitement items directs...')
        const r = await this.createOrderItems(order, payload.items)
        subtotal = r.subtotal
        itemsCount = r.itemsCount
        console.log('📦 Items directs utilisés')
      } else if (!isGuest && payload.userId) {
        console.log('🛒 Traitement depuis le panier...')
        const cart = await Cart.query().where('user_id', payload.userId).preload('items').first()
        if (cart && cart.items.length > 0) {
          const r = await this.createOrderItemsFromCart(cart, order)
          subtotal = r.subtotal
          itemsCount = r.itemsCount
          await CartItem.query().where('cart_id', cart.id).delete()
          console.log('🛒 Panier utilisé et vidé')
        } else {
          console.log('❌ Panier vide')
          await this.restoreProductStock(order.id)
          return response.status(400).json({
            success: false,
            message: 'Panier vide'
          })
        }
      } else {
        console.log('❌ Aucun article')
        return response.status(400).json({
          success: false,
          message: 'Aucun article'
        })
      }

      const total = subtotal + deliveryPrice
      order.subtotal = subtotal
      order.total = total
      await order.save()

      console.log(`💰 Commande QR mise à jour - Sous-total: ${subtotal}, Total: ${total}`)

      await OrderTracking.create({
        order_id: order.id,
        status: 'pending',
        description: `📷 Commande QR Code ${operatorInfo.name} (${isGuest ? 'Invité' : 'Connecté'}) - ${itemsCount} articles`,
        tracked_at: DateTime.now(),
      })

      // ✅ QR Code - Génération avec le compte approprié
      const terminalId = `T${Date.now().toString(36).toUpperCase()}${operatorInfo.code.substring(0, 3)}`

      console.log('🔑 ========== GÉNÉRATION QR CODE ==========')
      console.log(`📡 Opérateur: ${operatorInfo.name}`)
      console.log(`🔑 Compte utilisé: ${operatorInfo.accountCode}`)
      console.log(`🏷️ Terminal ID: ${terminalId}`)
      console.log(`💰 Montant: ${total}`)
      console.log(`📱 Téléphone pour secret: ${phoneNumber || 'non fourni'}`)

      try {
        // 🔐 FORCER LE RENOUVELLEMENT DU SECRET AVANT LA GÉNÉRATION DU QR
        console.log('🔐 Renouvellement forcé du secret avant QR Code...')
        try {
          const freshSecret = await MypvitSecretService.forceRenewal(phoneNumber)
          console.log('✅ Secret frais obtenu:', freshSecret.key.substring(0, 20) + '...')
          // Petit délai pour que le secret soit propagé sur les serveurs Mypvit
          await new Promise(resolve => setTimeout(resolve, 1000))
        } catch (secretError: any) {
          console.error('⚠️ Erreur renouvellement secret:', secretError.message)
          // On continue, peut-être que l'ancien secret fonctionne encore
        }

        const qrResult = await MypvitQRCodeService.generateStaticQRCode({
          accountOperationCode: operatorInfo.accountCode,
          terminalId: terminalId,
          callbackUrlCode: CALLBACK_URL_CODE,
          phoneNumber: phoneNumber  // Passer le téléphone pour le secret
        })

        console.log('✅ QR Code généré avec succès')
        console.log('📊 Résultat QR:', JSON.stringify(qrResult, null, 2))

        if (qrResult.reference_id) {
          order.payment_reference_id = qrResult.reference_id
          order.payment_operator_simple = operatorInfo.name
          order.status = 'pending_payment'
          await order.save()
          
          console.log('✅ Référence paiement sauvegardée:', qrResult.reference_id)
        }

        await OrderTracking.create({
          order_id: order.id,
          status: 'pending_payment',
          description: `📱 QR Code ${operatorInfo.name} - Réf: ${qrResult.reference_id || order.order_number}`,
          tracked_at: DateTime.now(),
        })

        await order.load('items')
        console.log(`✅ Paiement QR ${operatorInfo.name} terminé`)

        const responseData = {
          success: true,
          message: `✅ QR Code ${operatorInfo.name} généré ! Scannez pour payer.`,
          data: {
            orderId: order.id,
            orderNumber: order.order_number,
            total: order.total,
            status: 'pending_payment',
            customerName: order.customer_name,
            paymentMethod: `qr_code_${operatorInfo.name.toLowerCase()}`,
            isGuest,
            itemsCount,
            userId,
            operator: {
              name: operatorInfo.name,
              code: operatorInfo.code,
              accountCode: operatorInfo.accountCode
            },
            qr_code: {
              data: qrResult.data,
              reference_id: qrResult.reference_id || order.order_number,
              amount: total,
              expires_in: 600,
            },
          },
        }

        console.log('📤 Réponse QR envoyée au client:')
        console.log(JSON.stringify(responseData, null, 2))

        return response.status(201).json(responseData)
        
      } catch (qrError: any) {
        console.error('❌ ERREUR GÉNÉRATION QR CODE')
        console.error('❌ Message:', qrError.message)
        
        if (qrError.response) {
          console.error('❌ Status HTTP:', qrError.response.status)
          console.error('❌ Données erreur:', JSON.stringify(qrError.response.data, null, 2))
        }

        // Restaurer le stock en cas d'erreur
        await this.restoreProductStock(order.id)
        order.status = 'payment_failed'
        
        // Stocker les détails d'erreur dans le message
        const errorMessage = qrError.message || 'Erreur génération QR'
        const errorDetails = qrError.response?.data 
          ? ` | Détails: ${JSON.stringify(qrError.response.data)}` 
          : ''
        order.payment_error_message = errorMessage + errorDetails
        await order.save()

        await OrderTracking.create({
          order_id: order.id,
          status: 'payment_failed',
          description: `❌ Échec QR ${operatorInfo.name}: ${errorMessage}`,
          tracked_at: DateTime.now(),
        })

        return response.status(500).json({
          success: false,
          message: 'Erreur lors de la génération du QR Code',
          error: qrError.message,
          details: qrError.response?.data || null,
          operator: operatorInfo.name
        })
      }

    } catch (error: any) {
      console.error('🔴 ========== ERREUR GÉNÉRALE QR ==========')
      console.error('🔴 Message:', error.message)
      console.error('🔴 Type:', error.constructor.name)
      console.error('🔴 Stack:', error.stack)
      
      return response.status(500).json({
        success: false,
        message: 'Erreur interne QR Code',
        error: error.message,
        type: error.constructor.name
      })
    }
  }
}
