import { BaseSchema } from '@adonisjs/lucid/schema'

export default class CreatePushSubscriptionsTable extends BaseSchema {
  protected tableName = 'push_subscriptions'

  public async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary()
      table.string('endpoint').notNullable().unique()
      table.string('p256dh').notNullable()
      table.string('auth').notNullable()
      table.string('device_id').nullable()
      table.string('device_name').nullable()
      table.string('browser').nullable()
      table.string('os').nullable()
      table.string('sw_version').nullable()
      table.boolean('is_active').notNullable().defaultTo(true)
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
    })
  }

  public async down() {
    this.schema.dropTable(this.tableName)
  }
}
