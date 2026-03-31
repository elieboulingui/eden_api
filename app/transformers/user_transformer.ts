import type User from '#models/user'
import { BaseTransformer } from '@adonisjs/core/transformers'

export default class UserTransformer extends BaseTransformer<User> {
  toObject() {
    return this.pick(this.resource, [
      'id',
      'full_name',      // Change from 'fullName' to 'full_name'
      'email',
      'role',
      'avatar',
      'phone',
      'address',
      'created_at', // Change from 'createdAt' to 'created_at'
      'updated_at', // Change from 'updatedAt' to 'updated_at'
    ])
  }
}