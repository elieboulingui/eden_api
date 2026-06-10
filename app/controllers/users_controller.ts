import User from '#models/user'
import { DateTime } from 'luxon'
import type { HttpContext } from '@adonisjs/core/http'

export default class UsersController {
  /**
   * Récupérer tous les clients
   * GET /api/users
   */
  async index({ response, auth }: HttpContext) {
    try {
      const user = auth.user
      if (!user) {
        return response.status(401).json({
          success: false,
          message: 'Non authentifié'
        })
      }

      const clients = await User.query()
        .where('role', 'client')
        .orderBy('created_at', 'desc')
        .select('id', 'full_name', 'email', 'role', 'created_at', 'updated_at')

      return response.status(200).json({
        success: true,
        data: clients,
        count: clients.length
      })
    } catch (error: any) {
      console.error('Erreur:', error)
      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des clients',
        error: error.message
      })
    }
  }

  /**
   * Récupérer un utilisateur spécifique (tous rôles)
   * GET /api/users/:id
   * GET /api/client/:id
   */
  async show({ params, response }: HttpContext) {
    try {
      // ✅ Plus de filtre par rôle - retourne n'importe quel utilisateur
      const client = await User.query()
        .where('id', params.id)
        .first()

      if (!client) {
        return response.status(404).json({
          success: false,
          message: 'Utilisateur non trouvé'
        })
      }

      return response.status(200).json({
        success: true,
        data: client
      })
    } catch (error: any) {
      console.error('Erreur:', error)
      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération de l\'utilisateur',
        error: error.message
      })
    }
  }

  /**
   * Récupère les informations d'un utilisateur pour le contrat
   * GET /api/users/:id/contract-info
   */
  async getContractInfo({ params, response }: HttpContext) {
    try {
      const user = await User.find(params.id)

      if (!user) {
        return response.status(404).json({
          success: false,
          message: 'Utilisateur non trouvé'
        })
      }

      // Formater les données pour le contrat
      const contractInfo = {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        phone: user.phone,
        personal_phone: user.personal_phone,
        whatsapp_phone: user.whatsapp_phone,
        
        // Informations entreprise
        company_name: user.shop_name || user.commercial_name,
        legal_form: user.vendor_type === 'boutique_physique' ? 'Boutique Physique' : 
                    user.vendor_type === 'vendeur_ligne' ? 'Vendeur en ligne' : 
                    user.vendor_type === 'particulier' ? 'Particulier' : null,
        rccm: user.rccm_number,
        tax_id: user.nif_number,
        
        // Adresse
        address: user.shop_address || user.residence_address || user.address,
        
        // Représentant légal
        manager_name: user.full_name,
        manager_title: user.vendor_type === 'boutique_physique' ? 'Gérant' : 
                       user.vendor_type === 'vendeur_ligne' ? 'Vendeur' : 'Particulier',
        
        // Statut du contrat
        contract_signed: user.contract_signed,
        contract_signed_at: user.contract_signed_at,
        
        // Informations complémentaires
        vendor_type: user.vendor_type,
        is_verified: user.is_verified,
        verification_status: user.verification_status,
        role: user.role
      }

      return response.status(200).json({
        success: true,
        data: contractInfo
      })
    } catch (error: any) {
      console.error('Erreur getContractInfo:', error)
      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des informations du contrat',
        error: error.message
      })
    }
  }

  /**
   * Récupère uniquement les informations marchand
   * GET /api/users/:id/merchant-info
   */
  async getMerchantInfo({ params, response }: HttpContext) {
    try {
      const user = await User.find(params.id)

      if (!user) {
        return response.status(404).json({
          success: false,
          message: 'Utilisateur non trouvé'
        })
      }

      if (!user.isMerchant) {
        return response.status(400).json({
          success: false,
          message: 'Cet utilisateur n\'est pas un marchand'
        })
      }

      const merchantInfo = {
        // Infos personnelles
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        phone: user.phone,
        personal_phone: user.personal_phone,
        whatsapp_phone: user.whatsapp_phone,
        residence_address: user.residence_address,
        
        // Infos entreprise
        vendor_type: user.vendor_type,
        vendor_type_label: user.vendorTypeLabel,
        commercial_name: user.commercial_name,
        shop_name: user.shop_name,
        shop_description: user.shop_description,
        
        // Documents légaux
        nif_number: user.nif_number,
        rccm_number: user.rccm_number,
        
        // Boutique physique
        shop_address: user.shop_address,
        shop_latitude: user.shop_latitude,
        shop_longitude: user.shop_longitude,
        
        // Vendeur en ligne / Particulier
        stock_address: user.stock_address,
        facebook_url: user.facebook_url,
        instagram_url: user.instagram_url,
        tiktok_url: user.tiktok_url,
        
        // Références
        reference_1_name: user.reference1_name,
        reference_1_phone: user.reference1_phone,
        reference_2_name: user.reference2_name,
        reference_2_phone: user.reference2_phone,
        
        // Paiement
        payment_method: user.payment_method,
        
        // Statut
        is_verified: user.is_verified,
        verification_status: user.verification_status,
        verification_status_label: user.verificationStatusLabel,
        contract_signed: user.contract_signed,
        contract_signed_at: user.contract_signed_at
      }

      return response.status(200).json({
        success: true,
        data: merchantInfo
      })
    } catch (error: any) {
      console.error('Erreur getMerchantInfo:', error)
      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des informations marchand',
        error: error.message
      })
    }
  }

  /**
   * Met à jour le statut de signature du contrat
   * PATCH /api/users/:id/contract-signature
   */
  async updateContractSignature({ params, request, response }: HttpContext) {
    try {
      const user = await User.find(params.id)

      if (!user) {
        return response.status(404).json({
          success: false,
          message: 'Utilisateur non trouvé'
        })
      }

      const { contract_signed, signature } = request.only(['contract_signed', 'signature'])

      if (contract_signed !== undefined) {
        user.contract_signed = contract_signed
      }

      if (signature) {
        user.signature = signature
      }

      if (contract_signed === true) {
        user.contract_signed_at = DateTime.now()
      }

      await user.save()

      return response.status(200).json({
        success: true,
        data: {
          contract_signed: user.contract_signed,
          contract_signed_at: user.contract_signed_at
        }
      })
    } catch (error: any) {
      console.error('Erreur updateContractSignature:', error)
      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la mise à jour du contrat',
        error: error.message
      })
    }
  }

  /**
   * Vérifie si un utilisateur a signé son contrat
   * GET /api/users/:id/contract-status
   */
  async getContractStatus({ params, response }: HttpContext) {
    try {
      const user = await User.find(params.id)

      if (!user) {
        return response.status(404).json({
          success: false,
          message: 'Utilisateur non trouvé'
        })
      }

      return response.status(200).json({
        success: true,
        data: {
          contract_signed: user.contract_signed,
          contract_signed_at: user.contract_signed_at,
          contract_sent_at: user.contract_sent_at,
          has_signature: !!user.signature
        }
      })
    } catch (error: any) {
      console.error('Erreur getContractStatus:', error)
      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la vérification du contrat',
        error: error.message
      })
    }
  }
}
