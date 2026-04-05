import { DateTime } from 'luxon'
import { BaseModel, beforeCreate, column } from '@adonisjs/lucid/orm'
import crypto from 'node:crypto'

export default class NewsletterSubscriber extends BaseModel {
  static table = 'newsletter_subscribers'

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare email: string

  @column.dateTime({ autoCreate: true })
  declare created_at: DateTime

  @beforeCreate()
  static ensureUuid(subscriber: NewsletterSubscriber) {
    if (!subscriber.id) {
      subscriber.id = crypto.randomUUID()
    }
  }
}
