// database/migrations/XXXXXX_create_rooms_table.ts
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class RoomsSchema extends BaseSchema {
  protected tableName = 'rooms'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.db.rawQuery('gen_random_uuid()').knexQuery)
      table.uuid('hotel_id').references('id').inTable('hotels').onDelete('CASCADE').notNullable()
      table.string('name').notNullable()
      table.text('description').nullable()
      table.decimal('price', 10, 2).notNullable()
      table.integer('capacity').notNullable().defaultTo(2)
      table.string('image').nullable()
      table.boolean('is_available').defaultTo(true)
      table.timestamp('created_at', { useTz: true })
      table.timestamp('updated_at', { useTz: true })
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
