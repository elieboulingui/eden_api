import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, BelongsTo } from '@ioc:Adonis/Lucid/Orm'
import Ticket from './Ticket'
import Passenger from './Passenger'

export default class Payment extends BaseModel {
  @column({ isPrimary: true })
  public id: string

  // Relations
  @column()
  public ticket_id: string

  @column()
  public passenger_id: string

  // Informations de paiement
  @column()
  public transaction_id: string

  @column()
  public amount: number

  @column()
  public currency: string

  @column()
  public payment_method: string

  // Statut
  @column()
  public status: string // pending, processing, completed, failed, refunded

  // Détails de la transaction
  @column()
  public gateway_transaction_id: string | null

  @column()
  public gateway_response_code: string | null

  @column()
  public gateway_response_message: string | null

  // Facturation
  @column()
  public invoice_number: string | null

  @column()
  public invoice_url: string | null

  // Métadonnées
  @column()
  public payment_details: object | null

  @column()
  public metadata: object | null

  // Timestamps
  @column.dateTime({ autoCreate: true })
  public createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  public updatedAt: DateTime

  // Relations
  @belongsTo(() => Ticket)
  public ticket: BelongsTo<typeof Ticket>

  @belongsTo(() => Passenger)
  public passenger: BelongsTo<typeof Passenger>

  // Méthodes utilitaires
  public markAsCompleted(transactionId: string): void {
    this.status = 'completed'
    this.gateway_transaction_id = transactionId
  }

  public markAsFailed(reason: string): void {
    this.status = 'failed'
    this.gateway_response_message = reason
  }
}
