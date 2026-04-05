import User from '#models/user'
import { signupValidator } from '#validators/user'
import type { HttpContext } from '@adonisjs/core/http'

/**
 * NewAccountController handles user registration.
 * It provides methods for displaying the signup page and creating
 * new user accounts.
 */
export default class NewAccountController {
  /**
   * Display the signup page
   */
  async create({ view }: HttpContext) {
    return view.render('pages/auth/signup')
  }

  /**
   * Create a new user account and authenticate the user
   */
  async stores({ request, response, auth, session }: HttpContext) {
    const payload = await request.validateUsing(signupValidator)
    const existingUser = await User.findBy('email', payload.email)
    if (existingUser) {
      session.flash('error', 'Cet email est déjà utilisé')
      return response.redirect().back()
    }

    const user = await User.create({ ...payload })

    await auth.use('web').login(user)
    response.redirect().toRoute('home')
  }
}
