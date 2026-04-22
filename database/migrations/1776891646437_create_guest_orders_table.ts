// database/migrations/XXXXXXXXXXXX_CREATE_GUEST_ORDERS_TABLE.ts
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'guest_orders'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.string('id', 36).primary()
      table.string('guest_id', 100).notNullable()
      table.string('customer_name', 255).notNullable()
      table.string('customer_email', 255).notNullable()
      table.string('customer_phone', 50).notNullable()
      table.string('kyc_id', 36).nullable()
      table.string('order_id', 36).nullable()
      table.string('status', 50).defaultTo('pending')
      table.timestamp('created_at', { useTz: true }).defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).defaultTo(this.now())

      // Index pour améliorer les performances des recherches
      table.index(['guest_id'], 'idx_guest_orders_guest_id')
      table.index(['customer_email'], 'idx_guest_orders_email')
      table.index(['order_id'], 'idx_guest_orders_order_id')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
