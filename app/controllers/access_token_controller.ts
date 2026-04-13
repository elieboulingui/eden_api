import User from '#models/user'
import { loginValidator } from '#validators/user'
import type { HttpContext } from '@adonisjs/core/http'
import UserTransformer from '#transformers/user_transformer'
import redis from '@adonisjs/redis/services/main'

export default class AccessTokenController {
  /**
   * Login - Crée un token d'accès pour l'utilisateur
   */
  async store({ request, response }: HttpContext) {
    try {
      // Validation des données
      const { email, password } = await request.validateUsing(loginValidator)

      // ✅ Correction : Récupérer l'IP via request.ip()
      const clientIp = request.ip()

      // 🔒 Rate Limiting : Vérifier les tentatives de connexion par IP
      const rateLimitKey = `login_attempts:${clientIp}`
      const attempts = await redis.incr(rateLimitKey)

      // Définir l'expiration à la première tentative
      if (attempts === 1) {
        await redis.expire(rateLimitKey, 900) // 15 minutes
      }

      // Bloquer après 5 tentatives échouées
      if (attempts > 5) {
        const ttl = await redis.ttl(rateLimitKey)
        return response.status(429).json({
          success: false,
          message: `Trop de tentatives. Réessayez dans ${Math.ceil(ttl / 60)} minutes.`,
        })
      }

      // 🔍 Vérifier d'abord dans le cache si l'utilisateur existe
      const cacheKey = `user:email:${email.toLowerCase()}`
      let user: User | null = null

      const cachedUserId = await redis.get(cacheKey)

      if (cachedUserId) {
        // L'utilisateur existe, on le récupère
        user = await User.find(cachedUserId)
      }

      // Vérifier les credentials (si pas trouvé dans le cache)
      if (!user) {
        try {
          user = await User.verifyCredentials(email, password)

          // Mettre en cache l'ID de l'utilisateur pour les futures vérifications
          if (user) {
            await redis.set(cacheKey, user.id.toString(), 'EX', 86400) // 24 heures
          }
        } catch (verifyError) {
          // Échec de l'authentification
          return response.status(401).json({
            success: false,
            message: 'Email ou mot de passe invalide',
          })
        }
      } else {
        // Vérifier le mot de passe manuellement car l'utilisateur vient du cache
        const isValidPassword = await user.verifyPassword(password)
        if (!isValidPassword) {
          return response.status(401).json({
            success: false,
            message: 'Email ou mot de passe invalide',
          })
        }
      }

      // ✅ Connexion réussie : réinitialiser le compteur de tentatives
      await redis.del(rateLimitKey)

      // 📦 Mettre en cache les informations complètes de l'utilisateur
      const userDataKey = `user:data:${user.id}`
      await redis.set(
        userDataKey,
        JSON.stringify(UserTransformer.transform(user)),
        'EX',
        3600 // 1 heure
      )

      // Créer un token d'accès
      const token = await User.accessTokens.create(user)

      // 🔑 Stocker le token dans Redis
      const tokenKey = `token:${token.identifier}`
      await redis.set(
        tokenKey,
        JSON.stringify({
          userId: user.id,
          createdAt: new Date().toISOString(),
          ip: clientIp
        }),
        'EX',
        86400 * 7 // 7 jours
      )

      // 📊 Journalisation des connexions réussies
      const loginHistoryKey = `login_history:${user.id}`
      await redis.lpush(
        loginHistoryKey,
        JSON.stringify({
          timestamp: new Date().toISOString(),
          ip: clientIp,
          userAgent: request.header('User-Agent')
        })
      )
      await redis.ltrim(loginHistoryKey, 0, 9) // Garder les 10 dernières connexions
      await redis.expire(loginHistoryKey, 86400 * 30) // 30 jours

      return response.status(200).json({
        success: true,
        data: {
          user: UserTransformer.transform(user),
          token: token.value!.release(),
        },
      })

    } catch (error: any) {
      // Gestion des erreurs de validation
      if (error.code === 'E_VALIDATION_ERROR') {
        return response.status(422).json({
          success: false,
          message: 'Données invalides',
          errors: error.messages,
        })
      }

      console.error('❌ Erreur lors de la connexion:', error)
      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la connexion',
        error: error.message,
      })
    }
  }

  /**
   * Logout - Supprime le token courant et nettoie le cache
   */
  async destroy({ auth, response }: HttpContext) {
    try {
      const user = await auth.getUserOrFail()
      const userWithToken = user as User & { currentAccessToken: any }

      if (userWithToken.currentAccessToken) {
        // Supprimer le token de la base de données
        await User.accessTokens.delete(user, userWithToken.currentAccessToken.identifier)

        // 🗑️ Supprimer le token de Redis
        const tokenKey = `token:${userWithToken.currentAccessToken.identifier}`
        await redis.del(tokenKey)
      }

      // 🧹 Optionnel : Supprimer le cache des données utilisateur
      const userDataKey = `user:data:${user.id}`
      await redis.del(userDataKey)

      return response.status(200).json({
        success: true,
        message: 'Déconnexion réussie',
      })
    } catch (error: any) {
      console.error('❌ Erreur lors de la déconnexion:', error)
      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la déconnexion',
        error: error.message,
      })
    }
  }

  /**
   * 🔧 Méthode utilitaire : Vérifier si un token est révoqué
   */
  async isTokenRevoked(identifier: string): Promise<boolean> {
    const tokenKey = `token:${identifier}`
    const tokenData = await redis.get(tokenKey)
    return tokenData === null
  }

  /**
   * 🔧 Méthode utilitaire : Nettoyer tous les tokens d'un utilisateur
   */
  async revokeAllUserTokens(userId: number): Promise<void> {
    const versionKey = `user:version:${userId}`
    await redis.incr(versionKey)
  }

  /**
   * 📊 Méthode utilitaire : Récupérer l'historique des connexions
   */
  async getLoginHistory(userId: number): Promise<any[]> {
    const historyKey = `login_history:${userId}`
    const history = await redis.lrange(historyKey, 0, -1)
    return history.map(entry => JSON.parse(entry))
  }
}
