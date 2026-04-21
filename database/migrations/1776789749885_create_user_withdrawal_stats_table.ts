// database/migrations/xxx_create_user_withdrawal_stats.ts
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'user_withdrawal_stats'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary()
      table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE').unique()
      table.integer('total_withdrawals').defaultTo(0)
      table.decimal('total_amount', 15, 2).defaultTo(0)
      table.integer('completed_count').defaultTo(0)
      table.decimal('completed_amount', 15, 2).defaultTo(0)
      table.integer('pending_count').defaultTo(0)
      table.decimal('pending_amount', 15, 2).defaultTo(0)
      table.integer('failed_count').defaultTo(0)
      table.decimal('failed_amount', 15, 2).defaultTo(0)
      table.timestamp('last_withdrawal_at').nullable()
      table.decimal('last_withdrawal_amount', 15, 2).nullable()
      table.decimal('largest_withdrawal', 15, 2).defaultTo(0)
      table.decimal('average_withdrawal', 15, 2).defaultTo(0)
      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}