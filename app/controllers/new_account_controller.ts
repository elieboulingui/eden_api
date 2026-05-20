// app/controllers/new_account_controller.ts
import User from '#models/user'
import Wallet from '#models/wallet'
import type { HttpContext } from '@adonisjs/core/http'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'linemarket'

export default class NewAccountController {
  async store({ request, response }: HttpContext) {
    console.log('🟢 [NewAccountController] ===== DÉBUT INSCRIPTION =====')

    try {
      const rawData = request.body()
      
      console.log('📥 Données brutes reçues:')
      console.log('  - email:', rawData.email)
      console.log('  - role:', rawData.role)
      console.log('  - has_livreur:', rawData.has_livreur)

      // Vérifier email
      if (rawData.email) {
        const existingUser = await User.findBy('email', rawData.email)
        if (existingUser) {
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
        }
      }

      const isMerchant = role === 'merchant'
      const isLivreur = role === 'livreur'

      // ✅ Construire userData avec mapping des champs
      const userData: Record<string, any> = {}

      // Mapping des champs frontend -> DB
      const fieldMapping: Record<string, string> = {
        // Communs
        'full_name': 'full_name',
        'email': 'email',
        'password': 'password',
        'country': 'country',
        'neighborhood': 'neighborhood',
        'phone': 'phone',
        'address': 'address',
        'photo_url': 'avatar_url',
        'clientPhotoUrl': 'avatar_url',
        'livreurPhotoUrl': 'avatar_url',
        'avatar_url': 'avatar_url',
        
        // Infos personnelles
        'birth_date': 'birth_date',
        'id_number': 'id_number',
        'id_front_url': 'id_front_url',
        'id_back_url': 'id_back_url',
        'selfie_url': 'selfie_url',
        'personal_phone': 'personal_phone',
        'residence_address': 'residence_address',
        
        // Entreprise (marchand)
        'company_name': 'commercial_name',
        'commercial_name': 'commercial_name',
        'shop_name': 'shop_name',
        'products_sold': 'shop_description',
        'shop_description': 'shop_description',
        'business_type': 'vendor_type',
        'vendor_type': 'vendor_type',
        'company_phone': 'whatsapp_phone',
        'whatsapp_phone': 'whatsapp_phone',
        'business_address': 'shop_address',
        'shop_address': 'shop_address',
        'business_document_url': 'rccm_document_url',
        'rccm_document_url': 'rccm_document_url',
        'business_sector': 'shop_description',
        
        // Photos
        'logo_url': 'logo_url',
        'cover_photo_url': 'cover_photo_url',
        
        // Boutique physique
        'facade_photo1_url': 'facade_photo1_url',
        'facade_photo2_url': 'facade_photo2_url',
        'interior_photo1_url': 'interior_photo1_url',
        'interior_photo2_url': 'interior_photo2_url',
        'seeg_document_url': 'seeg_or_lease_url',
        'seeg_or_lease_url': 'seeg_or_lease_url',
        
        // Vendeur en ligne
        'stock_address': 'stock_address',
        'address_proof_url': 'address_proof_url',
        'facebook_url': 'facebook_url',
        'instagram_url': 'instagram_url',
        'tiktok_url': 'tiktok_url',
        'stock_video_url': 'stock_video_url',
        
        // Références
        'reference_1_name': 'reference_1_name',
        'reference_1_phone': 'reference_1_phone',
        'reference_2_name': 'reference_2_name',
        'reference_2_phone': 'reference_2_phone',
        
        // Signature
        'signature': 'signature',
        'certify_truth': 'certify_truth',
        'accept_escrow': 'accept_escrow',
        'has_livreur': 'has_livreur',
        
        // Livreur
        'vehicle_type': 'vehicle_type',
        'license_number': 'license_number',
        'license_document_url': 'license_document_url',
        'vehicle_document_url': 'vehicle_document_url',
        'availability': 'availability',
        
        // Statuts
        'verification_status': 'verification_status',
        'is_verified': 'is_verified',
        'is_phone_verified': 'is_phone_verified',
        'is_email_verified': 'is_email_verified',
        'is_whatsapp_verified': 'is_whatsapp_verified',
      }

      // Appliquer le mapping
      for (const [frontField, dbField] of Object.entries(fieldMapping)) {
        if (rawData[frontField] !== undefined && rawData[frontField] !== null && rawData[frontField] !== '') {
          userData[dbField] = rawData[frontField]
        }
      }

      // Conversion spéciale pour business_type -> vendor_type
      if (rawData.business_type) {
        if (rawData.business_type === 'physique') {
          userData.vendor_type = 'boutique_physique'
        } else if (rawData.business_type === 'ligne') {
          userData.vendor_type = 'vendeur_ligne'
        }
      }

      // ✅ PARTNER_CODE pour les marchands
      if (isMerchant) {
        userData.partner_code = rawData.partner_code || 'eden_client_nathjosh'
        console.log('🔗 Partner code:', userData.partner_code)
      }

      // ✅ Valeurs par défaut
      userData.role = role
      userData.is_phone_verified = userData.is_phone_verified ?? false
      userData.is_email_verified = userData.is_email_verified ?? false
      userData.is_whatsapp_verified = userData.is_whatsapp_verified ?? false

      if (isMerchant || isLivreur) {
        userData.verification_status = userData.verification_status || 'pending'
        userData.is_verified = userData.is_verified ?? false
      }

      if (isLivreur) {
        userData.is_available = userData.is_available ?? true
        userData.is_online = userData.is_online ?? false
        userData.total_deliveries = userData.total_deliveries ?? 0
        userData.total_earnings = userData.total_earnings ?? 0
        userData.rating = userData.rating ?? 0
        userData.total_ratings = userData.total_ratings ?? 0
        userData.has_livreur = userData.has_livreur ?? false
      }

      // S'assurer que full_name est présent
      if (!userData.full_name) {
        if (rawData.full_name) {
          userData.full_name = rawData.full_name
        } else if (rawData.first_name && rawData.last_name) {
          userData.full_name = `${rawData.first_name} ${rawData.last_name}`.trim()
        } else {
          userData.full_name = 'Utilisateur'
        }
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

      console.log('✅ Données finales pour la DB:')
      console.log('  - Champs:', Object.keys(userData).join(', '))
      console.log('  - Role:', userData.role)
      console.log('  - vendor_type:', userData.vendor_type || 'non défini')
      console.log('  - has_livreur:', userData.has_livreur)

      // Créer l'utilisateur
      const user = await User.create(userData)

      console.log('✅ Utilisateur créé! ID:', user.id)

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
          console.error('⚠️ Erreur création wallet:', (walletError as Error).message)
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

      console.log('🟢 FIN INSCRIPTION - SUCCÈS')

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
      const err = error as Error
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
