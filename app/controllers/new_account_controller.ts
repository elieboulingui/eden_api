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

      // 1. Validation
      const payload = await request.validateUsing(signupValidator)
      console.log('📥 Payload reçu:', payload)

      // 2. Vérifier email existant
      const existingUser = await User.findBy('email', payload.email)
      if (existingUser) {
        console.log('⚠️ Email déjà utilisé:', payload.email)
        return response.status(400).json({
          success: false,
          message: 'Cet email est déjà utilisé',
        })
      }

      // 3. Normaliser le rôle
      const role = payload.role || 'client'
      // 4. Création utilisateur
      const user = await User.create({
        full_name: payload.full_name,
        email: payload.email,
        password: payload.password,
        role,

        // 🔥 Champs boutique uniquement si marchand
        shop_name: role === 'merchant' ? payload.shop_name : null,
        shop_image: role === 'merchant' ? payload.shop_image : null,
      })

      let wallet = null

      // 5. Créer wallet si marchand
      if (user.role === 'merchant') {
        wallet = await Wallet.create({
          user_id: user.id,
          balance: 0,
          currency: 'XAF',
          status: 'active',
        })
      }

      // 6. Générer JWT
      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: '7d' }
      )

      // 7. Réponse
      const responseData: any = {
        success: true,
        message: 'Inscription réussie',
        user: {
          id: user.id,
          full_name: user.full_name,
          email: user.email,
          role: user.role,

          // 🔥 Infos boutique
          shop_name: user.shop_name,
          shop_image: user.shop_image,
        },
        token,
      }

      if (wallet) {
        responseData.wallet = {
          id: wallet.id,
          balance: wallet.balance,
          currency: wallet.currency,
          status: wallet.status,
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