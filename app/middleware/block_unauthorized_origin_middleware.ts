import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

export default class BlockUnauthorizedOriginMiddleware {
  // Origines autorisées avec correspondance exacte
  private readonly allowedOrigins = new Set([
    'http://localhost',
    'http://localhost:3000',
    'http://localhost:3333',
    'https://paradis-alimentaires.vercel.app',
    'https://ecomerce-api-aotc.onrender.com'
  ])

  async handle(ctx: HttpContext, next: NextFn) {
    const { request, response } = ctx

    const origin = request.header('origin')
    const referer = request.header('referer')
    const userAgent = request.header('user-agent') || ''

    // 1. Bloquer Postman et outils similaires par User-Agent
    const blockedUserAgents = [
      'postman',
      'insomnia',
      'thunder client',
      'curl',
      'wget',
      'httpie',
      'paw',
      'hopper'
    ]

    const isBlockedTool = blockedUserAgents.some(tool =>
      userAgent.toLowerCase().includes(tool)
    )

    if (isBlockedTool) {
      return response.status(403).json({
        error: 'Forbidden',
        message: 'Automated tools and API clients are not allowed'
      })
    }

    // 2. Vérification stricte de l'origine
    // Si pas d'origine ET pas de referer suspect
    if (!origin) {
      // Vérifier si le referer vient d'une origine autorisée
      if (referer) {
        const refererUrl = new URL(referer)
        const refererOrigin = `${refererUrl.protocol}//${refererUrl.host}`

        if (!this.allowedOrigins.has(refererOrigin)) {
          return response.status(403).json({
            error: 'Forbidden',
            message: 'Access denied: Invalid referer'
          })
        }
      } else {
        // Ni origin, ni referer = probablement un outil comme Postman
        return response.status(403).json({
          error: 'Forbidden',
          message: 'Access denied: Direct API access not allowed'
        })
      }
    }

    // 3. Vérifier si l'origine est autorisée
    if (!this.allowedOrigins.has(origin)) {
      return response.status(403).json({
        error: 'Forbidden',
        message: `Origin ${origin} is not allowed`
      })
    }

    // 4. Ajouter un header personnalisé obligatoire (protection supplémentaire)
    const customHeader = request.header('x-application-name')
    if (!customHeader || customHeader !== 'paradis-alimentaires-app') {
      return response.status(403).json({
        error: 'Forbidden',
        message: 'Invalid application header'
      })
    }

    // Configuration CORS pour l'origine autorisée
    response.header('Access-Control-Allow-Origin', origin)
    response.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS')
    response.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Application-Name')
    response.header('Access-Control-Allow-Credentials', 'true')

    // Gérer les requêtes OPTIONS (preflight)
    if (request.method() === 'OPTIONS') {
      return response.status(200).send('')
    }

    return await next()
  }
}
