// app/controllers/pubs_controller.ts
import type { HttpContext } from '@adonisjs/core/http'
import Pub from '#models/pub'
import { DateTime } from 'luxon'

export default class PubsController {
  /**
   * Récupérer toutes les pubs actives (pour affichage)
   */
  async getActivePubs({ response }: HttpContext) {
    try {
      const now = DateTime.now()

      const pubs = await Pub.query()
        .where('is_active', true)
        .whereNull('deleted_at')
        .where(query => {
          query.whereNull('start_date')
            .orWhere('start_date', '<=', now.toSQL())
        })
        .where(query => {
          query.whereNull('end_date')
            .orWhere('end_date', '>=', now.toSQL())
        })
        .orderBy('priority', 'asc') // Priorité la plus haute d'abord
        .orderBy('created_at', 'desc')

      return response.ok({
        success: true,
        data: pubs
      })
    } catch (error: any) {
      return response.internalServerError({
        success: false,
        message: error.message
      })
    }
  }

  /**
   * Récupérer toutes les pubs (admin)
   */
  async getAllPubs({ request, response }: HttpContext) {
    try {
      const page = request.input('page', 1)
      const limit = request.input('limit', 10)

      const pubs = await Pub.query()
        .whereNull('deleted_at')
        .orderBy('created_at', 'desc')
        .paginate(page, limit)

      return response.ok({
        success: true,
        data: pubs
      })
    } catch (error: any) {
      return response.internalServerError({
        success: false,
        message: error.message
      })
    }
  }

  /**
   * Créer une nouvelle pub
   */
  async createPub({ request, response }: HttpContext) {
    try {
      const data = request.only([
        'name',
        'description',
        'image_url',
        'display_duration',
        'start_date',
        'end_date',
        'priority',
        'target_url',
        'merchant_id'
      ])

      const pub = await Pub.create({
        ...data,
        is_active: true,
        start_date: data.start_date ? DateTime.fromISO(data.start_date) : null,
        end_date: data.end_date ? DateTime.fromISO(data.end_date) : null
      })

      return response.created({
        success: true,
        data: pub,
        message: 'Publicité créée avec succès'
      })
    } catch (error: any) {
      return response.internalServerError({
        success: false,
        message: error.message
      })
    }
  }

  /**
   * Mettre à jour une pub
   */
  async updatePub({ params, request, response }: HttpContext) {
    try {
      const pub = await Pub.findOrFail(params.id)

      const data = request.only([
        'name',
        'description',
        'image_url',
        'display_duration',
        'start_date',
        'end_date',
        'is_active',
        'priority',
        'target_url',
        'merchant_id'
      ])

      pub.merge({
        ...data,
        start_date: data.start_date ? DateTime.fromISO(data.start_date) : pub.start_date,
        end_date: data.end_date ? DateTime.fromISO(data.end_date) : pub.end_date
      })

      await pub.save()

      return response.ok({
        success: true,
        data: pub,
        message: 'Publicité mise à jour avec succès'
      })
    } catch (error:any) {
      return response.internalServerError({
        success: false,
        message: error.message
      })
    }
  }

  /**
   * Supprimer une pub (soft delete)
   */
  async deletePub({ params, response }: HttpContext) {
    try {
      const pub = await Pub.findOrFail(params.id)
      pub.deleted_at = DateTime.now()
      await pub.save()

      return response.ok({
        success: true,
        message: 'Publicité supprimée avec succès'
      })
    } catch (error: any) {
      return response.internalServerError({
        success: false,
        message: error.message
      })
    }
  }

  /**
   * Activer/désactiver une pub
   */
  async togglePubStatus({ params, response }: HttpContext) {
    try {
      const pub = await Pub.findOrFail(params.id)
      pub.is_active = !pub.is_active
      await pub.save()

      return response.ok({
        success: true,
        data: pub,
        message: pub.is_active ? 'Publicité activée' : 'Publicité désactivée'
      })
    } catch (error: any) {
      return response.internalServerError({
        success: false,
        message: error.message
      })
    }
  }
}