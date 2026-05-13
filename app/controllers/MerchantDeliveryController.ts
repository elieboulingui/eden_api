// app/controllers/MerchantDeliveryController.ts
import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'

export default class MerchantDeliveryController {
  
  /**
   * GET /api/merchant/:merchantId/delivery-zones
   * Récupère les zones de livraison et leurs frais pour un marchand spécifique
   */
  public async getDeliveryZones({ params, response }: HttpContext) {
    try {
      const { merchantId } = params

      const merchant = await User.find(merchantId)
      
      if (!merchant) {
        return response.notFound({ 
          success: false, 
          message: 'Marchand non trouvé' 
        })
      }

      // Vérifier que c'est bien un marchand
      if (!merchant.isMerchant) {
        return response.badRequest({ 
          success: false, 
          message: "Cet utilisateur n'est pas un marchand" 
        })
      }

      // ✅ Générer les zones avec les frais fixes
      const zones = [
        { zone: 'Akanda', fee: 4000 },
        { zone: 'Owendo', fee: 4000 },
        { zone: 'Libreville Centre', fee: 3000 },
        { zone: 'Libreville Nord', fee: 3000 },
        { zone: 'Libreville Sud', fee: 3000 },
        { zone: 'Ntoum', fee: 3000 },
        { zone: 'Kango', fee: 3000 },
        { zone: 'Cocobeach', fee: 3000 },
        { zone: 'Port-Gentil', fee: 3000 },
        { zone: 'Franceville', fee: 3000 },
        { zone: 'Autre', fee: 3000 },
      ]

      return response.ok({
        success: true,
        data: {
          merchantId: merchant.id,
          merchantName: merchant.commercial_name || merchant.shop_name || merchant.full_name,
          zones: zones
        }
      })

    } catch (error: any) {
      return response.internalServerError({
        success: false,
        message: 'Erreur lors de la récupération des zones de livraison',
        error: error.message
      })
    }
  }

  /**
   * GET /api/merchant/:merchantId/delivery-fee?zone=Libreville
   * Calcule les frais de livraison pour une zone spécifique
   */
  public async getDeliveryFee({ params, request, response }: HttpContext) {
    try {
      const { merchantId } = params
      const zone = request.input('zone')

      if (!zone) {
        return response.badRequest({ 
          success: false, 
          message: 'Zone de livraison requise' 
        })
      }

      const merchant = await User.find(merchantId)
      
      if (!merchant) {
        return response.notFound({ 
          success: false, 
          message: 'Marchand non trouvé' 
        })
      }

      if (!merchant.isMerchant) {
        return response.badRequest({ 
          success: false, 
          message: "Cet utilisateur n'est pas un marchand" 
        })
      }

      // ✅ Logique simple : 4000 pour Akanda/Owendo, 3000 pour le reste
      const fee = this.calculateDeliveryFee(zone)

      return response.ok({
        success: true,
        data: {
          merchantId: merchant.id,
          merchantName: merchant.commercial_name || merchant.shop_name || merchant.full_name,
          zone: zone,
          fee: fee
        }
      })

    } catch (error: any) {
      return response.internalServerError({
        success: false,
        message: 'Erreur lors du calcul des frais de livraison',
        error: error.message
      })
    }
  }

  /**
   * POST /api/cart/delivery-fees
   * Calcule les frais de livraison pour tous les marchands dans le panier
   */
  public async calculateCartDeliveryFees({ request, response }: HttpContext) {
    try {
      const { productIds, zone } = request.body()

      if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
        return response.badRequest({ 
          success: false, 
          message: 'Liste des produits requise' 
        })
      }

      if (!zone) {
        return response.badRequest({ 
          success: false, 
          message: 'Zone de livraison requise' 
        })
      }

      // Récupérer tous les produits avec leurs marchands
      const Product = (await import('#models/Product')).default
      const products = await Product.query()
        .whereIn('id', productIds)
        .preload('user')

      // ✅ Calculer les frais selon la règle métier
      const deliveryFee = this.calculateDeliveryFee(zone)

      // Regrouper par marchand
      const merchantFees: Record<string, { 
        merchantName: string; 
        fee: number; 
        productIds: string[] 
      }> = {}

      for (const product of products) {
        const merchant = product.user
        
        if (merchant && merchant.isMerchant) {
          if (!merchantFees[merchant.id]) {
            merchantFees[merchant.id] = {
              merchantName: merchant.commercial_name || merchant.shop_name || merchant.full_name || 'Marchand',
              fee: deliveryFee, // ✅ Mêmes frais pour tous les marchands
              productIds: []
            }
          }
          merchantFees[merchant.id].productIds.push(product.id)
        }
      }

      // Calculer le total
      const deliveries = Object.entries(merchantFees).map(([merchantId, data]) => ({
        merchantId,
        ...data
      }))

      const totalDeliveryFee = deliveries.reduce((sum, d) => sum + d.fee, 0)

      return response.ok({
        success: true,
        data: {
          zone,
          deliveries,
          totalDeliveryFee
        }
      })

    } catch (error: any) {
      return response.internalServerError({
        success: false,
        message: 'Erreur lors du calcul des frais de livraison',
        error: error.message
      })
    }
  }

  /**
   * ✅ Méthode utilitaire : calcule les frais selon la zone
   * Règle : Akanda/Owendo = 4000 FCFA, autres zones = 3000 FCFA
   */
  private calculateDeliveryFee(zone: string): number {
    const normalizedZone = zone.toLowerCase().trim()
    
    // Vérifier si c'est Akanda ou Owendo
    if (normalizedZone === 'akanda' || normalizedZone === 'owendo') {
      return 4000
    }
    
    // Vérification partielle au cas où (ex: "Akanda Centre")
    if (normalizedZone.includes('akanda') || normalizedZone.includes('owendo')) {
      return 4000
    }
    
    // Toutes les autres zones
    return 3000
  }
}
