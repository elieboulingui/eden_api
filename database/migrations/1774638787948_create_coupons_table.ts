import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'coupons'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      // Clé primaire auto-incrémentée
      table.increments('id').primary()

      // Colonnes de base
      table.string('code').unique().notNullable()
      table.decimal('discount', 10, 2).notNullable()
      table.enum('type', ['percentage', 'fixed']).defaultTo('percentage')
      table.text('description').nullable()

      // Dates de validité
      table.timestamp('valid_from', { useTz: true }).nullable()
      table.timestamp('valid_until', { useTz: true }).nullable()

      // Limites d'utilisation
      table.integer('usage_limit').defaultTo(1)
      table.integer('used_count').defaultTo(0)
      table.decimal('minimum_order_amount', 10, 2).nullable()
      table.decimal('maximum_discount_amount', 10, 2).nullable()

      // Clés étrangères - Correction ici
      table.integer('user_id').unsigned().notNullable()
      table.integer('product_id').unsigned().nullable()

      // Statut
      table.enum('status', ['active', 'expired', 'disabled']).defaultTo('active')

      // Timestamps
      table.timestamp('created_at', { useTz: true }).defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).defaultTo(this.now())

      // Contraintes de clés étrangères
      table.foreign('user_id').references('users.id').onDelete('CASCADE')
      table.foreign('product_id').references('products.id').onDelete('CASCADE')

      // Index pour optimiser les performances
      table.index(['code'])
      table.index(['user_id'])
      table.index(['status'])
      table.index(['valid_from', 'valid_until'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
