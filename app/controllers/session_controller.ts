import User from '#models/user'
import type { HttpContext } from '@adonisjs/core/http'
import jwt from 'jsonwebtoken'
import hash from '@adonisjs/core/services/hash'

const JWT_SECRET = process.env.JWT_SECRET || 'linemarket'

export default class SessionController {

  /**
   * Connexion utilisateur
   */
  async store({ request, response }: HttpContext) {
    try {
      const { email, password } = request.only(['email', 'password'])

      const user = await User.verifyCredentials(email, password)

      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: '7d' }
      )

      return response.ok({
        success: true,
        message: 'Connexion réussie',
        user: {
          id: user.id,
          full_name: user.full_name,
          email: user.email,
          role: user.role,
          avatar: user.avatar,
          phone: user.phone,
          address: user.address,
          country: user.country,
          neighborhood: user.neighborhood, // ✅ Ajout du quartier
          
          // ✅ Champs marchand - Étape 1 (Informations responsable)
          birth_date: user.birth_date,
          id_number: user.id_number,
          id_front_url: user.id_front_url,
          id_back_url: user.id_back_url,
          selfie_url: user.selfie_url,
          personal_phone: user.personal_phone,
          is_phone_verified: user.is_phone_verified,
          is_email_verified: user.is_email_verified,
          residence_address: user.residence_address,
          
          // ✅ Champs marchand - Étape 2 (Type d'activité)
          vendor_type: user.vendor_type,
          nif_number: user.nif_number,
          rccm_number: user.rccm_number,
          rccm_document_url: user.rccm_document_url,
          commercial_name: user.commercial_name,
          shop_name: user.shop_name, // Alias pour commercial_name
          whatsapp_phone: user.whatsapp_phone,
          is_whatsapp_verified: user.is_whatsapp_verified,
          shop_description: user.shop_description,
          logo_url: user.logo_url,
          shop_image: user.shop_image, // Alias pour logo_url
          cover_photo_url: user.cover_photo_url,
          
          // ✅ Bloc 4 : Boutique physique
          shop_address: user.shop_address,
          shop_latitude: user.shop_latitude,
          shop_longitude: user.shop_longitude,
          facade_photo1_url: user.facade_photo1_url,
          facade_photo2_url: user.facade_photo2_url,
          interior_photo1_url: user.interior_photo1_url,
          interior_photo2_url: user.interior_photo2_url,
          seeg_or_lease_url: user.seeg_or_lease_url,
          
          // ✅ Bloc 5 : Vendeur en ligne / Particulier
          stock_address: user.stock_address,
          address_proof_url: user.address_proof_url,
          facebook_url: user.facebook_url,
          instagram_url: user.instagram_url,
          tiktok_url: user.tiktok_url,
          stock_video_url: user.stock_video_url,
          reference1_name: user.reference1_name,
          reference1_phone: user.reference1_phone,
          reference2_name: user.reference2_name,
          reference2_phone: user.reference2_phone,
          
          // ✅ Champs marchand - Étape 3 (Paiement)
          payment_method: user.payment_method,
          airtel_number: user.airtel_number,
          moov_number: user.moov_number,
          account_holder_name: user.account_holder_name,
          bank_name: user.bank_name,
          rib_document_url: user.rib_document_url,
          
          // ✅ Validation et engagement
          certify_truth: user.certify_truth,
          accept_escrow: user.accept_escrow,
          signature: user.signature,
          
          // ✅ Statut du compte marchand
          is_verified: user.is_verified, // Vérification complète du compte
          verification_status: user.verification_status, // 'pending', 'approved', 'rejected'
          
          created_at: user.created_at,
          updated_at: user.updated_at,
        },
        token,
      })

    } catch (error) {
      return response.status(401).json({
        success: false,
        message: 'Email ou mot de passe incorrect',
      })
    }
  }

  /**
   * 🔐 Récupérer user depuis JWT
   */
  private async getUserFromToken(request: HttpContext['request']) {
    const authHeader = request.header('Authorization')

    if (!authHeader) return null

    const token = authHeader.replace('Bearer ', '')

    try {
      const payload: any = jwt.verify(token, JWT_SECRET)
      return await User.find(payload.id)
    } catch {
      return null
    }
  }

  /**
   * Profil utilisateur
   */
  async profile({ request, response }: HttpContext) {
    const user = await this.getUserFromToken(request)

    if (!user) {
      return response.unauthorized({
        success: false,
        message: 'Non authentifié',
      })
    }

    return response.ok({
      success: true,
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        phone: user.phone,
        address: user.address,
        country: user.country,
        neighborhood: user.neighborhood, // ✅ Ajout du quartier
        
        // ✅ Champs marchand - Étape 1
        birth_date: user.birth_date,
        id_number: user.id_number,
        id_front_url: user.id_front_url,
        id_back_url: user.id_back_url,
        selfie_url: user.selfie_url,
        personal_phone: user.personal_phone,
        is_phone_verified: user.is_phone_verified,
        is_email_verified: user.is_email_verified,
        residence_address: user.residence_address,
        
        // ✅ Champs marchand - Étape 2
        vendor_type: user.vendor_type,
        nif_number: user.nif_number,
        rccm_number: user.rccm_number,
        rccm_document_url: user.rccm_document_url,
        commercial_name: user.commercial_name,
        shop_name: user.shop_name,
        whatsapp_phone: user.whatsapp_phone,
        is_whatsapp_verified: user.is_whatsapp_verified,
        shop_description: user.shop_description,
        logo_url: user.logo_url,
        shop_image: user.shop_image,
        cover_photo_url: user.cover_photo_url,
        
        // ✅ Bloc 4 : Boutique physique
        shop_address: user.shop_address,
        shop_latitude: user.shop_latitude,
        shop_longitude: user.shop_longitude,
        facade_photo1_url: user.facade_photo1_url,
        facade_photo2_url: user.facade_photo2_url,
        interior_photo1_url: user.interior_photo1_url,
        interior_photo2_url: user.interior_photo2_url,
        seeg_or_lease_url: user.seeg_or_lease_url,
        
        // ✅ Bloc 5 : Vendeur en ligne / Particulier
        stock_address: user.stock_address,
        address_proof_url: user.address_proof_url,
        facebook_url: user.facebook_url,
        instagram_url: user.instagram_url,
        tiktok_url: user.tiktok_url,
        stock_video_url: user.stock_video_url,
        reference1_name: user.reference1_name,
        reference1_phone: user.reference1_phone,
        reference2_name: user.reference2_name,
        reference2_phone: user.reference2_phone,
        
        // ✅ Champs marchand - Étape 3
        payment_method: user.payment_method,
        airtel_number: user.airtel_number,
        moov_number: user.moov_number,
        account_holder_name: user.account_holder_name,
        bank_name: user.bank_name,
        rib_document_url: user.rib_document_url,
        
        // ✅ Validation
        certify_truth: user.certify_truth,
        accept_escrow: user.accept_escrow,
        signature: user.signature,
        is_verified: user.is_verified,
        verification_status: user.verification_status,
        
        created_at: user.created_at,
        updated_at: user.updated_at,
      },
    })
  }

  /**
   * ✅ UPDATE PROFIL
   */
  async update({ request, response }: HttpContext) {
    try {
      const user = await this.getUserFromToken(request)

      if (!user) {
        return response.unauthorized({
          success: false,
          message: 'Non authentifié',
        })
      }

      const data = request.only([
        'full_name',
        'phone',
        'address',
        'avatar',
        'country',
        'neighborhood', // ✅ Ajout du quartier
        
        // ✅ Champs marchand - Étape 1
        'birth_date',
        'id_number',
        'id_front_url',
        'id_back_url',
        'selfie_url',
        'personal_phone',
        'is_phone_verified',
        'is_email_verified',
        'residence_address',
        
        // ✅ Champs marchand - Étape 2
        'vendor_type',
        'nif_number',
        'rccm_number',
        'rccm_document_url',
        'commercial_name',
        'shop_name',
        'whatsapp_phone',
        'is_whatsapp_verified',
        'shop_description',
        'logo_url',
        'shop_image',
        'cover_photo_url',
        
        // ✅ Bloc 4 : Boutique physique
        'shop_address',
        'shop_latitude',
        'shop_longitude',
        'facade_photo1_url',
        'facade_photo2_url',
        'interior_photo1_url',
        'interior_photo2_url',
        'seeg_or_lease_url',
        
        // ✅ Bloc 5 : Vendeur en ligne / Particulier
        'stock_address',
        'address_proof_url',
        'facebook_url',
        'instagram_url',
        'tiktok_url',
        'stock_video_url',
        'reference1_name',
        'reference1_phone',
        'reference2_name',
        'reference2_phone',
        
        // ✅ Champs marchand - Étape 3
        'payment_method',
        'airtel_number',
        'moov_number',
        'account_holder_name',
        'bank_name',
        'rib_document_url',
        
        // ✅ Validation
        'certify_truth',
        'accept_escrow',
        'signature',
      ])

      // Synchroniser les alias
      if (data.commercial_name) {
        data.shop_name = data.commercial_name
      }
      if (data.logo_url) {
        data.shop_image = data.logo_url
      }

      user.merge(data)
      await user.save()

      return response.ok({
        success: true,
        message: 'Profil mis à jour',
        user: {
          id: user.id,
          full_name: user.full_name,
          email: user.email,
          role: user.role,
          avatar: user.avatar,
          phone: user.phone,
          address: user.address,
          country: user.country,
          neighborhood: user.neighborhood,
          
          // Étape 1
          birth_date: user.birth_date,
          id_number: user.id_number,
          id_front_url: user.id_front_url,
          id_back_url: user.id_back_url,
          selfie_url: user.selfie_url,
          personal_phone: user.personal_phone,
          is_phone_verified: user.is_phone_verified,
          is_email_verified: user.is_email_verified,
          residence_address: user.residence_address,
          
          // Étape 2
          vendor_type: user.vendor_type,
          nif_number: user.nif_number,
          rccm_number: user.rccm_number,
          rccm_document_url: user.rccm_document_url,
          commercial_name: user.commercial_name,
          shop_name: user.shop_name,
          whatsapp_phone: user.whatsapp_phone,
          is_whatsapp_verified: user.is_whatsapp_verified,
          shop_description: user.shop_description,
          logo_url: user.logo_url,
          shop_image: user.shop_image,
          cover_photo_url: user.cover_photo_url,
          
          // Bloc 4
          shop_address: user.shop_address,
          shop_latitude: user.shop_latitude,
          shop_longitude: user.shop_longitude,
          facade_photo1_url: user.facade_photo1_url,
          facade_photo2_url: user.facade_photo2_url,
          interior_photo1_url: user.interior_photo1_url,
          interior_photo2_url: user.interior_photo2_url,
          seeg_or_lease_url: user.seeg_or_lease_url,
          
          // Bloc 5
          stock_address: user.stock_address,
          address_proof_url: user.address_proof_url,
          facebook_url: user.facebook_url,
          instagram_url: user.instagram_url,
          tiktok_url: user.tiktok_url,
          stock_video_url: user.stock_video_url,
          reference1_name: user.reference1_name,
          reference1_phone: user.reference1_phone,
          reference2_name: user.reference2_name,
          reference2_phone: user.reference2_phone,
          
          // Étape 3
          payment_method: user.payment_method,
          airtel_number: user.airtel_number,
          moov_number: user.moov_number,
          account_holder_name: user.account_holder_name,
          bank_name: user.bank_name,
          rib_document_url: user.rib_document_url,
          
          // Validation
          certify_truth: user.certify_truth,
          accept_escrow: user.accept_escrow,
          signature: user.signature,
          
          created_at: user.created_at,
          updated_at: user.updated_at,
        },
      })

    } catch (error: any) {
      return response.internalServerError({
        success: false,
        message: 'Erreur update profil',
        error: error.message,
      })
    }
  }

  /**
   * 🔐 Modifier le mot de passe
   */
  async changePassword({ request, response }: HttpContext) {
    try {
      const user = await this.getUserFromToken(request)

      if (!user) {
        return response.unauthorized({
          success: false,
          message: 'Non authentifié',
        })
      }

      const { current_password, new_password, new_password_confirmation } = request.only([
        'current_password',
        'new_password',
        'new_password_confirmation',
      ])

      if (!current_password || !new_password) {
        return response.badRequest({
          success: false,
          message: 'Les champs current_password et new_password sont obligatoires',
        })
      }

      if (new_password_confirmation && new_password !== new_password_confirmation) {
        return response.badRequest({
          success: false,
          message: 'La confirmation du nouveau mot de passe ne correspond pas',
        })
      }

      const isVerified = await hash.verify(user.password, current_password)
      if (!isVerified) {
        return response.badRequest({
          success: false,
          message: 'Mot de passe actuel incorrect',
        })
      }

      user.password = await hash.make(new_password)
      await user.save()

      return response.ok({
        success: true,
        message: 'Mot de passe mis à jour',
      })
    } catch (error: any) {
      return response.internalServerError({
        success: false,
        message: 'Erreur lors du changement de mot de passe',
        error: error.message,
      })
    }
  }

  /**
   * ✅ Vérifier le statut de vérification du compte marchand
   */
  async verificationStatus({ request, response }: HttpContext) {
    const user = await this.getUserFromToken(request)

    if (!user) {
      return response.unauthorized({
        success: false,
        message: 'Non authentifié',
      })
    }

    return response.ok({
      success: true,
      verification_status: user.verification_status || 'pending',
      is_verified: user.is_verified || false,
      message: user.is_verified 
        ? 'Votre compte est vérifié' 
        : 'Votre compte est en attente de vérification',
    })
  }

  /**
   * Déconnexion
   */
  async destroy({ response }: HttpContext) {
    return response.ok({
      success: true,
      message: 'Déconnexion réussie (supprimer le token côté client)',
    })
  }
}
