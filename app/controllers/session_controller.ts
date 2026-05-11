import User from '#models/user'
import type { HttpContext } from '@adonisjs/core/http'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'linemarket'

export default class SessionController {
  /**
   * Connexion utilisateur - Supporte web et API
   * ✅ Vérifie si le compte est vérifié pour les marchands
   */
  async store({ request, response, session }: HttpContext) {
    try {
      const { email, password } = request.only(['email', 'password'])

      console.log('🔐 Tentative de connexion:', { email })

      // Vérifier si l'utilisateur existe
      const user = await User.findBy('email', email)
      
      if (!user) {
        console.log('❌ Utilisateur non trouvé:', email)
        
        if (request.accepts(['json'])) {
          return response.status(401).json({
            success: false,
            message: 'Email ou mot de passe incorrect',
          })
        }
        
        session.flash('errors', {
          email: 'Email ou mot de passe incorrect',
        })
        return response.redirect().back()
      }

      // ✅ VÉRIFICATION : Si c'est un marchand, vérifier si le compte est validé
      if (user.isMerchant) {
        // Vérifier si l'email est vérifié
        if (!user.is_email_verified) {
          console.log('❌ Email non vérifié pour le marchand:', email)
          
          if (request.accepts(['json'])) {
            return response.status(403).json({
              success: false,
              message: 'Votre adresse email n\'a pas encore été vérifiée. Veuillez vérifier votre email avant de vous connecter.',
              code: 'EMAIL_NOT_VERIFIED',
            })
          }
          
          session.flash('errors', {
            email: 'Votre adresse email n\'a pas encore été vérifiée.',
          })
          return response.redirect().back()
        }

        // Vérifier si le compte marchand est approuvé
        if (!user.is_verified) {
          console.log('❌ Compte marchand non vérifié pour:', email)
          
          // Message personnalisé selon le statut
          let message = 'Votre compte marchand est en attente de validation.'
          if (user.verification_status === 'rejected') {
            message = `Votre compte marchand a été rejeté. Raison : ${user.rejection_reason || 'Non spécifiée'}`
          } else if (user.verification_status === 'pending') {
            message = 'Votre compte marchand est en cours de validation. Vous recevrez un email dès qu\'il sera activé.'
          }
          
          if (request.accepts(['json'])) {
            return response.status(403).json({
              success: false,
              message: message,
              code: 'ACCOUNT_NOT_VERIFIED',
              verification_status: user.verification_status,
              rejection_reason: user.rejection_reason || null,
            })
          }
          
          session.flash('errors', {
            email: message,
          })
          return response.redirect().back()
        }
      }

      // Vérifier le mot de passe
      try {
        await User.verifyCredentials(email, password)
      } catch (error) {
        console.log('❌ Mot de passe incorrect pour:', email)
        
        if (request.accepts(['json'])) {
          return response.status(401).json({
            success: false,
            message: 'Email ou mot de passe incorrect',
          })
        }
        
        session.flash('errors', {
          password: 'Email ou mot de passe incorrect',
        })
        return response.redirect().back()
      }

      // Générer le token JWT
      const token = jwt.sign(
        { 
          id: user.id, 
          email: user.email, 
          role: user.role || 'client',
          is_verified: user.is_verified,
          is_email_verified: user.is_email_verified,
          verification_status: user.verification_status,
        },
        JWT_SECRET,
        { expiresIn: '7d' }
      )

      console.log('✅ Connexion réussie pour:', email)

      const userData = {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        role: user.role || 'client',
        phone: user.phone,
        address: user.address,
        avatar: user.avatar,
        is_verified: user.is_verified,
        is_email_verified: user.is_email_verified,
        verification_status: user.verification_status,
        country: user.country,
        neighborhood: user.neighborhood,
        created_at: user.created_at,
        updated_at: user.updated_at,
      }

      // Ajouter les infos marchand si applicable
      if (user.isMerchant) {
        Object.assign(userData, {
          shop_name: user.shop_name,
          commercial_name: user.commercial_name,
          vendor_type: user.vendor_type,
          shop_address: user.shop_address,
          whatsapp_phone: user.whatsapp_phone,
          shop_description: user.shop_description,
          logo_url: user.logo_url,
        })
      }

      // Réponse pour API
      if (request.accepts(['json'])) {
        return response.status(200).json({
          success: true,
          message: 'Connexion réussie',
          user: userData,
          token,
        })
      }

      // Réponse pour Web
      session.put('user', userData)
      session.put('token', token)
      session.flash('success', 'Connexion réussie')
      
      return response.redirect().toPath('/')

    } catch (error) {
      console.error('🔥 Erreur connexion:', error)
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue'
      
      if (request.accepts(['json'])) {
        return response.status(500).json({
          success: false,
          message: 'Erreur serveur lors de la connexion',
          error: errorMessage,
        })
      }
      
      session.flash('errors', {
        server: 'Erreur serveur lors de la connexion',
      })
      return response.redirect().back()
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
   * 📧 Vérifier si l'email est confirmé
   */
  async checkEmailVerification({ request, response }: HttpContext) {
    try {
      const { email } = request.only(['email'])
      
      const user = await User.findBy('email', email)
      
      if (!user) {
        return response.status(404).json({
          success: false,
          message: 'Utilisateur non trouvé',
        })
      }
      
      return response.status(200).json({
        success: true,
        is_email_verified: user.is_email_verified,
        is_verified: user.is_verified,
        verification_status: user.verification_status,
        message: user.is_email_verified 
          ? 'Email vérifié' 
          : 'Email non vérifié',
      })
    } catch (error) {
      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la vérification',
      })
    }
  }

