import User from '#models/user'
import { signupValidator } from '#validators/user'
import type { HttpContext } from '@adonisjs/core/http'

export default class NewAccountController {
  /**
   * Inscription d'un nouvel utilisateur (API)
   * POST /api/register
   */
  async store({ request, response }: HttpContext) {
    try {
      // Valider les données envoyées
      const payload = await request.validateUsing(signupValidator)

      // Vérifier si l'email existe déjà
      const existingUser = await User.findBy('email', payload.email)
      if (existingUser) {
        return response.status(400).json({
          success: false,
          message: 'Cet email est déjà utilisé',
        })
      }

      // Créer l'utilisateur
      const user = await User.create({
        full_name: payload.full_name,
        email: payload.email,
        password: payload.password,
        role: payload.role, // par défaut
      })

      // Connecter l'utilisateur (auth token)
      const token = await User.accessTokens.create(user, ['*'], {
        expiresIn: '7 days',
      })

      // Réponse JSON
      return response.status(201).json({
        success: true,
        message: 'Inscription réussie',
        user: {
          id: user.id,
          full_name: user.full_name,
          email: user.email,
          role: user.role,
        },
        token: token.value?.release(),
      })
    } catch (error) {
      return response.status(400).json({
        success: false,
        message: 'Erreur lors de l\'inscription',
        errors: error.messages || error.message,
      })
    }
  }
}
