import { DateTime } from 'luxon'
import User from '#models/user'
import type { HttpContext } from '@adonisjs/core/http'

export default class NewAccountViewController {
  /**
   * Afficher le formulaire d'inscription (Web)
   */
  async create({ view }: HttpContext) {
    return view.render('pages/auth/signup')
  }

  /**
   * Création d'un nouveau compte (Web et API)
   */
  async store({ request, response }: HttpContext) {
    try {
      const payload = request.all()

      // ✅ CORRECTION : Convertir les types avant de passer à User.create()
      const userData = {
        // Champs de base
        full_name: payload.full_name,
        email: payload.email,
        password: payload.password,
        role: payload.role || 'client',
        phone: payload.phone || null,
        address: payload.address || null,
        country: payload.country || null,
        neighborhood: payload.neighborhood || null,
        avatar: payload.avatar || null,

        // ✅ Conversion DateTime
        birth_date: payload.birth_date ? DateTime.fromISO(payload.birth_date) : null,

        // ÉTAPE 1
        id_number: payload.id_number || null,
        id_front_url: payload.id_front_url || null,
        id_back_url: payload.id_back_url || null,
        selfie_url: payload.selfie_url || null,
        personal_phone: payload.personal_phone || null,
        residence_address: payload.residence_address || null,
        
        // ✅ Conversion Boolean
        is_phone_verified: this.parseBoolean(payload.is_phone_verified),
        is_email_verified: this.parseBoolean(payload.is_email_verified),

        // ÉTAPE 2
        vendor_type: payload.vendor_type || null,
        nif_number: payload.nif_number || null,
        rccm_number: payload.rccm_number || null,
        rccm_document_url: payload.rccm_document_url || null,
        commercial_name: payload.commercial_name || null,
        shop_name: payload.shop_name || null,
        whatsapp_phone: payload.whatsapp_phone || null,
        is_whatsapp_verified: this.parseBoolean(payload.is_whatsapp_verified),
        shop_description: payload.shop_description || null,
        logo_url: payload.logo_url || null,
        shop_image: payload.shop_image || null,
        cover_photo_url: payload.cover_photo_url || null,

        // BLOC 4 : BOUTIQUE PHYSIQUE
        shop_address: payload.shop_address || null,
        // ✅ Conversion Number
        shop_latitude: payload.shop_latitude ? Number.parseFloat(payload.shop_latitude) : null,
        shop_longitude: payload.shop_longitude ? Number.parseFloat(payload.shop_longitude) : null,
        facade_photo1_url: payload.facade_photo_1_url || payload.facade_photo1_url || null,
        facade_photo2_url: payload.facade_photo_2_url || payload.facade_photo2_url || null,
        interior_photo1_url: payload.interior_photo_1_url || payload.interior_photo1_url || null,
        interior_photo2_url: payload.interior_photo_2_url || payload.interior_photo2_url || null,
        seeg_or_lease_url: payload.seeg_or_lease_url || null,

        // BLOC 5 : VENDEUR EN LIGNE / PARTICULIER
        stock_address: payload.stock_address || null,
        address_proof_url: payload.address_proof_url || null,
        facebook_url: payload.facebook_url || null,
        instagram_url: payload.instagram_url || null,
        tiktok_url: payload.tiktok_url || null,
        stock_video_url: payload.stock_video_url || null,
        reference1_name: payload.reference_1_name || payload.reference1_name || null,
        reference1_phone: payload.reference_1_phone || payload.reference1_phone || null,
        reference2_name: payload.reference_2_name || payload.reference2_name || null,
        reference2_phone: payload.reference_2_phone || payload.reference2_phone || null,

        // ÉTAPE 3 : PAIEMENT
        payment_method: payload.payment_method || null,
        airtel_number: payload.airtel_number || null,
        moov_number: payload.moov_number || null,
        account_holder_name: payload.account_holder_name || null,
        bank_name: payload.bank_name || null,
        rib_document_url: payload.rib_document_url || null,

        // VALIDATION
        certify_truth: this.parseBoolean(payload.certify_truth),
        accept_escrow: this.parseBoolean(payload.accept_escrow),
        signature: payload.signature || null,

        // STATUT
        is_verified: this.parseBoolean(payload.is_verified),
        verification_status: payload.verification_status || 'pending',
        verified_at: payload.verified_at ? DateTime.fromISO(payload.verified_at) : null,
        verified_by: payload.verified_by || null,
        rejection_reason: payload.rejection_reason || null,
      }

      const user = await User.create(userData)

      // Si c'est une requête API, retourner JSON
      if (request.accepts(['json'])) {
        return response.created({
          success: true,
          message: 'Compte créé avec succès',
          user: {
            id: user.id,
            full_name: user.full_name,
            email: user.email,
            role: user.role,
            created_at: user.created_at?.toISO(),
          },
        })
      }

      // Sinon, rediriger vers la page de connexion (Web)
      return response.redirect().toRoute('session.create')

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue'
      
      // Si c'est une requête API, retourner JSON
      if (request.accepts(['json'])) {
        return response.badRequest({
          success: false,
          message: 'Erreur lors de la création du compte',
          error: errorMessage,
        })
      }

      // Sinon, retourner à la page d'inscription avec erreur (Web)
      return response.redirect().back().withErrors({
        signup: errorMessage,
      })
    }
  }

  /**
   * Utilitaire pour parser les booléens
   */
  private parseBoolean(value: any): boolean {
    if (value === 'true' || value === true || value === 1 || value === '1') {
      return true
    }
    if (value === 'false' || value === false || value === 0 || value === '0') {
      return false
    }
    return false
  }
}
