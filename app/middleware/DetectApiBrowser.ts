import { HttpContext } from '@adonisjs/core/http'

export default class BlockBrowserApiMiddleware {
  async handle({ request, response }: HttpContext, next: () => Promise<void>) {
    // Si c'est une route API
    if (request.url().startsWith('/api')) {
      const acceptHeader = request.header('accept') || ''
      
      // Si c'est un navigateur
      if (acceptHeader.includes('text/html') && !acceptHeader.includes('application/json')) {
        return response.status(404).send('Not Found')
      }
    }
    
    await next()
  }
}
