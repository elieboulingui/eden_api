// app/controllers/new_account_controller.ts
import User from '#models/user'
import Wallet from '#models/wallet'
import type { HttpContext } from '@adonisjs/core/http'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'linemarket'

// ✅ Liste des colonnes autorisées dans la table users
const ALLOWED_USER_FIELDS = [
  // Champs de base
  'full_name', 'email', 'password', 'role', 'phone', 'address',
  'country', 'neighborhood', 'avatar',
  
  // Infos personnelles
  'birth_date', 'id_number', 'id_front_url', 'id_back_url',
  'selfie_url', 'personal_phone', 'residence_address',
  'is_phone_verified', 'is_email_verified',
  
  // Infos entreprise (colonnes existantes)
  'commercial_name', 'shop_name', 'shop_description', 'vendor_type',
  'whatsapp_phone', 'is_whatsapp_verified', 'shop_address',
  'rccm_number', 'rccm_document_url', 'nif_number',
  
  // Paiement
  'payment_method', 'airtel_number', 'moov_number',
  'account_holder_name', 'bank_name', 'rib_document_url',
  
  // Boutique physique
  'shop_latitude', 'shop_longitude',
  'facade_photo1_url', 'facade_photo2_url',
  'interior_photo1_url', 'interior_photo2_url',
  'seeg_or_lease_url',
  
  // Vendeur en ligne
  'stock_address', 'address_proof_url',
  'facebook_url', 'instagram_url', 'tiktok_url', 'stock_video_url',
  
  // Autres
  'logo_url', 'cover_photo_url',
  'signature', 'certify_truth', 'accept_escrow',
  
  // Statuts
  'verification_status', 'is_verified',
]

