import User from '#models/user'
import type { HttpContext } from '@adonisjs/core/http'
import jwt from 'jsonwebtoken'
import hash from '@adonisjs/core/services/hash'

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
          avatar: user.avatar,
          phone: user.phone,
          address: user.address, // ✅ Adresse déjà présente
          country: user.country, // ✅ Ajout du pays
          shop_name: user.shop_name, // ✅ Ajout boutique (si marchand)
          shop_image: user.shop_image, // ✅ Ajout image boutique
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
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        phone: user.phone,
        address: user.address,
        country: user.country, // ✅ Ajout du pays
        shop_name: user.shop_name, // ✅ Ajout boutique
        shop_image: user.shop_image, // ✅ Ajout image boutique
        created_at: user.created_at,
        updated_at: user.updated_at,
      },
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

      const data = request.only([
        'full_name',
        'phone',
        'address', // ✅ Adresse déjà incluse
        'avatar',
        'country', // ✅ Ajout du pays
      ])

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
          avatar: user.avatar,
          phone: user.phone,
          address: user.address,
          country: user.country,
          shop_name: user.shop_name,
          shop_image: user.shop_image,
          created_at: user.created_at,
          updated_at: user.updated_at,
        },
      })

    } catch (error: any) {
      return response.internalServerError({
        success: false,
        message: 'Erreur update profil',
        error: error.message,
      })
    }
  }

  /**
   * 🔐 Modifier le mot de passe
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

      const { current_password, new_password, new_password_confirmation } = request.only([
        'current_password',
        'new_password',
        'new_password_confirmation',
      ])

      if (!current_password || !new_password) {
        return response.badRequest({
          success: false,
          message: 'Les champs current_password et new_password sont obligatoires',
        })
      }

      if (new_password_confirmation && new_password !== new_password_confirmation) {
        return response.badRequest({
          success: false,
          message: 'La confirmation du nouveau mot de passe ne correspond pas',
        })
      }

      const isVerified = await hash.verify(user.password, current_password)
      if (!isVerified) {
        return response.badRequest({
          success: false,
          message: 'Mot de passe actuel incorrect',
        })
      }

      user.password = await hash.make(new_password)
      await user.save()

      return response.ok({
        success: true,
        message: 'Mot de passe mis à jour',
      })
    } catch (error: any) {
      return response.internalServerError({
        success: false,
        message: 'Erreur lors du changement de mot de passe',
        error: error.message,
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
