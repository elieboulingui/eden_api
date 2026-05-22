import { DateTime } from 'luxon'
import { BaseModel, column, beforeCreate, beforeSave, belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import crypto from 'node:crypto'
import User from './user.js'
import Category from './categories.js'
import Review from './review.js'
import OrderItem from './OrderItem.js'

export default class Product extends BaseModel {
  static table = 'products'

  @column({ isPrimary: true })
  declare id: string 

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

  @column({ columnName: 'is_new' })
  declare isNew: boolean

  @column({ columnName: 'is_on_sale' })
  declare isOnSale: boolean

  @column()
  declare sales: number

  @column()
  declare likes: number

  @column()
  declare status: string

  @column({ columnName: 'is_archived' })
  declare isArchived: boolean

  // ============================================================
  // 🎯 COLONNES DE BOOST (ABONNEMENT)
  // ============================================================

  @column({ columnName: 'is_boosted' })
  declare isBoosted: boolean

  @column({ columnName: 'boost_multiplier' })
  declare boostMultiplier: number

  @column.dateTime({ columnName: 'boost_start_date' })
  declare boostStartDate: DateTime | null

  @column.dateTime({ columnName: 'boost_end_date' })
  declare boostEndDate: DateTime | null

  @column({ columnName: 'boost_level' })
  declare boostLevel: 'none' | 'boosted' | 'premium' | 'premium_plus'

  @column({ columnName: 'boost_badge' })
  declare boostBadge: string | null

  @column({ columnName: 'boost_priority' })
  declare boostPriority: number

  @column({ columnName: 'boost_position' })
  declare boostPosition: number | null

  @column({ columnName: 'boost_views' })
  declare boostViews: number

  @column({ columnName: 'boost_clicks' })
  declare boostClicks: number

  @column({ columnName: 'boost_sales' })
  declare boostSales: number

  // ============================================================
  // IMAGES MULTIPLES
  // ============================================================

  @column({ columnName: 'image_url_2' })
  declare imageUrl2: string | null

  @column({ columnName: 'image_url_3' })
  declare imageUrl3: string | null

  @column({ columnName: 'image_url_4' })
  declare imageUrl4: string | null

  @column({ columnName: 'image_url_5' })
  declare imageUrl5: string | null

  // ============================================================
  // VARIANTES ET SPÉCIFICATIONS
  // ============================================================

  @column()
  declare brand: string | null

  @column()
  declare model: string | null

  @column()
  declare color: string | null

  @column()
  declare size: string | null

  @column()
  declare material: string | null

  @column({ columnName: 'min_order_quantity' })
  declare minOrderQuantity: number

  @column({ columnName: 'max_order_quantity' })
  declare maxOrderQuantity: number | null

  @column({ columnName: 'is_featured' })
  declare isFeatured: boolean

  @column({ columnName: 'is_trending' })
  declare isTrending: boolean

  @column({ columnName: 'seo_title' })
  declare seoTitle: string | null

  @column({ columnName: 'seo_description' })
  declare seoDescription: string | null

  @column()
  declare tags: string | null

  @column({ columnName: 'video_url' })
  declare videoUrl: string | null

  @column({ columnName: 'delivery_time' })
  declare deliveryTime: string | null

  @column({ columnName: 'warranty' })
  declare warranty: string | null

  @column({ columnName: 'return_policy' })
  declare returnPolicy: string | null

  @column.dateTime({ autoCreate: true, columnName: 'created_at' })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true, columnName: 'updated_at' })
  declare updatedAt: DateTime

  // ============================================================
  // HOOKS
  // ============================================================

  @beforeCreate()
  static async assignUuid(product: Product) {
    if (!product.id) product.id = crypto.randomUUID()
  }

  @beforeCreate()
  static async setDefaults(product: Product) {
    product.isArchived = product.isArchived ?? false
    product.isNew = product.isNew ?? true
    product.isOnSale = product.isOnSale ?? false
    product.stock = product.stock ?? 0
    product.sales = product.sales ?? 0
    product.likes = product.likes ?? 0
    product.rating = product.rating ?? 0
    product.reviews_count = product.reviews_count ?? 0
    product.status = product.status ?? 'active'
    product.minOrderQuantity = product.minOrderQuantity ?? 1
    product.isBoosted = product.isBoosted ?? false
    product.boostMultiplier = product.boostMultiplier ?? 1
    product.boostLevel = product.boostLevel ?? 'none'
    product.boostPriority = product.boostPriority ?? 0
    product.boostViews = product.boostViews ?? 0
    product.boostClicks = product.boostClicks ?? 0
    product.boostSales = product.boostSales ?? 0
    product.boostPosition = product.boostPosition ?? null
    product.boostBadge = product.boostBadge ?? null
    product.isFeatured = product.isFeatured ?? false
    product.isTrending = product.isTrending ?? false
  }

  @beforeSave()
  static async validateBoost(product: Product) {
    if (product.isBoosted && product.boostEndDate && product.boostEndDate <= DateTime.now()) {
      product.isBoosted = false
      product.boostMultiplier = 1
      product.boostLevel = 'none'
      product.boostBadge = null
      product.boostPriority = 0
      product.boostPosition = null
      product.boostStartDate = null
      product.boostEndDate = null
    }
  }

  // ============================================================
  // RELATIONS
  // ============================================================

  @belongsTo(() => User, { foreignKey: 'user_id' })
  declare user: BelongsTo<typeof User>

  @belongsTo(() => Category, { foreignKey: 'category_id' })
  declare categoryRelation: BelongsTo<typeof Category>

  @hasMany(() => Review, { foreignKey: 'product_id' })
  declare reviews: HasMany<typeof Review>

  @hasMany(() => OrderItem, { foreignKey: 'product_id' })
  declare orderItems: HasMany<typeof OrderItem>

  // ============================================================
  // GETTERS - GÉNÉRAUX
  // ============================================================

  get discountPercentage(): number | null {
    if (this.old_price && this.old_price > this.price) {
      return Math.round(((this.old_price - this.price) / this.old_price) * 100)
    }
    return null
  }

  get isInStock(): boolean {
    return this.stock > 0
  }

  get hasDiscount(): boolean {
    return this.old_price !== null && this.old_price > this.price
  }

  get savings(): number | null {
    if (this.old_price && this.old_price > this.price) {
      return this.old_price - this.price
    }
    return null
  }

  get allImages(): string[] {
    const images: string[] = []
    if (this.image_url) images.push(this.image_url)
    if (this.imageUrl2) images.push(this.imageUrl2)
    if (this.imageUrl3) images.push(this.imageUrl3)
    if (this.imageUrl4) images.push(this.imageUrl4)
    if (this.imageUrl5) images.push(this.imageUrl5)
    return images
  }

  get imagesCount(): number {
    return this.allImages.length
  }

  get tagsList(): string[] {
    if (!this.tags) return []
    return this.tags.split(',').map(t => t.trim()).filter(Boolean)
  }

  // ============================================================
  // GETTERS - BOOST
  // ============================================================

  get isBoostActive(): boolean {
    return this.isBoosted && this.boostEndDate !== null && this.boostEndDate > DateTime.now() && this.boostLevel !== 'none'
  }

  get boostRemainingDays(): number {
    if (!this.boostEndDate) return 0
    return Math.max(0, Math.floor(this.boostEndDate.diff(DateTime.now(), 'days').days))
  }

  get boostRemainingHours(): number {
    if (!this.boostEndDate) return 0
    return Math.max(0, Math.floor(this.boostEndDate.diff(DateTime.now(), 'hours').hours))
  }

  get boostProgressPercentage(): number {
    if (!this.boostStartDate || !this.boostEndDate) return 0
    const total = this.boostEndDate.diff(this.boostStartDate, 'hours').hours
    const elapsed = DateTime.now().diff(this.boostStartDate, 'hours').hours
    return Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)))
  }

  get boostBadgeConfig(): any {
    if (!this.isBoostActive) return null
    const configs: Record<string, any> = {
      boosted: { label: '🔥 Boosté', color: 'orange', bgColor: 'bg-orange-500', textColor: 'text-white', icon: 'Zap', borderColor: 'border-orange-500', ribbonColor: '#f97316' },
      premium: { label: '👑 Premium', color: 'purple', bgColor: 'bg-purple-500', textColor: 'text-white', icon: 'Crown', borderColor: 'border-purple-500', ribbonColor: '#a855f7' },
      premium_plus: { label: '💎 Premium+', color: 'yellow', bgColor: 'bg-yellow-500', textColor: 'text-black', icon: 'Diamond', borderColor: 'border-yellow-500', ribbonColor: '#eab308' },
    }
    return configs[this.boostLevel] || configs.boosted
  }

  get boostCardStyle(): string {
    if (!this.isBoostActive) return ''
    const styles: Record<string, string> = {
      boosted: 'ring-2 ring-orange-500 shadow-lg shadow-orange-500/20',
      premium: 'ring-2 ring-purple-500 shadow-lg shadow-purple-500/20',
      premium_plus: 'ring-2 ring-yellow-500 shadow-lg shadow-yellow-500/20',
    }
    return styles[this.boostLevel] || ''
  }

  get boostConversionRate(): number {
    if (this.boostViews === 0) return 0
    return Math.round((this.boostClicks / this.boostViews) * 100)
  }

  get totalBoostEngagement(): number {
    return this.boostViews + this.boostClicks + this.boostSales
  }

  get boostScore(): number {
    let score = this.boostPriority
    const levelBonus: Record<string, number> = { none: 0, boosted: 100, premium: 200, premium_plus: 300 }
    score += levelBonus[this.boostLevel] || 0
    score += Math.min(this.totalBoostEngagement, 50)
    if (this.isInStock) score += 20
    score += Math.min(this.rating * 10, 50)
    return score
  }

  // ============================================================
  // MÉTHODES - GESTION DES IMAGES MULTIPLES
  // ============================================================

  /**
   * Ajoute une image au produit
   * @param imageUrl URL de l'image à ajouter
   * @returns la position de l'image ajoutée (1-5) ou null si plein
   */
  async addImage(imageUrl: string): Promise<number | null> {
    if (!imageUrl) return null
    
    if (!this.image_url) {
      this.image_url = imageUrl
      await this.save()
      return 1
    }
    if (!this.imageUrl2) {
      this.imageUrl2 = imageUrl
      await this.save()
      return 2
    }
    if (!this.imageUrl3) {
      this.imageUrl3 = imageUrl
      await this.save()
      return 3
    }
    if (!this.imageUrl4) {
      this.imageUrl4 = imageUrl
      await this.save()
      return 4
    }
    if (!this.imageUrl5) {
      this.imageUrl5 = imageUrl
      await this.save()
      return 5
    }
    return null // Plus de place (max 5 images)
  }

  /**
   * Ajoute plusieurs images en une fois
   * @param imageUrls Liste des URLs d'images
   * @returns Nombre d'images ajoutées
   */
  async addMultipleImages(imageUrls: string[]): Promise<number> {
    let added = 0
    for (const url of imageUrls) {
      const result = await this.addImage(url)
      if (result) added++
    }
    return added
  }

  /**
   * Supprime une image du produit par sa position (1-5)
   * @param position Position de l'image (1 = image principale)
   */
  async removeImage(position: number): Promise<boolean> {
    switch (position) {
      case 1:
        this.image_url = null
        break
      case 2:
        this.imageUrl2 = null
        break
      case 3:
        this.imageUrl3 = null
        break
      case 4:
        this.imageUrl4 = null
        break
      case 5:
        this.imageUrl5 = null
        break
      default:
        return false
    }
    
    await this.save()
    await this.reorderImages()
    return true
  }

  /**
   * Supprime une image spécifique par son URL
   * @param imageUrl URL de l'image à supprimer
   */
  async removeImageByUrl(imageUrl: string): Promise<boolean> {
    if (this.image_url === imageUrl) {
      this.image_url = null
      await this.save()
      await this.reorderImages()
      return true
    }
    if (this.imageUrl2 === imageUrl) {
      this.imageUrl2 = null
      await this.save()
      await this.reorderImages()
      return true
    }
    if (this.imageUrl3 === imageUrl) {
      this.imageUrl3 = null
      await this.save()
      await this.reorderImages()
      return true
    }
    if (this.imageUrl4 === imageUrl) {
      this.imageUrl4 = null
      await this.save()
      await this.reorderImages()
      return true
    }
    if (this.imageUrl5 === imageUrl) {
      this.imageUrl5 = null
      await this.save()
      await this.reorderImages()
      return true
    }
    return false
  }

  /**
   * Réordonne les images pour combler les trous
   */
  async reorderImages(): Promise<void> {
    const images = this.allImages
    
    // Réinitialiser toutes les positions
    this.image_url = null
    this.imageUrl2 = null
    this.imageUrl3 = null
    this.imageUrl4 = null
    this.imageUrl5 = null
    
    // Replacer les images dans l'ordre
    if (images.length > 0) this.image_url = images[0]
    if (images.length > 1) this.imageUrl2 = images[1]
    if (images.length > 2) this.imageUrl3 = images[2]
    if (images.length > 3) this.imageUrl4 = images[3]
    if (images.length > 4) this.imageUrl5 = images[4]
    
    await this.save()
  }

  /**
   * Échange deux images
   * @param pos1 Position 1 (1-5)
   * @param pos2 Position 2 (1-5)
   */
  async swapImages(pos1: number, pos2: number): Promise<boolean> {
    const images = this.allImages
    if (pos1 < 1 || pos1 > 5 || pos2 < 1 || pos2 > 5) return false
    if (pos1 > images.length || pos2 > images.length) return false
    
    const temp = images[pos1 - 1]
    images[pos1 - 1] = images[pos2 - 1]
    images[pos2 - 1] = temp
    
    await this.setImagesFromArray(images)
    return true
  }

  /**
   * Définit toutes les images à partir d'un tableau
   * @param images Tableau d'URLs (max 5)
   */
  async setImagesFromArray(images: string[]): Promise<void> {
    // Limiter à 5 images
    const limited = images.slice(0, 5)
    
    this.image_url = limited[0] || null
    this.imageUrl2 = limited[1] || null
    this.imageUrl3 = limited[2] || null
    this.imageUrl4 = limited[3] || null
    this.imageUrl5 = limited[4] || null
    
    await this.save()
  }

  /**
   * Met à jour l'image principale
   * @param imageUrl Nouvelle URL de l'image principale
   */
  async setMainImage(imageUrl: string): Promise<boolean> {
    if (!imageUrl) return false
    
    // Vérifier si cette image existe déjà dans le produit
    const existingIndex = this.allImages.findIndex(img => img === imageUrl)
    
    if (existingIndex === -1) {
      // L'image n'existe pas, l'ajouter en première position
      const currentImages = this.allImages
      currentImages.unshift(imageUrl)
      await this.setImagesFromArray(currentImages)
    } else if (existingIndex > 0) {
      // L'image existe mais n'est pas en première position, l'échanger
      await this.swapImages(1, existingIndex + 1)
    }
    
    return true
  }

  /**
   * Vide toutes les images du produit
   */
  async clearAllImages(): Promise<void> {
    this.image_url = null
    this.imageUrl2 = null
    this.imageUrl3 = null
    this.imageUrl4 = null
    this.imageUrl5 = null
    await this.save()
  }

  // ============================================================
  // MÉTHODES - BOOST
  // ============================================================

  async activateBoost(config: { multiplier: number; level: 'boosted' | 'premium' | 'premium_plus'; badge: string; priority: number; startDate: DateTime; endDate: DateTime }): Promise<void> {
    this.isBoosted = true
    this.boostMultiplier = config.multiplier
    this.boostLevel = config.level
    this.boostBadge = config.badge
    this.boostPriority = config.priority
    this.boostStartDate = config.startDate
    this.boostEndDate = config.endDate
    this.boostViews = 0
    this.boostClicks = 0
    this.boostSales = 0
    await this.save()
  }

  async deactivateBoost(): Promise<void> {
    this.isBoosted = false
    this.boostMultiplier = 1
    this.boostLevel = 'none'
    this.boostBadge = null
    this.boostPriority = 0
    this.boostPosition = null
    this.boostStartDate = null
    this.boostEndDate = null
    await this.save()
  }

  async incrementBoostViews(count: number = 1): Promise<void> {
    if (!this.isBoostActive) return
    this.boostViews += count
    await this.save()
  }

  async incrementBoostClicks(count: number = 1): Promise<void> {
    if (!this.isBoostActive) return
    this.boostClicks += count
    await this.save()
  }

  async incrementBoostSales(count: number = 1): Promise<void> {
    if (!this.isBoostActive) return
    this.boostSales += count
    await this.save()
  }

  async checkAndExpireBoost(): Promise<void> {
    if (this.isBoostActive && this.boostEndDate && this.boostEndDate <= DateTime.now()) {
      await this.deactivateBoost()
    }
  }

  // ============================================================
  // MÉTHODES GÉNÉRALES
  // ============================================================

  async archive(): Promise<void> {
    this.isArchived = true
    this.status = 'inactive'
    if (this.isBoosted) await this.deactivateBoost()
    await this.save()
  }

  async unarchive(): Promise<void> {
    this.isArchived = false
    this.status = 'active'
    await this.save()
  }

  async updateStock(quantity: number): Promise<void> {
    this.stock = Math.max(0, this.stock - quantity)
    if (this.stock === 0) this.isNew = false
    await this.save()
  }

  async restoreStock(quantity: number): Promise<void> {
    this.stock += quantity
    if (this.isArchived && this.stock > 0) {
      this.isArchived = false
      this.status = 'active'
    }
    await this.save()
  }

  // ============================================================
  // MÉTHODES STATIQUES
  // ============================================================

  static async getBoostedProducts(limit: number = 20): Promise<Product[]> {
    return Product.query()
      .where('is_boosted', true)
      .where('boost_end_date', '>', DateTime.now().toISO())
      .where('is_archived', false)
      .where('status', 'active')
      .preload('user')
      .orderBy('boost_priority', 'desc')
      .orderBy('boost_multiplier', 'desc')
      .limit(limit)
  }

  static async getProductsSortedByBoost(categoryId?: string): Promise<Product[]> {
    let query = Product.query()
      .where('is_archived', false)
      .where('status', 'active')
      .preload('user')
      .orderByRaw('CASE WHEN is_boosted = true AND boost_end_date > ? THEN boost_priority ELSE 0 END DESC', [DateTime.now().toISO()])
      .orderBy('boost_multiplier', 'desc')
      .orderBy('created_at', 'desc')

    if (categoryId) {
      query = query.where('category_id', categoryId)
    }

    return query
  }

  static async expireAllBoosts(): Promise<number> {
    const result = await Product.query()
      .where('is_boosted', true)
      .where('boost_end_date', '<=', DateTime.now().toISO())
      .update({
        is_boosted: false,
        boost_multiplier: 1,
        boost_level: 'none',
        boost_badge: null,
        boost_priority: 0,
        boost_position: null,
        boost_start_date: null,
        boost_end_date: null
      })

    return Array.isArray(result) ? result.length : 0
  }

  // ============================================================
  // MÉTHODES STATIQUES - RECHERCHE PAR IMAGES
  // ============================================================

  /**
   * Trouve les produits qui ont une image
   */
  static async getProductsWithImages(limit: number = 50): Promise<Product[]> {
    return Product.query()
      .whereNotNull('image_url')
      .where('is_archived', false)
      .where('status', 'active')
      .limit(limit)
  }

  /**
   * Trouve les produits qui ont des images multiples
   */
  static async getProductsWithMultipleImages(limit: number = 50): Promise<Product[]> {
    return Product.query()
      .whereNotNull('image_url')
      .whereNotNull('image_url_2')
      .orWhereNotNull('image_url_3')
      .orWhereNotNull('image_url_4')
      .orWhereNotNull('image_url_5')
      .where('is_archived', false)
      .where('status', 'active')
      .limit(limit)
  }

  /**
   * Compte le nombre total d'images dans la base
   */
  static async getTotalImagesCount(): Promise<number> {
    const products = await Product.query()
      .where('is_archived', false)
      .where('status', 'active')
      .select('image_url', 'image_url_2', 'image_url_3', 'image_url_4', 'image_url_5')
    
    return products.reduce((total, product) => {
      return total + product.allImages.length
    }, 0)
  }
}
