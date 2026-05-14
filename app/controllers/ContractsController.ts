// app/controllers/ContractsController.ts (version complète)

import type { HttpContext } from '@adonisjs/core/http'
import Client from '#models/client'
import Shop from '#models/shop'
import Contract from '#models/contract'
import { DateTime } from 'luxon'

export default class ContractsController {
  
  /**
   * GET /api/client/:id
   */
  async getClientById({ params, response }: HttpContext) {
    try {
      const client = await Client.query()
        .where('id', params.id)
        .preload('shop')
        .first()

      if (!client) {
        return response.status(404).json({
          success: false,
          message: 'Client non trouvé'
        })
      }

      return response.json({
        success: true,
        data: client
      })

    } catch (error) {
      return response.status(500).json({
        success: false,
        message: 'Erreur serveur',
        error: error.message
      })
    }
  }

  /**
   * GET /api/shops/user/:userId
   */
  async getShopByUser({ params, response }: HttpContext) {
    try {
      const shop = await Shop.query()
        .where('user_id', params.userId)
        .first()

      if (!shop) {
        return response.status(404).json({
          success: false,
          message: 'Boutique non trouvée'
        })
      }

      return response.json({
        success: true,
        data: shop
      })

    } catch (error) {
      return response.status(500).json({
        success: false,
        message: 'Erreur serveur',
        error: error.message
      })
    }
  }

  /**
   * GET /api/contract/by-name/:name
   */
  async getByName({ params, response }: HttpContext) {
    try {
      const contracts = await Client.query()
        .where('full_name', 'like', `%${params.name}%`)
        .orWhere('company_name', 'like', `%${params.name}%`)

      return response.json({
        success: true,
        data: contracts
      })

    } catch (error) {
      return response.status(500).json({
        success: false,
        message: 'Erreur serveur',
        error: error.message
      })
    }
  }

  /**
   * POST /api/contracts/sign-and-send
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

      // Sauvegarder le contrat en base de données
      const contract = await Contract.create({
        userId: userId || null,
        contractNumber: contractNumber,
        contractType: contractType,
        vendorInfo: vendorInfo,
        signature: signature,
        status: 'signed',
        signedAt: DateTime.fromISO(signedAt),
        expiresAt: DateTime.now().plus({ years: 1 }), // Contrat valable 1 an
        adminEmail: adminEmail,
        vendorEmail: vendorEmail,
        metadata: {
          signedFrom: request.ip(),
          userAgent: request.header('User-Agent')
        }
      })

      // TODO: Génération du PDF
      // TODO: Envoi des emails

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

    } catch (error) {
      console.error('Erreur signature contrat:', error)
      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la signature du contrat',
        error: error.message
      })
    }
  }

  /**
   * GET /api/contracts
   */
  async index({ response }: HttpContext) {
    try {
      const contracts = await Contract.query()
        .preload('client')
        .orderBy('created_at', 'desc')

      return response.json({
        success: true,
        data: contracts
      })
    } catch (error) {
      return response.status(500).json({
        success: false,
        message: 'Erreur serveur',
        error: error.message
      })
    }
  }

  /**
   * GET /api/contracts/:id
   */
  async show({ params, response }: HttpContext) {
    try {
      const contract = await Contract.query()
        .where('id', params.id)
        .preload('client')
        .first()

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
    } catch (error) {
      return response.status(500).json({
        success: false,
        message: 'Erreur serveur',
        error: error.message
      })
    }
  }

}
