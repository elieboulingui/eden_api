// app/controllers/SubscriptionQRController.ts - POUR SUBSCRIPTION AVEC MONTANT DU FRONT
import type { HttpContext } from '@adonisjs/core/http'
import Subscription from '#models/Subscription'
import User from '#models/user'
import { DateTime } from 'luxon'
import crypto from 'node:crypto'
import MypvitSecretService from '../services/mypvit_secret_service.js'
import MypvitQRCodeService from '../services/mypvit_qrcode_service.js'

const CALLBACK_URL_CODE = '9ZOXW'

function generateSubscriptionNumber(): string {
  return `SUB-${Date.now()}-${Math.floor(Math.random() * 1000)}`
}

function generateRandomPassword(): string {
  return crypto.randomBytes(16).toString('hex')
}

// Plans d'abonnement avec leurs caractéristiques
const SUBSCRIPTION_PLANS = {
  daily: { name: 'Journalier', duration: 1, boostMultiplier: 2, maxProducts: 1 },
  weekly: { name: 'Hebdomadaire', duration: 7, boostMultiplier: 3, maxProducts: 5 },
  biweekly: { name: '2 Semaines', duration: 14, boostMultiplier: 4, maxProducts: 15 },
  monthly: { name: 'Mensuel', duration: 30, boostMultiplier: 5, maxProducts: 999999 }
}

