// database/migrations/xxx_add_product_count_to_categories.ts
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'categories'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Ajouter seulement product_count (sort_order existe déjà)
      table.integer('product_count').defaultTo(0)
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('product_count')
    })
  }
}