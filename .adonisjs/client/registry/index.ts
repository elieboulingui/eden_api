/* eslint-disable prettier/prettier */
import type { AdonisEndpoint } from '@tuyau/core/types'
import type { Registry } from './schema.d.ts'
import type { ApiDefinition } from './tree.d.ts'

const placeholder: any = {}

const routes = {
  'api.client.register': {
    methods: ["POST"],
    pattern: '/api/client/register',
    tokens: [{"old":"/api/client/register","type":0,"val":"api","end":""},{"old":"/api/client/register","type":0,"val":"client","end":""},{"old":"/api/client/register","type":0,"val":"register","end":""}],
    types: placeholder as Registry['api.client.register']['types'],
  },
  'api.client.login': {
    methods: ["POST"],
    pattern: '/api/client/login',
    tokens: [{"old":"/api/client/login","type":0,"val":"api","end":""},{"old":"/api/client/login","type":0,"val":"client","end":""},{"old":"/api/client/login","type":0,"val":"login","end":""}],
    types: placeholder as Registry['api.client.login']['types'],
  },
  'merchant_dashboard.index': {
    methods: ["GET","HEAD"],
    pattern: '/api/merchant/orders/:id',
    tokens: [{"old":"/api/merchant/orders/:id","type":0,"val":"api","end":""},{"old":"/api/merchant/orders/:id","type":0,"val":"merchant","end":""},{"old":"/api/merchant/orders/:id","type":0,"val":"orders","end":""},{"old":"/api/merchant/orders/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['merchant_dashboard.index']['types'],
  },
  'api.tracking.search': {
    methods: ["POST"],
    pattern: '/api/tracking/search',
    tokens: [{"old":"/api/tracking/search","type":0,"val":"api","end":""},{"old":"/api/tracking/search","type":0,"val":"tracking","end":""},{"old":"/api/tracking/search","type":0,"val":"search","end":""}],
    types: placeholder as Registry['api.tracking.search']['types'],
  },
  'api.tracking.events': {
    methods: ["GET","HEAD"],
    pattern: '/api/tracking/:orderId/events',
    tokens: [{"old":"/api/tracking/:orderId/events","type":0,"val":"api","end":""},{"old":"/api/tracking/:orderId/events","type":0,"val":"tracking","end":""},{"old":"/api/tracking/:orderId/events","type":1,"val":"orderId","end":""},{"old":"/api/tracking/:orderId/events","type":0,"val":"events","end":""}],
    types: placeholder as Registry['api.tracking.events']['types'],
  },
  'api.client.profile.update': {
    methods: ["PUT"],
    pattern: '/api/profile/update',
    tokens: [{"old":"/api/profile/update","type":0,"val":"api","end":""},{"old":"/api/profile/update","type":0,"val":"profile","end":""},{"old":"/api/profile/update","type":0,"val":"update","end":""}],
    types: placeholder as Registry['api.client.profile.update']['types'],
  },
  'api.client.logout': {
    methods: ["POST"],
    pattern: '/api/client/logout',
    tokens: [{"old":"/api/client/logout","type":0,"val":"api","end":""},{"old":"/api/client/logout","type":0,"val":"client","end":""},{"old":"/api/client/logout","type":0,"val":"logout","end":""}],
    types: placeholder as Registry['api.client.logout']['types'],
  },
  'api.users.index': {
    methods: ["GET","HEAD"],
    pattern: '/api/users',
    tokens: [{"old":"/api/users","type":0,"val":"api","end":""},{"old":"/api/users","type":0,"val":"users","end":""}],
    types: placeholder as Registry['api.users.index']['types'],
  },
  'api.users.show': {
    methods: ["GET","HEAD"],
    pattern: '/api/users/:id',
    tokens: [{"old":"/api/users/:id","type":0,"val":"api","end":""},{"old":"/api/users/:id","type":0,"val":"users","end":""},{"old":"/api/users/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['api.users.show']['types'],
  },
  'api.products.index': {
    methods: ["GET","HEAD"],
    pattern: '/api/products',
    tokens: [{"old":"/api/products","type":0,"val":"api","end":""},{"old":"/api/products","type":0,"val":"products","end":""}],
    types: placeholder as Registry['api.products.index']['types'],
  },
  'api.products.show': {
    methods: ["GET","HEAD"],
    pattern: '/api/products/:id',
    tokens: [{"old":"/api/products/:id","type":0,"val":"api","end":""},{"old":"/api/products/:id","type":0,"val":"products","end":""},{"old":"/api/products/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['api.products.show']['types'],
  },
  'api.products.store': {
    methods: ["POST"],
    pattern: '/api/products',
    tokens: [{"old":"/api/products","type":0,"val":"api","end":""},{"old":"/api/products","type":0,"val":"products","end":""}],
    types: placeholder as Registry['api.products.store']['types'],
  },
  'api.products.update': {
    methods: ["PUT"],
    pattern: '/api/products/:id',
    tokens: [{"old":"/api/products/:id","type":0,"val":"api","end":""},{"old":"/api/products/:id","type":0,"val":"products","end":""},{"old":"/api/products/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['api.products.update']['types'],
  },
  'api.products.destroy': {
    methods: ["DELETE"],
    pattern: '/api/products/:id',
    tokens: [{"old":"/api/products/:id","type":0,"val":"api","end":""},{"old":"/api/products/:id","type":0,"val":"products","end":""},{"old":"/api/products/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['api.products.destroy']['types'],
  },
  'api.categories.index': {
    methods: ["GET","HEAD"],
    pattern: '/api/categories',
    tokens: [{"old":"/api/categories","type":0,"val":"api","end":""},{"old":"/api/categories","type":0,"val":"categories","end":""}],
    types: placeholder as Registry['api.categories.index']['types'],
  },
  'api.categories.show': {
    methods: ["GET","HEAD"],
    pattern: '/api/categories/:slug',
    tokens: [{"old":"/api/categories/:slug","type":0,"val":"api","end":""},{"old":"/api/categories/:slug","type":0,"val":"categories","end":""},{"old":"/api/categories/:slug","type":1,"val":"slug","end":""}],
    types: placeholder as Registry['api.categories.show']['types'],
  },
  'api.categories.store': {
    methods: ["POST"],
    pattern: '/api/categories',
    tokens: [{"old":"/api/categories","type":0,"val":"api","end":""},{"old":"/api/categories","type":0,"val":"categories","end":""}],
    types: placeholder as Registry['api.categories.store']['types'],
  },
  'api.categories.update': {
    methods: ["PUT"],
    pattern: '/api/categories/:id',
    tokens: [{"old":"/api/categories/:id","type":0,"val":"api","end":""},{"old":"/api/categories/:id","type":0,"val":"categories","end":""},{"old":"/api/categories/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['api.categories.update']['types'],
  },
  'api.categories.destroy': {
    methods: ["DELETE"],
    pattern: '/api/categories/:id',
    tokens: [{"old":"/api/categories/:id","type":0,"val":"api","end":""},{"old":"/api/categories/:id","type":0,"val":"categories","end":""},{"old":"/api/categories/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['api.categories.destroy']['types'],
  },
  'api.categories.products.store': {
    methods: ["POST"],
    pattern: '/api/categories/:id/products',
    tokens: [{"old":"/api/categories/:id/products","type":0,"val":"api","end":""},{"old":"/api/categories/:id/products","type":0,"val":"categories","end":""},{"old":"/api/categories/:id/products","type":1,"val":"id","end":""},{"old":"/api/categories/:id/products","type":0,"val":"products","end":""}],
    types: placeholder as Registry['api.categories.products.store']['types'],
  },
  'api.cart.get': {
    methods: ["GET","HEAD"],
    pattern: '/api/cart/:userId',
    tokens: [{"old":"/api/cart/:userId","type":0,"val":"api","end":""},{"old":"/api/cart/:userId","type":0,"val":"cart","end":""},{"old":"/api/cart/:userId","type":1,"val":"userId","end":""}],
    types: placeholder as Registry['api.cart.get']['types'],
  },
  'api.cart.show': {
    methods: ["POST"],
    pattern: '/api/cart/show',
    tokens: [{"old":"/api/cart/show","type":0,"val":"api","end":""},{"old":"/api/cart/show","type":0,"val":"cart","end":""},{"old":"/api/cart/show","type":0,"val":"show","end":""}],
    types: placeholder as Registry['api.cart.show']['types'],
  },
  'api.cart.add': {
    methods: ["POST"],
    pattern: '/api/cart/add',
    tokens: [{"old":"/api/cart/add","type":0,"val":"api","end":""},{"old":"/api/cart/add","type":0,"val":"cart","end":""},{"old":"/api/cart/add","type":0,"val":"add","end":""}],
    types: placeholder as Registry['api.cart.add']['types'],
  },
  'api.cart.update': {
    methods: ["PUT"],
    pattern: '/api/cart/update',
    tokens: [{"old":"/api/cart/update","type":0,"val":"api","end":""},{"old":"/api/cart/update","type":0,"val":"cart","end":""},{"old":"/api/cart/update","type":0,"val":"update","end":""}],
    types: placeholder as Registry['api.cart.update']['types'],
  },
  'api.cart.delete': {
    methods: ["DELETE"],
    pattern: '/api/cart/item/:itemId',
    tokens: [{"old":"/api/cart/item/:itemId","type":0,"val":"api","end":""},{"old":"/api/cart/item/:itemId","type":0,"val":"cart","end":""},{"old":"/api/cart/item/:itemId","type":0,"val":"item","end":""},{"old":"/api/cart/item/:itemId","type":1,"val":"itemId","end":""}],
    types: placeholder as Registry['api.cart.delete']['types'],
  },
  'api.favorites.add': {
    methods: ["POST"],
    pattern: '/api/favorites/add',
    tokens: [{"old":"/api/favorites/add","type":0,"val":"api","end":""},{"old":"/api/favorites/add","type":0,"val":"favorites","end":""},{"old":"/api/favorites/add","type":0,"val":"add","end":""}],
    types: placeholder as Registry['api.favorites.add']['types'],
  },
  'api.favorites.remove': {
    methods: ["POST"],
    pattern: '/api/favorites/remove',
    tokens: [{"old":"/api/favorites/remove","type":0,"val":"api","end":""},{"old":"/api/favorites/remove","type":0,"val":"favorites","end":""},{"old":"/api/favorites/remove","type":0,"val":"remove","end":""}],
    types: placeholder as Registry['api.favorites.remove']['types'],
  },
  'api.favorites.index': {
    methods: ["GET","HEAD"],
    pattern: '/api/favorites',
    tokens: [{"old":"/api/favorites","type":0,"val":"api","end":""},{"old":"/api/favorites","type":0,"val":"favorites","end":""}],
    types: placeholder as Registry['api.favorites.index']['types'],
  },
  'api.favorites.check': {
    methods: ["GET","HEAD"],
    pattern: '/api/favorites/check',
    tokens: [{"old":"/api/favorites/check","type":0,"val":"api","end":""},{"old":"/api/favorites/check","type":0,"val":"favorites","end":""},{"old":"/api/favorites/check","type":0,"val":"check","end":""}],
    types: placeholder as Registry['api.favorites.check']['types'],
  },
  'api.orders.store': {
    methods: ["POST"],
    pattern: '/api/orders',
    tokens: [{"old":"/api/orders","type":0,"val":"api","end":""},{"old":"/api/orders","type":0,"val":"orders","end":""}],
    types: placeholder as Registry['api.orders.store']['types'],
  },
  'api.orders.index': {
    methods: ["GET","HEAD"],
    pattern: '/api/orders/:userId',
    tokens: [{"old":"/api/orders/:userId","type":0,"val":"api","end":""},{"old":"/api/orders/:userId","type":0,"val":"orders","end":""},{"old":"/api/orders/:userId","type":1,"val":"userId","end":""}],
    types: placeholder as Registry['api.orders.index']['types'],
  },
  'api.orders.show': {
    methods: ["GET","HEAD"],
    pattern: '/api/orders/:orderId/user/:userId',
    tokens: [{"old":"/api/orders/:orderId/user/:userId","type":0,"val":"api","end":""},{"old":"/api/orders/:orderId/user/:userId","type":0,"val":"orders","end":""},{"old":"/api/orders/:orderId/user/:userId","type":1,"val":"orderId","end":""},{"old":"/api/orders/:orderId/user/:userId","type":0,"val":"user","end":""},{"old":"/api/orders/:orderId/user/:userId","type":1,"val":"userId","end":""}],
    types: placeholder as Registry['api.orders.show']['types'],
  },
  'api.orders.cancel': {
    methods: ["POST"],
    pattern: '/api/orders/:orderId/cancel',
    tokens: [{"old":"/api/orders/:orderId/cancel","type":0,"val":"api","end":""},{"old":"/api/orders/:orderId/cancel","type":0,"val":"orders","end":""},{"old":"/api/orders/:orderId/cancel","type":1,"val":"orderId","end":""},{"old":"/api/orders/:orderId/cancel","type":0,"val":"cancel","end":""}],
    types: placeholder as Registry['api.orders.cancel']['types'],
  },
  'api.orders.invoice': {
    methods: ["GET","HEAD"],
    pattern: '/api/orders/:orderId/invoice/:userId',
    tokens: [{"old":"/api/orders/:orderId/invoice/:userId","type":0,"val":"api","end":""},{"old":"/api/orders/:orderId/invoice/:userId","type":0,"val":"orders","end":""},{"old":"/api/orders/:orderId/invoice/:userId","type":1,"val":"orderId","end":""},{"old":"/api/orders/:orderId/invoice/:userId","type":0,"val":"invoice","end":""},{"old":"/api/orders/:orderId/invoice/:userId","type":1,"val":"userId","end":""}],
    types: placeholder as Registry['api.orders.invoice']['types'],
  },
  'api.orders.update-status': {
    methods: ["PUT"],
    pattern: '/api/orders/:orderId/status',
    tokens: [{"old":"/api/orders/:orderId/status","type":0,"val":"api","end":""},{"old":"/api/orders/:orderId/status","type":0,"val":"orders","end":""},{"old":"/api/orders/:orderId/status","type":1,"val":"orderId","end":""},{"old":"/api/orders/:orderId/status","type":0,"val":"status","end":""}],
    types: placeholder as Registry['api.orders.update-status']['types'],
  },
  'api.merchant.dashboard': {
    methods: ["GET","HEAD"],
    pattern: '/api/merchant/dashboard/:userId',
    tokens: [{"old":"/api/merchant/dashboard/:userId","type":0,"val":"api","end":""},{"old":"/api/merchant/dashboard/:userId","type":0,"val":"merchant","end":""},{"old":"/api/merchant/dashboard/:userId","type":0,"val":"dashboard","end":""},{"old":"/api/merchant/dashboard/:userId","type":1,"val":"userId","end":""}],
    types: placeholder as Registry['api.merchant.dashboard']['types'],
  },
  'api.merchant.stats': {
    methods: ["GET","HEAD"],
    pattern: '/api/merchant/stats/:userId',
    tokens: [{"old":"/api/merchant/stats/:userId","type":0,"val":"api","end":""},{"old":"/api/merchant/stats/:userId","type":0,"val":"merchant","end":""},{"old":"/api/merchant/stats/:userId","type":0,"val":"stats","end":""},{"old":"/api/merchant/stats/:userId","type":1,"val":"userId","end":""}],
    types: placeholder as Registry['api.merchant.stats']['types'],
  },
  'api.merchant.orders': {
    methods: ["GET","HEAD"],
    pattern: '/api/merchant/orders/:userId',
    tokens: [{"old":"/api/merchant/orders/:userId","type":0,"val":"api","end":""},{"old":"/api/merchant/orders/:userId","type":0,"val":"merchant","end":""},{"old":"/api/merchant/orders/:userId","type":0,"val":"orders","end":""},{"old":"/api/merchant/orders/:userId","type":1,"val":"userId","end":""}],
    types: placeholder as Registry['api.merchant.orders']['types'],
  },
  'api.merchant.products': {
    methods: ["GET","HEAD"],
    pattern: '/api/merchant/products/:userId',
    tokens: [{"old":"/api/merchant/products/:userId","type":0,"val":"api","end":""},{"old":"/api/merchant/products/:userId","type":0,"val":"merchant","end":""},{"old":"/api/merchant/products/:userId","type":0,"val":"products","end":""},{"old":"/api/merchant/products/:userId","type":1,"val":"userId","end":""}],
    types: placeholder as Registry['api.merchant.products']['types'],
  },
  'api.merchant.products.create': {
    methods: ["POST"],
    pattern: '/api/merchant/products/:userId',
    tokens: [{"old":"/api/merchant/products/:userId","type":0,"val":"api","end":""},{"old":"/api/merchant/products/:userId","type":0,"val":"merchant","end":""},{"old":"/api/merchant/products/:userId","type":0,"val":"products","end":""},{"old":"/api/merchant/products/:userId","type":1,"val":"userId","end":""}],
    types: placeholder as Registry['api.merchant.products.create']['types'],
  },
  'api.merchant.products.update': {
    methods: ["PUT"],
    pattern: '/api/merchant/products/:userId/:productId',
    tokens: [{"old":"/api/merchant/products/:userId/:productId","type":0,"val":"api","end":""},{"old":"/api/merchant/products/:userId/:productId","type":0,"val":"merchant","end":""},{"old":"/api/merchant/products/:userId/:productId","type":0,"val":"products","end":""},{"old":"/api/merchant/products/:userId/:productId","type":1,"val":"userId","end":""},{"old":"/api/merchant/products/:userId/:productId","type":1,"val":"productId","end":""}],
    types: placeholder as Registry['api.merchant.products.update']['types'],
  },
  'api.merchant.products.delete': {
    methods: ["DELETE"],
    pattern: '/api/merchant/products/:userId/:productId',
    tokens: [{"old":"/api/merchant/products/:userId/:productId","type":0,"val":"api","end":""},{"old":"/api/merchant/products/:userId/:productId","type":0,"val":"merchant","end":""},{"old":"/api/merchant/products/:userId/:productId","type":0,"val":"products","end":""},{"old":"/api/merchant/products/:userId/:productId","type":1,"val":"userId","end":""},{"old":"/api/merchant/products/:userId/:productId","type":1,"val":"productId","end":""}],
    types: placeholder as Registry['api.merchant.products.delete']['types'],
  },
  'api.merchant.categories': {
    methods: ["GET","HEAD"],
    pattern: '/api/merchant/categories/:userId',
    tokens: [{"old":"/api/merchant/categories/:userId","type":0,"val":"api","end":""},{"old":"/api/merchant/categories/:userId","type":0,"val":"merchant","end":""},{"old":"/api/merchant/categories/:userId","type":0,"val":"categories","end":""},{"old":"/api/merchant/categories/:userId","type":1,"val":"userId","end":""}],
    types: placeholder as Registry['api.merchant.categories']['types'],
  },
  'api.merchant.categories.create': {
    methods: ["POST"],
    pattern: '/api/merchant/categories/:userId',
    tokens: [{"old":"/api/merchant/categories/:userId","type":0,"val":"api","end":""},{"old":"/api/merchant/categories/:userId","type":0,"val":"merchant","end":""},{"old":"/api/merchant/categories/:userId","type":0,"val":"categories","end":""},{"old":"/api/merchant/categories/:userId","type":1,"val":"userId","end":""}],
    types: placeholder as Registry['api.merchant.categories.create']['types'],
  },
  'api.merchant.categories.update': {
    methods: ["PUT"],
    pattern: '/api/merchant/categories/:userId/:categoryId',
    tokens: [{"old":"/api/merchant/categories/:userId/:categoryId","type":0,"val":"api","end":""},{"old":"/api/merchant/categories/:userId/:categoryId","type":0,"val":"merchant","end":""},{"old":"/api/merchant/categories/:userId/:categoryId","type":0,"val":"categories","end":""},{"old":"/api/merchant/categories/:userId/:categoryId","type":1,"val":"userId","end":""},{"old":"/api/merchant/categories/:userId/:categoryId","type":1,"val":"categoryId","end":""}],
    types: placeholder as Registry['api.merchant.categories.update']['types'],
  },
  'api.merchant.categories.delete': {
    methods: ["DELETE"],
    pattern: '/api/merchant/categories/:userId/:categoryId',
    tokens: [{"old":"/api/merchant/categories/:userId/:categoryId","type":0,"val":"api","end":""},{"old":"/api/merchant/categories/:userId/:categoryId","type":0,"val":"merchant","end":""},{"old":"/api/merchant/categories/:userId/:categoryId","type":0,"val":"categories","end":""},{"old":"/api/merchant/categories/:userId/:categoryId","type":1,"val":"userId","end":""},{"old":"/api/merchant/categories/:userId/:categoryId","type":1,"val":"categoryId","end":""}],
    types: placeholder as Registry['api.merchant.categories.delete']['types'],
  },
  'api.merchant.coupons': {
    methods: ["GET","HEAD"],
    pattern: '/api/merchant/coupons/:userId',
    tokens: [{"old":"/api/merchant/coupons/:userId","type":0,"val":"api","end":""},{"old":"/api/merchant/coupons/:userId","type":0,"val":"merchant","end":""},{"old":"/api/merchant/coupons/:userId","type":0,"val":"coupons","end":""},{"old":"/api/merchant/coupons/:userId","type":1,"val":"userId","end":""}],
    types: placeholder as Registry['api.merchant.coupons']['types'],
  },
  'api.merchant.coupons.create': {
    methods: ["POST"],
    pattern: '/api/merchant/coupons/:userId',
    tokens: [{"old":"/api/merchant/coupons/:userId","type":0,"val":"api","end":""},{"old":"/api/merchant/coupons/:userId","type":0,"val":"merchant","end":""},{"old":"/api/merchant/coupons/:userId","type":0,"val":"coupons","end":""},{"old":"/api/merchant/coupons/:userId","type":1,"val":"userId","end":""}],
    types: placeholder as Registry['api.merchant.coupons.create']['types'],
  },
  'api.merchant.coupons.update': {
    methods: ["PUT"],
    pattern: '/api/merchant/coupons/:userId/:couponId',
    tokens: [{"old":"/api/merchant/coupons/:userId/:couponId","type":0,"val":"api","end":""},{"old":"/api/merchant/coupons/:userId/:couponId","type":0,"val":"merchant","end":""},{"old":"/api/merchant/coupons/:userId/:couponId","type":0,"val":"coupons","end":""},{"old":"/api/merchant/coupons/:userId/:couponId","type":1,"val":"userId","end":""},{"old":"/api/merchant/coupons/:userId/:couponId","type":1,"val":"couponId","end":""}],
    types: placeholder as Registry['api.merchant.coupons.update']['types'],
  },
  'api.merchant.coupons.delete': {
    methods: ["DELETE"],
    pattern: '/api/merchant/coupons/:userId/:couponId',
    tokens: [{"old":"/api/merchant/coupons/:userId/:couponId","type":0,"val":"api","end":""},{"old":"/api/merchant/coupons/:userId/:couponId","type":0,"val":"merchant","end":""},{"old":"/api/merchant/coupons/:userId/:couponId","type":0,"val":"coupons","end":""},{"old":"/api/merchant/coupons/:userId/:couponId","type":1,"val":"userId","end":""},{"old":"/api/merchant/coupons/:userId/:couponId","type":1,"val":"couponId","end":""}],
    types: placeholder as Registry['api.merchant.coupons.delete']['types'],
  },
  'api.coupons.index': {
    methods: ["GET","HEAD"],
    pattern: '/api/merchant/coupons',
    tokens: [{"old":"/api/merchant/coupons","type":0,"val":"api","end":""},{"old":"/api/merchant/coupons","type":0,"val":"merchant","end":""},{"old":"/api/merchant/coupons","type":0,"val":"coupons","end":""}],
    types: placeholder as Registry['api.coupons.index']['types'],
  },
  'api.coupons.verify': {
    methods: ["GET","HEAD"],
    pattern: '/api/merchant/coupons/verify/:code',
    tokens: [{"old":"/api/merchant/coupons/verify/:code","type":0,"val":"api","end":""},{"old":"/api/merchant/coupons/verify/:code","type":0,"val":"merchant","end":""},{"old":"/api/merchant/coupons/verify/:code","type":0,"val":"coupons","end":""},{"old":"/api/merchant/coupons/verify/:code","type":0,"val":"verify","end":""},{"old":"/api/merchant/coupons/verify/:code","type":1,"val":"code","end":""}],
    types: placeholder as Registry['api.coupons.verify']['types'],
  },
  'api.coupons.show': {
    methods: ["GET","HEAD"],
    pattern: '/api/merchant/coupons/:id',
    tokens: [{"old":"/api/merchant/coupons/:id","type":0,"val":"api","end":""},{"old":"/api/merchant/coupons/:id","type":0,"val":"merchant","end":""},{"old":"/api/merchant/coupons/:id","type":0,"val":"coupons","end":""},{"old":"/api/merchant/coupons/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['api.coupons.show']['types'],
  },
  'api.tracking.add-event': {
    methods: ["POST"],
    pattern: '/api/tracking/:orderId/event',
    tokens: [{"old":"/api/tracking/:orderId/event","type":0,"val":"api","end":""},{"old":"/api/tracking/:orderId/event","type":0,"val":"tracking","end":""},{"old":"/api/tracking/:orderId/event","type":1,"val":"orderId","end":""},{"old":"/api/tracking/:orderId/event","type":0,"val":"event","end":""}],
    types: placeholder as Registry['api.tracking.add-event']['types'],
  },
  'api.tracking.update-status': {
    methods: ["PUT"],
    pattern: '/api/tracking/:orderId/status',
    tokens: [{"old":"/api/tracking/:orderId/status","type":0,"val":"api","end":""},{"old":"/api/tracking/:orderId/status","type":0,"val":"tracking","end":""},{"old":"/api/tracking/:orderId/status","type":1,"val":"orderId","end":""},{"old":"/api/tracking/:orderId/status","type":0,"val":"status","end":""}],
    types: placeholder as Registry['api.tracking.update-status']['types'],
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
