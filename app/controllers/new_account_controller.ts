// app/controllers/new_account_controller.ts
import User from '#models/user'
import Wallet from '#models/wallet'
import { signupValidator } from '#validators/user'
import type { HttpContext } from '@adonisjs/core/http'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'linemarket'

export default class NewAccountController {
  /**
   * Inscription d'un nouvel utilisateur (API)
   * POST /api/client/register
   */
  async store({ request, response }: HttpContext) {
    try {
      console.log('🟢 Début de l’inscription')

      // Valider les données envoyées
      const payload = await request.validateUsing(signupValidator)
      console.log('📥 Payload reçu:', payload)

      // Vérifier si l'email existe déjà
      const existingUser = await User.findBy('email', payload.email)
      if (existingUser) {
        console.log('⚠️ Email déjà utilisé:', payload.email)
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
        role: payload.role || 'client',
      })

      let wallet = null
      // Si c'est un marchand, créer un wallet
      if (user.role === 'marchant' || user.role === 'merchant') {
        wallet = await Wallet.create({
          user_id: user.id,
          balance: 0,
          currency: 'XAF',
          status: 'active'
        })
      }

      // Générer un JWT
      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: '7d' }
      )

      // Préparer la réponse
      const responseData: any = {
        success: true,
        message: 'Inscription réussie',
        user: {
          id: user.id,
          full_name: user.full_name,
          email: user.email,
          role: user.role,
        },
        token, // JWT ici
      }

      if (wallet) {
        responseData.wallet = {
          id: wallet.id,
          balance: wallet.balance,
          currency: wallet.currency,
          status: wallet.status
        }
      }

      return response.status(201).json(responseData)
    } catch (error: any) {
      console.error('❌ Erreur lors de l\'inscription:', error)
      return response.status(400).json({
        success: false,
        message: 'Erreur lors de l\'inscription',
        errors: error.messages || error.message,
      })
    }
  }
}
