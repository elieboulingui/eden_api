// app/models/Product.ts
import { DateTime } from 'luxon'
import { BaseModel, column, beforeCreate, belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import crypto from 'node:crypto'
import User from './user.js'
import Category from './categories.js'
import Review from './review.js'
import OrderItem from './OrderItem.js'

export default class Product extends BaseModel {
  static table = 'products'

  @column({ isPrimary: true })
  declare id: string  // UUID

  @column()
  declare name: string

  @column()
  declare price: number

  @column()
  declare old_price: number | null

  @column()
  declare description: string

  @column()
  declare stock: number

  @column()
  declare rating: number

  @column()
  declare reviews_count: number

  @column()
  declare user_id: string

  @column({ columnName: 'category_id' })
  declare category_id: string | null

  @column({ columnName: 'image_url' })
  declare image_url: string | null

  @column()
  declare category: string | null

  @column()
  declare origin: string | null

  @column()
  declare weight: string | null

  @column()
  declare packaging: string | null

  @column()
  declare conservation: string | null

  @column()
  declare isNew: boolean

  @column()
  declare isOnSale: boolean

  @column()
  declare sales: number

  @column()
  declare likes: number

  @column()
  declare status: string  // 'active', 'inactive', 'draft'

  // ✅ NOUVEAU CHAMP : Archivage (par défaut false)
  @column({ columnName: 'is_archived' })
  declare is_archived: boolean

  @column.dateTime({ columnName: 'archived_at' })
  declare archived_at: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare created_at: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updated_at: DateTime

  @beforeCreate()
  static assignUuid(product: Product) {
    if (!product.id) {
      product.id = crypto.randomUUID()
    }
  }

  @beforeCreate()
  static setDefaults(product: Product) {
    product.is_archived = product.is_archived ?? false
    product.status = product.status ?? 'active'
    product.rating = product.rating ?? 0
    product.reviews_count = product.reviews_count ?? 0
    product.sales = product.sales ?? 0
    product.likes = product.likes ?? 0
    product.isNew = product.isNew ?? true
    product.isOnSale = product.isOnSale ?? false
  }

  // ================= RELATIONS =================

  @belongsTo(() => User, {
    foreignKey: 'user_id',
  })
  declare user: BelongsTo<typeof User>

  @belongsTo(() => Category, {
    foreignKey: 'category_id',
  })
  declare categoryRelation: BelongsTo<typeof Category>

  @hasMany(() => Review, {
    foreignKey: 'product_id',
  })
  declare reviews: HasMany<typeof Review>

  @hasMany(() => OrderItem, {
    foreignKey: 'product_id',
  })
  declare orderItems: HasMany<typeof OrderItem>

  // ================= MÉTHODES UTILITAIRES =================

  /**
   * Calcule la réduction en pourcentage
   */
  get discountPercentage(): number | null {
    if (this.old_price && this.old_price > this.price) {
      return Math.round(((this.old_price - this.price) / this.old_price) * 100)
    }
    return null
  }

  /**
   * Vérifie si le produit est en stock
   */
  get isInStock(): boolean {
    return this.stock > 0
  }

  /**
   * Vérifie si le stock est faible
   */
  get isLowStock(): boolean {
    return this.stock > 0 && this.stock <= 5
  }

  /**
   * Vérifie si le produit est archivé
   */
  get isArchived(): boolean {
    return this.is_archived === true
  }

  /**
   * Vérifie si le produit est actif (non archivé ET statut 'active')
   */
  get isActive(): boolean {
    return !this.is_archived && this.status === 'active'
  }

  /**
   * Formate le prix pour l'affichage
   */
  get formattedPrice(): string {
    return new Intl.NumberFormat('fr-FR').format(this.price) + ' FCFA'
  }

  /**
   * Formate l'ancien prix pour l'affichage
   */
  get formattedOldPrice(): string | null {
    if (this.old_price) {
      return new Intl.NumberFormat('fr-FR').format(this.old_price) + ' FCFA'
    }
    return null
  }

  // ================= MÉTHODES D'ARCHIVAGE =================

  /**
   * Archive le produit
   */
  async archive(): Promise<void> {
    this.is_archived = true
    this.archived_at = DateTime.now()
    await this.save()
  }

  /**
   * Désarchive le produit
   */
  async unarchive(): Promise<void> {
    this.is_archived = false
    this.archived_at = null
    await this.save()
  }

  /**
   * Active le produit
   */
  async activate(): Promise<void> {
    this.status = 'active'
    await this.save()
  }

  /**
   * Désactive le produit
   */
  async deactivate(): Promise<void> {
    this.status = 'inactive'
    await this.save()
  }

  // ================= SCOPES DE REQUÊTE =================

  /**
   * Scope pour les produits actifs (non archivés ET statut 'active')
   */
  static active() {
    return this.query()
      .where('is_archived', false)
      .where('status', 'active')
  }

  /**
   * Scope pour les produits archivés
   */
  static archived() {
    return this.query().where('is_archived', true)
  }

  /**
   * Scope pour les produits non archivés
   */
  static notArchived() {
    return this.query().where('is_archived', false)
  }

  /**
   * Scope pour les produits en stock
   */
  static inStock() {
    return this.query().where('stock', '>', 0)
  }

  /**
   * Scope pour les produits en promotion
   */
  static onSale() {
    return this.query().where('isOnSale', true)
  }
}