  /**
   * Profil utilisateur
   */
  async profile({ request, response }: HttpContext) {
    try {
      const user = await this.getUserFromToken(request)

      if (!user) {
        return response.status(401).json({
          success: false,
          message: 'Non authentifié',
        })
      }

      const userData: any = {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        address: user.address,
        avatar: user.avatar,
        is_verified: user.is_verified,
        is_email_verified: user.is_email_verified,
        verification_status: user.verification_status,
        country: user.country,
        neighborhood: user.neighborhood,
        created_at: user.created_at,
        updated_at: user.updated_at,
      }

      // Ajouter les infos marchand
      if (user.isMerchant) {
        Object.assign(userData, {
          shop_name: user.shop_name,
          commercial_name: user.commercial_name,
          vendor_type: user.vendor_type,
          shop_address: user.shop_address,
          whatsapp_phone: user.whatsapp_phone,
          shop_description: user.shop_description,
          logo_url: user.logo_url,
          birth_date: user.birth_date,
          id_number: user.id_number,
          business_type: user.vendor_type,
          payment_method: user.payment_method,
        })
      }

      return response.status(200).json({
        success: true,
        user: userData,
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération du profil',
        error: errorMessage,
      })
    }
  }

  /**
   * Mise à jour du profil
   */
  async update({ request, response }: HttpContext) {
    try {
      const user = await this.getUserFromToken(request)

      if (!user) {
        return response.status(401).json({
          success: false,
          message: 'Non authentifié',
        })
      }

      const data = request.only(['full_name', 'phone', 'address'])

      user.merge(data)
      await user.save()

      return response.status(200).json({
        success: true,
        message: 'Profil mis à jour avec succès',
        user: {
          id: user.id,
          full_name: user.full_name,
          email: user.email,
          role: user.role,
          phone: user.phone,
          address: user.address,
        },
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la mise à jour du profil',
        error: errorMessage,
      })
    }
  }

  /**
   * Changement de mot de passe
   */
  async changePassword({ request, response }: HttpContext) {
    try {
      const user = await this.getUserFromToken(request)

      if (!user) {
        return response.status(401).json({
          success: false,
          message: 'Non authentifié',
        })
      }

      const { currentPassword, newPassword } = request.only([
        'currentPassword',
        'newPassword',
      ])

      try {
        await User.verifyCredentials(user.email, currentPassword)
      } catch (error) {
        return response.status(400).json({
          success: false,
          message: 'Mot de passe actuel incorrect',
        })
      }

      if (!newPassword || newPassword.length < 6) {
        return response.status(400).json({
          success: false,
          message: 'Le nouveau mot de passe doit contenir au moins 6 caractères',
        })
      }

      user.password = newPassword
      await user.save()

      return response.status(200).json({
        success: true,
        message: 'Mot de passe modifié avec succès',
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      return response.status(500).json({
        success: false,
        message: 'Erreur lors du changement de mot de passe',
        error: errorMessage,
      })
    }
  }

  /**
   * Déconnexion
   */
  async destroy({ response, session }: HttpContext) {
    session.clear()
    
    return response.status(200).json({
      success: true,
      message: 'Déconnexion réussie',
    })
  }
}
