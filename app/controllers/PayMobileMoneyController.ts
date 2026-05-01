// app/controllers/PayMobileMoneyController.ts - COMPLET, CORRIGÉ ET FONCTIONNEL
import type { HttpContext } from '@adonisjs/core/http'
import Order from '#models/Order'
import OrderItem from '#models/OrderItem'
import OrderTracking from '#models/order_tracking'
import Cart from '#models/Cart'
import User from '#models/user'
import Product from '#models/Product'
import KYC from '#models/kyc'
import { DateTime } from 'luxon'
import crypto from 'node:crypto'
import MypvitSecretService from '../services/mypvit_secret_service.js'
import MypvitTransactionService from '../services/mypvit_transaction_service.js'
import MypvitKYCService from '../services/mypvit_kyc_service.js'

const CALLBACK_URL_CODE = '9ZOXW'

function generateOrderNumber(): string {
  return `CMD-${Date.now()}-${Math.floor(Math.random() * 1000)}`
}

function generateRandomPassword(): string {
  return crypto.randomBytes(16).toString('hex')
}

export default class PayMobileMoneyController {

  private async renewSecretIfNeeded(phoneNumber?: string): Promise<void> {
    try {
      console.log('🔄 Tentative de renouvellement du secret...')
      await MypvitSecretService.renewSecret(phoneNumber)
      console.log('✅ Clé renouvelée avec succès')
    } catch (error: any) {
      console.error('⚠️ Erreur renouvellement secret:', error.message)
      // On ne bloque pas le processus si le renouvellement échoue
    }
  }

  private detectOperatorGabon(phoneNumber: string): { name: string; code: string; accountCode: string } {
    console.log('🔍 Détection opérateur pour:', phoneNumber)
    
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
      console.log('✅ LIBERTIS détecté')
      return {
        name: 'LIBERTIS',
        code: 'LIBERTIS',
        accountCode: 'ACC_69EA59CBC7495'
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
    
    if (local.startsWith('2') || local.startsWith('4')) {
      console.log('✅ MOOV_MONEY détecté')
      return {
        name: 'MOOV_MONEY',
        code: 'MOOV_MONEY',
        accountCode: 'ACC_69EFB143D4F54'
      }
    }
    
    // Par défaut MOOV
    console.log('⚠️ Opérateur non reconnu, utilisation de MOOV par défaut')
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
    const { customerEmail, customerPhone, customerName } = payload
    const email = customerEmail || `guest_${Date.now()}@guest.com`

    console.log('👤 Recherche/Création utilisateur:', { email, customerPhone })

    let user = await User.findBy('email', email)

    if (user) {
      console.log('👤 Utilisateur existant trouvé:', user.id)
      user.full_name = customerName || user.full_name
      if (!user.phone) user.phone = customerPhone
      await user.save()
      console.log('👤 Utilisateur mis à jour:', user.id)
    } else {
      user = await User.create({
        id: crypto.randomUUID(),
        email: email,
        full_name: customerName || 'Client',
        phone: customerPhone || '',
        role: 'client',
        password: generateRandomPassword(),
      })
      console.log('✅ Nouvel utilisateur créé:', user.id)
    }

    return user
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
      console.log('🔄 Tentative KYC avec opérateur:', detected.code)
      await this.renewSecretIfNeeded(phoneNumber)
      const kycData = await MypvitKYCService.getKYCInfo(phoneNumber, detected.code)
      console.log('📊 Données KYC reçues:', JSON.stringify(kycData, null, 2))
      
      fullName = kycData.firstname || kycData.full_name || 'Client'
      console.log('✅ KYC réussi, nom:', fullName)
    } catch (error: any) {
      console.log('🟡 KYC échoué, utilisation du fallback')
      console.log('🟡 Message d\'erreur:', error.message)
      if (error.response?.data) {
        console.log('🟡 Détails erreur:', JSON.stringify(error.response.data, null, 2))
      }
    }

    // Sauvegarder KYC en base dans tous les cas
    try {
      const existingKYC = await KYC.findBy('numeroTelephone', phoneNumber)
      if (existingKYC) {
        existingKYC.nomComplet = fullName
        existingKYC.operateur = detected.name
        await existingKYC.save()
        console.log('📝 KYC mis à jour en base')
      } else {
        await KYC.create({
          nomComplet: fullName,
          numeroTelephone: phoneNumber,
          operateur: detected.name
        })
        console.log('📝 Nouveau KYC sauvegardé en base')
      }
    } catch (error: any) {
      console.log('🟡 Erreur sauvegarde KYC:', error.message)
    }

    const result = {
      operator: detected.name,
      fullName,
      accountNumber: phoneNumber,
      operatorCode: detected.code,
      accountCode: detected.accountCode,
      isActive: true
    }
    
    console.log('📋 Résultat KYC final:', JSON.stringify(result, null, 2))
    return result
  }

