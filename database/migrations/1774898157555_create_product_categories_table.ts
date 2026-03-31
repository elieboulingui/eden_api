import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'product_categories'

  async up() {
    // Vérifier si la table existe déjà
    const hasTable = await this.schema.hasTable(this.tableName)

    if (!hasTable) {
      await this.schema.createTable(this.tableName, (table) => {
        table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))

        // Utiliser uuid pour correspondre au type de categories.id
        table.uuid('product_id').references('products.id').onDelete('CASCADE').notNullable()
        table.uuid('category_id').references('categories.id').onDelete('CASCADE').notNullable()

        table.timestamp('created_at', { useTz: true }).defaultTo(this.now())

        // Éviter les doublons
        table.unique(['product_id', 'category_id'])
      })
    }
  }

  async down() {
    this.schema.dropTableIfExists(this.tableName)
  }
}