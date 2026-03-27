import vine from '@vinejs/vine'

/**
 * Validator to use when performing self-signup
 */
export const signupValidator = vine.compile(
  vine.object({
    full_name: vine.string().trim().minLength(2).maxLength(255), // 👈 full_name (underscore)
    email: vine.string().email().trim(),
    password: vine.string().minLength(8),
  })
)

export const loginValidator = vine.compile(
  vine.object({
    email: vine.string().email().trim(),
    password: vine.string(),
  })
)
