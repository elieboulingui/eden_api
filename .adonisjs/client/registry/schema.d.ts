/* eslint-disable prettier/prettier */
/// <reference path="../manifest.d.ts" />

import type { ExtractBody, ExtractErrorResponse, ExtractQuery, ExtractQueryForGet, ExtractResponse } from '@tuyau/core/types'
import type { InferInput, SimpleError } from '@vinejs/vine/types'

export type ParamValue = string | number | bigint | boolean

export interface Registry {
  'orders.check_payment_status': {
    methods: ["GET","HEAD"]
    pattern: '/api/orders/:orderId/payment-status'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { orderId: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'orders.payment_status_callbacks': {
    methods: ["GET","HEAD"]
    pattern: '/api/payment/status/:transactionId'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { transactionId: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'pubs.get_all_pubs': {
    methods: ["GET","HEAD"]
    pattern: '/api/pubs'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'pubs.create_pub': {
    methods: ["POST"]
    pattern: '/api/pubs'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'pubs.update_pub': {
    methods: ["PUT"]
    pattern: '/api/pubs/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'pubs.delete_pub': {
    methods: ["DELETE"]
    pattern: '/api/pubs/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'pubs.toggle_pub_status': {
    methods: ["PATCH"]
    pattern: '/api/pubs/:id/toggle'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'merchant_dashboard.give_change': {
    methods: ["POST"]
    pattern: '/api/merchant/give-change'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'merchant_dashboard.get_withdrawal_history': {
    methods: ["GET","HEAD"]
    pattern: '/api/merchant/withdrawals/:userId'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { userId: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'merchant_dashboard.get_wallet': {
    methods: ["GET","HEAD"]
    pattern: '/api/merchant/wallet/:userId'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { userId: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'merchant_dashboard.dashboard': {
    methods: ["GET","HEAD"]
    pattern: '/api/merchant/dashboard/:userId'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { userId: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'merchant_dashboard.get_stats': {
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
  'merchant_dashboard.get_merchant_orders': {
    methods: ["GET","HEAD"]
    pattern: '/api/merchant/orders/all/:userId'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { userId: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'merchant_dashboard.get_pending_orders': {
    methods: ["GET","HEAD"]
    pattern: '/api/merchant/orders/pending/:userId'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { userId: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'merchant_dashboard.get_order_details': {
    methods: ["GET","HEAD"]
    pattern: '/api/merchant/orders/detail/:userId/:orderId'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue]
      params: { userId: ParamValue; orderId: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'merchant_dashboard.get_recent_orders': {
    methods: ["GET","HEAD"]
    pattern: '/api/merchant/orders/recent/:userId'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { userId: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'merchant_dashboard.get_products': {
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
  'merchant_dashboard.create_product': {
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
  'merchant_dashboard.update_product': {
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
  'merchant_dashboard.delete_product': {
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
  'merchant_dashboard.get_categories': {
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
  'merchant_dashboard.create_category': {
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
  'merchant_dashboard.update_category': {
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
  'merchant_dashboard.delete_category': {
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
  'merchant_dashboard.get_coupons': {
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
  'merchant_dashboard.create_coupon': {
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
  'merchant_dashboard.update_coupon': {
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
  'merchant_dashboard.delete_coupon': {
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
  'coupons.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/coupons'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'coupons.apply': {
    methods: ["POST"]
    pattern: '/api/coupons/apply'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'coupons.verify': {
    methods: ["POST"]
    pattern: '/api/coupons/verify'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'coupons.show': {
    methods: ["GET","HEAD"]
    pattern: '/api/coupons/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'new_account.store': {
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
  'session.store': {
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
  'session.update': {
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
  'session.destroy': {
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
  'users.index': {
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
  'users.show': {
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
  'products.index': {
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
  'products.show': {
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
  'products.store': {
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
  'products.update': {
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
  'products.destroy': {
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
  'categories.index': {
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
  'categories.show': {
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
  'categories.store': {
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
  'categories.update': {
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
  'categories.destroy': {
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
  'categories.create_product': {
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
  'cart.get_cart': {
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
  'cart.show': {
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
  'cart.add': {
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
  'cart.update': {
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
  'cart.delete_item': {
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
  'cart.clear': {
    methods: ["DELETE"]
    pattern: '/api/cart/clear'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'favorites.add': {
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
  'favorites.remove': {
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
  'favorites.index': {
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
  'favorites.check': {
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
  'orders.store': {
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
  'orders.index': {
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
  'orders.show': {
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
  'orders.cancel': {
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
  'orders.invoice': {
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
  'orders.update_status': {
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
  'order_tracking.search': {
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
  'order_tracking.get_tracking_events': {
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
  'order_tracking.add_tracking_event': {
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
  'order_tracking.update_order_status': {
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