  private async checkStock(items: any[], useCart: boolean, userId?: string): Promise<{
    ok: boolean
    errors: string[]
  }> {
    console.log('📦 Vérification stock...')
    const errors: string[] = []
    let toCheck: any[] = []

    if (useCart && userId) {
      console.log('🛒 Vérification depuis le panier')
      const cart = await Cart.query().where('user_id', userId).preload('items').first()
      if (cart) {
        toCheck = cart.items.map((i: any) => ({ id: i.product_id, qty: i.quantity }))
        console.log(`📦 ${toCheck.length} articles dans le panier`)
      }
    } else if (items?.length > 0) {
      toCheck = items.map((i: any) => ({ id: i.productId || i.id, qty: i.quantity }))
      console.log(`📦 ${toCheck.length} articles fournis directement`)
    }

    for (const item of toCheck) {
      if (!item.id) {
        errors.push('Produit sans ID')
        continue
      }
      
      const p = await Product.findBy('id', item.id)
      if (!p) {
        errors.push(`Produit ${item.id} introuvable`)
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
      if (p.stock < item.qty) {
        errors.push(`${p.name}: stock disponible ${p.stock} < ${item.qty} demandé`)
        continue
      }
    }

    const ok = errors.length === 0
    console.log(`📊 Résultat vérification stock: ${ok ? 'OK' : 'ERREURS'}`)
    if (!ok) {
      console.log('❌ Erreurs stock:', errors)
    }

    return { ok, errors }
  }

  private async decrementStock(productId: string, qty: number): Promise<void> {
    const p = await Product.findBy('id', productId)
    if (p) {
      p.stock = Math.max(0, p.stock - qty)
      if (p.stock === 0) p.isArchived = true
      await p.save()
      console.log(`📉 Stock décrémenté: ${p.name} -${qty} (reste: ${p.stock})`)
    }
  }

  private async restoreStock(orderId: string): Promise<void> {
    console.log('🔄 Restauration du stock pour commande:', orderId)
    const items = await OrderItem.query().where('order_id', orderId)
    for (const item of items) {
      const p = await Product.findBy('id', item.product_id)
      if (p) {
        p.stock += item.quantity
        if (p.isArchived && p.stock > 0) p.isArchived = false
        await p.save()
        console.log(`📈 Stock restauré: ${p.name} +${item.quantity} (total: ${p.stock})`)
      }
    }
  }

  private async buildItems(order: Order, items: any[], fromCart: boolean, userId?: string): Promise<{ subtotal: number; count: number }> {
    console.log('🏗️ Construction des items de la commande')
    let subtotal = 0
    let count = 0

    const source = fromCart
      ? (await Cart.query().where('user_id', userId!).preload('items').first())?.items || []
      : items

    console.log(`📦 ${source.length} items à traiter`)

    for (const item of source) {
      const pid = item.productId || item.product_id || item.id
      if (!pid) {
        console.log('⚠️ Item sans ID, ignoré')
        continue
      }

      const p = await Product.findBy('id', pid)
      if (!p) {
        console.log(`⚠️ Produit ${pid} non trouvé, ignoré`)
        continue
      }

      const qty = item.quantity || 1
      const itemTotal = p.price * qty
      subtotal += itemTotal

      await OrderItem.create({
        order_id: order.id,
        product_id: p.id,
        product_name: p.name,
        price: p.price,
        quantity: qty,
        subtotal: itemTotal
      })

      console.log(`➕ ${p.name} x${qty} = ${itemTotal} FCFA`)
      await this.decrementStock(p.id, qty)
      count++
    }

    console.log(`💰 Sous-total: ${subtotal} FCFA | ${count} articles`)
    return { subtotal, count }
  }

  // ==================== MÉTHODE PRINCIPALE ====================
  async pay({ request, response }: HttpContext) {
    console.log('📱 ========== NOUVEAU PAIEMENT MOBILE MONEY ==========')
    console.log('🕐 Heure:', new Date().toISOString())

    try {
      const payload = request.only([
        'userId', 'customerAccountNumber', 'shippingAddress', 'deliveryMethod',
        'deliveryPrice', 'customerName', 'customerEmail', 'customerPhone', 'agent', 'items',
      ])

      console.log('📦 Payload reçu:', JSON.stringify(payload, null, 2))

      // Validation du numéro de téléphone
      const phoneNumber = payload.customerAccountNumber || payload.customerPhone
      if (!phoneNumber) {
        console.log('❌ Pas de numéro de téléphone')
        return response.status(400).json({
          success: false,
          message: 'Numéro de téléphone requis'
        })
      }

      console.log('📱 Numéro à traiter:', phoneNumber)

      // 1. Vérification stock
      const useCart = !!payload.userId && (!payload.items || payload.items.length === 0)
      console.log('🛒 Mode panier:', useCart)
      
      const stock = await this.checkStock(payload.items || [], useCart, payload.userId)
      if (!stock.ok) {
        console.log('❌ Échec vérification stock')
        return response.status(400).json({
          success: false,
          message: 'Stock insuffisant',
          errors: stock.errors
        })
      }

      // 2. KYC et détection opérateur
      console.log('🆔 Démarrage KYC...')
      const kyc = await this.performKYC(phoneNumber)
      console.log('📊 Résultat KYC:')
      console.log(`   Opérateur: ${kyc.operator}`)
      console.log(`   Code: ${kyc.operatorCode}`)
      console.log(`   Compte: ${kyc.accountCode}`)
      console.log(`   Nom: ${kyc.fullName}`)

      // 3. Renouveler le secret pour l'opérateur détecté
      await this.renewSecretIfNeeded(phoneNumber)

      // 4. User ID : si absent → créer un User
      let userId = payload.userId
      if (!userId) {
        console.log('👤 Création utilisateur nécessaire...')
        try {
          const newUser = await this.getOrCreateUser({
            customerName: payload.customerName || kyc.fullName,
            customerEmail: payload.customerEmail || '',
            customerPhone: phoneNumber,
          })
          userId = newUser.id
          console.log('✅ Utilisateur créé avec ID:', userId)
        } catch (error: any) {
          console.error('❌ Erreur création utilisateur:', error)
          return response.status(500).json({
            success: false,
            message: 'Erreur lors de la création du compte utilisateur',
            error: error.message
          })
        }
      } else {
        console.log('👤 Utilisation ID existant:', userId)
      }

      // 5. Création commande
      console.log('📝 Création de la commande...')
      const order = await Order.create({
        user_id: userId,
        order_number: generateOrderNumber(),
        status: 'pending',
        total: 0,
        subtotal: 0,
        shipping_cost: payload.deliveryPrice || 1,
        delivery_method: payload.deliveryMethod || 'standard',
        customer_name: payload.customerName || kyc.fullName,
        customer_phone: phoneNumber,
        payment_method: kyc.operator,
        customer_email: payload.customerEmail || 'invite@email.com',
        shipping_address: payload.shippingAddress || 'non renseigné',
        payment_operator_simple: kyc.operator
      })

      console.log('✅ Commande créée:', order.id, order.order_number)

      // 6. Items
      console.log('📦 Traitement des items...')
      const { subtotal, count } = await this.buildItems(
        order,
        payload.items || [],
        useCart,
        payload.userId
      )

      const total = subtotal + (payload.deliveryPrice || 1)
      order.subtotal = subtotal
      order.total = total
      await order.save()
      
      console.log(`💰 Commande mise à jour - Sous-total: ${subtotal}, Total: ${total}`)

      await OrderTracking.create({
        order_id: order.id,
        status: 'pending',
        description: `🛒 Commande initiée - ${kyc.operator} - ${count} articles`,
        tracked_at: DateTime.now(),
      })

      // 7. Paiement
      console.log('💳 ========== LANCEMENT PAIEMENT ==========')
      console.log('💳 Détails:')
      console.log(`   Opérateur: ${kyc.operator}`)
      console.log(`   Code opérateur: ${kyc.operatorCode}`)
      console.log(`   Compte marchand: ${kyc.accountCode}`)
      console.log(`   Numéro client: ${kyc.accountNumber}`)
      console.log(`   Montant: ${total}`)
      console.log(`   Nom client: ${kyc.fullName}`)

      let paymentResult;
      
      try {
        paymentResult = await MypvitTransactionService.processPayment({
          agent: payload.agent || 'AGENT_DEFAULT',
          amount: total,
          reference: `REF${Date.now()}`.substring(0, 15),
          callback_url_code: CALLBACK_URL_CODE,
          customer_account_number: kyc.accountNumber,
          merchant_operation_account_code: kyc.accountCode,
          owner_charge: 'CUSTOMER',
          operator_code: kyc.operatorCode,
        })

        console.log('✅ Réponse paiement reçue:')
        console.log(JSON.stringify(paymentResult, null, 2))
        
      } catch (paymentError: any) {
        console.error('❌ ERREUR PAIEMENT MYPVIT')
        console.error('❌ Message:', paymentError.message)
        console.error('❌ Type:', paymentError.constructor.name)
        
        if (paymentError.response) {
          console.error('❌ Status HTTP:', paymentError.response.status)
          console.error('❌ Données erreur:', JSON.stringify(paymentError.response.data, null, 2))
        }
        
        if (paymentError.stack) {
          console.error('❌ Stack trace:', paymentError.stack)
        }

        // Restaurer le stock
        await this.restoreStock(order.id)
        order.status = 'payment_failed'
        
        // Stocker les détails d'erreur dans le message
        const errorMessage = paymentError.message || 'Erreur de paiement'
        const errorDetails = paymentError.response?.data 
          ? ` | Détails: ${JSON.stringify(paymentError.response.data)}` 
          : ''
        order.payment_error_message = errorMessage + errorDetails
        await order.save()

        await OrderTracking.create({
          order_id: order.id,
          status: 'payment_failed',
          description: `❌ Échec paiement ${kyc.operator}: ${errorMessage}`,
          tracked_at: DateTime.now(),
        })

        return response.status(500).json({
          success: false,
          message: 'Erreur lors de l\'appel au service de paiement',
          error: paymentError.message,
          details: paymentError.response?.data || null,
          operator: kyc.operator,
          operatorCode: kyc.operatorCode
        })
      }

      // 8. Traitement selon résultat
      if (paymentResult && paymentResult.status !== 'FAILED' && paymentResult.reference_id) {
        // Paiement initié avec succès
        console.log('✅ Paiement initié avec succès')
        
        order.payment_reference_id = paymentResult.reference_id
        order.payment_operator_simple = kyc.operator
        order.payment_amount = total
        order.payment_initiated_at = DateTime.now()
        order.status = 'pending_payment'
        await order.save()

        await OrderTracking.create({
          order_id: order.id,
          status: 'pending_payment',
          description: `⏳ En attente de confirmation - ${kyc.operator} - Réf: ${paymentResult.reference_id}`,
          tracked_at: DateTime.now(),
        })

        await order.load('items')

        const responseData = {
          success: true,
          message: '⏳ Vérifiez votre téléphone pour confirmer le paiement',
          data: {
            orderId: order.id,
            orderNumber: order.order_number,
            total: order.total,
            status: 'pending_payment',
            customerName: order.customer_name,
            paymentMethod: kyc.operator,
            itemsCount: count,
            userId,
            operator: {
              name: kyc.operator,
              code: kyc.operatorCode,
              accountCode: kyc.accountCode
            },
            payment: {
              reference_id: paymentResult.reference_id,
              status: 'PENDING'
            },
          },
        }

        console.log('📤 Réponse envoyée au client:')
        console.log(JSON.stringify(responseData, null, 2))

        return response.status(201).json(responseData)
        
      } else {
        // Échec du paiement
        console.log('❌ Paiement échoué')
        console.log('📊 Détails échec:', paymentResult)
        
        await this.restoreStock(order.id)
        order.status = 'payment_failed'
        order.payment_error_message = paymentResult?.message || 'Erreur inconnue'
        await order.save()

        await OrderTracking.create({
          order_id: order.id,
          status: 'payment_failed',
          description: `❌ Échec paiement ${kyc.operator}: ${paymentResult?.message || 'Erreur inconnue'}`,
          tracked_at: DateTime.now(),
        })

        return response.status(400).json({
          success: false,
          message: 'Paiement échoué',
          error: paymentResult?.message || 'Erreur inconnue',
          operator: kyc.operator,
          operatorCode: kyc.operatorCode,
          details: paymentResult
        })
      }
      
    } catch (error: any) {
      console.error('🔴 ========== ERREUR GÉNÉRALE ==========')
      console.error('🔴 Message:', error.message)
      console.error('🔴 Type:', error.constructor.name)
      console.error('🔴 Stack:', error.stack)
      
      return response.status(500).json({
        success: false,
        message: 'Erreur interne lors du paiement',
        error: error.message,
        type: error.constructor.name
      })
    }
  }
}
