import type { HttpContext } from '@adonisjs/core/http'
import KYC from '#models/kyc'

export default class KYCsController {
  /**
   * Afficher tous les enregistrements
   */
  async index({ response }: HttpContext) {
    const kycs = await KYC.query().orderBy('createdAt', 'desc')
    return response.json(kycs)
  }

  /**
   * Afficher un enregistrement spécifique
   */
  async show({ params, response }: HttpContext) {
    const kyc = await KYC.find(params.id)

    if (!kyc) {
      return response.status(404).json({
        message: 'Enregistrement non trouvé'
      })
    }

    return response.json(kyc)
  }

  /**
   * Créer un nouvel enregistrement KYC (manuel)
   */
  async store({ request, response }: HttpContext) {
    const payload = request.only(['nomComplet', 'numeroTelephone', 'operateur'])

    if (!payload.nomComplet || !payload.numeroTelephone || !payload.operateur) {
      return response.status(400).json({
        message: 'Tous les champs sont obligatoires'
      })
    }

    const existing = await KYC.findBy('numeroTelephone', payload.numeroTelephone)
    if (existing) {
      return response.status(400).json({
        message: 'Ce numéro de téléphone est déjà enregistré'
      })
    }

    const kyc = await KYC.create(payload)

    return response.status(201).json({
      message: 'Enregistrement KYC réussi',
      data: kyc
    })
  }

  /**
   * Vérifier un numéro via API Render et enregistrer
   * Le numéro est passé dans l'URL
   */
  async verifyAndStore({ params, response }: HttpContext) {
    const numeroTelephone = params.numeroTelephone

    if (!numeroTelephone) {
      return response.status(400).json({
        success: false,
        message: 'Le numéro de téléphone est obligatoire'
      })
    }

    try {
      // Détecter l'opérateur à partir du préfixe
      const prefix = numeroTelephone.substring(0, 2)

      // Mapping des codes opérateurs
      const operatorMapping: { [key: string]: string } = {
        '06': 'MOOV_MONEY',
        '07': 'AIRTEL_MONEY'
      }

      if (!operatorMapping[prefix]) {
        return response.status(400).json({
          success: false,
          message: 'Numéro non reconnu. Utilisez un numéro Moov (06) ou Airtel (07)',
          prefix: prefix
        })
      }

      const operatorCode = operatorMapping[prefix]

      // Appel à l'API Render avec le bon operatorCode
      const kycUrl = `https://api.mypvit.pro/v2/NH3QVMNQOWNXRZ91/kyc?customerAccountNumber=${numeroTelephone}&operatorCode=${operatorCode}`

      console.log('URL appelée:', kycUrl)

      const externalResponse = await fetch(kycUrl)

      // Vérifier si la réponse HTTP est correcte
      if (!externalResponse.ok) {
        const errorText = await externalResponse.text()
        console.error('Erreur API externe:', errorText)
        return response.status(externalResponse.status).json({
          success: false,
          message: `L'API externe a retourné une erreur: ${externalResponse.status}`,
          error: errorText
        })
      }

      const externalData: any = await externalResponse.json()
      console.log('Réponse API brute:', JSON.stringify(externalData, null, 2))

      // Vérifier la structure de la réponse et extraire les données
      const nomComplet = externalData.data?.firstname || externalData.data?.full_name || externalData.data?.name
      const numeroAPI = externalData.data?.phone || externalData.data?.phoneNumber || externalData.data?.customerAccountNumber
      const operateur = externalData.data?.operator || operatorCode

      if (!nomComplet) {
        console.error('Données API incomplètes:', externalData)
        return response.status(500).json({
          success: false,
          message: 'Données client non trouvées dans la réponse API',
          receivedData: externalData.data || externalData
        })
      }

      // Utiliser le numéro de téléphone de l'API si disponible, sinon celui fourni
      const finalNumero = numeroAPI || numeroTelephone

      // Vérifier si le numéro existe déjà
      const existing = await KYC.findBy('numeroTelephone', finalNumero)

      let kycRecord

      if (existing) {
        // Mise à jour avec les nouvelles données
        existing.nomComplet = nomComplet
        existing.operateur = operateur
        // Mettre à jour le numéro si l'API en retourne un différent
        if (numeroAPI && numeroAPI !== existing.numeroTelephone) {
          existing.numeroTelephone = numeroAPI
        }
        await existing.save()
        kycRecord = existing
      } else {
        // Création d'un nouvel enregistrement
        kycRecord = await KYC.create({
          nomComplet: nomComplet,
          numeroTelephone: finalNumero,
          operateur: operateur
        })
      }

      // Renvoyer les données enregistrées
      return response.status(200).json({
        success: true,
        message: existing ? 'KYC mis à jour avec succès' : 'KYC créé avec succès',
        data: {
          id: kycRecord.id,
          numeroTelephone: kycRecord.numeroTelephone,
          nomComplet: kycRecord.nomComplet,
          operateur: kycRecord.operateur,
          createdAt: kycRecord.createdAt,
          updatedAt: kycRecord.updatedAt
        }
      })

    } catch (error: any) {
      console.error('Erreur KYC complète:', error)
      return response.status(500).json({
        success: false,
        message: 'Erreur serveur',
        error: process.env.NODE_ENV === 'production' ? 'Erreur interne' : error.message
      })
    }
  }

