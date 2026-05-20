// app/controllers/new_account_controller.ts
import User from '#models/user'
import Wallet from '#models/wallet'
import type { HttpContext } from '@adonisjs/core/http'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'linemarket'

// ✅ Liste des colonnes autorisées dans la table users (basée sur ce que le frontend envoie)
const ALLOWED_USER_FIELDS = [
  // Champs de base
  'full_name', 'email', 'password', 'role', 'phone', 'address',
  'country', 'neighborhood', 'avatar_url', 'photo_url',
  
  // Infos personnelles
  'birth_date', 'id_number', 'id_front_url', 'id_back_url',
  'selfie_url', 'personal_phone', 'residence_address',
  'is_phone_verified', 'is_email_verified',
  
  // Infos entreprise (marchand)
  'company_name', 'commercial_name', 'shop_name', 'business_sector',
  'shop_description', 'products_sold', 'business_type', 'vendor_type',
  'company_phone', 'whatsapp_phone', 'business_address', 'shop_address',
  'business_document_url', 'rccm_document_url', 'rccm_number', 'nif_number',
  
  // Paiement
  'payment_method', 'airtel_number', 'moov_number',
  'account_holder_name', 'bank_name', 'rib_document_url',
  
  // Boutique physique
  'shop_latitude', 'shop_longitude',
  'facade_photo1_url', 'facade_photo2_url',
  'interior_photo1_url', 'interior_photo2_url',
  'seeg_or_lease_url', 'seeg_document_url',
  
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
  'has_livreur',
]

