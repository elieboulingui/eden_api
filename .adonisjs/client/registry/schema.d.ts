/* eslint-disable prettier/prettier */
/// <reference path="../manifest.d.ts" />

import type { ExtractBody, ExtractErrorResponse, ExtractQuery, ExtractQueryForGet, ExtractResponse } from '@tuyau/core/types'
import type { InferInput, SimpleError } from '@vinejs/vine/types'

export type ParamValue = string | number | bigint | boolean

export interface Registry {
  'api.client.profile.update': {
    methods: ["PUT"]
    pattern: '/api/profile/update'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'api.client.register': {
    methods: ["POST"]
    pattern: '/api/client/register'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'api.client.login': {
    methods: ["POST"]
    pattern: '/api/client/login'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'api.client.logout': {
    methods: ["POST"]
    pattern: '/api/client/logout'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'api.users.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/users'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'api.users.show': {
    methods: ["GET","HEAD"]
    pattern: '/api/users/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'api.products.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/products'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'api.products.show': {
    methods: ["GET","HEAD"]
    pattern: '/api/products/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'api.products.store': {
    methods: ["POST"]
    pattern: '/api/products'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'api.products.update': {
    methods: ["PUT"]
    pattern: '/api/products/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'api.products.destroy': {
    methods: ["DELETE"]
    pattern: '/api/products/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'api.categories.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/categories'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'api.categories.show': {
    methods: ["GET","HEAD"]
    pattern: '/api/categories/:slug'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { slug: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'api.categories.store': {
    methods: ["POST"]
    pattern: '/api/categories'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'api.categories.update': {
    methods: ["PUT"]
    pattern: '/api/categories/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'api.categories.destroy': {
    methods: ["DELETE"]
    pattern: '/api/categories/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'api.categories.products.store': {
    methods: ["POST"]
    pattern: '/api/categories/:id/products'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'api.cart.get': {
    methods: ["GET","HEAD"]
    pattern: '/api/cart/:userId'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { userId: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'api.cart.show': {
    methods: ["POST"]
    pattern: '/api/cart/show'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'api.cart.add': {
    methods: ["POST"]
    pattern: '/api/cart/add'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'api.cart.update': {
    methods: ["PUT"]
    pattern: '/api/cart/update'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'api.cart.delete': {
    methods: ["DELETE"]
    pattern: '/api/cart/item/:itemId'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { itemId: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'api.favorites.add': {
    methods: ["POST"]
    pattern: '/api/favorites/add'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'api.favorites.remove': {
    methods: ["POST"]
    pattern: '/api/favorites/remove'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'api.favorites.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/favorites'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'api.favorites.check': {
    methods: ["GET","HEAD"]
    pattern: '/api/favorites/check'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'api.orders.store': {
    methods: ["POST"]
    pattern: '/api/orders'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'api.orders.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/orders/:userId'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { userId: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'api.orders.show': {
    methods: ["GET","HEAD"]
    pattern: '/api/orders/:orderId/user/:userId'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue]
      params: { orderId: ParamValue; userId: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'api.orders.cancel': {
    methods: ["POST"]
    pattern: '/api/orders/:orderId/cancel'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { orderId: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'api.orders.invoice': {
    methods: ["GET","HEAD"]
    pattern: '/api/orders/:orderId/invoice/:userId'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue]
      params: { orderId: ParamValue; userId: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'api.orders.update-status': {
    methods: ["PUT"]
    pattern: '/api/orders/:orderId/status'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { orderId: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'api.merchant.products': {
    methods: ["GET","HEAD"]
    pattern: '/api/merchant/products/:userId'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { userId: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'api.merchant.products.create': {
    methods: ["POST"]
    pattern: '/api/merchant/products/:userId'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { userId: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'api.merchant.products.update': {
    methods: ["PUT"]
    pattern: '/api/merchant/products/:userId/:productId'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue]
      params: { userId: ParamValue; productId: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'api.merchant.products.delete': {
    methods: ["DELETE"]
    pattern: '/api/merchant/products/:userId/:productId'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue]
      params: { userId: ParamValue; productId: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'api.merchant.categories': {
    methods: ["GET","HEAD"]
    pattern: '/api/merchant/categories/:userId'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { userId: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'api.merchant.categories.create': {
    methods: ["POST"]
    pattern: '/api/merchant/categories/:userId'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { userId: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'api.merchant.categories.update': {
    methods: ["PUT"]
    pattern: '/api/merchant/categories/:userId/:categoryId'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue]
      params: { userId: ParamValue; categoryId: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'api.merchant.categories.delete': {
    methods: ["DELETE"]
    pattern: '/api/merchant/categories/:userId/:categoryId'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue]
      params: { userId: ParamValue; categoryId: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'api.merchant.coupons': {
    methods: ["GET","HEAD"]
    pattern: '/api/merchant/coupons/:userId'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { userId: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'api.merchant.coupons.create': {
    methods: ["POST"]
    pattern: '/api/merchant/coupons/:userId'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { userId: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'api.merchant.coupons.update': {
    methods: ["PUT"]
    pattern: '/api/merchant/coupons/:userId/:couponId'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue]
      params: { userId: ParamValue; couponId: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'api.merchant.coupons.delete': {
    methods: ["DELETE"]
    pattern: '/api/merchant/coupons/:userId/:couponId'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue]
      params: { userId: ParamValue; couponId: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'api.merchant.stats': {
    methods: ["GET","HEAD"]
    pattern: '/api/merchant/stats/:userId'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { userId: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'api.merchant.orders': {
    methods: ["GET","HEAD"]
    pattern: '/api/merchant/orders/:userId'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { userId: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'api.tracking.search': {
    methods: ["POST"]
    pattern: '/api/tracking/search'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'api.tracking.events': {
    methods: ["GET","HEAD"]
    pattern: '/api/tracking/:orderId/events'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { orderId: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'api.tracking.add-event': {
    methods: ["POST"]
    pattern: '/api/tracking/:orderId/event'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { orderId: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'api.tracking.update-status': {
    methods: ["PUT"]
    pattern: '/api/tracking/:orderId/status'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { orderId: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
}
