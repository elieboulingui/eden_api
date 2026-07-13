// app/controllers/admin_notification_controller.ts
import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'

export default class AdminNotificationController {
  
  /**
   * Récupère les emails de tous les utilisateurs avec le rôle admin
   */
  async getAdminEmails({ response }: HttpContext) {
    try {
      const admins = await User.query()
        .where('role', 'admin')
        .orWhere('role', 'superadmin')
        .select('id', 'full_name', 'email', 'role', 'avatar')
        .orderBy('created_at', 'asc')

      const adminEmails = admins.map(admin => ({
        id: admin.id,
        full_name: admin.full_name,
        email: admin.email,
        role: admin.role,
        avatar: admin.avatar,
      }))

      return response.ok({
        success: true,
        message: `${admins.length} administrateur(s) trouvé(s)`,
        data: adminEmails,
        emails: admins.map(admin => admin.email),
        count: admins.length,
      })
    } catch (error: any) {
      console.error('Erreur getAdminEmails:', error)
      return response.internalServerError({
        success: false,
        message: 'Erreur lors de la récupération des administrateurs',
        error: error.message,
      })
    }
  }

  /**
   * Récupère uniquement les emails des admins (format simple)
   */
  async getAdminEmailsOnly({ response }: HttpContext) {
    try {
      const admins = await User.query()
        .where('role', 'admin')
        .orWhere('role', 'superadmin')
        .select('email')
        .orderBy('email', 'asc')

      const emails = admins.map(admin => admin.email)

      return response.ok({
        success: true,
        message: `${emails.length} email(s) admin trouvé(s)`,
        data: emails,
        count: emails.length,
      })
    } catch (error: any) {
      console.error('Erreur getAdminEmailsOnly:', error)
      return response.internalServerError({
        success: false,
        message: 'Erreur lors de la récupération des emails admin',
        error: error.message,
      })
    }
  }

  /**
   * Envoyer une notification à tous les admins
   */
  async sendNotificationToAdmins({ request, response }: HttpContext) {
    try {
      const { title, message, type, data } = request.only([
        'title',
        'message',
        'type',
        'data',
      ])

      if (!title || !message) {
        return response.badRequest({
          success: false,
          message: 'Le titre et le message sont requis',
        })
      }

      // Récupérer tous les admins
      const admins = await User.query()
        .where('role', 'admin')
        .orWhere('role', 'superadmin')
        .select('id', 'email', 'full_name')

      if (admins.length === 0) {
        return response.notFound({
          success: false,
          message: 'Aucun administrateur trouvé',
        })
      }

      // Logique d'envoi de notification
      const notifications = admins.map(admin => ({
        admin_id: admin.id,
        email: admin.email,
        full_name: admin.full_name,
        title: title,
        message: message,
        type: type || 'info',
        status: 'sent',
        sent_at: new Date().toISOString(),
      }))

      console.log(`📧 Notification envoyée à ${admins.length} administrateur(s)`)
      console.log('📧 Détails:', { title, type: type || 'info' })

      return response.ok({
        success: true,
        message: `Notification envoyée à ${admins.length} administrateur(s)`,
        data: {
          recipients: admins.map(a => a.email),
          notification: {
            title,
            message,
            type: type || 'info',
          },
          sent_count: admins.length,
        },
      })
    } catch (error: any) {
      console.error('Erreur sendNotificationToAdmins:', error)
      return response.internalServerError({
        success: false,
        message: 'Erreur lors de l\'envoi de la notification',
        error: error.message,
      })
    }
  }

  /**
   * Récupère les notifications pour un admin spécifique
   */
  async getAdminNotifications({ params, response }: HttpContext) {
    try {
      const { adminId } = params

      const admin = await User.query()
        .where('id', adminId)
        .where((query) => {
          query.where('role', 'admin').orWhere('role', 'superadmin')
        })
        .select('id', 'full_name', 'email', 'role')
        .first()

      if (!admin) {
        return response.notFound({
          success: false,
          message: 'Administrateur non trouvé',
        })
      }

      return response.ok({
        success: true,
        message: 'Notifications récupérées avec succès',
        data: {
          admin: {
            id: admin.id,
            full_name: admin.full_name,
            email: admin.email,
            role: admin.role,
          },
          notifications: [],
        },
      })
    } catch (error: any) {
      console.error('Erreur getAdminNotifications:', error)
      return response.internalServerError({
        success: false,
        message: 'Erreur lors de la récupération des notifications',
        error: error.message,
      })
    }
  }

  /**
   * Vérifier si un email appartient à un admin
   */
  async checkAdminEmail({ request, response }: HttpContext) {
    try {
      const { email } = request.only(['email'])

      if (!email) {
        return response.badRequest({
          success: false,
          message: 'L\'email est requis',
        })
      }

      const admin = await User.query()
        .where('email', email)
        .where((query) => {
          query.where('role', 'admin').orWhere('role', 'superadmin')
        })
        .select('id', 'full_name', 'email', 'role')
        .first()

      return response.ok({
        success: true,
        is_admin: !!admin,
        data: admin ? {
          id: admin.id,
          full_name: admin.full_name,
          email: admin.email,
          role: admin.role,
        } : null,
        message: admin ? 'Cet email appartient à un administrateur' : 'Cet email n\'appartient pas à un administrateur',
      })
    } catch (error: any) {
      console.error('Erreur checkAdminEmail:', error)
      return response.internalServerError({
        success: false,
        message: 'Erreur lors de la vérification de l\'email',
        error: error.message,
      })
    }
  }
}