  /**
   * Mettre à jour un enregistrement
   */
  async update({ params, request, response }: HttpContext) {
    const kyc = await KYC.find(params.id)

    if (!kyc) {
      return response.status(404).json({
        message: 'Enregistrement non trouvé'
      })
    }

    const payload = request.only(['nomComplet', 'numeroTelephone', 'operateur'])

    if (payload.numeroTelephone && payload.numeroTelephone !== kyc.numeroTelephone) {
      const existing = await KYC.findBy('numeroTelephone', payload.numeroTelephone)
      if (existing) {
        return response.status(400).json({
          message: 'Ce numéro de téléphone est déjà utilisé'
        })
      }
    }

    kyc.merge(payload)
    await kyc.save()

    return response.json({
      message: 'Enregistrement mis à jour',
      data: kyc
    })
  }

  /**
   * Supprimer un enregistrement
   */
  async destroy({ params, response }: HttpContext) {
    const kyc = await KYC.find(params.id)

    if (!kyc) {
      return response.status(404).json({
        message: 'Enregistrement non trouvé'
      })
    }

    await kyc.delete()

    return response.json({
      message: 'Enregistrement supprimé avec succès'
    })
  }

  /**
   * Rechercher par numéro de téléphone
   */
  async searchByPhone({ request, response }: HttpContext) {
    const { numero } = request.qs()

    if (!numero) {
      return response.status(400).json({
        message: 'Numéro de téléphone requis'
      })
    }

    const kyc = await KYC.findBy('numeroTelephone', numero)

    if (!kyc) {
      return response.status(404).json({
        message: 'Aucun enregistrement trouvé pour ce numéro'
      })
    }

    return response.json(kyc)
  }

  /**
   * Rechercher par nom
   */
  async searchByName({ request, response }: HttpContext) {
    const { nom } = request.qs()

    if (!nom) {
      return response.status(400).json({
        message: 'Nom requis'
      })
    }

    const kycs = await KYC.query()
      .where('nomComplet', 'LIKE', `%${nom}%`)
      .orderBy('createdAt', 'desc')

    return response.json(kycs)
  }

  /**
   * Filtrer par opérateur
   */
  async filterByOperator({ request, response }: HttpContext) {
    const { operateur } = request.qs()

    if (!operateur) {
      return response.status(400).json({
        message: 'Opérateur requis'
      })
    }

    const kycs = await KYC.query()
      .where('operateur', operateur)
      .orderBy('createdAt', 'desc')

    return response.json(kycs)
  }

  /**
   * Statistiques
   */
  async stats({ response }: HttpContext) {
    const total = await KYC.query().count('* as total')

    const byOperator = await KYC.query()
      .select('operateur')
      .count('* as count')
      .groupBy('operateur')

    const recent = await KYC.query()
      .orderBy('createdAt', 'desc')
      .limit(5)

    return response.json({
      total: total[0].$extras.total,
      byOperator,
      recent
    })
  }
}
