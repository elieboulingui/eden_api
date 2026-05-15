// app/controllers/ContractsController.ts

import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import Contract from '#models/contract'
import { DateTime } from 'luxon'

export default class ContractsController {
  
  /**
   * GET /api/client/:id
   */
  async getClientById({ params, response }: HttpContext) {
    try {
      const user = await User.find(params.id)

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
   */
  async getShopByUser({ params, response }: HttpContext) {
    try {
      const user = await User.find(params.userId)

      return response.json({
        success: true,
        data: user || null
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

      if (!vendorInfo || !signature || !vendorEmail || !contractNumber) {
        return response.status(400).json({
          success: false,
          message: 'Données manquantes'
        })
      }

      const contract = await Contract.create({
        userId: userId || null,
        contractNumber,
        contractType,
        vendorInfo: typeof vendorInfo === 'string' ? JSON.parse(vendorInfo) : vendorInfo,
        signature,
        status: 'signed',
        signedAt: DateTime.fromISO(signedAt),
        expiresAt: DateTime.now().plus({ years: 1 }),
        adminEmail,
        vendorEmail,
        metadata: {
          signedFrom: request.ip(),
          userAgent: request.header('User-Agent')
        }
      })

      return response.json({
        success: true,
        message: 'Contrat signé avec succès',
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
      console.error('Erreur signature contrat:', error)
      return response.status(500).json({
        success: false,
        message: 'Erreur serveur',
        error: error.message
      })
    }
  }

  /**
   * GET /api/contracts
   */
  async index({ response }: HttpContext) {
    try {
      const contracts = await Contract.query().orderBy('created_at', 'desc')

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
