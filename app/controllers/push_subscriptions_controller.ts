import type { HttpContext } from '@adonisjs/core/http'
import PushSubscription from '#models/push_subscription'

export default class PushSubscriptionsController {
  /**
   * List all push subscriptions (optionally only active ones)
   */
  public async index({ request, response }: HttpContext) {
    const showAll = request.input('all', false)

    const query = PushSubscription.query().orderBy('created_at', 'desc')
    if (!showAll) {
      query.where('is_active', true)
    }

    const subscriptions = await query

    return response.ok({
      success: true,
      data: subscriptions,
    })
  }

  /**
   * Store or update a push subscription
   */
  public async store({ request, response }: HttpContext) {
    const payload = request.only([
      'endpoint',
      'p256dh',
      'auth',
      'device_id',
      'device_name',
      'browser',
      'os',
      'sw_version',
    ])

    if (!payload.endpoint || !payload.p256dh || !payload.auth) {
      return response.badRequest({
        success: false,
        message: 'endpoint, p256dh and auth are required',
      })
    }

    const subscription = await PushSubscription.firstOrNew(
      { endpoint: payload.endpoint },
      {
        ...payload,
        is_active: true,
      }
    )

    subscription.is_active = true
    subscription.merge(payload)
    await subscription.save()

    return response.created({
      success: true,
      data: subscription,
    })
  }

  /**
   * Delete/unsubscribe a push subscription by id
   */
  public async destroy({ params, response }: HttpContext) {
    const subscription = await PushSubscription.findOrFail(params.id)
    await subscription.delete()

    return response.ok({
      success: true,
      message: 'Subscription removed',
    })
  }
}
