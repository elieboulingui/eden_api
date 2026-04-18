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
          created_at: user.created_at,
          updated_at: user.updated_at,
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
      user,
    })
  }

  /**
   * ✅ UPDATE PROFIL
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
        user,
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      return response.internalServerError({
        success: false,
        message: 'Erreur update profil',
        error: errorMessage,
      })
    }
  }

  /**
   * 🔐 CHANGER MOT DE PASSE
   */
  async changePassword({ request, response }: HttpContext) {
    try {
      const user = await this.getUserFromToken(request)

      if (!user) {
        return response.unauthorized({
          success: false,
          message: 'Non authentifié',
        })
      }

      const { currentPassword, newPassword } = request.only([
        'currentPassword',
        'newPassword',
      ])

      // Vérifier le mot de passe actuel
      try {
        await User.verifyCredentials(user.email, currentPassword)
      } catch (error) {
        return response.badRequest({
          success: false,
          message: 'Mot de passe actuel incorrect',
        })
      }

      // Valider le nouveau mot de passe
      if (!newPassword || newPassword.length < 6) {
        return response.badRequest({
          success: false,
          message: 'Le nouveau mot de passe doit contenir au moins 6 caractères',
        })
      }

      // Mettre à jour le mot de passe
      user.password = newPassword
      await user.save()

      return response.ok({
        success: true,
        message: 'Mot de passe modifié avec succès',
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      return response.internalServerError({
        success: false,
        message: 'Erreur lors du changement de mot de passe',
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
