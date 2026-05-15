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
  
  // Infos entreprise (marchand)
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
  
  // Références
  'reference_1_name', 'reference_1_phone',
  'reference_2_name', 'reference_2_phone',
  
  // Autres
  'logo_url', 'cover_photo_url',
  'signature', 'certify_truth', 'accept_escrow',
  
  // Statuts
  'verification_status', 'is_verified',

  // Partenaire (marchand uniquement)
  'partner_code',

  // 🆕 CHAMPS LIVREUR
  'vehicle_type', 'license_number', 'license_document_url',
  'vehicle_document_url', 'availability',
  'is_available', 'is_online',
  'current_latitude', 'current_longitude',
  'total_deliveries', 'total_earnings', 'rating', 'total_ratings',
  'has_livreur', // 🆕 AJOUT
]

export default class NewAccountController {
  async store({ request, response }: HttpContext) {
    console.log('🟢 [NewAccountController] ===== DÉBUT INSCRIPTION =====')

    try {
      const rawData = request.body()
      
      console.log('📥 [NewAccountController] Données brutes reçues:')
      console.log('  - email:', rawData.email)
      console.log('  - role:', rawData.role)
      console.log('  - partner_code:', rawData.partner_code || 'null (non défini)')
      console.log('  - has_livreur:', rawData.has_livreur) // 🆕 LOG

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
        } else if (lowerRole === 'livreur' || lowerRole === 'livreur') {
          role = 'livreur'
        } else if (lowerRole === 'admin') {
          role = 'admin'
        }
      }

      const isMerchant = role === 'merchant'
      const isLivreur = role === 'livreur'

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
        
        // Références
        reference_1_name: 'reference_1_name',
        reference_1_phone: 'reference_1_phone',
        reference_2_name: 'reference_2_name',
        reference_2_phone: 'reference_2_phone',
        
        // Autres
        logo_url: 'logo_url',
        cover_photo_url: 'cover_photo_url',
        
        // Statuts
        verification_status: 'verification_status',
        is_verified: 'is_verified',

        // 🆕 Champs livreur
        vehicle_type: 'vehicle_type',
        license_number: 'license_number',
        license_document_url: 'license_document_url',
        vehicle_document_url: 'vehicle_document_url',
        availability: 'availability',
        is_available: 'is_available',
        is_online: 'is_online',
        current_latitude: 'current_latitude',
        current_longitude: 'current_longitude',
        total_deliveries: 'total_deliveries',
        total_earnings: 'total_earnings',
        rating: 'rating',
        total_ratings: 'total_ratings',
        has_livreur: 'has_livreur', // 🆕 AJOUT
      }

      // Construire userData en filtrant
      for (const [frontendKey, dbKey] of Object.entries(fieldMappings)) {
        if (Array.isArray(dbKey)) {
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

      // ✅ PARTNER_CODE : uniquement pour les marchands
      if (isMerchant) {
        if (rawData.partner_code) {
          userData.partner_code = rawData.partner_code
          console.log('🔗 [NewAccountController] Marchand partenaire:', rawData.partner_code)
        } else {
          userData.partner_code = 'eden_client_nathjosh'
          console.log('🏪 [NewAccountController] Marchand normal → eden_client_nathjosh')
        }
      } else {
        userData.partner_code = null
        console.log('👤 [NewAccountController] Ni marchand → pas de partner_code')
      }

      // 🆕 STATUT LIVREUR
      if (isLivreur) {
        if (!userData.verification_status) {
          userData.verification_status = 'pending'
        }
        if (userData.is_verified === undefined) {
          userData.is_verified = false
        }
        if (userData.is_available === undefined) {
          userData.is_available = true
        }
        if (userData.is_online === undefined) {
          userData.is_online = false
        }
        if (userData.total_deliveries === undefined) {
          userData.total_deliveries = 0
        }
        if (userData.total_earnings === undefined) {
          userData.total_earnings = 0
        }
        if (userData.rating === undefined) {
          userData.rating = 0
        }
        if (userData.total_ratings === undefined) {
          userData.total_ratings = 0
        }
        // 🆕 Valeur par défaut pour has_livreur
        if (userData.has_livreur === undefined) {
          userData.has_livreur = false
        }
        console.log('🛵 [NewAccountController] Compte livreur - statut:', userData.verification_status)
        console.log('  - Véhicule:', userData.vehicle_type || 'Non défini')
        console.log('  - Disponibilité:', userData.availability || 'Non défini')
        console.log('  - has_livreur:', userData.has_livreur) // 🆕 LOG
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

      // ✅ Créer l'utilisateur
      const user = await User.create(userData)

      console.log('✅ [NewAccountController] Utilisateur créé avec succès!')
      console.log('  - ID:', user.id)
      console.log('  - Nom:', user.full_name)
      console.log('  - Email:', user.email)
      console.log('  - Rôle:', user.role)
      console.log('  - Partenaire:', user.partner_code || 'Aucun')
      console.log('  - Est marchand:', user.isMerchant)
      console.log('  - Est livreur:', user.isLivreur)
      console.log('  - has_livreur:', user.has_livreur) // 🆕 LOG

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

      // 🆕 Créer wallet pour le livreur aussi
      if (isLivreur) {
        try {
          wallet = await Wallet.create({
            user_id: user.id,
            balance: 0,
            currency: 'XAF',
            status: 'active',
          })
          console.log('💰 [NewAccountController] Wallet créé pour le livreur')
        } catch (walletError: unknown) {
          const error = walletError as Error
          console.error('⚠️ [NewAccountController] Erreur création wallet livreur:', error.message)
        }
      }

      // Générer JWT
      const token = jwt.sign(
        { 
          id: user.id, 
          email: user.email, 
          role: user.role,
          partner_code: user.partner_code,
        },
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
          // Partenaire visible uniquement pour les marchands
          ...(user.isMerchant && { partner_code: user.partner_code }),
          // 🆕 Infos livreur
          ...(user.isLivreur && { 
            vehicle_type: user.vehicle_type,
            availability: user.availability,
            has_livreur: user.has_livreur, // 🆕 AJOUT
          }),
          verification_status: user.verification_status,
        },
        token,
        ...(wallet && { wallet: { id: wallet.id, balance: wallet.balance, currency: wallet.currency } }),
      })

    } catch (error: unknown) {
      const err = error as any
      console.error('💥 [NewAccountController] ERREUR:', err.message)
      console.error('💥 Stack:', err.stack)

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
