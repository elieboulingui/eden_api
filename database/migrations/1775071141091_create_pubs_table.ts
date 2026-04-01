// database/migrations/xxxx_create_pubs_table.ts
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'pubs'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary()
      table.string('name').notNullable()
      table.text('description').notNullable()
      table.string('image_url').notNullable()
      table.integer('display_duration').notNullable().defaultTo(5) // 5 secondes par défaut
      table.timestamp('start_date').nullable()
      table.timestamp('end_date').nullable()
      table.boolean('is_active').defaultTo(true)
      table.integer('priority').defaultTo(2) // 1 = haute, 2 = moyenne, 3 = basse
      table.string('target_url').nullable()
      table.uuid('merchant_id').nullable()
      table.timestamp('created_at', { useTz: true })
      table.timestamp('updated_at', { useTz: true })
      table.timestamp('deleted_at').nullable()

      // Index pour optimiser les requêtes
      table.index(['is_active', 'start_date', 'end_date'])
      table.index(['priority'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}