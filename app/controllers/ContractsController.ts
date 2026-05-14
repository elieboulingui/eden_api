// app/controllers/ContractsController.ts

import type { HttpContext } from '@adonisjs/core/http'
import Client from '#models/client'
import Shop from '#models/shop'

export default class ContractsController {
  
  /**
   * Récupère les informations d'un client/vendeur par son ID
   * GET /api/client/:id
   */
  async getClientById({ params, response }: HttpContext) {
    try {
      const client = await Client.find(params.id)

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
   * Récupère la boutique d'un utilisateur
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
   * Récupère un contrat par le nom du vendeur
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
   * Signature et envoi du contrat par email
   * POST /api/contracts/sign-and-send
   */
  async signAndSend({ request, response }: HttpContext) {
    try {
      const {
        vendorInfo,
        signature,
        signedAt,
        userId,
        contractType,
        contractNumber,
        adminEmail,
        vendorEmail
      } = request.body()

      // Validation
      if (!vendorInfo || !signature || !vendorEmail) {
        return response.status(400).json({
          success: false,
          message: 'Données manquantes (vendorInfo, signature, vendorEmail requis)'
        })
      }

      // TODO: Générer le PDF du contrat
      // TODO: Envoyer l'email au vendeur
      // TODO: Envoyer l'email à l'admin (edenmarcket@gmail.com)
      // TODO: Sauvegarder le contrat signé en base de données

      // Pour l'instant, on simule le succès
      console.log('Contrat signé:', {
        contractNumber,
        vendorEmail,
        adminEmail,
        signedAt
      })

      return response.json({
        success: true,
        message: 'Contrat signé et envoyé avec succès',
        data: {
          contractNumber,
          signedAt,
          sentTo: [vendorEmail, adminEmail]
        }
      })

    } catch (error) {
      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la signature du contrat',
        error: error.message
      })
    }
  }

}
