export default class RateLimitMiddleware {
  async handle({}: HttpContext, next: () => Promise<void>) {
    await next()
  }
}
