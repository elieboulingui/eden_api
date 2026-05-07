// app/middleware/brute_force_middleware.ts
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

export default class BruteForceMiddleware {
  async handle(_ctx: HttpContext, next: NextFn) {
    return next()
  }
}
