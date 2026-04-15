import { DateTime } from 'luxon'
import User from '#models/user'
import type { HttpContext } from '@adonisjs/core/http'

export default class NewAccountController {
  async store({ request, response }: HttpContext) {
    try {
      const data = request.only([
        'role',
        'country',
        'neighborhood',
        'birth_date',
        'id_number',
        'id_front_url',
        // ... autres champs
        'password',
      ])

      // ✅ CORRECTION : Convertir birth_date en DateTime
      const userData = {
        ...data,
        birth_date: data.birth_date ? DateTime.fromISO(data.birth_date) : null,
      }

      const user = await User.create(userData)

      return response.created({
        success: true,
        message: 'Compte créé avec succès',
        user,
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue'
      return response.badRequest({
        success: false,
        message: 'Erreur création compte',
        error: errorMessage,
      })
    }
  }
}
