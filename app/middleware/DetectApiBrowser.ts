import { HttpContext } from '@adonisjs/core/http'

export default class DetectApiBrowserMiddleware {
  async handle(ctx: HttpContext, next: () => Promise<void>) {
    await next()

    // Après l'exécution de la route, on regarde si :
    // 1. L'URL commence par /api
    // 2. La requête a été faite par un navigateur (Accept: text/html)
    // 3. La réponse n'est pas déjà une erreur ou une redirection
    if (
      ctx.request.url().startsWith('/api') &&
      ctx.request.accepts(['html', 'json']) === 'html' &&
      ctx.response.getStatus() === 200
    ) {
      return ctx.response.notFound({
        error: 'Resource not found'
      })
    }
  }
}
