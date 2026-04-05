import User from '#models/user'
import type { HttpContext } from '@adonisjs/core/http'

/**
 * SessionController handles user authentication and session management.
 * It provides methods for displaying the login page, authenticating users,
 * and logging out.
 */
export default class SessionController {
  /**
   * Display the login page
   */
  async create({ view }: HttpContext) {
    return view.render('pages/auth/login')
  }

  /**
   * Authenticate user credentials and create a new session
   */
  async stores({ request, auth, response, session }: HttpContext) {
    const { email, password } = request.all()

    const wantsJson = request.accepts('json')

    try {
      const user = await User.verifyCredentials(email, password)
      await auth.use('web').login(user)
      if (wantsJson) {
        return response.ok({
          success: true,
          message: 'Connexion réussie',
          user: {
            id: user.id,
            full_name: user.full_name,
            email: user.email,
          },
        })
      }

      return response.redirect().toRoute('home')
    } catch (error) {
      session.flash('error', 'Identifiants invalides')
      if (wantsJson) {
        return response.unauthorized({
          success: false,
          message: 'Identifiants invalides',
        })
      }

      return response.redirect().back()
    }
  }

  /**
   * Log out the current user and destroy their session
   */
  async destroy({ auth, response }: HttpContext) {
    await auth.use('web').logout()
    response.redirect().toRoute('session.create')
  }
}
