import type { HttpContext } from '@adonisjs/core/http'

export default class HealthChecksController {
  public async index({ response }: HttpContext) {
    return response.ok({
      success: true,
      message: 'OK',
      timestamp: new Date().toISOString()
    })
  }
}