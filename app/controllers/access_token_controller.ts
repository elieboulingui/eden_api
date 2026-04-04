import User from '#models/user'
import { loginValidator } from '#validators/user'
import type { HttpContext } from '@adonisjs/core/http'
import UserTransformer from '#transformers/user_transformer'

export default class AccessTokenController {
  /**
   * Login - Crée un token d'accès pour l'utilisateur
   */
  async store({ request, response }: HttpContext) {
    try {
      // Validation des données
      const { email, password } = await request.validateUsing(loginValidator)

      // Vérifier les credentials
      const user = await User.verifyCredentials(email, password)
      if (!user) {
        return response.status(401).json({
          success: false,
          message: 'Email ou mot de passe invalide',
        })
      }

      // Créer un token d'accès
      const token = await User.accessTokens.create(user)

      return response.status(200).json({
        success: true,
        data: {
          user: UserTransformer.transform(user),
          token: token.value!.release(),
        },
      })
    } catch (error:any) {
      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la connexion',
        error: error.message,
      })
    }
  }

  /**
   * Logout - Supprime le token courant
   */
async destroy({ auth, response }: HttpContext) {
  try {
    const user = await auth.getUserOrFail()
    const userWithToken = user as User & { currentAccessToken: any }
    
    if (userWithToken.currentAccessToken) {
      await User.accessTokens.delete(user, userWithToken.currentAccessToken.identifier)
    }

    return response.status(200).json({
      success: true,
      message: 'Déconnexion réussie',
    })
  } catch (error:any) {
    return response.status(500).json({
      success: false,
      message: 'Erreur lors de la déconnexion',
      error: error.message,
    })
  }
}
}