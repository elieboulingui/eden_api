// app/validators/hotel.ts
import vine from '@vinejs/vine'

export const createHotelValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(3).maxLength(255),
    description: vine.string().trim().optional(),
    address: vine.string().trim().minLength(5),
    city: vine.string().trim().minLength(2),
    country: vine.string().trim().minLength(2),
    latitude: vine.number().min(-90).max(90),
    longitude: vine.number().min(-180).max(180),
    rating: vine.number().min(0).max(5).optional(),
    phone: vine.string().trim().minLength(8).maxLength(20).optional(),
    image: vine.string().optional(),
    isActive: vine.boolean().optional(),
  })
)

export const updateHotelValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(3).maxLength(255).optional(),
    description: vine.string().trim().optional(),
    address: vine.string().trim().minLength(5).optional(),
    city: vine.string().trim().minLength(2).optional(),
    country: vine.string().trim().minLength(2).optional(),
    latitude: vine.number().min(-90).max(90).optional(),
    longitude: vine.number().min(-180).max(180).optional(),
    rating: vine.number().min(0).max(5).optional(),
    phone: vine.string().trim().minLength(8).maxLength(20).optional(),
    image: vine.string().optional(),
    isActive: vine.boolean().optional(),
  })
)
