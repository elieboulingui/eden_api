// app/controllers/profile_controller.ts
import UserTransformer from '#transformers/user_transformer'
import type { HttpContext } from '@adonisjs/core/http'

export default class ProfileController {
  /**
   * Récupérer le profil de l'utilisateur connecté
   * GET /api/profile
   */
  async show({ auth, response }: HttpContext) {
    try {
      const user = await auth.use('api').authenticate()

      return response.status(200).json({
        success: true,
        user: UserTransformer.transform(user)
      })
    } catch (error) {
      return response.status(401).json({
        success: false,
        message: 'Non authentifié'
      })
    }
  }
}
