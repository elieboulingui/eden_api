// app/controllers/rooms_controller.ts
import type { HttpContext } from '@adonisjs/core/http'
import Room from '#models/room'

export default class RoomsController {
  /**
   * Liste de toutes les chambres
   */
  async index({ response }: HttpContext) {
    try {
      const rooms = await Room.query()
        .where('is_available', true)
        .preload('hotel')
        .orderBy('price', 'asc')

      return response.json({
        success: true,
        data: rooms,
        message: 'Liste des chambres récupérée avec succès'
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Une erreur inconnue est survenue'
      
      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des chambres',
        error: errorMessage
      })
    }
  }

  /**
   * Afficher une chambre spécifique
   */
  async show({ params, response }: HttpContext) {
    try {
      const room = await Room.findOrFail(params.id)
      
      await room.load('hotel')

      return response.json({
        success: true,
        data: room,
        message: 'Chambre récupérée avec succès'
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Une erreur inconnue est survenue'
      
      if (error instanceof Error && error.message.includes('E_ROW_NOT_FOUND')) {
        return response.status(404).json({
          success: false,
          message: 'Chambre non trouvée',
          error: errorMessage
        })
      }

      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération de la chambre',
        error: errorMessage
      })
    }
  }

  /**
   * Créer une nouvelle chambre
   */
  async store({ request, response }: HttpContext) {
    try {
      const data = request.only([
        'hotelId',
        'name',
        'description',
        'price',
        'capacity',
        'image',
        'isAvailable'
      ])

      const room = await Room.create({
        ...data,
        isAvailable: data.isAvailable ?? true
      })

      return response.status(201).json({
        success: true,
        data: room,
        message: 'Chambre créée avec succès'
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Une erreur inconnue est survenue'

      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la création de la chambre',
        error: errorMessage
      })
    }
  }

  /**
   * Mettre à jour une chambre
   */
  async update({ params, request, response }: HttpContext) {
    try {
      const room = await Room.findOrFail(params.id)
      
      const data = request.only([
        'name',
        'description',
        'price',
        'capacity',
        'image',
        'isAvailable'
      ])

      room.merge(data)
      await room.save()

      return response.json({
        success: true,
        data: room,
        message: 'Chambre mise à jour avec succès'
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Une erreur inconnue est survenue'

      if (error instanceof Error && error.message.includes('E_ROW_NOT_FOUND')) {
        return response.status(404).json({
          success: false,
          message: 'Chambre non trouvée',
          error: errorMessage
        })
      }

      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la mise à jour de la chambre',
        error: errorMessage
      })
    }
  }

  /**
   * Supprimer une chambre
   */
  async destroy({ params, response }: HttpContext) {
    try {
      const room = await Room.findOrFail(params.id)
      await room.delete()

      return response.json({
        success: true,
        message: 'Chambre supprimée avec succès'
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Une erreur inconnue est survenue'

      if (error instanceof Error && error.message.includes('E_ROW_NOT_FOUND')) {
        return response.status(404).json({
          success: false,
          message: 'Chambre non trouvée',
          error: errorMessage
        })
      }

      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la suppression de la chambre',
        error: errorMessage
      })
    }
  }
}
