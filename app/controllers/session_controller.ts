// app/controllers/session_controller.ts
import User from '#models/user'
import type { HttpContext } from '@adonisjs/core/http'

export default class SessionController {
  /**
   * Connexion d'un utilisateur (API)
   * POST /api/session/login
   */
  async store({ request, auth, response }: HttpContext) {
    try {
      const { email, password } = request.only(['email', 'password'])

      const user = await User.verifyCredentials(email, password)

      // Vérifier que l'utilisateur a un uuid (le générer si nécessaire)
      if (!user.uuid) {
        const { v4: uuidv4 } = await import('uuid')
        user.uuid = uuidv4()
        await user.save()
      }

      // Créer un token API pour l'utilisateur
      const token = await User.accessTokens.create(user, ['*'], {
        expiresIn: '7 days'
      })

      // Log pour déboguer
      console.log('🔵 Utilisateur connecté:', {
        id: user.id,
        uuid: user.uuid,
        full_name: user.full_name,
        email: user.email,
        role: user.role
      })

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
        token: token.value?.release()
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
   * Mettre à jour le profil utilisateur
   * PUT /api/profile/update
   */
  async update({ request, auth, response }: HttpContext) {
    try {
      // Authentifier l'utilisateur
      const user = await auth.use('api').authenticate()
      
      // Récupérer les données à mettre à jour
      const { full_name, email, phone, address } = request.only(['full_name', 'email', 'phone', 'address'])

      // Vérifier si l'email est déjà utilisé par un autre utilisateur
      if (email && email !== user.email) {
        const existingUser = await User.findBy('email', email)
        if (existingUser && existingUser.id !== user.id) {
          return response.status(400).json({
            success: false,
            message: 'Cet email est déjà utilisé par un autre compte',
          })
        }
      }

      // Mettre à jour les champs
      if (full_name !== undefined) user.full_name = full_name
      if (email !== undefined) user.email = email
      if (phone !== undefined) user.phone = phone
      if (address !== undefined) user.address = address

      // Sauvegarder les modifications
      await user.save()

      console.log('✅ Profil mis à jour pour:', user.email)

      return response.status(200).json({
        success: true,
        message: 'Profil mis à jour avec succès',
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
        }
      })
    } catch (error) {
      console.error('❌ Erreur mise à jour profil:', error)
      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la mise à jour du profil',
        error: error.message
      })
    }
  }

  /**
   * Changer le mot de passe
   * POST /api/profile/change-password
   */
  async changePassword({ request, auth, response }: HttpContext) {
    try {
      // Authentifier l'utilisateur
      const user = await auth.use('api').authenticate()
      
      const { current_password, new_password, confirm_password } = request.only([
        'current_password', 
        'new_password', 
        'confirm_password'
      ])

      // Vérifier que les mots de passe correspondent
      if (new_password !== confirm_password) {
        return response.status(400).json({
          success: false,
          message: 'Les nouveaux mots de passe ne correspondent pas',
        })
      }

      // Vérifier le mot de passe actuel
      const isPasswordValid = await user.verifyPassword(current_password)
      if (!isPasswordValid) {
        return response.status(400).json({
          success: false,
          message: 'Le mot de passe actuel est incorrect',
        })
      }

      // Mettre à jour le mot de passe
      user.password = new_password
      await user.save()

      // Supprimer tous les tokens existants pour forcer une reconnexion
      const tokens = await User.accessTokens.all(user)
      for (const token of tokens) {
        await User.accessTokens.delete(user, token.identifier)
      }

      console.log('✅ Mot de passe changé pour:', user.email)

      return response.status(200).json({
        success: true,
        message: 'Mot de passe changé avec succès. Veuillez vous reconnecter.',
      })
    } catch (error) {
      console.error('❌ Erreur changement mot de passe:', error)
      return response.status(500).json({
        success: false,
        message: 'Erreur lors du changement de mot de passe',
        error: error.message
      })
    }
  }

  /**
   * Récupérer le profil utilisateur
   * GET /api/profile
   */
  async profile({ auth, response }: HttpContext) {
    try {
      const user = await auth.use('api').authenticate()

      return response.status(200).json({
        success: true,
        user: {
          id: user.id,
          uuid: user.uuid,
          full_name: user.full_name,
          email: user.email,
          role: user.role,
          created_at: user.created_at,
          updated_at: user.updated_at,
        }
      })
    } catch (error) {
      return response.status(401).json({
        success: false,
        message: 'Non authentifié',
      })
    }
  }

  /**
   * Déconnexion d'un utilisateur (API)
   * POST /api/session/logout
   */
  async destroy({ auth, response }: HttpContext) {
    try {
      const user = await auth.use('api').authenticate()
      const token = user.currentAccessToken?.identifier

      if (token) {
        await User.accessTokens.delete(user, token)
      }

      return response.status(200).json({
        success: true,
        message: 'Déconnexion réussie'
      })
    } catch (error) {
      console.error('❌ Erreur de déconnexion:', error)
      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la déconnexion',
      })
    }
  }
}