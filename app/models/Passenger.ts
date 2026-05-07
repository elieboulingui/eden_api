import { DateTime } from 'luxon'
import { BaseModel, column, hasMany, HasMany } from '@ioc:Adonis/Lucid/Orm'
import Ticket from './Ticket'
import Payment from './Payment'

export default class Passenger extends BaseModel {
  @column({ isPrimary: true })
  public id: string

  // Informations personnelles
  @column()
  public first_name: string

  @column()
  public last_name: string

  @column()
  public email: string

  @column()
  public phone: string | null

  // Document d'identité
  @column()
  public document_type: string // passport, id_card, driver_license

  @column()
  public document_number: string

  @column()
  public nationality: string | null

  // Date de naissance
  @column.date()
  public date_of_birth: DateTime | null

  // Statut
  @column()
  public status: string // active, blocked, vip

  // Préférences
  @column()
  public preferred_class: string

  @column()
  public preferred_payment_method: string | null

  // Métadonnées
  @column()
  public metadata: object | null

  // Timestamps
  @column.dateTime({ autoCreate: true })
  public createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  public updatedAt: DateTime

  // Relations
  @hasMany(() => Ticket)
  public tickets: HasMany<typeof Ticket>

  @hasMany(() => Payment)
  public payments: HasMany<typeof Payment>

  // Computed properties (accesseurs)
  public get fullName(): string {
    return `${this.first_name} ${this.last_name}`
  }

  // Hooks
  public static boot() {
    // Hook avant sauvegarde pour normaliser l'email
    this.before('save', (passenger: Passenger) => {
      if (passenger.email) {
        passenger.email = passenger.email.toLowerCase().trim()
      }
    })
  }
}
