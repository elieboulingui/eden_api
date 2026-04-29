import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

export default class BlockUnauthorizedOriginMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const { request, response } = ctx

    // SOLUTION TEMPORAIRE : Autoriser toutes les origines
    response.header('Access-Control-Allow-Origin', '*')
    response.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH')
    response.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept')
    response.header('Access-Control-Max-Age', '86400')

    // Gérer les requêtes OPTIONS (preflight)
    if (request.method() === 'OPTIONS') {
      return response.status(200).send('OK')
    }

    const output = await next()
    return output
  }
}
