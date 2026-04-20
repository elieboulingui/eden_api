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
      // Appel à l'API Render
      const kycUrl = `https://apist.onrender.com/api/mypvit/kyc/marchant?customerAccountNumber=${numeroTelephone}`

      const externalResponse = await fetch(kycUrl)
      const externalData: any = await externalResponse.json()

      // Prendre les données telles quelles de l'API Render
      const nomComplet = externalData.data.full_name
      const operateur = externalData.data.operator

      // Vérifier si le numéro existe déjà
      const existing = await KYC.findBy('numeroTelephone', numeroTelephone)

      let kycRecord

      if (existing) {
        existing.nomComplet = nomComplet
        existing.operateur = operateur
        await existing.save()
        kycRecord = existing
      } else {
        kycRecord = await KYC.create({
          nomComplet: nomComplet,
          numeroTelephone: numeroTelephone,
          operateur: operateur
        })
      }

      // Renvoyer uniquement les données enregistrées
      return response.status(200).json({
        id: kycRecord.id,
        numeroTelephone: kycRecord.numeroTelephone,
        nomComplet: kycRecord.nomComplet,
        operateur: kycRecord.operateur,
        createdAt: kycRecord.createdAt,
        updatedAt: kycRecord.updatedAt
      })

    } catch (error: any) {
      console.error('Erreur KYC:', error)
      return response.status(500).json({
        success: false,
        message: 'Erreur serveur',
        error: error.message
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
