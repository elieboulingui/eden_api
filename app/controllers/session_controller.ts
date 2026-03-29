import User from '#models/user'
import type { HttpContext } from '@adonisjs/core/http'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'linemarket'

export default class SessionController {
  /**
   * Connexion d'un utilisateur (API)
   * POST /api/client/login
   */
  async store({ request, response }: HttpContext) {
    try {
      const { email, password } = request.only(['email', 'password'])

      const user = await User.verifyCredentials(email, password)

      // Générer un JWT
      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: '7d' }
      )

      return response.status(200).json({
        success: true,
        message: 'Connexion réussie',
        user: {
          id: user.id,
          uuid: user.uuid,
          full_name: user.full_name,
          email: user.email,
          role: user.role,
          phone: user.phone,
          address: user.address,
          created_at: user.created_at,
          updated_at: user.updated_at,
        },
        token, // JWT ici
      })
    } catch (error) {
      console.error('❌ Erreur de connexion:', error)
      return response.status(401).json({
        success: false,
        message: 'Email ou mot de passe incorrect',
      })
    }
  }

  /**
   * Middleware : récupérer l'utilisateur depuis le JWT
   */
  private async getUserFromToken(request: HttpContext['request']) {
    const authHeader = request.header('Authorization')
    if (!authHeader) return null

    const token = authHeader.replace('Bearer ', '')
    try {
      const payload: any = jwt.verify(token, JWT_SECRET)
      const user = await User.find(payload.id)
      return user
    } catch {
      return null
    }
  }

  /**
   * Récupérer le profil utilisateur
   * GET /api/profile
   */
  async profile({ request, response }: HttpContext) {
    const user = await this.getUserFromToken(request)
    if (!user) {
      return response.status(401).json({
        success: false,
        message: 'Non authentifié',
      })
    }

    return response.status(200).json({
      success: true,
      user: {
        id: user.id,
        uuid: user.uuid,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        address: user.address,
        created_at: user.created_at,
        updated_at: user.updated_at,
      },
    })
  }

  /**
   * Déconnexion (JWT stateless => côté client)
   * POST /api/session/logout
   */
  async destroy({ response }: HttpContext) {
    // Avec JWT classique, la "déconnexion" est côté client :
    // il suffit de supprimer le token côté frontend.
    return response.status(200).json({
      success: true,
      message: 'Déconnexion réussie. Supprimez le token côté client.',
    })
  }
}
