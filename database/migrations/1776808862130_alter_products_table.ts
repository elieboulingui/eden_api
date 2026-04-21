// database/migrations/xxx_add_is_archived_to_products.ts
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'products'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.boolean('is_archived').defaultTo(false).notNullable()
      table.timestamp('archived_at').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('is_archived')
      table.dropColumn('archived_at')
    })
  }
}