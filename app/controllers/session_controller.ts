import User from '#models/user'
import type { HttpContext } from '@adonisjs/core/http'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'linemarket'

export default class SessionController {
  /**
   * Connexion utilisateur
   */
  async store({ request, response }: HttpContext) {
    try {
      const { email, password } = request.only(['email', 'password'])

      const user = await User.verifyCredentials(email, password)

      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: '7d' }
      )

      // Convert DateTime to ISO string for JSON response
      return response.ok({
        success: true,
        message: 'Connexion réussie',
        user: {
          id: user.id,
          full_name: user.full_name,
          email: user.email,
          role: user.role,
          phone: user.phone,
          address: user.address,
          created_at: user.created_at?.toISO(),
          updated_at: user.updated_at?.toISO(),
        },
        token,
      })
    } catch (error) {
      return response.status(401).json({
        success: false,
        message: 'Email ou mot de passe incorrect',
      })
    }
  }

  /**
   * 🔐 Récupérer user depuis JWT
   */
  private async getUserFromToken(request: HttpContext['request']) {
    const authHeader = request.header('Authorization')

    if (!authHeader) return null

    const token = authHeader.replace('Bearer ', '')

    try {
      const payload: any = jwt.verify(token, JWT_SECRET)
      return await User.find(payload.id)
    } catch {
      return null
    }
  }

  /**
   * Profil utilisateur
   */
  async profile({ request, response }: HttpContext) {
    const user = await this.getUserFromToken(request)

    if (!user) {
      return response.unauthorized({
        success: false,
        message: 'Non authentifié',
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
        created_at: user.created_at?.toISO(),
        updated_at: user.updated_at?.toISO(),
      },
    })
  }

  /**
   * ✅ UPDATE PROFIL (FIX ERREUR TS)
   */
  async update({ request, response }: HttpContext) {
    try {
      const user = await this.getUserFromToken(request)

      if (!user) {
        return response.unauthorized({
          success: false,
          message: 'Non authentifié',
        })
      }

      const data = request.only(['full_name', 'phone', 'address'])

      user.merge(data)
      await user.save()

      return response.ok({
        success: true,
        message: 'Profil mis à jour',
        user: {
          id: user.id,
          full_name: user.full_name,
          email: user.email,
          role: user.role,
          phone: user.phone,
          address: user.address,
          created_at: user.created_at?.toISO(),
          updated_at: user.updated_at?.toISO(),
        },
      })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur inconnue'
      return response.internalServerError({
        success: false,
        message: 'Erreur update profil',
        error: errorMessage,
      })
    }
  }

  /**
   * Déconnexion
   */
  async destroy({ response }: HttpContext) {
    return response.ok({
      success: true,
      message: 'Déconnexion réussie (supprimer le token côté client)',
    })
  }
}