export default class NewAccountController {
  async store({ request, response }: HttpContext) {
    console.log('🟢 [NewAccountController] ===== DÉBUT INSCRIPTION =====')

    try {
      const rawData = request.body()
      
      console.log('📥 [NewAccountController] Données brutes reçues:')
      console.log(JSON.stringify(rawData, null, 2))

      // Vérifier email si présent
      if (rawData.email) {
        const existingUser = await User.findBy('email', rawData.email)
        if (existingUser) {
          console.log('❌ [NewAccountController] Email déjà utilisé')
          return response.status(400).json({
            success: false,
            message: 'Cet email est déjà utilisé',
          })
        }
      }

      // Déterminer le rôle
      let role = 'client'
      if (rawData.role) {
        const lowerRole = rawData.role.toLowerCase()
        if (lowerRole === 'merchant' || lowerRole === 'marchant' || lowerRole === 'marchand') {
          role = 'merchant'
        } else if (lowerRole === 'admin') {
          role = 'admin'
        }
      }

      const isMerchant = role === 'merchant'

      // ✅ Filtrer et mapper les champs
      const userData: Record<string, any> = {}
      
      // Mappage des champs du frontend vers les colonnes de la table
      const fieldMappings: Record<string, string | string[]> = {
        // Champs directs (même nom)
        full_name: 'full_name',
        email: 'email',
        password: 'password',
        role: 'role',
        country: 'country',
        neighborhood: 'neighborhood',
        avatar: 'avatar',
        birth_date: 'birth_date',
        id_number: 'id_number',
        id_front_url: 'id_front_url',
        id_back_url: 'id_back_url',
        selfie_url: 'selfie_url',
        personal_phone: 'personal_phone',
        residence_address: 'residence_address',
        is_phone_verified: 'is_phone_verified',
        is_email_verified: 'is_email_verified',
        signature: 'signature',
        certify_truth: 'certify_truth',
        accept_escrow: 'accept_escrow',
        
        // Mappages avec synonymes
        phone: ['phone', 'personal_phone'],
        address: ['address', 'residence_address'],
        
        // Entreprise
        commercial_name: ['commercial_name', 'company_name', 'shop_name'],
        shop_name: ['shop_name', 'company_name'],
        shop_description: ['shop_description', 'products_sold'],
        vendor_type: 'vendor_type',
        whatsapp_phone: ['whatsapp_phone', 'company_phone'],
        is_whatsapp_verified: 'is_whatsapp_verified',
        shop_address: ['shop_address', 'business_address'],
        rccm_number: 'rccm_number',
        rccm_document_url: ['rccm_document_url', 'business_document_url'],
        nif_number: 'nif_number',
        
        // Paiement
        payment_method: 'payment_method',
        airtel_number: 'airtel_number',
        moov_number: 'moov_number',
        account_holder_name: 'account_holder_name',
        bank_name: 'bank_name',
        rib_document_url: 'rib_document_url',
        
        // Boutique physique
        shop_latitude: 'shop_latitude',
        shop_longitude: 'shop_longitude',
        facade_photo1_url: 'facade_photo1_url',
        facade_photo2_url: 'facade_photo2_url',
        interior_photo1_url: 'interior_photo1_url',
        interior_photo2_url: 'interior_photo2_url',
        seeg_or_lease_url: 'seeg_or_lease_url',
        
        // Vendeur en ligne
        stock_address: 'stock_address',
        address_proof_url: 'address_proof_url',
        facebook_url: 'facebook_url',
        instagram_url: 'instagram_url',
        tiktok_url: 'tiktok_url',
        stock_video_url: 'stock_video_url',
        
        // Autres
        logo_url: 'logo_url',
        cover_photo_url: 'cover_photo_url',
        
        // Statuts
        verification_status: 'verification_status',
        is_verified: 'is_verified',
      }

      // Construire userData en filtrant
      for (const [frontendKey, dbKey] of Object.entries(fieldMappings)) {
        if (Array.isArray(dbKey)) {
          // Chercher la première source disponible
          for (const source of dbKey) {
            if (rawData[source] !== undefined && rawData[source] !== null && rawData[source] !== '') {
              if (ALLOWED_USER_FIELDS.includes(frontendKey)) {
                userData[frontendKey] = rawData[source]
              }
              break
            }
          }
        } else {
          if (rawData[frontendKey] !== undefined && rawData[frontendKey] !== null && rawData[frontendKey] !== '') {
            if (ALLOWED_USER_FIELDS.includes(dbKey)) {
              userData[dbKey] = rawData[frontendKey]
            }
          }
        }
      }

      // ✅ Ajouter les champs supplémentaires qui sont dans ALLOWED_USER_FIELDS
      for (const key in rawData) {
        if (ALLOWED_USER_FIELDS.includes(key) && !(key in userData)) {
          const value = rawData[key]
          if (value !== undefined && value !== null && value !== '') {
            userData[key] = value
          }
        }
      }

      // Log des champs filtrés
      console.log('✅ [NewAccountController] Champs filtrés pour la DB:')
      console.log('  - Nombre de champs:', Object.keys(userData).length)
      console.log('  - Champs:', Object.keys(userData).join(', '))

      // Statut marchand
      if (isMerchant) {
        if (!userData.verification_status) {
          userData.verification_status = 'pending'
        }
        if (userData.is_verified === undefined) {
          userData.is_verified = false
        }
        console.log('🏪 [NewAccountController] Compte marchand - statut:', userData.verification_status)
      }

      // S'assurer que les champs requis sont présents
      if (!userData.full_name) {
        userData.full_name = 'Utilisateur'
        console.log('⚠️ [NewAccountController] full_name manquant, valeur par défaut utilisée')
      }
      if (!userData.email) {
        return response.status(400).json({
          success: false,
          message: 'Email requis',
        })
      }
      if (!userData.password) {
        return response.status(400).json({
          success: false,
          message: 'Mot de passe requis',
        })
      }

      console.log('💾 [NewAccountController] Création utilisateur dans la DB...')
      console.log('📋 Données finales:', JSON.stringify(userData, null, 2))

      // ✅ Créer l'utilisateur (seulement avec les champs autorisés)
      const user = await User.create(userData)

      console.log('✅ [NewAccountController] Utilisateur créé avec succès!')
      console.log('  - ID:', user.id)
      console.log('  - Nom:', user.full_name)
      console.log('  - Email:', user.email)
      console.log('  - Rôle:', user.role)

      // Créer wallet si marchand
      let wallet = null
      if (isMerchant) {
        try {
          wallet = await Wallet.create({
            user_id: user.id,
            balance: 0,
            currency: 'XAF',
            status: 'active',
          })
          console.log('💰 [NewAccountController] Wallet créé pour le marchand')
        } catch (walletError: unknown) {
          const error = walletError as Error
          console.error('⚠️ [NewAccountController] Erreur création wallet:', error.message)
        }
      }

      // Générer JWT
      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: '7d' }
      )

      console.log('🟢 [NewAccountController] ===== FIN INSCRIPTION =====')

      return response.status(201).json({
        success: true,
        message: 'Inscription réussie',
        user: {
          id: user.id,
          full_name: user.full_name,
          email: user.email,
          role: user.role,
          verification_status: user.verification_status,
        },
        token,
        ...(wallet && { wallet: { id: wallet.id, balance: wallet.balance, currency: wallet.currency } }),
      })

    } catch (error: unknown) {
      const err = error as any
      console.error('💥 [NewAccountController] ERREUR:', err.message)
      console.error('💥 Stack:', err.stack)

      // Message d'erreur plus explicite
      let errorMessage = err.message
      if (err.message?.includes('Cannot define')) {
        const fieldName = err.message.match(/"(\w+)"/)?.[1] || 'inconnu'
        errorMessage = `Le champ "${fieldName}" n'existe pas dans la base de données. Contactez l'administrateur.`
        console.error(`🗄️ Champ invalide détecté: ${fieldName}`)
      }

      return response.status(400).json({
        success: false,
        message: 'Erreur lors de l\'inscription',
        error: errorMessage,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
      })
    }
  }
}
