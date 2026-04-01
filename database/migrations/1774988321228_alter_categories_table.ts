import { BaseSchema } from '@adonisjs/lucid/schema'

export default class AddProductIdsToCategories extends BaseSchema {
  protected tableName = 'categories'

  public async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.json('product_ids').defaultTo('[]').notNullable()
    })
  }

  public async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('product_ids')
    })
  }
}
