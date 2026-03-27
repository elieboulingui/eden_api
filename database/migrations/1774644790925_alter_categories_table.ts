// database/migrations/xxx_add_user_id_to_categories.ts
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'categories'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Ajouter la colonne user_id (integer si users.id est integer, ou uuid si users.id est uuid)
      table.integer('user_id').unsigned().nullable()
      table.foreign('user_id').references('users.id').onDelete('CASCADE')
      table.index(['user_id'])
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropForeign(['user_id'])
      table.dropColumn('user_id')
    })
  }
}