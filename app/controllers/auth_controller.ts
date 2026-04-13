// app/controllers/auth_controller.ts
import User from '#models/user'
import type { HttpContext } from '@adonisjs/core/http'
import { signupValidator, loginValidator } from '#validators/user'
import redis from '@adonisjs/redis/services/main'

export default class ApiAuthController {

  /**
   * 📝 Inscription d'un nouvel utilisateur
   * Avec rate limiting par IP pour éviter les abus
   */
  async register({ request, response }: HttpContext) {
    try {
      const clientIp = request.ip()

      // 🔒 Rate limiting : Max 3 inscriptions par IP en 1 heure
      const registerRateKey = `register_attempts:${clientIp}`
      const registerAttempts = await redis.incr(registerRateKey)

      if (registerAttempts === 1) {
        await redis.expire(registerRateKey, 3600) // 1 heure
      }

      if (registerAttempts > 3) {
        const ttl = await redis.ttl(registerRateKey)
        return response.status(429).json({
          success: false,
          message: `Trop de tentatives d'inscription. Réessayez dans ${Math.ceil(ttl / 60)} minutes.`,
        })
      }

      const payload = await request.validateUsing(signupValidator)

      // Vérifier dans le cache d'abord
      const emailCacheKey = `user:email:${payload.email.toLowerCase()}`
      const cachedUserId = await redis.get(emailCacheKey)

      if (cachedUserId) {
        return response.status(400).json({
          success: false,
          message: 'Cet email est déjà utilisé',
        })
      }

      // Vérifier en base de données
      const existingUser = await User.findBy('email', payload.email)
      if (existingUser) {
        // Mettre en cache pour les futures vérifications
        await redis.set(emailCacheKey, existingUser.id.toString(), 'EX', 86400) // 24h
        return response.status(400).json({
          success: false,
          message: 'Cet email est déjà utilisé',
        })
      }

      // Créer l'utilisateur
      const user = await User.create({
        full_name: payload.full_name,
        email: payload.email,
        password: payload.password,
        role: 'client',
      })

      // 📦 Mettre en cache l'email
      await redis.set(emailCacheKey, user.id.toString(), 'EX', 86400) // 24h

      // 📦 Mettre en cache les données utilisateur
      const userDataKey = `user:data:${user.id}`
      const userData = {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
      }
      await redis.set(userDataKey, JSON.stringify(userData), 'EX', 3600) // 1h

      // Créer le token
      const token = await User.accessTokens.create(user, ['*'], {
        expiresIn: '7 days',
      })

      // 🔑 Stocker le token dans Redis
      if (token.identifier) {
        const tokenKey = `token:${token.identifier}`
        await redis.set(
          tokenKey,
          JSON.stringify({
            userId: user.id,
            createdAt: new Date().toISOString(),
            ip: clientIp,
            expiresIn: '7 days'
          }),
          'EX',
          86400 * 7 // 7 jours
        )
      }

      // ✅ Réinitialiser le compteur d'inscriptions
      await redis.del(registerRateKey)

      // 📊 Logger l'inscription
      const userEventsKey = `user_events:${user.id}`
      await redis.lpush(
        userEventsKey,
        JSON.stringify({
          event: 'register',
          timestamp: new Date().toISOString(),
          ip: clientIp,
          userAgent: request.header('User-Agent')
        })
      )
      await redis.ltrim(userEventsKey, 0, 49) // Garder 50 derniers événements
      await redis.expire(userEventsKey, 86400 * 90) // 90 jours

      return response.status(201).json({
        success: true,
        message: 'Inscription réussie',
        user: userData,
        token: token.value?.release(),
      })

    } catch (error: any) {
      // Gestion des erreurs de validation
      if (error.code === 'E_VALIDATION_ERROR') {
        return response.status(422).json({
          success: false,
          message: 'Erreur de validation',
          errors: error.messages,
        })
      }

      console.error('❌ Erreur inscription:', error)
      return response.status(400).json({
        success: false,
        message: 'Erreur lors de l\'inscription',
        errors: error.messages || error.message,
      })
    }
  }

