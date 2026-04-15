import User from '#models/user'
import type { HttpContext } from '@adonisjs/core/http'
import jwt from 'jsonwebtoken'
import hash from '@adonisjs/core/services/hash'
import { DateTime } from 'luxon'

const JWT_SECRET = process.env.JWT_SECRET || 'linemarket'

export default class SessionController {

  /**
   * Connexion utilisateur
   */
  async store({ request, response }: HttpContext) {
    try {
      const { email, password } = request.only(['email', 'password'])

      // Vérification des champs
      if (!email || !password) {
        return response.badRequest({
          success: false,
          message: 'Email et mot de passe requis'
        })
      }

      // Vérifier les credentials
      const user = await User.verifyCredentials(email, password)

      // Vérifier si le compte est actif
      if (!user.is_active) {
        return response.forbidden({
          success: false,
          message: 'Ce compte est désactivé'
        })
      }

      // Vérifier si le compte est bloqué
      if (user.is_blocked) {
        return response.forbidden({
          success: false,
          message: 'Ce compte est bloqué'
        })
      }

      // Mettre à jour la date de dernière connexion
      user.last_login_at = DateTime.now()
      await user.save()

      // Générer le token JWT
      const token = jwt.sign(
        {
          id: user.id,
          email: user.email,
          role: user.role
        },
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
          address: user.address,
          country: user.country,
          city: user.city,
          neighborhood: user.neighborhood,
          shop_name: user.shop_name,
          shop_image: user.shop_image,
          email_verified: user.email_verified,
          created_at: user.created_at,
          updated_at: user.updated_at,
          last_login_at: user.last_login_at
        },
        token,
      })

    } catch (error) {
      return response.unauthorized({
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
      const user = await User.find(payload.id)

      // Vérifier si l'utilisateur existe et est actif
      if (!user || !user.is_active || user.is_blocked) {
        return null
      }

      return user
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
        message: 'Non authentifié ou session expirée',
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
        country: user.country,
        city: user.city,
        neighborhood: user.neighborhood,
        shop_name: user.shop_name,
        shop_image: user.shop_image,
        shop_description: user.shop_description,
        email_verified: user.email_verified,
        two_factor_enabled: user.two_factor_enabled,
        created_at: user.created_at,
        updated_at: user.updated_at,
        last_login_at: user.last_login_at
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
        'address',
        'avatar',
        'country',
        'city',
        'neighborhood',
        'shop_name',
        'shop_description',
        'shop_image',
        'shop_address',
        'shop_city',
        'shop_country',
        'shop_phone',
        'shop_email',
        'language',
        'currency',
        'timezone',
        'notification_preferences'
      ])

      // Empêcher la modification de certains champs sensibles
      delete data.email
      delete data.password
      delete data.role
      delete data.is_active
      delete data.is_blocked

      user.merge(data)
      await user.save()

      return response.ok({
        success: true,
        message: 'Profil mis à jour avec succès',
        user: {
          id: user.id,
          full_name: user.full_name,
          email: user.email,
          role: user.role,
          avatar: user.avatar,
          phone: user.phone,
          address: user.address,
          country: user.country,
          city: user.city,
          neighborhood: user.neighborhood,
          shop_name: user.shop_name,
          shop_image: user.shop_image,
          shop_description: user.shop_description,
          created_at: user.created_at,
          updated_at: user.updated_at,
        },
      })

    } catch (error: any) {
      console.error('Erreur update profil:', error)
      return response.internalServerError({
        success: false,
        message: 'Erreur lors de la mise à jour du profil',
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

      // Validation
      if (!current_password || !new_password) {
        return response.badRequest({
          success: false,
          message: 'Les champs current_password et new_password sont obligatoires',
        })
      }

      if (new_password.length < 6) {
        return response.badRequest({
          success: false,
          message: 'Le nouveau mot de passe doit contenir au moins 6 caractères',
        })
      }

      if (new_password_confirmation && new_password !== new_password_confirmation) {
        return response.badRequest({
          success: false,
          message: 'La confirmation du nouveau mot de passe ne correspond pas',
        })
      }

      // Vérifier le mot de passe actuel
      const isVerified = await hash.verify(user.password, current_password)
      if (!isVerified) {
        return response.badRequest({
          success: false,
          message: 'Mot de passe actuel incorrect',
        })
      }

      // Mettre à jour le mot de passe
      user.password = await hash.make(new_password)
      await user.save()

      return response.ok({
        success: true,
        message: 'Mot de passe mis à jour avec succès',
      })
    } catch (error: any) {
      console.error('Erreur changement mot de passe:', error)
      return response.internalServerError({
        success: false,
        message: 'Erreur lors du changement de mot de passe',
        error: error.message,
      })
    }
  }

  /**
   * 🔄 Rafraîchir le token
   */
  async refresh({ request, response }: HttpContext) {
    try {
      const user = await this.getUserFromToken(request)

      if (!user) {
        return response.unauthorized({
          success: false,
          message: 'Token invalide ou expiré',
        })
      }

      // Générer un nouveau token
      const newToken = jwt.sign(
        {
          id: user.id,
          email: user.email,
          role: user.role
        },
        JWT_SECRET,
        { expiresIn: '7d' }
      )

      return response.ok({
        success: true,
        message: 'Token rafraîchi avec succès',
        token: newToken,
      })

    } catch (error: any) {
      return response.internalServerError({
        success: false,
        message: 'Erreur lors du rafraîchissement du token',
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
      message: 'Déconnexion réussie (supprimez le token côté client)',
    })
  }

  /**
   * Vérifier la validité du token
   */
  async validate({ request, response }: HttpContext) {
    try {
      const user = await this.getUserFromToken(request)

      if (!user) {
        return response.unauthorized({
          success: false,
          valid: false,
          message: 'Token invalide ou expiré',
        })
      }

      return response.ok({
        success: true,
        valid: true,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
      })

    } catch (error: any) {
      return response.internalServerError({
        success: false,
        valid: false,
        message: 'Erreur de validation',
        error: error.message,
      })
    }
  }
}