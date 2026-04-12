import { BaseSchema } from '@adonisjs/lucid/schema'

export default class CreateSecurityLogsTable extends BaseSchema {
  protected tableName = 'security_logs'

  public async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.string('ip', 45).notNullable()
      table.string('method', 10).notNullable()
      table.string('url', 500).notNullable()
      table.integer('status_code').notNullable()
      table.text('user_agent').nullable()
      table.string('referer', 500).nullable()
      table.integer('duration').nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()

      table.index(['ip', 'created_at'])
      table.index(['status_code'])
    })
  }

  public async down() {
    this.schema.dropTable(this.tableName)
  }
}
