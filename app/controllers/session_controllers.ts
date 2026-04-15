import User from '#models/user'
import type { HttpContext } from '@adonisjs/core/http'
import jwt from 'jsonwebtoken'
import env from '#start/env'

export default class SessionController {
  /**
   * Authenticate user credentials and return a JWT token
   */
  async store({ request, response }: HttpContext) {
    const { email, password } = request.all()

    try {
      const user = await User.verifyCredentials(email, password)

      // Création du payload JWT
      const payload = {
        userId: user.id,
        email: user.email,
        full_name: user.full_name,
      }

      // Génération du token JWT
      const token = jwt.sign(payload, 'APP_KEY', {
        expiresIn: '7d', // Token valide 7 jours
      })

      return response.status(200).json({
        success: true,
        message: 'Connexion réussie',
        user: {
          id: user.id,
          full_name: user.full_name,
          email: user.email,
        },
        token: {
          type: 'Bearer',
          value: token,
        },
      })
    } catch (error) {
      return response.status(401).json({
        success: false,
        message: 'Identifiants invalides',
      })
    }
  }

  /**
   * Get current authenticated user (via JWT)
   */
  async me({ request, response }: HttpContext) {
    try {
      // Récupération du token depuis le header Authorization
      const authHeader = request.header('Authorization')

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return response.status(401).json({
          success: false,
          message: 'Token manquant ou invalide',
        })
      }

      const token = authHeader.split(' ')[1]

      // Vérification et décodage du token
      const decoded = jwt.verify(token, 'APP_KEY') as any

      // Récupération de l'utilisateur
      const user = await User.find(decoded.userId)

      if (!user) {
        return response.status(404).json({
          success: false,
          message: 'Utilisateur non trouvé',
        })
      }

      return response.status(200).json({
        success: true,
        user: {
          id: user.id,
          full_name: user.full_name,
          email: user.email,
        },
      })
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        return response.status(401).json({
          success: false,
          message: 'Token invalide',
        })
      }

      if (error instanceof jwt.TokenExpiredError) {
        return response.status(401).json({
          success: false,
          message: 'Token expiré',
        })
      }

      return response.status(401).json({
        success: false,
        message: 'Non authentifié',
      })
    }
  }

  /**
   * Log out - côté client uniquement (supprimer le token)
   */
  async destroy({ response }: HttpContext) {
    // Avec JWT, la déconnexion se fait côté client en supprimant le token
    // On peut ajouter une blacklist si nécessaire, mais pour une API simple,
    // il suffit que le client supprime le token de son stockage

    return response.status(200).json({
      success: true,
      message: 'Déconnexion réussie (supprimez le token côté client)',
    })
  }
}
