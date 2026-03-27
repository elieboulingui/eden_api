import User from '#models/user'
import type { HttpContext } from '@adonisjs/core/http'

export default class UsersController {
  /**
   * Récupérer tous les clients
   * GET /api/users
   */
  async index({ response, auth }: HttpContext) {
    try {
      // Vérifier si l'utilisateur est authentifié
      const user = auth.user
      if (!user) {
        return response.status(401).json({
          success: false,
          message: 'Non authentifié'
        })
      }

      // Récupérer tous les utilisateurs avec rôle client
      const clients = await User.query()
        .where('role', 'client')
        .orderBy('created_at', 'desc')
        .select('id', 'full_name', 'email', 'role', 'created_at', 'updated_at')

      return response.status(200).json({
        success: true,
        data: clients,
        count: clients.length
      })
    } catch (error) {
      console.error('Erreur:', error)
      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des clients',
        error: error.message
      })
    }
  }

  /**
   * Récupérer un client spécifique
   * GET /api/users/:id
   */
  async show({ params, response, auth }: HttpContext) {
    try {
      const user = auth.user
      if (!user) {
        return response.status(401).json({
          success: false,
          message: 'Non authentifié'
        })
      }

      const client = await User.query()
        .where('id', params.id)
        .where('role', 'client')
        .first()

      if (!client) {
        return response.status(404).json({
          success: false,
          message: 'Client non trouvé'
        })
      }

      return response.status(200).json({
        success: true,
        data: client
      })
    } catch (error) {
      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération du client',
        error: error.message
      })
    }
  }
}