  /**
   * 🔐 Connexion utilisateur
   * Avec rate limiting, cache et gestion des tokens
   */
  async login({ request, response }: HttpContext) {
    try {
      const clientIp = request.ip()

      // 🔒 Rate limiting par IP
      const loginRateKey = `login_attempts:${clientIp}`
      const loginAttempts = await redis.incr(loginRateKey)

      if (loginAttempts === 1) {
        await redis.expire(loginRateKey, 900) // 15 minutes
      }

      if (loginAttempts > 5) {
        const ttl = await redis.ttl(loginRateKey)
        return response.status(429).json({
          success: false,
          message: `Trop de tentatives. Réessayez dans ${Math.ceil(ttl / 60)} minutes.`,
        })
      }

      const { email, password } = await request.validateUsing(loginValidator)

      // 🔍 Vérifier si l'utilisateur existe via le cache
      const emailCacheKey = `user:email:${email.toLowerCase()}`
      let user: User | null = null

      const cachedUserId = await redis.get(emailCacheKey)

      if (cachedUserId) {
        user = await User.find(cachedUserId)
      }

      // Si pas dans le cache, chercher en base
      if (!user) {
        try {
          user = await User.verifyCredentials(email, password)

          // Mettre en cache pour les futures connexions
          if (user) {
            await redis.set(emailCacheKey, user.id.toString(), 'EX', 86400) // 24h
          }
        } catch (verifyError) {
          return response.status(401).json({
            success: false,
            message: 'Email ou mot de passe incorrect',
          })
        }
      } else {
        // Vérifier le mot de passe manuellement
        const isValidPassword = await user.verifyPassword(password)
        if (!isValidPassword) {
          return response.status(401).json({
            success: false,
            message: 'Email ou mot de passe incorrect',
          })
        }
      }

      // ✅ Connexion réussie : réinitialiser le compteur
      await redis.del(loginRateKey)

      // 📦 Mettre en cache les données utilisateur
      const userDataKey = `user:data:${user.id}`
      const userData = {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
      }
      await redis.set(userDataKey, JSON.stringify(userData), 'EX', 3600) // 1h

      // 🔄 Supprimer les anciens tokens
      const existingTokens = await User.accessTokens.all(user)
      for (const oldToken of existingTokens) {
        await User.accessTokens.delete(user, oldToken.identifier)
        // Nettoyer aussi dans Redis
        await redis.del(`token:${oldToken.identifier}`)
      }

      // Créer un nouveau token
      const token = await User.accessTokens.create(user, ['*'], {
        expiresIn: '7 days',
      })

      // 🔑 Stocker le token dans Redis
      if (token.identifier) {
        const tokenKey = `token:${token.identifier}`
        await redis.set(
          tokenKey,
          JSON.stringify({
            userId: user.id,
            createdAt: new Date().toISOString(),
            ip: clientIp,
            userAgent: request.header('User-Agent'),
            expiresIn: '7 days'
          }),
          'EX',
          86400 * 7 // 7 jours
        )
      }

      // 📊 Logger la connexion
      const loginHistoryKey = `login_history:${user.id}`
      await redis.lpush(
        loginHistoryKey,
        JSON.stringify({
          timestamp: new Date().toISOString(),
          ip: clientIp,
          userAgent: request.header('User-Agent')
        })
      )
      await redis.ltrim(loginHistoryKey, 0, 9) // Garder 10 dernières connexions
      await redis.expire(loginHistoryKey, 86400 * 30) // 30 jours

      // 📊 Ajouter aux événements utilisateur
      const userEventsKey = `user_events:${user.id}`
      await redis.lpush(
        userEventsKey,
        JSON.stringify({
          event: 'login',
          timestamp: new Date().toISOString(),
          ip: clientIp
        })
      )
      await redis.ltrim(userEventsKey, 0, 49)

      return response.status(200).json({
        success: true,
        message: 'Connexion réussie',
        user: userData,
        token: token.value?.release(),
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

      return response.status(401).json({
        success: false,
        message: 'Email ou mot de passe incorrect',
      })
    }
  }

  /**
   * 🚪 Déconnexion utilisateur
   * Supprime le token et nettoie le cache
   */
  async logout({ auth, response }: HttpContext) {
    try {
      const user = await auth.use('api').authenticate()
      const tokenId = user.currentAccessToken?.identifier

      if (tokenId) {
        // Supprimer de la base de données
        await User.accessTokens.delete(user, tokenId)

        // 🗑️ Supprimer de Redis
        await redis.del(`token:${tokenId}`)
      }

      // 🧹 Optionnel : Supprimer le cache des données utilisateur
      // pour forcer un rechargement à la prochaine connexion
      await redis.del(`user:data:${user.id}`)

      // 📊 Logger la déconnexion
      const userEventsKey = `user_events:${user.id}`
      await redis.lpush(
        userEventsKey,
        JSON.stringify({
          event: 'logout',
          timestamp: new Date().toISOString(),
          ip: request.ip()
        })
      )
      await redis.ltrim(userEventsKey, 0, 49)

      return response.status(200).json({
        success: true,
        message: 'Déconnexion réussie',
      })
    } catch (error) {
      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la déconnexion',
      })
    }
  }

