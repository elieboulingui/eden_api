/* eslint-disable prettier/prettier */
import type { AdonisEndpoint } from '@tuyau/core/types'
import type { Registry } from './schema.d.ts'
import type { ApiDefinition } from './tree.d.ts'

const placeholder: any = {}

const routes = {
  'orders.check_payment_status': {
    methods: ["GET","HEAD"],
    pattern: '/api/orders/:orderId/payment-status',
    tokens: [{"old":"/api/orders/:orderId/payment-status","type":0,"val":"api","end":""},{"old":"/api/orders/:orderId/payment-status","type":0,"val":"orders","end":""},{"old":"/api/orders/:orderId/payment-status","type":1,"val":"orderId","end":""},{"old":"/api/orders/:orderId/payment-status","type":0,"val":"payment-status","end":""}],
    types: placeholder as Registry['orders.check_payment_status']['types'],
  },
  'orders.payment_status_callbacks': {
    methods: ["GET","HEAD"],
    pattern: '/api/payment/status/:transactionId',
    tokens: [{"old":"/api/payment/status/:transactionId","type":0,"val":"api","end":""},{"old":"/api/payment/status/:transactionId","type":0,"val":"payment","end":""},{"old":"/api/payment/status/:transactionId","type":0,"val":"status","end":""},{"old":"/api/payment/status/:transactionId","type":1,"val":"transactionId","end":""}],
    types: placeholder as Registry['orders.payment_status_callbacks']['types'],
  },
  'pubs.get_all_pubs': {
    methods: ["GET","HEAD"],
    pattern: '/api/pubs',
    tokens: [{"old":"/api/pubs","type":0,"val":"api","end":""},{"old":"/api/pubs","type":0,"val":"pubs","end":""}],
    types: placeholder as Registry['pubs.get_all_pubs']['types'],
  },
  'pubs.create_pub': {
    methods: ["POST"],
    pattern: '/api/pubs',
    tokens: [{"old":"/api/pubs","type":0,"val":"api","end":""},{"old":"/api/pubs","type":0,"val":"pubs","end":""}],
    types: placeholder as Registry['pubs.create_pub']['types'],
  },
  'pubs.update_pub': {
    methods: ["PUT"],
    pattern: '/api/pubs/:id',
    tokens: [{"old":"/api/pubs/:id","type":0,"val":"api","end":""},{"old":"/api/pubs/:id","type":0,"val":"pubs","end":""},{"old":"/api/pubs/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['pubs.update_pub']['types'],
  },
  'pubs.delete_pub': {
    methods: ["DELETE"],
    pattern: '/api/pubs/:id',
    tokens: [{"old":"/api/pubs/:id","type":0,"val":"api","end":""},{"old":"/api/pubs/:id","type":0,"val":"pubs","end":""},{"old":"/api/pubs/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['pubs.delete_pub']['types'],
  },
  'pubs.toggle_pub_status': {
    methods: ["PATCH"],
    pattern: '/api/pubs/:id/toggle',
    tokens: [{"old":"/api/pubs/:id/toggle","type":0,"val":"api","end":""},{"old":"/api/pubs/:id/toggle","type":0,"val":"pubs","end":""},{"old":"/api/pubs/:id/toggle","type":1,"val":"id","end":""},{"old":"/api/pubs/:id/toggle","type":0,"val":"toggle","end":""}],
    types: placeholder as Registry['pubs.toggle_pub_status']['types'],
  },
  'merchant_dashboard.give_change': {
    methods: ["POST"],
    pattern: '/api/merchant/give-change',
    tokens: [{"old":"/api/merchant/give-change","type":0,"val":"api","end":""},{"old":"/api/merchant/give-change","type":0,"val":"merchant","end":""},{"old":"/api/merchant/give-change","type":0,"val":"give-change","end":""}],
    types: placeholder as Registry['merchant_dashboard.give_change']['types'],
  },
  'merchant_dashboard.get_withdrawal_history': {
    methods: ["GET","HEAD"],
    pattern: '/api/merchant/withdrawals/:userId',
    tokens: [{"old":"/api/merchant/withdrawals/:userId","type":0,"val":"api","end":""},{"old":"/api/merchant/withdrawals/:userId","type":0,"val":"merchant","end":""},{"old":"/api/merchant/withdrawals/:userId","type":0,"val":"withdrawals","end":""},{"old":"/api/merchant/withdrawals/:userId","type":1,"val":"userId","end":""}],
    types: placeholder as Registry['merchant_dashboard.get_withdrawal_history']['types'],
  },
  'merchant_dashboard.get_wallet': {
    methods: ["GET","HEAD"],
    pattern: '/api/merchant/wallet/:userId',
    tokens: [{"old":"/api/merchant/wallet/:userId","type":0,"val":"api","end":""},{"old":"/api/merchant/wallet/:userId","type":0,"val":"merchant","end":""},{"old":"/api/merchant/wallet/:userId","type":0,"val":"wallet","end":""},{"old":"/api/merchant/wallet/:userId","type":1,"val":"userId","end":""}],
    types: placeholder as Registry['merchant_dashboard.get_wallet']['types'],
  },
  'merchant_dashboard.dashboard': {
    methods: ["GET","HEAD"],
    pattern: '/api/merchant/dashboard/:userId',
    tokens: [{"old":"/api/merchant/dashboard/:userId","type":0,"val":"api","end":""},{"old":"/api/merchant/dashboard/:userId","type":0,"val":"merchant","end":""},{"old":"/api/merchant/dashboard/:userId","type":0,"val":"dashboard","end":""},{"old":"/api/merchant/dashboard/:userId","type":1,"val":"userId","end":""}],
    types: placeholder as Registry['merchant_dashboard.dashboard']['types'],
  },
  'merchant_dashboard.get_stats': {
    methods: ["GET","HEAD"],
    pattern: '/api/merchant/stats/:userId',
    tokens: [{"old":"/api/merchant/stats/:userId","type":0,"val":"api","end":""},{"old":"/api/merchant/stats/:userId","type":0,"val":"merchant","end":""},{"old":"/api/merchant/stats/:userId","type":0,"val":"stats","end":""},{"old":"/api/merchant/stats/:userId","type":1,"val":"userId","end":""}],
    types: placeholder as Registry['merchant_dashboard.get_stats']['types'],
  },
  'merchant_dashboard.get_merchant_orders': {
    methods: ["GET","HEAD"],
    pattern: '/api/merchant/orders/all/:userId',
    tokens: [{"old":"/api/merchant/orders/all/:userId","type":0,"val":"api","end":""},{"old":"/api/merchant/orders/all/:userId","type":0,"val":"merchant","end":""},{"old":"/api/merchant/orders/all/:userId","type":0,"val":"orders","end":""},{"old":"/api/merchant/orders/all/:userId","type":0,"val":"all","end":""},{"old":"/api/merchant/orders/all/:userId","type":1,"val":"userId","end":""}],
    types: placeholder as Registry['merchant_dashboard.get_merchant_orders']['types'],
  },
  'merchant_dashboard.get_pending_orders': {
    methods: ["GET","HEAD"],
    pattern: '/api/merchant/orders/pending/:userId',
    tokens: [{"old":"/api/merchant/orders/pending/:userId","type":0,"val":"api","end":""},{"old":"/api/merchant/orders/pending/:userId","type":0,"val":"merchant","end":""},{"old":"/api/merchant/orders/pending/:userId","type":0,"val":"orders","end":""},{"old":"/api/merchant/orders/pending/:userId","type":0,"val":"pending","end":""},{"old":"/api/merchant/orders/pending/:userId","type":1,"val":"userId","end":""}],
    types: placeholder as Registry['merchant_dashboard.get_pending_orders']['types'],
  },
  'merchant_dashboard.get_order_details': {
    methods: ["GET","HEAD"],
    pattern: '/api/merchant/orders/detail/:userId/:orderId',
    tokens: [{"old":"/api/merchant/orders/detail/:userId/:orderId","type":0,"val":"api","end":""},{"old":"/api/merchant/orders/detail/:userId/:orderId","type":0,"val":"merchant","end":""},{"old":"/api/merchant/orders/detail/:userId/:orderId","type":0,"val":"orders","end":""},{"old":"/api/merchant/orders/detail/:userId/:orderId","type":0,"val":"detail","end":""},{"old":"/api/merchant/orders/detail/:userId/:orderId","type":1,"val":"userId","end":""},{"old":"/api/merchant/orders/detail/:userId/:orderId","type":1,"val":"orderId","end":""}],
    types: placeholder as Registry['merchant_dashboard.get_order_details']['types'],
  },
  'merchant_dashboard.get_recent_orders': {
    methods: ["GET","HEAD"],
    pattern: '/api/merchant/orders/recent/:userId',
    tokens: [{"old":"/api/merchant/orders/recent/:userId","type":0,"val":"api","end":""},{"old":"/api/merchant/orders/recent/:userId","type":0,"val":"merchant","end":""},{"old":"/api/merchant/orders/recent/:userId","type":0,"val":"orders","end":""},{"old":"/api/merchant/orders/recent/:userId","type":0,"val":"recent","end":""},{"old":"/api/merchant/orders/recent/:userId","type":1,"val":"userId","end":""}],
    types: placeholder as Registry['merchant_dashboard.get_recent_orders']['types'],
  },
  'merchant_dashboard.get_products': {
    methods: ["GET","HEAD"],
    pattern: '/api/merchant/products/:userId',
    tokens: [{"old":"/api/merchant/products/:userId","type":0,"val":"api","end":""},{"old":"/api/merchant/products/:userId","type":0,"val":"merchant","end":""},{"old":"/api/merchant/products/:userId","type":0,"val":"products","end":""},{"old":"/api/merchant/products/:userId","type":1,"val":"userId","end":""}],
    types: placeholder as Registry['merchant_dashboard.get_products']['types'],
  },
  'merchant_dashboard.create_product': {
    methods: ["POST"],
    pattern: '/api/merchant/products/:userId',
    tokens: [{"old":"/api/merchant/products/:userId","type":0,"val":"api","end":""},{"old":"/api/merchant/products/:userId","type":0,"val":"merchant","end":""},{"old":"/api/merchant/products/:userId","type":0,"val":"products","end":""},{"old":"/api/merchant/products/:userId","type":1,"val":"userId","end":""}],
    types: placeholder as Registry['merchant_dashboard.create_product']['types'],
  },
  'merchant_dashboard.update_product': {
    methods: ["PUT"],
    pattern: '/api/merchant/products/:userId/:productId',
    tokens: [{"old":"/api/merchant/products/:userId/:productId","type":0,"val":"api","end":""},{"old":"/api/merchant/products/:userId/:productId","type":0,"val":"merchant","end":""},{"old":"/api/merchant/products/:userId/:productId","type":0,"val":"products","end":""},{"old":"/api/merchant/products/:userId/:productId","type":1,"val":"userId","end":""},{"old":"/api/merchant/products/:userId/:productId","type":1,"val":"productId","end":""}],
    types: placeholder as Registry['merchant_dashboard.update_product']['types'],
  },
  'merchant_dashboard.delete_product': {
    methods: ["DELETE"],
    pattern: '/api/merchant/products/:userId/:productId',
    tokens: [{"old":"/api/merchant/products/:userId/:productId","type":0,"val":"api","end":""},{"old":"/api/merchant/products/:userId/:productId","type":0,"val":"merchant","end":""},{"old":"/api/merchant/products/:userId/:productId","type":0,"val":"products","end":""},{"old":"/api/merchant/products/:userId/:productId","type":1,"val":"userId","end":""},{"old":"/api/merchant/products/:userId/:productId","type":1,"val":"productId","end":""}],
    types: placeholder as Registry['merchant_dashboard.delete_product']['types'],
  },
  'merchant_dashboard.get_categories': {
    methods: ["GET","HEAD"],
    pattern: '/api/merchant/categories/:userId',
    tokens: [{"old":"/api/merchant/categories/:userId","type":0,"val":"api","end":""},{"old":"/api/merchant/categories/:userId","type":0,"val":"merchant","end":""},{"old":"/api/merchant/categories/:userId","type":0,"val":"categories","end":""},{"old":"/api/merchant/categories/:userId","type":1,"val":"userId","end":""}],
    types: placeholder as Registry['merchant_dashboard.get_categories']['types'],
  },
  'merchant_dashboard.create_category': {
    methods: ["POST"],
    pattern: '/api/merchant/categories/:userId',
    tokens: [{"old":"/api/merchant/categories/:userId","type":0,"val":"api","end":""},{"old":"/api/merchant/categories/:userId","type":0,"val":"merchant","end":""},{"old":"/api/merchant/categories/:userId","type":0,"val":"categories","end":""},{"old":"/api/merchant/categories/:userId","type":1,"val":"userId","end":""}],
    types: placeholder as Registry['merchant_dashboard.create_category']['types'],
  },
  'merchant_dashboard.update_category': {
    methods: ["PUT"],
    pattern: '/api/merchant/categories/:userId/:categoryId',
    tokens: [{"old":"/api/merchant/categories/:userId/:categoryId","type":0,"val":"api","end":""},{"old":"/api/merchant/categories/:userId/:categoryId","type":0,"val":"merchant","end":""},{"old":"/api/merchant/categories/:userId/:categoryId","type":0,"val":"categories","end":""},{"old":"/api/merchant/categories/:userId/:categoryId","type":1,"val":"userId","end":""},{"old":"/api/merchant/categories/:userId/:categoryId","type":1,"val":"categoryId","end":""}],
    types: placeholder as Registry['merchant_dashboard.update_category']['types'],
  },
  'merchant_dashboard.delete_category': {
    methods: ["DELETE"],
    pattern: '/api/merchant/categories/:userId/:categoryId',
    tokens: [{"old":"/api/merchant/categories/:userId/:categoryId","type":0,"val":"api","end":""},{"old":"/api/merchant/categories/:userId/:categoryId","type":0,"val":"merchant","end":""},{"old":"/api/merchant/categories/:userId/:categoryId","type":0,"val":"categories","end":""},{"old":"/api/merchant/categories/:userId/:categoryId","type":1,"val":"userId","end":""},{"old":"/api/merchant/categories/:userId/:categoryId","type":1,"val":"categoryId","end":""}],
    types: placeholder as Registry['merchant_dashboard.delete_category']['types'],
  },
  'merchant_dashboard.get_coupons': {
    methods: ["GET","HEAD"],
    pattern: '/api/merchant/coupons/:userId',
    tokens: [{"old":"/api/merchant/coupons/:userId","type":0,"val":"api","end":""},{"old":"/api/merchant/coupons/:userId","type":0,"val":"merchant","end":""},{"old":"/api/merchant/coupons/:userId","type":0,"val":"coupons","end":""},{"old":"/api/merchant/coupons/:userId","type":1,"val":"userId","end":""}],
    types: placeholder as Registry['merchant_dashboard.get_coupons']['types'],
  },
  'merchant_dashboard.create_coupon': {
    methods: ["POST"],
    pattern: '/api/merchant/coupons/:userId',
    tokens: [{"old":"/api/merchant/coupons/:userId","type":0,"val":"api","end":""},{"old":"/api/merchant/coupons/:userId","type":0,"val":"merchant","end":""},{"old":"/api/merchant/coupons/:userId","type":0,"val":"coupons","end":""},{"old":"/api/merchant/coupons/:userId","type":1,"val":"userId","end":""}],
    types: placeholder as Registry['merchant_dashboard.create_coupon']['types'],
  },
  'merchant_dashboard.update_coupon': {
    methods: ["PUT"],
    pattern: '/api/merchant/coupons/:userId/:couponId',
    tokens: [{"old":"/api/merchant/coupons/:userId/:couponId","type":0,"val":"api","end":""},{"old":"/api/merchant/coupons/:userId/:couponId","type":0,"val":"merchant","end":""},{"old":"/api/merchant/coupons/:userId/:couponId","type":0,"val":"coupons","end":""},{"old":"/api/merchant/coupons/:userId/:couponId","type":1,"val":"userId","end":""},{"old":"/api/merchant/coupons/:userId/:couponId","type":1,"val":"couponId","end":""}],
    types: placeholder as Registry['merchant_dashboard.update_coupon']['types'],
  },
  'merchant_dashboard.delete_coupon': {
    methods: ["DELETE"],
    pattern: '/api/merchant/coupons/:userId/:couponId',
    tokens: [{"old":"/api/merchant/coupons/:userId/:couponId","type":0,"val":"api","end":""},{"old":"/api/merchant/coupons/:userId/:couponId","type":0,"val":"merchant","end":""},{"old":"/api/merchant/coupons/:userId/:couponId","type":0,"val":"coupons","end":""},{"old":"/api/merchant/coupons/:userId/:couponId","type":1,"val":"userId","end":""},{"old":"/api/merchant/coupons/:userId/:couponId","type":1,"val":"couponId","end":""}],
    types: placeholder as Registry['merchant_dashboard.delete_coupon']['types'],
  },
  'coupons.index': {
    methods: ["GET","HEAD"],
    pattern: '/api/coupons',
    tokens: [{"old":"/api/coupons","type":0,"val":"api","end":""},{"old":"/api/coupons","type":0,"val":"coupons","end":""}],
    types: placeholder as Registry['coupons.index']['types'],
  },
  'coupons.apply': {
    methods: ["POST"],
    pattern: '/api/coupons/apply',
    tokens: [{"old":"/api/coupons/apply","type":0,"val":"api","end":""},{"old":"/api/coupons/apply","type":0,"val":"coupons","end":""},{"old":"/api/coupons/apply","type":0,"val":"apply","end":""}],
    types: placeholder as Registry['coupons.apply']['types'],
  },
  'coupons.verify': {
    methods: ["POST"],
    pattern: '/api/coupons/verify',
    tokens: [{"old":"/api/coupons/verify","type":0,"val":"api","end":""},{"old":"/api/coupons/verify","type":0,"val":"coupons","end":""},{"old":"/api/coupons/verify","type":0,"val":"verify","end":""}],
    types: placeholder as Registry['coupons.verify']['types'],
  },
  'coupons.show': {
    methods: ["GET","HEAD"],
    pattern: '/api/coupons/:id',
    tokens: [{"old":"/api/coupons/:id","type":0,"val":"api","end":""},{"old":"/api/coupons/:id","type":0,"val":"coupons","end":""},{"old":"/api/coupons/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['coupons.show']['types'],
  },
  'new_account.store': {
    methods: ["POST"],
    pattern: '/api/client/register',
    tokens: [{"old":"/api/client/register","type":0,"val":"api","end":""},{"old":"/api/client/register","type":0,"val":"client","end":""},{"old":"/api/client/register","type":0,"val":"register","end":""}],
    types: placeholder as Registry['new_account.store']['types'],
  },
  'session.store': {
    methods: ["POST"],
    pattern: '/api/client/login',
    tokens: [{"old":"/api/client/login","type":0,"val":"api","end":""},{"old":"/api/client/login","type":0,"val":"client","end":""},{"old":"/api/client/login","type":0,"val":"login","end":""}],
    types: placeholder as Registry['session.store']['types'],
  },
  'session.update': {
    methods: ["PUT"],
    pattern: '/api/profile/update',
    tokens: [{"old":"/api/profile/update","type":0,"val":"api","end":""},{"old":"/api/profile/update","type":0,"val":"profile","end":""},{"old":"/api/profile/update","type":0,"val":"update","end":""}],
    types: placeholder as Registry['session.update']['types'],
  },
  'session.destroy': {
    methods: ["POST"],
    pattern: '/api/client/logout',
    tokens: [{"old":"/api/client/logout","type":0,"val":"api","end":""},{"old":"/api/client/logout","type":0,"val":"client","end":""},{"old":"/api/client/logout","type":0,"val":"logout","end":""}],
    types: placeholder as Registry['session.destroy']['types'],
  },
  'users.index': {
    methods: ["GET","HEAD"],
    pattern: '/api/users',
    tokens: [{"old":"/api/users","type":0,"val":"api","end":""},{"old":"/api/users","type":0,"val":"users","end":""}],
    types: placeholder as Registry['users.index']['types'],
  },
  'users.show': {
    methods: ["GET","HEAD"],
    pattern: '/api/users/:id',
    tokens: [{"old":"/api/users/:id","type":0,"val":"api","end":""},{"old":"/api/users/:id","type":0,"val":"users","end":""},{"old":"/api/users/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['users.show']['types'],
  },
  'products.index': {
    methods: ["GET","HEAD"],
    pattern: '/api/products',
    tokens: [{"old":"/api/products","type":0,"val":"api","end":""},{"old":"/api/products","type":0,"val":"products","end":""}],
    types: placeholder as Registry['products.index']['types'],
  },
  'products.show': {
    methods: ["GET","HEAD"],
    pattern: '/api/products/:id',
    tokens: [{"old":"/api/products/:id","type":0,"val":"api","end":""},{"old":"/api/products/:id","type":0,"val":"products","end":""},{"old":"/api/products/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['products.show']['types'],
  },
  'products.store': {
    methods: ["POST"],
    pattern: '/api/products',
    tokens: [{"old":"/api/products","type":0,"val":"api","end":""},{"old":"/api/products","type":0,"val":"products","end":""}],
    types: placeholder as Registry['products.store']['types'],
  },
  'products.update': {
    methods: ["PUT"],
    pattern: '/api/products/:id',
    tokens: [{"old":"/api/products/:id","type":0,"val":"api","end":""},{"old":"/api/products/:id","type":0,"val":"products","end":""},{"old":"/api/products/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['products.update']['types'],
  },
  'products.destroy': {
    methods: ["DELETE"],
    pattern: '/api/products/:id',
    tokens: [{"old":"/api/products/:id","type":0,"val":"api","end":""},{"old":"/api/products/:id","type":0,"val":"products","end":""},{"old":"/api/products/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['products.destroy']['types'],
  },
  'categories.index': {
    methods: ["GET","HEAD"],
    pattern: '/api/categories',
    tokens: [{"old":"/api/categories","type":0,"val":"api","end":""},{"old":"/api/categories","type":0,"val":"categories","end":""}],
    types: placeholder as Registry['categories.index']['types'],
  },
  'categories.show': {
    methods: ["GET","HEAD"],
    pattern: '/api/categories/:slug',
    tokens: [{"old":"/api/categories/:slug","type":0,"val":"api","end":""},{"old":"/api/categories/:slug","type":0,"val":"categories","end":""},{"old":"/api/categories/:slug","type":1,"val":"slug","end":""}],
    types: placeholder as Registry['categories.show']['types'],
  },
  'categories.store': {
    methods: ["POST"],
    pattern: '/api/categories',
    tokens: [{"old":"/api/categories","type":0,"val":"api","end":""},{"old":"/api/categories","type":0,"val":"categories","end":""}],
    types: placeholder as Registry['categories.store']['types'],
  },
  'categories.update': {
    methods: ["PUT"],
    pattern: '/api/categories/:id',
    tokens: [{"old":"/api/categories/:id","type":0,"val":"api","end":""},{"old":"/api/categories/:id","type":0,"val":"categories","end":""},{"old":"/api/categories/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['categories.update']['types'],
  },
  'categories.destroy': {
    methods: ["DELETE"],
    pattern: '/api/categories/:id',
    tokens: [{"old":"/api/categories/:id","type":0,"val":"api","end":""},{"old":"/api/categories/:id","type":0,"val":"categories","end":""},{"old":"/api/categories/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['categories.destroy']['types'],
  },
  'categories.create_product': {
    methods: ["POST"],
    pattern: '/api/categories/:id/products',
    tokens: [{"old":"/api/categories/:id/products","type":0,"val":"api","end":""},{"old":"/api/categories/:id/products","type":0,"val":"categories","end":""},{"old":"/api/categories/:id/products","type":1,"val":"id","end":""},{"old":"/api/categories/:id/products","type":0,"val":"products","end":""}],
    types: placeholder as Registry['categories.create_product']['types'],
  },
  'cart.get_cart': {
    methods: ["GET","HEAD"],
    pattern: '/api/cart/:userId',
    tokens: [{"old":"/api/cart/:userId","type":0,"val":"api","end":""},{"old":"/api/cart/:userId","type":0,"val":"cart","end":""},{"old":"/api/cart/:userId","type":1,"val":"userId","end":""}],
    types: placeholder as Registry['cart.get_cart']['types'],
  },
  'cart.show': {
    methods: ["POST"],
    pattern: '/api/cart/show',
    tokens: [{"old":"/api/cart/show","type":0,"val":"api","end":""},{"old":"/api/cart/show","type":0,"val":"cart","end":""},{"old":"/api/cart/show","type":0,"val":"show","end":""}],
    types: placeholder as Registry['cart.show']['types'],
  },
  'cart.add': {
    methods: ["POST"],
    pattern: '/api/cart/add',
    tokens: [{"old":"/api/cart/add","type":0,"val":"api","end":""},{"old":"/api/cart/add","type":0,"val":"cart","end":""},{"old":"/api/cart/add","type":0,"val":"add","end":""}],
    types: placeholder as Registry['cart.add']['types'],
  },
  'cart.update': {
    methods: ["PUT"],
    pattern: '/api/cart/update',
    tokens: [{"old":"/api/cart/update","type":0,"val":"api","end":""},{"old":"/api/cart/update","type":0,"val":"cart","end":""},{"old":"/api/cart/update","type":0,"val":"update","end":""}],
    types: placeholder as Registry['cart.update']['types'],
  },
  'cart.delete_item': {
    methods: ["DELETE"],
    pattern: '/api/cart/item/:itemId',
    tokens: [{"old":"/api/cart/item/:itemId","type":0,"val":"api","end":""},{"old":"/api/cart/item/:itemId","type":0,"val":"cart","end":""},{"old":"/api/cart/item/:itemId","type":0,"val":"item","end":""},{"old":"/api/cart/item/:itemId","type":1,"val":"itemId","end":""}],
    types: placeholder as Registry['cart.delete_item']['types'],
  },
  'cart.clear': {
    methods: ["DELETE"],
    pattern: '/api/cart/clear',
    tokens: [{"old":"/api/cart/clear","type":0,"val":"api","end":""},{"old":"/api/cart/clear","type":0,"val":"cart","end":""},{"old":"/api/cart/clear","type":0,"val":"clear","end":""}],
    types: placeholder as Registry['cart.clear']['types'],
  },
  'favorites.add': {
    methods: ["POST"],
    pattern: '/api/favorites/add',
    tokens: [{"old":"/api/favorites/add","type":0,"val":"api","end":""},{"old":"/api/favorites/add","type":0,"val":"favorites","end":""},{"old":"/api/favorites/add","type":0,"val":"add","end":""}],
    types: placeholder as Registry['favorites.add']['types'],
  },
  'favorites.remove': {
    methods: ["POST"],
    pattern: '/api/favorites/remove',
    tokens: [{"old":"/api/favorites/remove","type":0,"val":"api","end":""},{"old":"/api/favorites/remove","type":0,"val":"favorites","end":""},{"old":"/api/favorites/remove","type":0,"val":"remove","end":""}],
    types: placeholder as Registry['favorites.remove']['types'],
  },
  'favorites.index': {
    methods: ["GET","HEAD"],
    pattern: '/api/favorites',
    tokens: [{"old":"/api/favorites","type":0,"val":"api","end":""},{"old":"/api/favorites","type":0,"val":"favorites","end":""}],
    types: placeholder as Registry['favorites.index']['types'],
  },
  'favorites.check': {
    methods: ["GET","HEAD"],
    pattern: '/api/favorites/check',
    tokens: [{"old":"/api/favorites/check","type":0,"val":"api","end":""},{"old":"/api/favorites/check","type":0,"val":"favorites","end":""},{"old":"/api/favorites/check","type":0,"val":"check","end":""}],
    types: placeholder as Registry['favorites.check']['types'],
  },
  'orders.store': {
    methods: ["POST"],
    pattern: '/api/orders',
    tokens: [{"old":"/api/orders","type":0,"val":"api","end":""},{"old":"/api/orders","type":0,"val":"orders","end":""}],
    types: placeholder as Registry['orders.store']['types'],
  },
  'orders.index': {
    methods: ["GET","HEAD"],
    pattern: '/api/orders/:userId',
    tokens: [{"old":"/api/orders/:userId","type":0,"val":"api","end":""},{"old":"/api/orders/:userId","type":0,"val":"orders","end":""},{"old":"/api/orders/:userId","type":1,"val":"userId","end":""}],
    types: placeholder as Registry['orders.index']['types'],
  },
  'orders.show': {
    methods: ["GET","HEAD"],
    pattern: '/api/orders/:orderId/user/:userId',
    tokens: [{"old":"/api/orders/:orderId/user/:userId","type":0,"val":"api","end":""},{"old":"/api/orders/:orderId/user/:userId","type":0,"val":"orders","end":""},{"old":"/api/orders/:orderId/user/:userId","type":1,"val":"orderId","end":""},{"old":"/api/orders/:orderId/user/:userId","type":0,"val":"user","end":""},{"old":"/api/orders/:orderId/user/:userId","type":1,"val":"userId","end":""}],
    types: placeholder as Registry['orders.show']['types'],
  },
  'orders.cancel': {
    methods: ["POST"],
    pattern: '/api/orders/:orderId/cancel',
    tokens: [{"old":"/api/orders/:orderId/cancel","type":0,"val":"api","end":""},{"old":"/api/orders/:orderId/cancel","type":0,"val":"orders","end":""},{"old":"/api/orders/:orderId/cancel","type":1,"val":"orderId","end":""},{"old":"/api/orders/:orderId/cancel","type":0,"val":"cancel","end":""}],
    types: placeholder as Registry['orders.cancel']['types'],
  },
  'orders.invoice': {
    methods: ["GET","HEAD"],
    pattern: '/api/orders/:orderId/invoice/:userId',
    tokens: [{"old":"/api/orders/:orderId/invoice/:userId","type":0,"val":"api","end":""},{"old":"/api/orders/:orderId/invoice/:userId","type":0,"val":"orders","end":""},{"old":"/api/orders/:orderId/invoice/:userId","type":1,"val":"orderId","end":""},{"old":"/api/orders/:orderId/invoice/:userId","type":0,"val":"invoice","end":""},{"old":"/api/orders/:orderId/invoice/:userId","type":1,"val":"userId","end":""}],
    types: placeholder as Registry['orders.invoice']['types'],
  },
  'orders.update_status': {
    methods: ["PUT"],
    pattern: '/api/orders/:orderId/status',
    tokens: [{"old":"/api/orders/:orderId/status","type":0,"val":"api","end":""},{"old":"/api/orders/:orderId/status","type":0,"val":"orders","end":""},{"old":"/api/orders/:orderId/status","type":1,"val":"orderId","end":""},{"old":"/api/orders/:orderId/status","type":0,"val":"status","end":""}],
    types: placeholder as Registry['orders.update_status']['types'],
  },
  'order_tracking.search': {
    methods: ["POST"],
    pattern: '/api/tracking/search',
    tokens: [{"old":"/api/tracking/search","type":0,"val":"api","end":""},{"old":"/api/tracking/search","type":0,"val":"tracking","end":""},{"old":"/api/tracking/search","type":0,"val":"search","end":""}],
    types: placeholder as Registry['order_tracking.search']['types'],
  },
  'order_tracking.get_tracking_events': {
    methods: ["GET","HEAD"],
    pattern: '/api/tracking/:orderId/events',
    tokens: [{"old":"/api/tracking/:orderId/events","type":0,"val":"api","end":""},{"old":"/api/tracking/:orderId/events","type":0,"val":"tracking","end":""},{"old":"/api/tracking/:orderId/events","type":1,"val":"orderId","end":""},{"old":"/api/tracking/:orderId/events","type":0,"val":"events","end":""}],
    types: placeholder as Registry['order_tracking.get_tracking_events']['types'],
  },
  'order_tracking.add_tracking_event': {
    methods: ["POST"],
    pattern: '/api/tracking/:orderId/event',
    tokens: [{"old":"/api/tracking/:orderId/event","type":0,"val":"api","end":""},{"old":"/api/tracking/:orderId/event","type":0,"val":"tracking","end":""},{"old":"/api/tracking/:orderId/event","type":1,"val":"orderId","end":""},{"old":"/api/tracking/:orderId/event","type":0,"val":"event","end":""}],
    types: placeholder as Registry['order_tracking.add_tracking_event']['types'],
  },
  'order_tracking.update_order_status': {
    methods: ["PUT"],
    pattern: '/api/tracking/:orderId/status',
    tokens: [{"old":"/api/tracking/:orderId/status","type":0,"val":"api","end":""},{"old":"/api/tracking/:orderId/status","type":0,"val":"tracking","end":""},{"old":"/api/tracking/:orderId/status","type":1,"val":"orderId","end":""},{"old":"/api/tracking/:orderId/status","type":0,"val":"status","end":""}],
    types: placeholder as Registry['order_tracking.update_order_status']['types'],
  },
} as const satisfies Record<string, AdonisEndpoint>

export { routes }

export const registry = {
  routes,
  $tree: {} as ApiDefinition,
}

declare module '@tuyau/core/types' {
  export interface UserRegistry {
    routes: typeof routes
    $tree: ApiDefinition
  }
}
