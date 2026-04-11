// validators/user.ts
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
  }).superRefine((data, field) => {
    // 🔥 Si marchand → validations obligatoires
    if (data.role === 'merchant') {
      if (!data.country) {
        field.report(
          'Le pays est obligatoire pour un marchand',
          'country',
          field
        )
      }

      if (!data.shop_name) {
        field.report(
          'Le nom de la boutique est obligatoire pour un marchand',
          'shop_name',
          field
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
