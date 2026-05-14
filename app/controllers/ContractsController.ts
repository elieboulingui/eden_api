// app/Controllers/Http/ContractsController.ts
import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'

export default class ContractsController {

  /**
   * Récupère les infos du marchand via le nom dans l'URL
   * GET /api/contract/by-name/:name
   * 
   * Frontend : https://eden-azure-one.vercel.app/contrat/dsds
   */
  async getByName({ params, response }: HttpContext) {
    try {
      const { name } = params

      if (!name) {
        return response.badRequest({
          success: false,
          message: 'Nom du marchand requis'
        })
      }

      const searchName = decodeURIComponent(name).replace(/-/g, ' ').trim()

      // Rechercher le marchand
      let user = await User.query()
        .whereRaw('LOWER(full_name) LIKE ?', [`%${searchName.toLowerCase()}%`])
        .whereIn('role', ['marchant', 'merchant'])
        .first()

      if (!user) {
        user = await User.query()
          .where((builder) => {
            builder
              .whereRaw('LOWER(shop_name) LIKE ?', [`%${searchName.toLowerCase()}%`])
              .orWhereRaw('LOWER(commercial_name) LIKE ?', [`%${searchName.toLowerCase()}%`])
          })
          .whereIn('role', ['marchant', 'merchant'])
          .first()
      }

      if (!user) {
        return response.notFound({
          success: false,
          message: 'Aucun marchand trouvé'
        })
      }

      return response.ok({
        success: true,
        data: {
          id: user.id,
          full_name: user.full_name,
          email: user.email,
          phone: user.phone,
          shop_name: user.shop_name,
          commercial_name: user.commercial_name,
          vendor_type: user.vendor_type,
          rccm: user.rccm_number,
          nif: user.nif_number,
          address: user.shop_address || user.address,
          is_verified: user.is_verified,
          contract_signed: user.contract_signed,
          contract_signed_at: user.contract_signed_at
        }
      })

    } catch (error) {
      console.error('Erreur getByName:', error)
      return response.internalServerError({
        success: false,
        message: 'Erreur serveur'
      })
    }
  }
}