export default class NewAccountController {
  async store({ request, response }: HttpContext) {
    console.log('🟢 [NewAccountController] ===== DÉBUT INSCRIPTION =====')

    try {
      const rawData = request.body()
      
      console.log('📥 [NewAccountController] Données brutes reçues:')
      console.log('  - email:', rawData.email)
      console.log('  - role:', rawData.role)
      console.log('  - partner_code:', rawData.partner_code || 'null')
      console.log('  - has_livreur:', rawData.has_livreur)

      // Vérifier email
      if (rawData.email) {
        const existingUser = await User.findBy('email', rawData.email)
        if (existingUser) {
          console.log('❌ Email déjà utilisé')
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
        } else if (lowerRole === 'livreur') {
          role = 'livreur'
        } else if (lowerRole === 'admin') {
          role = 'admin'
        }
      }

      const isMerchant = role === 'merchant'
      const isLivreur = role === 'livreur'

      // ✅ Construire userData directement à partir des champs du frontend
      const userData: Record<string, any> = {}

      // Liste des champs que le frontend peut envoyer (copier-coller depuis le frontend)
      const frontendFields = [
        // Communs
        'full_name', 'email', 'password', 'role', 'country', 'neighborhood',
        'phone', 'address', 'photo_url', 'avatar_url', 'is_phone_verified', 'is_email_verified',
        
        // Client
        'clientPhone', 'clientAddress', 'clientPhotoUrl',
        
        // Marchand - Personnel
        'birth_date', 'id_number', 'id_front_url', 'id_back_url',
        'selfie_url', 'personal_phone', 'residence_address',
        
        // Marchand - Entreprise
        'company_name', 'business_sector', 'products_sold', 'business_type',
        'company_phone', 'business_address', 'business_document_url',
        'logo_url', 'cover_photo_url',
        
        // Boutique physique
        'facade_photo1_url', 'facade_photo2_url',
        'interior_photo1_url', 'interior_photo2_url', 'seeg_document_url',
        
        // Vendeur en ligne
        'stock_address', 'address_proof_url',
        'facebook_url', 'instagram_url', 'tiktok_url', 'stock_video_url',
        'reference_1_name', 'reference_1_phone',
        'reference_2_name', 'reference_2_phone',
        
        // Signature
        'signature', 'certify_truth', 'accept_escrow', 'has_livreur',
        
        // Livreur
        'livreurPhone', 'vehicle_type', 'license_number',
        'license_document_url', 'vehicle_document_url', 'livreurPhotoUrl', 'availability',
        
        // Statuts
        'verification_status', 'is_verified', 'is_whatsapp_verified',
        
        // Partner
        'partner_code',
      ]

      // Copier tous les champs du frontend qui sont dans ALLOWED_USER_FIELDS
      for (const key of frontendFields) {
        if (rawData[key] !== undefined && rawData[key] !== null && rawData[key] !== '') {
          // Mapper les noms de champs si nécessaire
          let dbField = key
          
          // Mappings spécifiques
          const mappings: Record<string, string> = {
            'clientPhone': 'phone',
            'clientAddress': 'address',
            'clientPhotoUrl': 'avatar_url',
            'livreurPhone': 'phone',
            'livreurPhotoUrl': 'avatar_url',
            'company_name': 'commercial_name',
            'business_sector': 'shop_description',
            'products_sold': 'shop_description',
            'company_phone': 'whatsapp_phone',
            'business_address': 'shop_address',
            'seeg_document_url': 'seeg_or_lease_url',
            'photo_url': 'avatar_url',
          }
          
          dbField = mappings[key] || key
          
          if (ALLOWED_USER_FIELDS.includes(dbField)) {
            userData[dbField] = rawData[key]
          }
        }
      }

      // ✅ Traitement spécial pour les URLs de photo
      if (rawData.photo_url && !userData.avatar_url) {
        userData.avatar_url = rawData.photo_url
      }
      if (rawData.clientPhotoUrl && !userData.avatar_url) {
        userData.avatar_url = rawData.clientPhotoUrl
      }
      if (rawData.livreurPhotoUrl && !userData.avatar_url) {
        userData.avatar_url = rawData.livreurPhotoUrl
      }

      // ✅ PARTNER_CODE pour les marchands
      if (isMerchant) {
        userData.partner_code = rawData.partner_code || 'eden_client_nathjosh'
        console.log('🔗 Partner code:', userData.partner_code)
      } else {
        userData.partner_code = null
      }

      // ✅ Statuts par défaut
      if (isMerchant || isLivreur) {
        userData.verification_status = userData.verification_status || 'pending'
        userData.is_verified = userData.is_verified || false
      }

      // ✅ Valeurs par défaut pour livreur
      if (isLivreur) {
        userData.is_available = userData.is_available ?? true
        userData.is_online = userData.is_online ?? false
        userData.total_deliveries = userData.total_deliveries ?? 0
        userData.total_earnings = userData.total_earnings ?? 0
        userData.rating = userData.rating ?? 0
        userData.total_ratings = userData.total_ratings ?? 0
        userData.has_livreur = userData.has_livreur ?? false
      }

      // ✅ S'assurer que les champs requis sont présents
      if (!userData.full_name && rawData.full_name) {
        userData.full_name = rawData.full_name
      }
      if (!userData.full_name && rawData.first_name && rawData.last_name) {
        userData.full_name = `${rawData.first_name} ${rawData.last_name}`.trim()
      }
      if (!userData.full_name) {
        userData.full_name = 'Utilisateur'
      }

      if (!userData.email && rawData.email) {
        userData.email = rawData.email
      }
      if (!userData.password && rawData.password) {
        userData.password = rawData.password
      }

      // Vérifier les champs requis
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

      // Définir le rôle
      userData.role = role

      console.log('✅ [NewAccountController] Données finales pour la DB:')
      console.log('  - Nombre de champs:', Object.keys(userData).length)
      console.log('  - Champs:', Object.keys(userData).join(', '))
      console.log('  - Role:', userData.role)
      console.log('  - has_livreur:', userData.has_livreur)

      // Créer l'utilisateur
      const user = await User.create(userData)

      console.log('✅ Utilisateur créé avec succès! ID:', user.id)

      // Créer le wallet pour marchand ou livreur
      let wallet = null
      if (isMerchant || isLivreur) {
        try {
          wallet = await Wallet.create({
            user_id: user.id,
            balance: 0,
            currency: 'XAF',
            status: 'active',
          })
          console.log(`💰 Wallet créé pour ${role}`)
        } catch (walletError: unknown) {
          const error = walletError as Error
          console.error('⚠️ Erreur création wallet:', error.message)
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
          ...(user.isMerchant && { partner_code: user.partner_code }),
          ...(user.isLivreur && { 
            vehicle_type: user.vehicle_type,
            availability: user.availability,
            has_livreur: user.has_livreur,
          }),
          verification_status: user.verification_status,
        },
        token,
        ...(wallet && { wallet: { id: wallet.id, balance: wallet.balance, currency: wallet.currency } }),
      })

    } catch (error: unknown) {
      const err = error as any
      console.error('💥 ERREUR:', err.message)
      console.error('💥 Stack:', err.stack)

      return response.status(400).json({
        success: false,
        message: 'Erreur lors de l\'inscription',
        error: err.message,
      })
    }
  }
}
