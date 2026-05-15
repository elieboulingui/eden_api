// app/controllers/PayQRCodeController.ts
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
import MypvitSecretService from '../services/mypvit_secret_services.js'
import MypvitQRCodeService from '../services/mypvit_qrcode_service.js'
import PvitStatusService from '../services/pvit_status_service.js'
import crypto from 'node:crypto'

const CALLBACK_URL_CODE = '9ZOXW'
const GIMAC_ACCOUNT = 'ACC_69FE0E1BC34B4'
const ADMIN_COMMISSION_RATE = 0.03 // 3% pour l'admin

export default class PayQRCodeController {

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

  async pay({ request, response }: HttpContext) {
    console.log('📷 ========== PAIEMENT QR CODE GIMAC ==========')
    
    try {
      const rawBody = request.body() as Record<string, any>
      console.log('📦 BODY OK')

      const userId = rawBody.userId
      console.log('👤 userId:', userId)

      if (!userId) {
        return response.status(400).json({ success: false, message: 'userId requis' })
      }

      // ÉTAPE 1 : Cart
      console.log('🛒 ÉTAPE 1: Recherche Cart...')
      const cart = await Cart.query().where('user_id', userId).preload('items').first()
      console.log('🛒 Cart trouvé:', cart ? 'OUI' : 'NON')

      if (!cart || !cart.items || cart.items.length === 0) {
        return response.status(400).json({ success: false, message: 'Panier vide' })
      }

      const cartItems = cart.items.map(item => ({
        product_id: item.product_id,
        quantity: item.quantity,
      }))
      console.log('🛒 Items:', cartItems.length)

      // ÉTAPE 2 : Produits (avec regroupement par marchand)
      let subtotal = 0
      const validProducts: { product: Product; quantity: number }[] = []
      const merchantIds = new Set<string>()
      const merchantProducts = new Map<string, { productId: string; productName: string; price: number; quantity: number; subtotal: number }[]>()

      for (const cartItem of cartItems) {
        console.log('🔍 Produit:', cartItem.product_id)
        const product = await Product.find(cartItem.product_id)
        console.log('🔍 Trouvé:', product ? product.name : 'NON')
        
        if (!product) {
          return response.status(400).json({
            success: false,
            message: `Produit ${cartItem.product_id} introuvable`
          })
        }

        const itemTotal = product.price * cartItem.quantity
        subtotal += itemTotal
        validProducts.push({ product, quantity: cartItem.quantity })
        
        // 🆕 Regrouper par marchand
        merchantIds.add(product.user_id)
        if (!merchantProducts.has(product.user_id)) {
          merchantProducts.set(product.user_id, [])
        }
        merchantProducts.get(product.user_id)!.push({
          productId: product.id,
          productName: product.name,
          price: product.price,
          quantity: cartItem.quantity,
          subtotal: itemTotal
        })
      }

      console.log('💰 Sous-total:', subtotal)
      console.log('🏪 Marchands:', Array.from(merchantIds))

      const deliveryPrice = rawBody.deliveryPrice || 0
      const total = subtotal + deliveryPrice

      // ÉTAPE 3 : Commande
      console.log('📝 ÉTAPE 3: Création commande...')
      const order = await Order.create({
        user_id: userId,
        order_number: `CMD-${Date.now()}`,
        status: 'pending',
        total: total,
        subtotal,
        shipping_cost: deliveryPrice,
        delivery_method: rawBody.deliveryMethod || 'pickup',
        customer_name: rawBody.customerName || 'Client',
        customer_phone: rawBody.customerPhone || rawBody.customerAccountNumber || '060000000',
        payment_method: 'qr_code_gimac',
        customer_email: rawBody.customerEmail || 'invite@email.com',
        shipping_address: rawBody.shippingAddress || 'Retrait en magasin',
        payment_operator_simple: 'GIMAC'
      })
      console.log('📝 Commande:', order.id)

      // ÉTAPE 4 : OrderItems
      console.log('📦 ÉTAPE 4: OrderItems...')
      for (const item of validProducts) {
        await OrderItem.create({
          order_id: order.id,
          product_id: item.product.id,
          product_name: item.product.name,
          price: item.product.price,
          quantity: item.quantity,
          subtotal: item.product.price * item.quantity
        })
      }
      console.log('📦 OrderItems OK')

      // ============================================================
      // 🆕 DISTRIBUTION DE L'ARGENT
      // ============================================================
      
      // Commission admin (3% du total)
      const adminCommission = total * ADMIN_COMMISSION_RATE
      console.log(`\n💼 ===== DISTRIBUTION FINANCIÈRE =====`)
      console.log(`📊 Total commande: ${total} XAF`)
      console.log(`📦 Sous-total produits: ${subtotal} XAF`)
      console.log(`🚚 Frais livraison: ${deliveryPrice} XAF`)
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
      if (deliveryPrice > 0) {
        console.log(`\n🚚 FRAIS DE LIVRAISON: ${deliveryPrice} XAF`)
        
        let needEdenLivreur = false
        
        for (const merchantId of merchantIds) {
          const merchant = await User.findBy('id', merchantId)
          
          if (merchant) {
            console.log(`  👤 ${merchant.full_name} | has_livreur: ${merchant.has_livreur}`)
            
            if (merchant.has_livreur) {
              // ✅ Le marchand a son propre livreur → lui envoyer les frais
              const deliveryShare = deliveryPrice / merchantIds.size
              console.log(`  ✅ Livreur personnel → +${deliveryShare} XAF`)
              await this.creditWallet(merchant.id, deliveryShare, `Frais livraison (livreur personnel) - Commande #${order.order_number}`)
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
          await this.creditWallet(edenLivreur.id, deliveryPrice, `Frais livraison - Commande #${order.order_number}`)
          
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

      // ÉTAPE 5 : Tracking (pending)
      console.log('📊 ÉTAPE 5: Tracking...')
      await OrderTracking.create({
        order_id: order.id,
        status: 'pending',
        description: `QR Code GIMAC - ${validProducts.length} articles`,
        tracked_at: DateTime.now(),
      })
      console.log('📊 Tracking OK')

      // ÉTAPE 6 : QR Code GIMAC (avant de vider le panier)
      console.log('🔑 ÉTAPE 6: QR Code GIMAC...')
      
      await MypvitSecretService.forceRenewal()
      
      const qrResult = await MypvitQRCodeService.generateQRCode({
        accountOperationCode: GIMAC_ACCOUNT,
        terminalId: `T${Date.now().toString(36).toUpperCase()}`,
        callbackUrlCode: CALLBACK_URL_CODE,
        amount: subtotal,
        reference: order.order_number,
        phoneNumber: rawBody.customerPhone || '060000000',
        returnAsImage: true
      })
      
      console.log('🔑 QR Code généré')
      console.log('🔑 QR Result COMPLET:', JSON.stringify(qrResult, null, 2))
      console.log('🔑 Reference ID:', qrResult.reference_id)
      console.log('🔑 Merchant Reference ID:', qrResult.merchant_reference_id)

      // ÉTAPE 7 : Sauvegarder la référence
      if (qrResult.reference_id) {
        order.payment_reference_id = qrResult.reference_id
        order.status = 'pending_payment'
        await order.save()
        console.log('💾 Référence sauvegardée:', qrResult.reference_id)
      }

      await OrderTracking.create({
        order_id: order.id,
        status: 'pending_payment',
        description: `QR Code GIMAC - Réf: ${qrResult.reference_id || order.order_number}`,
        tracked_at: DateTime.now(),
      })

      await order.load('items')

      // ✅ ÉTAPE 8 : VIDER LE PANIER
      console.log('🗑️ ÉTAPE 8: Vidage panier...')
      await CartItem.query().where('cart_id', cart.id).delete()
      console.log('🗑️ Panier vidé avec succès')

      // ✅ ÉTAPE 9 : RÉCUPÉRER LE X-SECRET
      console.log('🔑 Récupération du X-Secret...')
      const xSecret = await MypvitSecretService.getSecret()
      console.log('   X-Secret:', xSecret.substring(0, 15) + '...')

      // ✅ ÉTAPE 10 : VÉRIFICATION DU STATUT
      console.log('🔍 ÉTAPE 10: Vérification statut...')
      
      let paymentStatus = null
      
      if (qrResult.reference_id) {
        try {
          const statusResult = await PvitStatusService.checkStatus(
            xSecret,
            qrResult.reference_id,
            GIMAC_ACCOUNT
          )
          
          paymentStatus = {
            checked: true,
            status: statusResult.status,
            data: statusResult.data || null
          }
          
          if (statusResult.status === 'SUCCESS') {
            order.status = 'paid'
            order.payment_completed_at = DateTime.now()
            order.payment_amount = statusResult.data?.amount ?? null
            await order.save()
            
            await OrderTracking.create({
              order_id: order.id,
              status: 'paid',
              description: `✅ Paiement immédiat - GIMAC - ${statusResult.data?.amount ?? 0} FCFA`,
              tracked_at: DateTime.now()
            })
          }
          
        } catch (statusError) {
          console.log('⚠️ Erreur vérification statut:', statusError instanceof Error ? statusError.message : 'Erreur inconnue')
          paymentStatus = {
            checked: false,
            error: statusError instanceof Error ? statusError.message : 'Erreur inconnue'
          }
        }
      }

      // ✅ RÉPONSE
      return response.status(201).json({
        success: true,
        message: '✅ QR Code GIMAC généré !',
        data: {
          orderId: order.id,
          orderNumber: order.order_number,
          total: total,
          subtotal: subtotal,
          shippingCost: deliveryPrice,
          adminCommission: adminCommission,
          status: order.status,
          itemsCount: validProducts.length,
          
          operator: {
            name: 'GIMAC',
            code: 'GIMAC_PAY',
            accountCode: GIMAC_ACCOUNT
          },
          
          x_secret: xSecret,
          
          pvit_reference_id: qrResult.reference_id,
          merchant_reference_id: qrResult.merchant_reference_id,
          
          qr_code: {
            data: qrResult.data,
            format: qrResult.format,
            reference_id: qrResult.reference_id,
            merchant_reference_id: qrResult.merchant_reference_id,
            amount: subtotal,
            expires_in: 600,
            mime_type: 'image/png'
          },
          
          payment_status: paymentStatus
        }
      })

    } catch (error) {
      console.error('🔴 ERREUR:', error instanceof Error ? error.message : 'Erreur inconnue')
      
      return response.status(500).json({
        success: false,
        message: 'Erreur: ' + (error instanceof Error ? error.message : 'Erreur inconnue'),
        error: error instanceof Error ? error.message : 'Erreur inconnue'
      })
    }
  }
}
