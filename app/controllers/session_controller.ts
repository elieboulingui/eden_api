import User from '#models/user'
import type { HttpContext } from '@adonisjs/core/http'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'linemarket'

export default class SessionController {
  /**
   * Connexion utilisateur - Supporte web et API
   */
  async store({ request, response, session }: HttpContext) {
    try {
      const { email, password } = request.only(['email', 'password'])

      console.log('🔐 Tentative de connexion:', { email })

      // Vérifier si l'utilisateur existe
      const user = await User.findBy('email', email)
      
      if (!user) {
        console.log('❌ Utilisateur non trouvé:', email)
        
        // Si c'est une requête API (accepte JSON)
        if (request.accepts(['json'])) {
          return response.status(401).json({
            success: false,
            message: 'Email ou mot de passe incorrect',
          })
        }
        
        // Sinon, retour à la vue web avec flash messages
        session.flash('errors', {
          email: 'Email ou mot de passe incorrect',
        })
        return response.redirect().back()
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
          role: user.role || 'client' 
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
        created_at: user.created_at,
        updated_at: user.updated_at,
      }

      // Réponse pour API - Format PLAT sans "data"
      if (request.accepts(['json'])) {
        return response.status(200).json({
          success: true,
          message: 'Connexion réussie',
          user: userData,    // Directement à la racine
          token,             // Directement à la racine
        })
      }

      // Réponse pour Web - stocker le token dans la session
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

      return response.status(200).json({
        success: true,
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

      // Vérifier le mot de passe actuel
      try {
        await User.verifyCredentials(user.email, currentPassword)
      } catch (error) {
        return response.status(400).json({
          success: false,
          message: 'Mot de passe actuel incorrect',
        })
      }

      // Valider le nouveau mot de passe
      if (!newPassword || newPassword.length < 6) {
        return response.status(400).json({
          success: false,
          message: 'Le nouveau mot de passe doit contenir au moins 6 caractères',
        })
      }

      // Mettre à jour le mot de passe
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
    // Nettoyer la session pour le web
    session.clear()
    
    return response.status(200).json({
      success: true,
      message: 'Déconnexion réussie',
    })
  }
}
