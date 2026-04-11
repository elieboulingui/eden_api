// app/validators/user.ts
import vine from '@vinejs/vine'

export const signupValidator = vine.compile(
  vine.object({
    full_name: vine.string().trim().minLength(2).maxLength(255),

    email: vine.string().email().trim(),

    password: vine.string().minLength(8),

    // rôle
    role: vine.enum(['client', 'merchant']).optional(),

    // boutique
    shop_name: vine.string().trim().minLength(2).maxLength(255).optional(),
    shop_image: vine.string().trim().url().optional(),

    // 🌍 pays
    country: vine.string().trim().minLength(2).maxLength(100).optional(),
  }).custom((value, field) => {
    // 🔥 Si marchand → validations obligatoires
    if (value.role === 'merchant') {
      if (!value.country) {
        field.report(
          'Le pays est obligatoire pour un marchand',
          'country',
          'country.required'
        )
      }

      if (!value.shop_name) {
        field.report(
          'Le nom de la boutique est obligatoire pour un marchand',
          'shop_name',
          'shop_name.required'
        )
      }
    }
  })
)

export const loginValidator = vine.compile(
  vine.object({
    email: vine.string().email().trim(),
    password: vine.string(),
  })
)
