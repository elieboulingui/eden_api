// app/controllers/contacts_controller.ts

import type { HttpContext } from '@adonisjs/core/http'
import Contact from '#models/contact'

export default class ContactsController {
  async store({ request, response }: HttpContext) {
    const { name, email, subject, message } = request.only([
      'name',
      'email',
      'subject',
      'message'
    ])

    await Contact.create({ name, email, subject, message })

    return response.status(201).json({
      success: true,
      message: 'Message envoyé avec succès'
    })
  }
}
