// app/controllers/ContractsController.ts

import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import Contract from '#models/contract'
import { DateTime } from 'luxon'

export default class ContractsController {
  
  /**
   * GET /api/client/:id
   * Récupère les infos d'un utilisateur/client
   */
  async getClientById({ params, response }: HttpContext) {
    try {
      const user = await User.query()
        .where('id', params.id)
        .first()

      if (!user) {
        return response.status(404).json({
          success: false,
          message: 'Utilisateur non trouvé'
        })
      }

      return response.json({
        success: true,
        data: user
      })

    } catch (err) {
      const error = err as Error
      return response.status(500).json({
        success: false,
        message: 'Erreur serveur',
        error: error.message
      })
    }
  }

  /**
   * GET /api/shops/user/:userId
   * Récupère la boutique d'un utilisateur
   */
  async getShopByUser({ params, response }: HttpContext) {
    try {
      // Cherche la boutique via une requête directe
      const Shop = (await import('#models/shop')).default
      const shop = await Shop.query()
        .where('user_id', params.userId)
        .first()

      return response.json({
        success: true,
        data: shop || null
      })

    } catch (err) {
      const error = err as Error
      return response.status(500).json({
        success: false,
        message: 'Erreur serveur',
        error: error.message
      })
    }
  }

  /**
   * GET /api/contract/by-name/:name
   * Recherche un contrat par le nom du vendeur
   */
  async getByName({ params, response }: HttpContext) {
    try {
      const contracts = await Contract.query()
        .where('vendor_info', 'like', `%${params.name}%`)

      return response.json({
        success: true,
        data: contracts
      })

    } catch (err) {
      const error = err as Error
      return response.status(500).json({
        success: false,
        message: 'Erreur serveur',
        error: error.message
      })
    }
  }

  /**
   * POST /api/contracts/sign-and-send
   * Signe et sauvegarde un contrat
   */
  async signAndSend({ request, response }: HttpContext) {
    try {
      const {
        vendorInfo,
        signature,
        signedAt,
        userId,
        contractType = 'vendor_partnership',
        contractNumber,
        adminEmail = 'edenmarcket@gmail.com',
        vendorEmail
      } = request.body()

      // Validation
      if (!vendorInfo || !signature || !vendorEmail || !contractNumber) {
        return response.status(400).json({
          success: false,
          message: 'Données manquantes : vendorInfo, signature, vendorEmail, contractNumber sont requis'
        })
      }

      // Sauvegarder le contrat
      const contract = await Contract.create({
        userId: userId || null,
        contractNumber: contractNumber,
        contractType: contractType,
        vendorInfo: typeof vendorInfo === 'string' ? JSON.parse(vendorInfo) : vendorInfo,
        signature: signature,
        status: 'signed',
        signedAt: DateTime.fromISO(signedAt),
        expiresAt: DateTime.now().plus({ years: 1 }),
        adminEmail: adminEmail,
        vendorEmail: vendorEmail,
        metadata: JSON.stringify({
          signedFrom: request.ip(),
          userAgent: request.header('User-Agent')
        })
      })

      console.log(`✅ Contrat ${contractNumber} signé par ${vendorEmail}`)

      return response.json({
        success: true,
        message: 'Contrat signé et sauvegardé avec succès',
        data: {
          id: contract.id,
          contractNumber: contract.contractNumber,
          status: contract.status,
          signedAt: contract.signedAt,
          expiresAt: contract.expiresAt
        }
      })

    } catch (err) {
      const error = err as Error
      console.error('❌ Erreur signature contrat:', error)
      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la signature du contrat',
        error: error.message
      })
    }
  }

  /**
   * GET /api/contracts
   * Liste tous les contrats
   */
  async index({ response }: HttpContext) {
    try {
      const contracts = await Contract.query()
        .orderBy('created_at', 'desc')

      return response.json({
        success: true,
        data: contracts
      })
    } catch (err) {
      const error = err as Error
      return response.status(500).json({
        success: false,
        message: 'Erreur serveur',
        error: error.message
      })
    }
  }

  /**
   * GET /api/contracts/:id
   * Affiche un contrat spécifique
   */
  async show({ params, response }: HttpContext) {
    try {
      const contract = await Contract.find(params.id)

      if (!contract) {
        return response.status(404).json({
          success: false,
          message: 'Contrat non trouvé'
        })
      }

      return response.json({
        success: true,
        data: contract
      })
    } catch (err) {
      const error = err as Error
      return response.status(500).json({
        success: false,
        message: 'Erreur serveur',
        error: error.message
      })
    }
  }

}
