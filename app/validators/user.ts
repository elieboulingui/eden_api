// validators/user.ts
import vine from '@vinejs/vine'

export const signupValidator = vine.compile(
  vine.object({
    full_name: vine.string().trim().minLength(2).maxLength(255),

    email: vine.string().email().trim(),

    password: vine.string().minLength(8),

    // ✅ on garde UNE seule version propre
    role: vine.enum(['client', 'merchant']).optional(),

    // ✅ Champs boutique (optionnels sauf si merchant)
    country: vine.string().trim().minLength(2).maxLength(255).optional(),
    shop_name: vine.string().trim().minLength(2).maxLength(255).optional(),

    shop_image: vine.string().trim().url().optional(),
  })
)

export const loginValidator = vine.compile(
  vine.object({
    email: vine.string().email().trim(),
    password: vine.string(),
  })
)
