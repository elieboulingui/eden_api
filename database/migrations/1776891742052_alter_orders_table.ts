// database/migrations/XXXXXXXXXXXX_ADD_GUEST_ORDER_ID_TO_ORDERS.ts
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'orders'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('guest_order_id', 36).nullable().after('user_id')
      table.index(['guest_order_id'], 'idx_orders_guest_order_id')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropIndex(['guest_order_id'], 'idx_orders_guest_order_id')
      table.dropColumn('guest_order_id')
    })
  }
}
