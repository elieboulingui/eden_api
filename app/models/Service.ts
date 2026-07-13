// app/models/Service.ts - Ajoutez
import DailySubscription from './DailySubscription.js'

@hasMany(() => DailySubscription, {
  foreignKey: 'service_id',
})
declare daily_subscriptions: HasMany<typeof DailySubscription>

// Méthodes pour le service
async getTodaySubscribers(): Promise<number> {
  const today = DateTime.now().toFormat('yyyy-MM-dd')
  const result = await DailySubscription.query()
    .where('service_id', this.id)
    .where('status', 'active')
    .whereRaw('DATE(subscription_date) = ?', [today])
    .count('* as total')
    .first()
  
  return Number.parseInt(result?.$extras?.total) || 0
}

async getActiveSubscriptionsCount(): Promise<number> {
  const result = await DailySubscription.query()
    .where('service_id', this.id)
    .where('status', 'active')
    .where('valid_until', '>', DateTime.now().toSQL())
    .count('* as total')
    .first()
  
  return Number.parseInt(result?.$extras?.total) || 0
}

async getTodayRevenue(): Promise<number> {
  const today = DateTime.now().toFormat('yyyy-MM-dd')
  const result = await DailySubscription.query()
    .where('service_id', this.id)
    .where('status', 'active')
    .whereRaw('DATE(subscription_date) = ?', [today])
    .sum('price_paid as total')
    .first()
  
  return Number.parseFloat(result?.$extras?.total) || 0
}
