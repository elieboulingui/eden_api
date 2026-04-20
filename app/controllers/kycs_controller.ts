import type { HttpContext } from '@adonisjs/core/http'
import KYC from '#models/kyc'

export default class KYCsController {
  /**
   * Afficher tous les enregistrements (API JSON)
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
   * Créer un nouvel enregistrement KYC
   */
  async store({ request, response }: HttpContext) {
    const payload = request.only(['nomComplet', 'numeroTelephone', 'operateur'])

    // Validation basique
    if (!payload.nomComplet || !payload.numeroTelephone || !payload.operateur) {
      return response.status(400).json({
        message: 'Tous les champs sont obligatoires'
      })
    }

    // Vérifier si le numéro existe déjà
    const existing = await KYC.findBy('numeroTelephone', payload.numeroTelephone)
    if (existing) {
      return response.status(400).json({
        message: 'Ce numéro de téléphone est déjà enregistré'
      })
    }

    // Créer le KYC
    const kyc = await KYC.create(payload)

    return response.status(201).json({
      message: 'Enregistrement KYC réussi',
      data: kyc
    })
  }

  /**
   * Vérifier un numéro via API externe et enregistrer
   */
  async verifyAndStore({ request, response }: HttpContext) {
    const { numeroTelephone, nomComplet, operateur } = request.only([
      'numeroTelephone',
      'nomComplet',
      'operateur'
    ])

    // Validation basique
    if (!numeroTelephone) {
      return response.status(400).json({
        message: 'Le numéro de téléphone est obligatoire'
      })
    }

    try {
      // 1. Appel à l'API externe
      const kycUrl = `https://apist.onrender.com/api/mypvit/kyc/marchant?customerAccountNumber=${numeroTelephone}`

      const externalResponse = await fetch(kycUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      })

      if (!externalResponse.ok) {
        return response.status(externalResponse.status).json({
          message: 'Erreur lors de la vérification du numéro',
          error: await externalResponse.text()
        })
      }

      const externalData = await externalResponse.json()

      // 2. Vérifier si le numéro existe déjà dans notre base
      const existing = await KYC.findBy('numeroTelephone', numeroTelephone)

      let kycRecord

      if (existing) {
        // Mettre à jour avec les nouvelles données de l'API
        existing.merge({
          nomComplet: nomComplet || externalData.name || existing.nomComplet,
          operateur: operateur || externalData.operator || existing.operateur
        })
        await existing.save()
        kycRecord = existing
      } else {
        // Créer un nouvel enregistrement
        kycRecord = await KYC.create({
          nomComplet: nomComplet || externalData.name || 'Inconnu',
          numeroTelephone: numeroTelephone,
          operateur: operateur || externalData.operator || 'INCONNU'
        })
      }

      // 3. Renvoyer les données combinées au front
      return response.status(200).json({
        message: 'Vérification KYC effectuée avec succès',
        kyc: kycRecord,
        externalData: externalData
      })

    } catch (error) {
      console.error('Erreur KYC:', error)
      return response.status(500).json({
        message: 'Erreur serveur lors de la vérification KYC',
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

    // Vérifier si le nouveau numéro existe déjà (si modifié)
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
