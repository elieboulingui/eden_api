import { DateTime } from 'luxon'
import User from '#models/user'
import type { HttpContext } from '@adonisjs/core/http'

export default class NewAccountController {



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
