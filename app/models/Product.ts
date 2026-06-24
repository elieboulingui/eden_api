// app/models/Product.ts
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
  // 🎬 COLONNES VIDÉO
  // ============================================================

  @column({ columnName: 'video_url' })
  declare videoUrl: string | null

  @column({ columnName: 'demo_video_url' })
  declare demoVideoUrl: string | null

  @column({ columnName: 'video_360_url' })
  declare video360Url: string | null

  @column({ columnName: 'video_thumbnail_url' })
  declare videoThumbnailUrl: string | null

  @column({ columnName: 'video_duration' })
  declare videoDuration: number | null

  @column({ columnName: 'video_subtitles_url' })
  declare videoSubtitlesUrl: string | null

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
  // GETTERS - VIDÉO
  // ============================================================

  get hasVideo(): boolean {
    return !!(this.videoUrl || this.demoVideoUrl || this.video360Url)
  }

  get hasMainVideo(): boolean {
    return !!this.videoUrl
  }

  get hasDemoVideo(): boolean {
    return !!this.demoVideoUrl
  }

  get hasVideo360(): boolean {
    return !!this.video360Url
  }

  get mainVideoUrl(): string | null {
    return this.videoUrl || this.demoVideoUrl || null
  }

  get videoUrls(): { url: string; type: 'main' | 'demo' | '360'; label: string }[] {
    const videos: { url: string; type: 'main' | 'demo' | '360'; label: string }[] = []
    if (this.videoUrl) videos.push({ url: this.videoUrl, type: 'main', label: 'Vidéo principale' })
    if (this.demoVideoUrl) videos.push({ url: this.demoVideoUrl, type: 'demo', label: 'Vidéo de démonstration' })
    if (this.video360Url) videos.push({ url: this.video360Url, type: '360', label: 'Vidéo 360°' })
    return videos
  }

  get videoThumbnail(): string | null {
    if (this.videoThumbnailUrl) return this.videoThumbnailUrl
    if (this.image_url) return this.image_url
    return null
  }

  get videoEmbedUrl(): string | null {
    if (!this.videoUrl) return null
    
    // YouTube
    const youtubeRegex = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/
    const youtubeMatch = this.videoUrl.match(youtubeRegex)
    if (youtubeMatch) {
      return `https://www.youtube.com/embed/${youtubeMatch[1]}`
    }
    
    // Vimeo
    const vimeoRegex = /vimeo\.com\/(\d+)/
    const vimeoMatch = this.videoUrl.match(vimeoRegex)
    if (vimeoMatch) {
      return `https://player.vimeo.com/video/${vimeoMatch[1]}`
    }
    
    // Facebook Video
    const facebookRegex = /facebook\.com\/.*\/videos\/(\d+)/
    const facebookMatch = this.videoUrl.match(facebookRegex)
    if (facebookMatch) {
      return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(this.videoUrl)}`
    }
    
    // Dailymotion
    const dailymotionRegex = /dailymotion\.com\/video\/([a-zA-Z0-9]+)/
    const dailymotionMatch = this.videoUrl.match(dailymotionRegex)
    if (dailymotionMatch) {
      return `https://www.dailymotion.com/embed/video/${dailymotionMatch[1]}`
    }
    
    // Si c'est déjà une URL d'embed
    if (this.videoUrl.includes('embed') || this.videoUrl.includes('player')) {
      return this.videoUrl
    }
    
    return this.videoUrl
  }

  get videoEmbedUrlDemo(): string | null {
    if (!this.demoVideoUrl) return null
    
    // YouTube
    const youtubeRegex = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/
    const youtubeMatch = this.demoVideoUrl.match(youtubeRegex)
    if (youtubeMatch) {
      return `https://www.youtube.com/embed/${youtubeMatch[1]}`
    }
    
    // Vimeo
    const vimeoRegex = /vimeo\.com\/(\d+)/
    const vimeoMatch = this.demoVideoUrl.match(vimeoRegex)
    if (vimeoMatch) {
      return `https://player.vimeo.com/video/${vimeoMatch[1]}`
    }
    
    return this.demoVideoUrl
  }

  get videoDurationFormatted(): string | null {
    if (!this.videoDuration) return null
    const minutes = Math.floor(this.videoDuration / 60)
    const seconds = this.videoDuration % 60
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  get videoPlatform(): 'youtube' | 'vimeo' | 'facebook' | 'dailymotion' | 'other' | null {
    if (!this.videoUrl) return null
    
    if (this.videoUrl.includes('youtube.com') || this.videoUrl.includes('youtu.be')) {
      return 'youtube'
    }
    if (this.videoUrl.includes('vimeo.com')) {
      return 'vimeo'
    }
    if (this.videoUrl.includes('facebook.com')) {
      return 'facebook'
    }
    if (this.videoUrl.includes('dailymotion.com')) {
      return 'dailymotion'
    }
    return 'other'
  }

  get videoPlatformIcon(): string {
    const icons = {
      youtube: '▶️',
      vimeo: '🎬',
      facebook: '📱',
      dailymotion: '🎥',
      other: '📹'
    }
    return icons[this.videoPlatform || 'other'] || '📹'
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
  // MÉTHODES - VIDÉO
  // ============================================================

  async setVideoUrl(url: string | null): Promise<void> {
    this.videoUrl = url
    await this.save()
  }

  async setDemoVideoUrl(url: string | null): Promise<void> {
    this.demoVideoUrl = url
    await this.save()
  }

  async setVideo360Url(url: string | null): Promise<void> {
    this.video360Url = url
    await this.save()
  }

  async setVideoThumbnail(url: string | null): Promise<void> {
    this.videoThumbnailUrl = url
    await this.save()
  }

  async setVideoDuration(seconds: number | null): Promise<void> {
    this.videoDuration = seconds
    await this.save()
  }

  async setVideoSubtitles(url: string | null): Promise<void> {
    this.videoSubtitlesUrl = url
    await this.save()
  }

  async clearAllVideos(): Promise<void> {
    this.videoUrl = null
    this.demoVideoUrl = null
    this.video360Url = null
    this.videoThumbnailUrl = null
    this.videoDuration = null
    this.videoSubtitlesUrl = null
    await this.save()
  }

  async removeVideo(videoType: 'main' | 'demo' | '360'): Promise<void> {
    if (videoType === 'main') {
      this.videoUrl = null
    } else if (videoType === 'demo') {
      this.demoVideoUrl = null
    } else if (videoType === '360') {
      this.video360Url = null
    }
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
  // MÉTHODES STATIQUES - VIDÉO
  // ============================================================

  static async getProductsWithVideo(limit: number = 20): Promise<Product[]> {
    return Product.query()
      .whereNotNull('video_url')
      .where('is_archived', false)
      .where('status', 'active')
      .preload('user')
      .orderBy('created_at', 'desc')
      .limit(limit)
  }

  static async getProductsWithDemoVideo(limit: number = 20): Promise<Product[]> {
    return Product.query()
      .whereNotNull('demo_video_url')
      .where('is_archived', false)
      .where('status', 'active')
      .preload('user')
      .orderBy('created_at', 'desc')
      .limit(limit)
  }
}
