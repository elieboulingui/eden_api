import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'promotions'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary()
      table.string('title').notNullable()
      table.text('description').nullable()
      table.string('image_url').nullable()
      table.string('banner_image').nullable()
      table.string('type').defaultTo('banner') // banner, flash_sale, category_offer
      table.integer('discount_percentage').nullable()
      table.integer('discount_amount').nullable()
      table.string('category').nullable()
      table.text('product_ids').nullable() // JSON stringifié
      table.string('link').nullable()
      table.string('button_text').defaultTo('En profiter')
      table.integer('min_order_amount').nullable()
      table.date('start_date').nullable()
      table.date('end_date').nullable()
      table.enum('status', ['active', 'expired', 'upcoming', 'disabled']).defaultTo('active')
      table.integer('priority').defaultTo(0)
      table.timestamp('created_at', { useTz: true })
      table.timestamp('updated_at', { useTz: true })
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
