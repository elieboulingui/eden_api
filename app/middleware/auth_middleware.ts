// app/middleware/auth_middleware.ts
import type { HttpContext } from '@adonisjs/core/http'
import jwt from 'jsonwebtoken'
import User from '#models/user'

// Déclaration de type pour étendre l'interface Request
declare module '@adonisjs/core/http' {
  export interface Request {
    user?: User
  }
}

export default class AuthMiddleware {
  async handle({ request, response }: HttpContext, next: () => Promise<void>) {
    const authHeader = request.header('authorization')

    if (!authHeader) {
      return response.unauthorized({ message: 'Token manquant' })
    }

    const token = authHeader.replace('Bearer ', '')

    try {
      const decoded: any = jwt.verify(token, process.env.JWT_SECRET!)

      const user = await User.find(decoded.id)

      if (!user) {
        return response.unauthorized({ message: 'Utilisateur invalide' })
      }

      // Injecter user dans la requête
      request.user = user

      await next()
    } catch (error) {
      console.error('Erreur d\'authentification:', error.message)
      return response.unauthorized({ message: 'Token invalide' })
    }
  }
}
