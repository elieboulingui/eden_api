// app/controllers/auth_controller.ts
import User from '#models/user'
import type { HttpContext } from '@adonisjs/core/http'
import { signupValidator, loginValidator } from '#validators/user'

export default class ApiAuthController {
  // Inscription
  async register({ request, response }: HttpContext) {
    try {
      const payload = await request.validateUsing(signupValidator)

      const existingUser = await User.findBy('email', payload.email)
      if (existingUser) {
        return response.status(400).json({
          success: false,
          message: 'Cet email est déjà utilisé',
        })
      }

      const user = await User.create({
        full_name: payload.full_name,
        email: payload.email,
        password: payload.password,
        role: 'client',
      })

      const token = await User.accessTokens.create(user, ['*'], {
        expiresIn: '7 days',
      })

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

  // Connexion
  async login({ request, response }: HttpContext) {
    try {
      const { email, password } = await request.validateUsing(loginValidator)
      const user = await User.verifyCredentials(email, password)
      if (!user) {
        return response.status(401).json({
          success: false,
          message: 'Email ou mot de passe incorrect',
        })
      }

      // Supprimer anciens tokens
      const existingTokens = await User.accessTokens.all(user)
      for (const token of existingTokens) {
        await User.accessTokens.delete(user, token.identifier)
      }

      // Créer un nouveau token
      const token = await User.accessTokens.create(user, ['*'], {
        expiresIn: '7 days',
      })

      return response.status(200).json({
        success: true,
        message: 'Connexion réussie',
        user: {
          id: user.id,
          full_name: user.full_name,
          email: user.email,
          role: user.role,
        },
        token: token.value?.release(),
      })
    } catch (error) {
      return response.status(401).json({
        success: false,
        message: 'Email ou mot de passe incorrect',
      })
    }
  }

  // Déconnexion
  async logout({ auth, response }: HttpContext) {
    try {
      const user = await auth.use('api').authenticate()
      const tokenId = user.currentAccessToken?.identifier
      if (tokenId) {
        await User.accessTokens.delete(user, tokenId)
      }

      return response.status(200).json({
        success: true,
        message: 'Déconnexion réussie',
      })
    } catch (error) {
      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la déconnexion',
      })
    }
  }

  // Profil de l'utilisateur
  async me({ auth, response }: HttpContext) {
    try {
      const user = await auth.use('api').authenticate()
      return response.status(200).json({
        success: true,
        user: {
          id: user.id,
          full_name: user.full_name,
          email: user.email,
          role: user.role,
          created_at: user.created_at,
        },
      })
    } catch (error) {
      return response.status(401).json({
        success: false,
        message: 'Non authentifié',
      })
    }
  }
}
