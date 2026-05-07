// database/migrations/XXXXXX_create_hotels_table.ts
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class HotelsSchema extends BaseSchema {
  protected tableName = 'hotels'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.db.rawQuery('gen_random_uuid()').knexQuery)
      table.string('name').notNullable()
      table.text('description').nullable()
      table.string('address').notNullable()
      table.string('city').notNullable()
      table.string('country').notNullable()
      table.decimal('latitude', 10, 8).notNullable()
      table.decimal('longitude', 11, 8).notNullable()
      table.decimal('rating', 3, 2).defaultTo(0)
      table.string('phone', 20).nullable()
      table.string('image').nullable()
      table.boolean('is_active').defaultTo(true)
      table.timestamp('created_at', { useTz: true })
      table.timestamp('updated_at', { useTz: true })
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