export default class SubscriptionQRController {

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
      console.log('⚠️ Pas de numéro, utilisation MOOV par défaut')
      return {
        name: 'MOOV_MONEY',
        code: 'MOOV_MONEY',
        accountCode: 'ACC_69EFB143D4F54'
      }
    }

    console.log('🔍 Détection opérateur QR pour:', phoneNumber)
    
    const clean = phoneNumber.replace(/[\s\+\.\-]/g, '')
    let local = clean
    
    if (clean.startsWith('+241')) local = clean.substring(4)
    else if (clean.startsWith('241')) local = clean.substring(3)
    
    if (local.startsWith('0')) local = local.substring(1)
    
    console.log('📱 Numéro nettoyé:', local)

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
    
    console.log('⚠️ Opérateur non reconnu, utilisation MOOV par défaut')
    return {
      name: 'MOOV_MONEY',
      code: 'MOOV_MONEY',
      accountCode: 'ACC_69EFB143D4F54'
    }
  }

  private async getOrCreateUser(payload: {
    customerName: string
    customerEmail: string
    customerPhone: string
  }): Promise<User> {
    const email = payload.customerEmail || `sub_${Date.now()}@guest.com`
    const phone = payload.customerPhone || ''
    const fullName = payload.customerName || 'Client'

    console.log('👤 Recherche/Création utilisateur abonnement:', { email, phone })

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
        role: 'marchant',
        password: generateRandomPassword(),
      })
      console.log('✅ Nouveau marchand créé:', user.id, '|', user.email, '|', user.full_name)
    }

    return user
  }

  // ==================== SOUSCRIPTION PAR QR CODE ====================
  async generateQR({ request, response }: HttpContext) {
    console.log('📷 ========== NOUVELLE SOUSCRIPTION QR CODE ==========')
    console.log('🕐 Heure:', new Date().toISOString())

    try {
      // ✅ Récupération du payload avec le montant du front
      const payload = request.only([
        'userId',
        'plan',
        'amount',           // ✅ MONTANT VIENT DU FRONT
        'customerAccountNumber',
        'customerName',
        'customerEmail',
        'customerPhone',
        'selectedProducts',  // Liste des produits à booster
      ])

      console.log('📦 Payload QR reçu:', JSON.stringify(payload, null, 2))

      const planData = SUBSCRIPTION_PLANS[payload.plan as keyof typeof SUBSCRIPTION_PLANS]
      if (!planData) {
        console.log('❌ Plan invalide:', payload.plan)
        return response.status(400).json({
          success: false,
          message: 'Plan d\'abonnement invalide',
        })
      }

      // ✅ UTILISATION DU MONTANT ENVOYÉ PAR LE FRONT
      const amount = payload.amount
      if (!amount || amount <= 0) {
        console.log('❌ Montant invalide:', amount)
        return response.status(400).json({
          success: false,
          message: 'Montant invalide',
        })
      }

      const phoneNumber = payload.customerAccountNumber || payload.customerPhone
      const isGuest = payload.userId === 'guest' || !payload.userId

      console.log(`💳 Plan: ${payload.plan} (${planData.name})`)
      console.log(`💰 Montant du front: ${amount} FCFA`)
      console.log(`👤 Mode: ${isGuest ? 'INVITÉ' : 'CONNECTÉ'}`)
      console.log(`📱 Téléphone: ${phoneNumber || 'N/A'}`)
      console.log(`📦 Produits à booster: ${payload.selectedProducts?.length || 0}`)

      const operatorInfo = this.detectOperatorGabon(phoneNumber)
      console.log('📡 Opérateur QR détecté:', operatorInfo.name)

      await this.renewSecretIfNeeded(phoneNumber)

      let userId = payload.userId

      if (isGuest || !userId) {
        console.log('👤 Création utilisateur pour abonnement...')
        try {
          const newUser = await this.getOrCreateUser({
            customerName: payload.customerName || 'Client',
            customerEmail: payload.customerEmail || '',
            customerPhone: phoneNumber || '',
          })
          userId = newUser.id
          console.log('✅ Utilisateur créé:', userId)
        } catch (error: any) {
          console.error('❌ Erreur création utilisateur:', error)
          return response.status(500).json({
            success: false,
            message: 'Erreur lors de la création du compte',
            error: error.message
          })
        }
      }

      const subscriptionNumber = generateSubscriptionNumber()
      const startDate = DateTime.now()
      const endDate = startDate.plus({ days: planData.duration })

      console.log('📝 Création de l\'abonnement...')
      
      // Création de l'abonnement
      const subscription = await Subscription.create({
        id: crypto.randomUUID(),
        user_id: userId,
        subscription_number: subscriptionNumber,
        plan: payload.plan,
        plan_name: planData.name,
        status: 'pending_payment',
        amount: amount,
        start_date: startDate.toSQL(),
        end_date: endDate.toSQL(),
        boost_multiplier: planData.boostMultiplier,
        max_products: planData.maxProducts,
        payment_method: `qr_code_${operatorInfo.name.toLowerCase()}`,
        payment_operator_simple: operatorInfo.name,
        customer_phone: phoneNumber || '',
        customer_name: payload.customerName || 'Client',
        customer_email: payload.customerEmail || '',
      })

      console.log('✅ Abonnement créé:', subscription.id, subscription.subscription_number)
      console.log(`💰 Montant: ${subscription.amount} FCFA`)

      // Sauvegarde des produits à booster
      if (payload.selectedProducts && payload.selectedProducts.length > 0) {
        // @ts-ignore - Relation to be defined
        await subscription.related('products').attach(payload.selectedProducts.map((pid: string) => ({
          id: crypto.randomUUID(),
          product_id: pid,
          subscription_id: subscription.id,
          created_at: DateTime.now()
        })))
        console.log(`✅ ${payload.selectedProducts.length} produit(s) lié(s) à l'abonnement`)
      }

      const terminalId = `SUB${Date.now().toString(36).toUpperCase()}${operatorInfo.code.substring(0, 3)}`

      console.log('🔑 ========== GÉNÉRATION QR CODE ==========')
      console.log(`📡 Opérateur: ${operatorInfo.name}`)
      console.log(`💰 Montant: ${amount}`)
      console.log(`📱 Téléphone: ${phoneNumber || 'non fourni'}`)

      try {
        console.log('🔐 Renouvellement du secret avant QR Code...')
        try {
          const freshSecret = await MypvitSecretService.forceRenewal(phoneNumber)
          console.log('✅ Secret frais obtenu')
          await new Promise(resolve => setTimeout(resolve, 1000))
        } catch (secretError: any) {
          console.error('⚠️ Erreur renouvellement secret:', secretError.message)
        }

        const qrResult = await MypvitQRCodeService.generateQRCode({
          accountOperationCode: operatorInfo.accountCode,
          terminalId: terminalId,
          callbackUrlCode: CALLBACK_URL_CODE,
          amount: amount,
          reference: subscription.subscription_number,
          phoneNumber: phoneNumber
        })

        console.log('✅ QR Code généré avec succès')

        if (qrResult.reference_id) {
          subscription.payment_reference_id = qrResult.reference_id
          subscription.payment_operator_simple = operatorInfo.name
          await subscription.save()
          console.log('✅ Référence paiement sauvegardée:', qrResult.reference_id)
        }

        const responseData = {
          success: true,
          message: `✅ QR Code ${operatorInfo.name} généré ! Scannez pour payer votre abonnement.`,
          data: {
            subscriptionId: subscription.id,
            subscriptionNumber: subscription.subscription_number,
            plan: payload.plan,
            planName: planData.name,
            amount: amount,
            duration: planData.duration,
            boostMultiplier: planData.boostMultiplier,
            maxProducts: planData.maxProducts,
            status: 'pending_payment',
            customerName: subscription.customer_name,
            paymentMethod: `qr_code_${operatorInfo.name.toLowerCase()}`,
            operator: {
              name: operatorInfo.name,
              code: operatorInfo.code,
              accountCode: operatorInfo.accountCode
            },
            qr_code: {
              data: qrResult.data,
              reference_id: qrResult.reference_id || subscription.subscription_number,
              amount: amount,
              expires_in: 600,
            },
          },
        }

        console.log('📤 Réponse QR envoyée au client')
        return response.status(201).json(responseData)
        
      } catch (qrError: any) {
        console.error('❌ ERREUR GÉNÉRATION QR CODE')
        console.error('❌ Message:', qrError.message)
        
        if (qrError.response) {
          console.error('❌ Status HTTP:', qrError.response.status)
          console.error('❌ Données erreur:', JSON.stringify(qrError.response.data, null, 2))
        }

        subscription.status = 'payment_failed'
        subscription.payment_error_message = qrError.message || 'Erreur génération QR'
        await subscription.save()

        return response.status(500).json({
          success: false,
          message: 'Erreur lors de la génération du QR Code',
          error: qrError.message,
          operator: operatorInfo.name
        })
      }

    } catch (error: any) {
      console.error('🔴 ========== ERREUR GÉNÉRALE ==========')
      console.error('🔴 Message:', error.message)
      console.error('🔴 Stack:', error.stack)
      
      return response.status(500).json({
        success: false,
        message: 'Erreur interne',
        error: error.message,
      })
    }
  }

  // ==================== VÉRIFICATION STATUT PAIEMENT ====================
  async checkPaymentStatus({ params, response }: HttpContext) {
    try {
      const subscriptionId = params.subscriptionId
      
      const subscription = await Subscription.find(subscriptionId)
      
      if (!subscription) {
        return response.status(404).json({
          success: false,
          message: 'Abonnement non trouvé'
        })
      }

      return response.json({
        success: true,
        data: {
          subscriptionId: subscription.id,
          subscriptionNumber: subscription.subscription_number,
          status: subscription.status,
          amount: subscription.amount,
          plan: subscription.plan,
          planName: subscription.plan_name,
          paymentReferenceId: subscription.payment_reference_id
        }
      })
    } catch (error: any) {
      console.error('❌ Erreur vérification statut:', error)
      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la vérification',
        error: error.message
      })
    }
  }
}
