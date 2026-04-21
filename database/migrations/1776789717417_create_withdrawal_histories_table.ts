// database/migrations/xxx_create_withdrawal_histories.ts
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'withdrawal_histories'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary()
      table.uuid('withdrawal_id').references('id').inTable('withdrawals').onDelete('CASCADE')
      table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE')
      table.string('action', 50).notNullable()
      table.string('old_status', 50).nullable()
      table.string('new_status', 50).notNullable()
      table.decimal('amount', 15, 2).nullable()
      table.text('notes').nullable()
      table.uuid('performed_by').nullable()
      table.string('ip_address', 45).nullable()
      table.json('metadata').nullable()
      table.timestamp('created_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}