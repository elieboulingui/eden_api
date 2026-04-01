import { BaseSchema } from '@adonisjs/lucid/schema'

export default class AddUserIdsToCoupons extends BaseSchema {
  protected tableName = 'coupons'

  public async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Ajoute une colonne user_ids de type array d'UUID
      table.specificType('user_ids', 'uuid[]').defaultTo('{}')
    })
  }

  public async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('user_ids')
    })
  }
}
