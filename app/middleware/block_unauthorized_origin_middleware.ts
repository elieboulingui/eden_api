import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

export default class BlockUnauthorizedOriginMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const { request, response } = ctx

    const origin = request.header('origin')

    // Liste des origines autorisées
    const allowedOrigins = [
      'http://localhost',
      'http://localhost:3000',
      'http://localhost:3333',
      'https://eden-azure-one.vercel.app',
      'https://ecomerce-api-aotc.onrender.com'
    ]

    // Vérifier si l'origine est dans la liste des autorisées
    // On utilise some() pour supporter les différentes variations de localhost avec port
    const isAllowed = origin ? allowedOrigins.some(allowed =>
      origin.startsWith(allowed) || origin === allowed
    ) : false

    // Bloquer les requêtes sans origine ou avec une origine non autorisée
    if (origin && !isAllowed) {
      return response.status(403).json({
        error: 'Forbidden',
        message: 'Access denied: Origin not allowed'
      })
    }

    // Ajouter l'en-tête CORS pour les origines autorisées
    if (origin && isAllowed) {
      response.header('Access-Control-Allow-Origin', origin)
    }
    response.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    response.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')

    // Gérer les requêtes preflight OPTIONS
    if (request.method() === 'OPTIONS') {
      return response.status(204).send('')
    }

    const output = await next()
    return output
  }
}
