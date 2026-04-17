import { HttpContext } from '@adonisjs/core/http'

export default class DetectApiBrowserMiddleware {
  async handle({ request, response }: HttpContext, next: () => Promise<void>) {
    // Exécute d'abord la route normalement
    await next()
    
    // Vérifie si l'URL commence par /api
    const isApiRoute = request.url().startsWith('/api')
    
    if (isApiRoute) {
      // Récupère l'en-tête Accept du navigateur
      const acceptHeader = request.header('accept') || ''
      
      // Vérifie si c'est un navigateur qui demande du HTML
      const isBrowserRequest = acceptHeader.includes('text/html') && !acceptHeader.includes('application/json')
      
      // Si c'est un navigateur qui essaie d'accéder à l'API
      if (isBrowserRequest) {
        // Retourne une erreur 404
        return response.status(404).send({
          error: 'Page non trouvée',
          message: 'Cette ressource n\'est pas accessible directement depuis le navigateur'
        })
      }
    }
  }
}
