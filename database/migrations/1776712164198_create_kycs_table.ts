import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'kycs'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.string('id').primary() // ID en string
      table.string('nom_complet').notNullable()
      table.string('numero_telephone').notNullable().unique()
      table.string('operateur').notNullable()
      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
