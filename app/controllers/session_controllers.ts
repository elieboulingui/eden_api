import { DateTime } from 'luxon'
import User from '#models/user'
import type { HttpContext } from '@adonisjs/core/http'

export default class NewAccountController {
  /**
   * Création d'un nouveau compte (client ou marchand)
   */
  async store({ request, response }: HttpContext) {
    try {
      const payload = request.all()

      // Préparer les données avec les bons types
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

        // ÉTAPE 1 : INFORMATIONS DU RESPONSABLE
        birth_date: payload.birth_date ? DateTime.fromISO(payload.birth_date) : null,
        id_number: payload.id_number || null,
        id_front_url: payload.id_front_url || null,
        id_back_url: payload.id_back_url || null,
        selfie_url: payload.selfie_url || null,
        personal_phone: payload.personal_phone || null,
        residence_address: payload.residence_address || null,
        is_phone_verified: payload.is_phone_verified === 'true' || payload.is_phone_verified === true || false,
        is_email_verified: payload.is_email_verified === 'true' || payload.is_email_verified === true || false,

        // ÉTAPE 2 : TYPE D'ACTIVITÉ
        vendor_type: payload.vendor_type || null,
        nif_number: payload.nif_number || null,
        rccm_number: payload.rccm_number || null,
        rccm_document_url: payload.rccm_document_url || null,
        commercial_name: payload.commercial_name || null,
        shop_name: payload.shop_name || null,
        whatsapp_phone: payload.whatsapp_phone || null,
        is_whatsapp_verified: payload.is_whatsapp_verified === 'true' || payload.is_whatsapp_verified === true || false,
        shop_description: payload.shop_description || null,
        logo_url: payload.logo_url || null,
        shop_image: payload.shop_image || null,
        cover_photo_url: payload.cover_photo_url || null,

        // BLOC 4 : BOUTIQUE PHYSIQUE
        shop_address: payload.shop_address || null,
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

        // ÉTAPE 3 : PAIEMENT ET VALIDATION
        payment_method: payload.payment_method || null,
        airtel_number: payload.airtel_number || null,
        moov_number: payload.moov_number || null,
        account_holder_name: payload.account_holder_name || null,
        bank_name: payload.bank_name || null,
        rib_document_url: payload.rib_document_url || null,

        // VALIDATION ET ENGAGEMENT
        certify_truth: payload.certify_truth === 'true' || payload.certify_truth === true || false,
        accept_escrow: payload.accept_escrow === 'true' || payload.accept_escrow === true || false,
        signature: payload.signature || null,

        // STATUT DE VÉRIFICATION
        is_verified: payload.is_verified === 'true' || payload.is_verified === true || false,
        verification_status: payload.verification_status || 'pending',
        verified_at: payload.verified_at ? DateTime.fromISO(payload.verified_at) : null,
        verified_by: payload.verified_by || null,
        rejection_reason: payload.rejection_reason || null,
      }

      const user = await User.create(userData)

      return response.created({
        success: true,
        message: 'Compte créé avec succès',
        user: {
          id: user.id,
          full_name: user.full_name,
          email: user.email,
          role: user.role,
          phone: user.phone,
          address: user.address,
          is_verified: user.is_verified,
          verification_status: user.verification_status,
          created_at: user.created_at?.toISO(),
          updated_at: user.updated_at?.toISO(),
        },
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue'
      return response.badRequest({
        success: false,
        message: 'Erreur lors de la création du compte',
        error: errorMessage,
      })
    }
  }

  /**
   * Récupérer la liste des comptes (admin seulement)
   */
  async index({ request, response }: HttpContext) {
    try {
      const page = request.input('page', 1)
      const limit = request.input('limit', 10)
      const role = request.input('role')

      const query = User.query().orderBy('created_at', 'desc')

      if (role) {
        query.where('role', role)
      }

      const users = await query.paginate(page, limit)

      return response.ok({
        success: true,
        users: users.all().map((user) => ({
          id: user.id,
          full_name: user.full_name,
          email: user.email,
          role: user.role,
          phone: user.phone,
          is_verified: user.is_verified,
          verification_status: user.verification_status,
          created_at: user.created_at?.toISO(),
        })),
        pagination: {
          total: users.total,
          page: users.currentPage,
          limit: users.perPage,
          lastPage: users.lastPage,
        },
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue'
      return response.internalServerError({
        success: false,
        message: 'Erreur lors de la récupération des comptes',
        error: errorMessage,
      })
    }
  }

  /**
   * Récupérer un compte spécifique (admin ou propriétaire)
   */
  async show({ params, response }: HttpContext) {
    try {
      const user = await User.find(params.id)

      if (!user) {
        return response.notFound({
          success: false,
          message: 'Utilisateur non trouvé',
        })
      }

      return response.ok({
        success: true,
        user: {
          id: user.id,
          full_name: user.full_name,
          email: user.email,
          role: user.role,
          phone: user.phone,
          address: user.address,
          country: user.country,
          neighborhood: user.neighborhood,
          avatar: user.avatar,
          birth_date: user.birth_date?.toISO(),
          id_number: user.id_number,
          vendor_type: user.vendor_type,
          commercial_name: user.commercial_name,
          shop_name: user.shop_name,
          shop_description: user.shop_description,
          is_verified: user.is_verified,
          verification_status: user.verification_status,
          created_at: user.created_at?.toISO(),
          updated_at: user.updated_at?.toISO(),
        },
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue'
      return response.internalServerError({
        success: false,
        message: 'Erreur lors de la récupération du compte',
        error: errorMessage,
      })
    }
  }

  /**
   * Mettre à jour un compte (admin ou propriétaire)
   */
  async update({ params, request, response }: HttpContext) {
    try {
      const user = await User.find(params.id)

      if (!user) {
        return response.notFound({
          success: false,
          message: 'Utilisateur non trouvé',
        })
      }

      const payload = request.only([
        'full_name',
        'phone',
        'address',
        'country',
        'neighborhood',
        'shop_description',
        'commercial_name',
        'shop_name',
      ])

      user.merge(payload)
      await user.save()

      return response.ok({
        success: true,
        message: 'Compte mis à jour avec succès',
        user: {
          id: user.id,
          full_name: user.full_name,
          email: user.email,
          role: user.role,
          phone: user.phone,
          address: user.address,
          updated_at: user.updated_at?.toISO(),
        },
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue'
      return response.badRequest({
        success: false,
        message: 'Erreur lors de la mise à jour du compte',
        error: errorMessage,
      })
    }
  }

  /**
   * Approuver un compte marchand (admin seulement)
   */
  async approve({ params, request, response }: HttpContext) {
    try {
      const user = await User.find(params.id)

      if (!user) {
        return response.notFound({
          success: false,
          message: 'Utilisateur non trouvé',
        })
      }

      const adminId = request.input('admin_id') || 'system'

      await user.approve(adminId)

      return response.ok({
        success: true,
        message: 'Compte marchand approuvé avec succès',
        user: {
          id: user.id,
          full_name: user.full_name,
          email: user.email,
          is_verified: user.is_verified,
          verification_status: user.verification_status,
          verified_at: user.verified_at?.toISO(),
        },
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue'
      return response.badRequest({
        success: false,
        message: 'Erreur lors de l\'approbation du compte',
        error: errorMessage,
      })
    }
  }

  /**
   * Rejeter un compte marchand (admin seulement)
   */
  async reject({ params, request, response }: HttpContext) {
    try {
      const user = await User.find(params.id)

      if (!user) {
        return response.notFound({
          success: false,
          message: 'Utilisateur non trouvé',
        })
      }

      const adminId = request.input('admin_id') || 'system'
      const reason = request.input('reason') || 'Non spécifié'

      await user.reject(adminId, reason)

      return response.ok({
        success: true,
        message: 'Compte marchand rejeté',
        user: {
          id: user.id,
          full_name: user.full_name,
          email: user.email,
          is_verified: user.is_verified,
          verification_status: user.verification_status,
          rejection_reason: user.rejection_reason,
        },
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue'
      return response.badRequest({
        success: false,
        message: 'Erreur lors du rejet du compte',
        error: errorMessage,
      })
    }
  }

  /**
   * Supprimer un compte (admin seulement)
   */
  async destroy({ params, response }: HttpContext) {
    try {
      const user = await User.find(params.id)

      if (!user) {
        return response.notFound({
          success: false,
          message: 'Utilisateur non trouvé',
        })
      }

      await user.delete()

      return response.ok({
        success: true,
        message: 'Compte supprimé avec succès',
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue'
      return response.badRequest({
        success: false,
        message: 'Erreur lors de la suppression du compte',
        error: errorMessage,
      })
    }
  }
}
