import { BaseSchema } from '@adonisjs/lucid/schema'

export default class CreateProductsTable extends BaseSchema {
  protected tableName = 'products'

  public async up() {
    this.schema.createTable(this.tableName, (table) => {
      // 1. ID Unique (UUID)
      table.string('id').primary().notNullable()

      // 2. Informations de base
      table.string('name').notNullable()
      table.text('description').nullable()
      table.string('image_url').nullable()

      // 3. Prix et Stock
      // decimal(12, 2) permet de stocker jusqu'à 9,999,999,999.99
      table.decimal('price', 12, 2).notNullable().defaultTo(0)
      table.integer('stock').notNullable().defaultTo(0)

      // 4. Statistiques et États (Checkboxes/Badges)
      table.float('rating').defaultTo(0)
      table.boolean('is_new').defaultTo(true).notNullable()
      table.boolean('is_on_sale').defaultTo(false).notNullable()

      // 5. Relations (Clés étrangères)
      // On les crée comme de simples colonnes d'abord pour éviter les blocages
      table.string('user_id').notNullable()
      table.string('category_id').nullable() // 👈 La colonne qui manquait !

      /**
       * 6. Timestamps
       */
      table.timestamp('created_at', { useTz: true })
      table.timestamp('updated_at', { useTz: true })
    })
  }

  public async down() {
    this.schema.dropTable(this.tableName)
  }
}
