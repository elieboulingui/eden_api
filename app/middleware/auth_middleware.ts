import type { HttpContext } from '@adonisjs/core/http'
import jwt from 'jsonwebtoken'
import User from '#models/user'

declare module '@adonisjs/core/http' {
  interface HttpContext {
    user?: User
  }
}

export default class AuthMiddleware {
  public async handle(ctx: HttpContext, next: () => Promise<void>) {
    const { request, response } = ctx

    const authHeader = request.header('authorization')

    if (!authHeader) {
      return response.unauthorized({ message: 'Token manquant' })
    }

    const token = authHeader.replace('Bearer ', '')

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { id: number }

      const user = await User.find(decoded.id)

      if (!user) {
        return response.unauthorized({ message: 'Utilisateur invalide' })
      }

      // ✅ Injection du user dans le contexte
      ctx.user = user

      await next()
    } catch (error: any) {
      console.error('Erreur auth:', error.message)
      return response.unauthorized({ message: 'Token invalide' })
    }
  }
}