  /**
   * 👤 Profil de l'utilisateur connecté
   * Avec mise en cache pour de meilleures performances
   */
  async me({ auth, response }: HttpContext) {
    try {
      const user = await auth.use('api').authenticate()

      // 🔍 Vérifier d'abord dans le cache
      const cacheKey = `user:data:${user.id}`
      const cachedUser = await redis.get(cacheKey)

      if (cachedUser) {
        return response.status(200).json({
          success: true,
          source: 'cache',
          user: JSON.parse(cachedUser),
        })
      }

      // Si pas en cache, construire les données
      const userData = {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
        created_at: user.created_at,
      }

      // 📦 Mettre en cache pour les prochaines requêtes
      await redis.set(cacheKey, JSON.stringify(userData), 'EX', 3600) // 1h

      return response.status(200).json({
        success: true,
        source: 'database',
        user: userData,
      })

    } catch (error) {
      return response.status(401).json({
        success: false,
        message: 'Non authentifié',
      })
    }
  }

  /**
   * 🔧 Méthode utilitaire : Vérifier si un token est valide dans Redis
   * À utiliser dans un middleware d'authentification
   */
  async isTokenValid(tokenIdentifier: string): Promise<boolean> {
    const tokenKey = `token:${tokenIdentifier}`
    const tokenData = await redis.get(tokenKey)
    return tokenData !== null
  }

  /**
   * 🔧 Méthode utilitaire : Révoquer tous les tokens d'un utilisateur
   * Force la déconnexion sur tous les appareils
   */
  async revokeAllUserTokens(userId: number): Promise<void> {
    // Incrémenter la version de l'utilisateur
    // Les middlewares peuvent vérifier cette version
    const versionKey = `user:version:${userId}`
    await redis.incr(versionKey)

    // Logger l'action
    const userEventsKey = `user_events:${userId}`
    await redis.lpush(
      userEventsKey,
      JSON.stringify({
        event: 'all_tokens_revoked',
        timestamp: new Date().toISOString(),
      })
    )
  }

  /**
   * 📊 Méthode utilitaire : Récupérer l'historique des connexions
   */
  async getLoginHistory(userId: number): Promise<any[]> {
    const historyKey = `login_history:${userId}`
    const history = await redis.lrange(historyKey, 0, -1)
    return history.map(entry => JSON.parse(entry))
  }

  /**
   * 📊 Méthode utilitaire : Récupérer les événements utilisateur
   */
  async getUserEvents(userId: number): Promise<any[]> {
    const eventsKey = `user_events:${userId}`
    const events = await redis.lrange(eventsKey, 0, -1)
    return events.map(entry => JSON.parse(entry))
  }

  /**
   * 🔄 Méthode utilitaire : Rafraîchir le cache d'un utilisateur
   */
  async refreshUserCache(userId: number): Promise<void> {
    const user = await User.find(userId)
    if (user) {
      const userData = {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
        created_at: user.created_at,
      }
      await redis.set(`user:data:${userId}`, JSON.stringify(userData), 'EX', 3600)
      await redis.set(`user:email:${user.email.toLowerCase()}`, userId.toString(), 'EX', 86400)
    }
  }
}
