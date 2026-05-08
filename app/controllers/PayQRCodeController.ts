// app/controllers/PayQRCodeController.ts - CORRIGÉ FINAL
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
    }
  }

  private detectOperatorGabon(phoneNumber?: string): { name: string; code: string; accountCode: string } {
    if (!phoneNumber) {
      console.log('⚠️ Pas de numéro, utilisation GIMAC par défaut')
      return { name: 'GIMAC', code: 'GIMAC_PAY', accountCode: 'ACC_69FE0E1BC34B4' }
    }

    console.log('🔍 Détection opérateur QR pour:', phoneNumber)
    
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

  // ✅ NOUVELLE MÉTHODE : Récupère et valide les produits du panier
  private async getCartWithValidatedItems(userId: string): Promise<{
    valid: boolean
    cart?: any
    productsToCheck: any[]
    errors: string[]
    subtotal: number
  }> {
    console.log('🛒 Récupération du panier pour userId:', userId)
    
    const cart = await Cart.query()
      .where('user_id', userId)
      .preload('items')
      .first()

    if (!cart || !cart.items || cart.items.length === 0) {
      return { 
        valid: false, 
        productsToCheck: [], 
        errors: ['Votre panier est vide'],
        subtotal: 0
      }
    }

    console.log(`🛒 Panier trouvé avec ${cart.items.length} articles`)

    const productsToCheck: any[] = []
    const errors: string[] = []
    let subtotal = 0

    for (const cartItem of cart.items) {
      const product = await Product.findBy('id', cartItem.product_id)
      
      if (!product) {
        errors.push(`Produit ${cartItem.product_id} introuvable`)
        continue
      }
      
      if (product.isArchived) {
        errors.push(`${product.name} - Archivé`)
        continue
      }
      
      if (product.status !== 'active') {
        errors.push(`${product.name} - Produit inactif`)
        continue
      }
      
      if (product.stock <= 0) {
        errors.push(`${product.name} - Rupture de stock`)
        continue
      }
      
      if (product.stock < cartItem.quantity) {
        errors.push(`${product.name}: stock ${product.stock} < ${cartItem.quantity} demandé`)
        continue
      }

      // ✅ Tout est OK
      productsToCheck.push({
        productId: cartItem.product_id,
        quantity: cartItem.quantity,
        product: product
      })
      
      subtotal += product.price * cartItem.quantity
      console.log(`✅ ${product.name}: ${product.stock} en stock, ${cartItem.quantity} demandé`)
    }

    const valid = errors.length === 0
    console.log(`📊 Panier valide: ${valid ? 'OUI' : 'NON'} | ${productsToCheck.length} produits OK | ${errors.length} erreurs`)
    
    return { valid, cart, productsToCheck, errors, subtotal }
  }

  // ✅ NOUVELLE MÉTHODE : Valide les items directs
  private async validateDirectItems(items: any[]): Promise<{
    valid: boolean
    productsToCheck: any[]
    errors: string[]
    subtotal: number
  }> {
    console.log('📦 Validation des items directs...')
    
    const productsToCheck: any[] = []
    const errors: string[] = []
    let subtotal = 0

    for (const item of items) {
      const productId = item.productId || item.id
      
      if (!productId) {
        errors.push('Item sans ID produit')
        continue
      }

      const product = await Product.findBy('id', productId)
      
      if (!product) {
        errors.push(`Produit ${productId} introuvable`)
        continue
      }
      
      if (product.isArchived) {
        errors.push(`${product.name} - Archivé`)
        continue
      }
      
      if (product.status !== 'active') {
        errors.push(`${product.name} - Produit inactif`)
        continue
      }
      
      const qty = item.quantity || 1
      
      if (product.stock <= 0) {
        errors.push(`${product.name} - Rupture de stock`)
        continue
      }
      
      if (product.stock < qty) {
        errors.push(`${product.name}: stock ${product.stock} < ${qty} demandé`)
        continue
      }

      // ✅ Tout est OK
      productsToCheck.push({
        productId: productId,
        quantity: qty,
        product: product
      })
      
      subtotal += product.price * qty
      console.log(`✅ ${product.name}: ${product.stock} en stock, ${qty} demandé`)
    }

    const valid = errors.length === 0
    console.log(`📊 Items valides: ${valid ? 'OUI' : 'NON'} | ${productsToCheck.length} produits OK | ${errors.length} erreurs`)
    
    return { valid, productsToCheck, errors, subtotal }
  }

  // ✅ CRÉATION DES ORDER ITEMS (version simplifiée)
  private async createOrderItemsFromValidated(order: Order, productsToCheck: any[]): Promise<number> {
    console.log('🏗️ Création des OrderItems...')
    let itemsCount = 0

    for (const item of productsToCheck) {
      await OrderItem.create({
        order_id: order.id,
        product_id: item.productId,
        product_name: item.product.name,
        price: item.product.price,
        quantity: item.quantity,
        subtotal: item.product.price * item.quantity
      })

      console.log(`➕ ${item.product.name} x${item.quantity} = ${item.product.price * item.quantity} FCFA`)
      itemsCount++
    }

    console.log(`✅ ${itemsCount} OrderItems créés`)
    return itemsCount
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
      const hasDirectItems = payload.items && payload.items.length > 0

      console.log(`👤 Mode: ${isGuest ? 'INVITÉ' : 'CONNECTÉ'}`)
      console.log(`📱 Téléphone: ${phoneNumber || 'N/A'}`)
      console.log(`📦 Items directs: ${hasDirectItems ? payload.items.length : 'NON'}`)

      const operatorInfo = this.detectOperatorGabon(phoneNumber)
      console.log(`📡 Opérateur QR: ${operatorInfo.name} | Compte: ${operatorInfo.accountCode}`)

      // ============================================================
      // ✅ ÉTAPE 1 : VALIDER LES PRODUITS
      // ============================================================
      let subtotal = 0
      let validProducts: any[] = []
      let cart: any = null

      if (hasDirectItems) {
        // 📦 MODE ITEMS DIRECTS
        console.log('📦 Mode: ITEMS DIRECTS')
        const validation = await this.validateDirectItems(payload.items)
        
        if (!validation.valid) {
          return response.status(400).json({
            success: false,
            message: 'Produits indisponibles',
            error: 'STOCK_INSUFFISANT',
            details: {
              errors: validation.errors,
              message: validation.errors.join(' | ')
            }
          })
        }
        
        subtotal = validation.subtotal
        validProducts = validation.productsToCheck
        
      } else if (!isGuest && payload.userId) {
        // 🛒 MODE PANIER (utilisateur connecté)
        console.log('🛒 Mode: PANIER')
        const cartValidation = await this.getCartWithValidatedItems(payload.userId)
        
        if (!cartValidation.valid) {
          return response.status(400).json({
            success: false,
            message: cartValidation.errors.includes('Votre panier est vide') 
              ? 'Votre panier est vide' 
              : 'Produits indisponibles dans votre panier',
            error: 'CART_ERROR',
            details: {
              errors: cartValidation.errors,
              message: cartValidation.errors.join(' | ')
            }
          })
        }
        
        subtotal = cartValidation.subtotal
        validProducts = cartValidation.productsToCheck
        cart = cartValidation.cart
        
      } else {
        // ❌ AUCUN PRODUIT
        console.log('❌ Aucun produit à commander')
        return response.status(400).json({
          success: false,
          message: 'Aucun article à commander',
          error: 'NO_ITEMS'
        })
      }

      console.log(`✅ Validation OK - ${validProducts.length} produits, Sous-total: ${subtotal} FCFA`)

      // ============================================================
      // ✅ ÉTAPE 2 : RENOUVELER LE SECRET
      // ============================================================
      await this.renewSecretIfNeeded(phoneNumber)

      // ============================================================
      // ✅ ÉTAPE 3 : GÉRER L'UTILISATEUR
      // ============================================================
      let userId = payload.userId

      if (!userId) {
        console.log('👤 Création utilisateur QR nécessaire...')
        const newUser = await this.getOrCreateUser({
          customerName: payload.customerName || 'Client',
          customerEmail: payload.customerEmail || '',
          customerPhone: phoneNumber || '',
        })
        userId = newUser.id
        console.log('✅ Utilisateur QR créé:', userId)
      }

      // ============================================================
      // ✅ ÉTAPE 4 : CRÉER LA COMMANDE
      // ============================================================
      const deliveryPrice = payload.deliveryPrice || 1
      const total = subtotal + deliveryPrice
      const orderNumber = generateOrderNumber()

      console.log('📝 Création commande QR...')
      const order = await Order.create({
        user_id: userId,
        order_number: orderNumber,
        status: 'pending',
        total: total,
        subtotal: subtotal,
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

      // ============================================================
      // ✅ ÉTAPE 5 : CRÉER LES ORDER ITEMS
      // ============================================================
      const itemsCount = await this.createOrderItemsFromValidated(order, validProducts)

      // ============================================================
      // ✅ ÉTAPE 6 : VIDER LE PANIER (si mode panier)
      // ============================================================
      if (cart) {
        await CartItem.query().where('cart_id', cart.id).delete()
        console.log('🛒 Panier vidé après création commande')
      }

      // ============================================================
      // ✅ ÉTAPE 7 : TRACKING INITIAL
      // ============================================================
      await OrderTracking.create({
        order_id: order.id,
        status: 'pending',
        description: `📷 Commande QR Code ${operatorInfo.name} (${isGuest ? 'Invité' : 'Connecté'}) - ${itemsCount} articles`,
        tracked_at: DateTime.now(),
      })

      // ============================================================
      // ✅ ÉTAPE 8 : GÉNÉRER LE QR CODE
      // ============================================================
      const terminalId = `T${Date.now().toString(36).toUpperCase()}${operatorInfo.code.substring(0, 3)}`

      console.log('🔑 Génération QR Code...')
      console.log(`📡 Opérateur: ${operatorInfo.name} | Compte: ${operatorInfo.accountCode}`)
      console.log(`💰 Montant: ${total} | Terminal: ${terminalId}`)

      // Renouvellement forcé du secret
      try {
        await MypvitSecretService.forceRenewal(phoneNumber)
        console.log('✅ Secret frais obtenu pour QR Code')
        await new Promise(resolve => setTimeout(resolve, 1000))
      } catch (secretError: any) {
        console.error('⚠️ Erreur renouvellement secret:', secretError.message)
      }

      const qrResult = await MypvitQRCodeService.generateQRCode({
        accountOperationCode: operatorInfo.accountCode,
        terminalId: terminalId,
        callbackUrlCode: CALLBACK_URL_CODE,
        amount: total,
        reference: order.order_number,
        phoneNumber: phoneNumber
      })

      console.log('✅ QR Code généré avec succès')

      // ============================================================
      // ✅ ÉTAPE 9 : SAUVEGARDER LA RÉFÉRENCE
      // ============================================================
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

      // ============================================================
      // ✅ ÉTAPE 10 : RÉPONSE SUCCÈS
      // ============================================================
      return response.status(201).json({
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
      })

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
