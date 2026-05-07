// app/controllers/hotels_controller.ts
import type { HttpContext } from '@adonisjs/core/http'
import Hotel from '#models/hotel'
import Room from '#models/room'
import { createHotelValidator, updateHotelValidator } from '#validators/hotel'
import { errors as validationErrors } from '@vinejs/vine'

export default class HotelsController {
  /**
   * Afficher la liste de tous les hôtels avec leurs chambres
   */
  async index({ response }: HttpContext) {
    try {
      const hotels = await Hotel.query()
        .where('is_active', true)
        .preload('rooms', (query) => {
          query.where('is_available', true)
        })
        .orderBy('created_at', 'desc')

      return response.json({
        success: true,
        data: hotels,
        message: 'Liste des hôtels récupérée avec succès'
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Une erreur inconnue est survenue'

      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des hôtels',
        error: errorMessage
      })
    }
  }

  /**
   * Afficher un hôtel spécifique avec ses chambres
   */
  async show({ params, response }: HttpContext) {
    try {
      const hotel = await Hotel.findOrFail(params.id)

      await hotel.load('rooms', (query) => {
        query.where('is_available', true)
      })

      return response.json({
        success: true,
        data: hotel,
        message: 'Hôtel récupéré avec succès'
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Une erreur inconnue est survenue'

      return response.status(404).json({
        success: false,
        message: 'Hôtel non trouvé',
        error: errorMessage
      })
    }
  }

  /**
   * Créer un nouvel hôtel
   */
  async store({ request, response }: HttpContext) {
    try {
      const data = await request.validateUsing(createHotelValidator)

      const hotel = await Hotel.create({
        ...data,
        isActive: data.isActive ?? true
      })

      return response.status(201).json({
        success: true,
        data: hotel,
        message: 'Hôtel créé avec succès'
      })
    } catch (error) {
      if (error instanceof validationErrors.E_VALIDATION_ERROR) {
        return response.status(422).json({
          success: false,
          message: 'Erreur de validation',
          errors: error.messages
        })
      }

      const errorMessage = error instanceof Error ? error.message : 'Une erreur inconnue est survenue'

      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la création de l\'hôtel',
        error: errorMessage
      })
    }
  }

  /**
   * Mettre à jour un hôtel
   */
  async update({ params, request, response }: HttpContext) {
    try {
      const hotel = await Hotel.findOrFail(params.id)
      const data = await request.validateUsing(updateHotelValidator)

      hotel.merge(data)
      await hotel.save()

      return response.json({
        success: true,
        data: hotel,
        message: 'Hôtel mis à jour avec succès'
      })
    } catch (error) {
      if (error instanceof validationErrors.E_VALIDATION_ERROR) {
        return response.status(422).json({
          success: false,
          message: 'Erreur de validation',
          errors: error.messages
        })
      }

      if (error instanceof Error && error.message.includes('E_ROW_NOT_FOUND')) {
        return response.status(404).json({
          success: false,
          message: 'Hôtel non trouvé'
        })
      }

      const errorMessage = error instanceof Error ? error.message : 'Une erreur inconnue est survenue'

      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la mise à jour de l\'hôtel',
        error: errorMessage
      })
    }
  }

  /**
   * Supprimer un hôtel
   */
  async destroy({ params, response }: HttpContext) {
    try {
      const hotel = await Hotel.findOrFail(params.id)
      await hotel.delete()

      return response.json({
        success: true,
        message: 'Hôtel supprimé avec succès'
      })
    } catch (error) {
      if (error instanceof Error && error.message.includes('E_ROW_NOT_FOUND')) {
        return response.status(404).json({
          success: false,
          message: 'Hôtel non trouvé'
        })
      }

      const errorMessage = error instanceof Error ? error.message : 'Une erreur inconnue est survenue'

      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la suppression de l\'hôtel',
        error: errorMessage
      })
    }
  }

  /**
   * Rechercher des hôtels par position géographique (proximité)
   */
  async searchByLocation({ request, response }: HttpContext) {
    try {
      const { latitude, longitude, radius = 10 } = request.qs()

      if (!latitude || !longitude) {
        return response.status(400).json({
          success: false,
          message: 'Latitude et longitude sont requises'
        })
      }

      const hotels = await Hotel.query()
        .where('is_active', true)
        .whereRaw(
          `(
            6371 * acos(
              cos(radians(?)) * cos(radians(latitude)) *
              cos(radians(longitude) - radians(?)) +
              sin(radians(?)) * sin(radians(latitude))
            )
          ) <= ?`,
          [latitude, longitude, latitude, radius]
        )
        .preload('rooms', (query) => {
          query.where('is_available', true)
        })
        .orderBy('rating', 'desc')

      return response.json({
        success: true,
        data: hotels,
        message: `Hôtels trouvés dans un rayon de ${radius}km`
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Une erreur inconnue est survenue'

      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la recherche par localisation',
        error: errorMessage
      })
    }
  }

  /**
   * Obtenir toutes les chambres d'un hôtel
   */
  async getRooms({ params, response }: HttpContext) {
    try {
      const hotel = await Hotel.findOrFail(params.id)
      const rooms = await Room.query()
        .where('hotel_id', hotel.id)
        .where('is_available', true)
        .orderBy('price', 'asc')

      return response.json({
        success: true,
        data: rooms,
        message: 'Chambres de l\'hôtel récupérées avec succès'
      })
    } catch (error) {
      if (error instanceof Error && error.message.includes('E_ROW_NOT_FOUND')) {
        return response.status(404).json({
          success: false,
          message: 'Hôtel non trouvé'
        })
      }

      const errorMessage = error instanceof Error ? error.message : 'Une erreur inconnue est survenue'

      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des chambres',
        error: errorMessage
      })
    }
  }

  /**
   * Obtenir des hôtels par ville
   */
  async getByCity({ params, response }: HttpContext) {
    try {
      const hotels = await Hotel.query()
        .where('city', params.city)
        .where('is_active', true)
        .preload('rooms', (query) => {
          query.where('is_available', true)
        })
        .orderBy('rating', 'desc')

      return response.json({
        success: true,
        data: hotels,
        message: `Hôtels à ${params.city} récupérés avec succès`
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Une erreur inconnue est survenue'

      return response.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des hôtels par ville',
        error: errorMessage
      })
    }
  }
}
