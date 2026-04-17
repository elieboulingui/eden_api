import { HttpContext } from '@adonisjs/core/http'

export default class DetectApiBrowserMiddleware {
  async handle({ request, response }: HttpContext, next: () => Promise<void>) {
    // Laisse passer la requête normalement
    await next()
    
    // Vérifie si l'URL commence par /api
    if (request.url().startsWith('/api')) {
      // Vérifie si c'est un navigateur (demande du HTML)
      const acceptHeader = request.header('accept') || ''
      const isBrowserRequest = acceptHeader.includes('text/html') && !acceptHeader.includes('application/json')
      
      // Si c'est un navigateur, retourne 404
      if (isBrowserRequest) {
        return response.status(404).send({
          success: false,
          error: 'Resource not found'
        })
      }
    }
  }
}
