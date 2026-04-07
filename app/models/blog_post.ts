// app/models/blog_post.ts
import { DateTime } from 'luxon'
import { BaseModel, column, beforeCreate, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import crypto from 'node:crypto'
import User from './user.js'

export default class BlogPost extends BaseModel {
  static table = 'blog_posts'

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare title: string

  @column()
  declare slug: string

  @column()
  declare excerpt: string

  @column()
  declare content: string

  // ✅ Changé de string | null à string | undefined
  @column()
  declare image_url: string | undefined

  @column()
  declare category: string

  @column()
  declare author_name: string

  // ✅ Changé de string | null à string | undefined
  @column()
  declare author_id: string | undefined

  @column()
  declare read_time: number

  @column()
  declare status: 'draft' | 'published' | 'archived'

  @column()
  declare views: number

  // ✅ Changé de string | null à string | undefined
  @column()
  declare meta_title: string | undefined

  // ✅ Changé de string | null à string | undefined
  @column()
  declare meta_description: string | undefined

  // ✅ Changé de string[] | null à string[] | undefined
  @column({
    consume: (value: string | null) => {
      if (!value) return undefined
      try {
        return typeof value === 'string' ? JSON.parse(value) : value
      } catch {
        return undefined
      }
    },
    prepare: (value: string[] | undefined) => {
      return value ? JSON.stringify(value) : undefined
    }
  })
  declare tags: string[] | undefined

  @column.dateTime({ autoCreate: true })
  declare created_at: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updated_at: DateTime

  // ✅ Changé de DateTime | null à DateTime | undefined
  @column.dateTime()
  declare published_at: DateTime | undefined

  @beforeCreate()
  static assignUuid(post: BlogPost) {
    if (!post.id) {
      post.id = crypto.randomUUID()
    }
    if (!post.slug) {
      post.slug = post.title
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
    }
    if (!post.views) {
      post.views = 0
    }
    if (!post.status) {
      post.status = 'draft'
    }
  }

  @belongsTo(() => User, {
    foreignKey: 'author_id',
  })
  declare author: BelongsTo<typeof User>
}