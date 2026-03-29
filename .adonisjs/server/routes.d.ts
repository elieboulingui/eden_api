import '@adonisjs/core/types/http'

type ParamValue = string | number | bigint | boolean

export type ScannedRoutes = {
  ALL: {
    'api.client.register': { paramsTuple?: []; params?: {} }
    'api.client.login': { paramsTuple?: []; params?: {} }
    'merchant_dashboard.index': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'api.tracking.search': { paramsTuple?: []; params?: {} }
    'api.tracking.events': { paramsTuple: [ParamValue]; params: {'orderId': ParamValue} }
    'api.client.profile.update': { paramsTuple?: []; params?: {} }
    'api.client.logout': { paramsTuple?: []; params?: {} }
    'api.users.index': { paramsTuple?: []; params?: {} }
    'api.users.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'api.products.index': { paramsTuple?: []; params?: {} }
    'api.products.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'api.products.store': { paramsTuple?: []; params?: {} }
    'api.products.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'api.products.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'api.categories.index': { paramsTuple?: []; params?: {} }
    'api.categories.show': { paramsTuple: [ParamValue]; params: {'slug': ParamValue} }
    'api.categories.store': { paramsTuple?: []; params?: {} }
    'api.categories.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'api.categories.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'api.categories.products.store': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'api.cart.get': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'api.cart.show': { paramsTuple?: []; params?: {} }
    'api.cart.add': { paramsTuple?: []; params?: {} }
    'api.cart.update': { paramsTuple?: []; params?: {} }
    'api.cart.delete': { paramsTuple: [ParamValue]; params: {'itemId': ParamValue} }
    'api.favorites.add': { paramsTuple?: []; params?: {} }
    'api.favorites.remove': { paramsTuple?: []; params?: {} }
    'api.favorites.index': { paramsTuple?: []; params?: {} }
    'api.favorites.check': { paramsTuple?: []; params?: {} }
    'api.orders.store': { paramsTuple?: []; params?: {} }
    'api.orders.index': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'api.orders.show': { paramsTuple: [ParamValue,ParamValue]; params: {'orderId': ParamValue,'userId': ParamValue} }
    'api.orders.cancel': { paramsTuple: [ParamValue]; params: {'orderId': ParamValue} }
    'api.orders.invoice': { paramsTuple: [ParamValue,ParamValue]; params: {'orderId': ParamValue,'userId': ParamValue} }
    'api.orders.update-status': { paramsTuple: [ParamValue]; params: {'orderId': ParamValue} }
    'api.merchant.dashboard': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'api.merchant.stats': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'api.merchant.orders': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'api.merchant.products': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'api.merchant.products.create': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'api.merchant.products.update': { paramsTuple: [ParamValue,ParamValue]; params: {'userId': ParamValue,'productId': ParamValue} }
    'api.merchant.products.delete': { paramsTuple: [ParamValue,ParamValue]; params: {'userId': ParamValue,'productId': ParamValue} }
    'api.merchant.categories': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'api.merchant.categories.create': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'api.merchant.categories.update': { paramsTuple: [ParamValue,ParamValue]; params: {'userId': ParamValue,'categoryId': ParamValue} }
    'api.merchant.categories.delete': { paramsTuple: [ParamValue,ParamValue]; params: {'userId': ParamValue,'categoryId': ParamValue} }
    'api.merchant.coupons': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'api.merchant.coupons.create': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'api.merchant.coupons.update': { paramsTuple: [ParamValue,ParamValue]; params: {'userId': ParamValue,'couponId': ParamValue} }
    'api.merchant.coupons.delete': { paramsTuple: [ParamValue,ParamValue]; params: {'userId': ParamValue,'couponId': ParamValue} }
    'api.coupons.index': { paramsTuple?: []; params?: {} }
    'api.coupons.verify': { paramsTuple: [ParamValue]; params: {'code': ParamValue} }
    'api.coupons.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'api.tracking.add-event': { paramsTuple: [ParamValue]; params: {'orderId': ParamValue} }
    'api.tracking.update-status': { paramsTuple: [ParamValue]; params: {'orderId': ParamValue} }
  }
  POST: {
    'api.client.register': { paramsTuple?: []; params?: {} }
    'api.client.login': { paramsTuple?: []; params?: {} }
    'api.tracking.search': { paramsTuple?: []; params?: {} }
    'api.client.logout': { paramsTuple?: []; params?: {} }
    'api.products.store': { paramsTuple?: []; params?: {} }
    'api.categories.store': { paramsTuple?: []; params?: {} }
    'api.categories.products.store': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'api.cart.show': { paramsTuple?: []; params?: {} }
    'api.cart.add': { paramsTuple?: []; params?: {} }
    'api.favorites.add': { paramsTuple?: []; params?: {} }
    'api.favorites.remove': { paramsTuple?: []; params?: {} }
    'api.orders.store': { paramsTuple?: []; params?: {} }
    'api.orders.cancel': { paramsTuple: [ParamValue]; params: {'orderId': ParamValue} }
    'api.merchant.products.create': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'api.merchant.categories.create': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'api.merchant.coupons.create': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'api.tracking.add-event': { paramsTuple: [ParamValue]; params: {'orderId': ParamValue} }
  }
  GET: {
    'merchant_dashboard.index': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'api.tracking.events': { paramsTuple: [ParamValue]; params: {'orderId': ParamValue} }
    'api.users.index': { paramsTuple?: []; params?: {} }
    'api.users.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'api.products.index': { paramsTuple?: []; params?: {} }
    'api.products.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'api.categories.index': { paramsTuple?: []; params?: {} }
    'api.categories.show': { paramsTuple: [ParamValue]; params: {'slug': ParamValue} }
    'api.cart.get': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'api.favorites.index': { paramsTuple?: []; params?: {} }
    'api.favorites.check': { paramsTuple?: []; params?: {} }
    'api.orders.index': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'api.orders.show': { paramsTuple: [ParamValue,ParamValue]; params: {'orderId': ParamValue,'userId': ParamValue} }
    'api.orders.invoice': { paramsTuple: [ParamValue,ParamValue]; params: {'orderId': ParamValue,'userId': ParamValue} }
    'api.merchant.dashboard': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'api.merchant.stats': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'api.merchant.orders': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'api.merchant.products': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'api.merchant.categories': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'api.merchant.coupons': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'api.coupons.index': { paramsTuple?: []; params?: {} }
    'api.coupons.verify': { paramsTuple: [ParamValue]; params: {'code': ParamValue} }
    'api.coupons.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
  HEAD: {
    'merchant_dashboard.index': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'api.tracking.events': { paramsTuple: [ParamValue]; params: {'orderId': ParamValue} }
    'api.users.index': { paramsTuple?: []; params?: {} }
    'api.users.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'api.products.index': { paramsTuple?: []; params?: {} }
    'api.products.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'api.categories.index': { paramsTuple?: []; params?: {} }
    'api.categories.show': { paramsTuple: [ParamValue]; params: {'slug': ParamValue} }
    'api.cart.get': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'api.favorites.index': { paramsTuple?: []; params?: {} }
    'api.favorites.check': { paramsTuple?: []; params?: {} }
    'api.orders.index': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'api.orders.show': { paramsTuple: [ParamValue,ParamValue]; params: {'orderId': ParamValue,'userId': ParamValue} }
    'api.orders.invoice': { paramsTuple: [ParamValue,ParamValue]; params: {'orderId': ParamValue,'userId': ParamValue} }
    'api.merchant.dashboard': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'api.merchant.stats': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'api.merchant.orders': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'api.merchant.products': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'api.merchant.categories': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'api.merchant.coupons': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'api.coupons.index': { paramsTuple?: []; params?: {} }
    'api.coupons.verify': { paramsTuple: [ParamValue]; params: {'code': ParamValue} }
    'api.coupons.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
  PUT: {
    'api.client.profile.update': { paramsTuple?: []; params?: {} }
    'api.products.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'api.categories.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'api.cart.update': { paramsTuple?: []; params?: {} }
    'api.orders.update-status': { paramsTuple: [ParamValue]; params: {'orderId': ParamValue} }
    'api.merchant.products.update': { paramsTuple: [ParamValue,ParamValue]; params: {'userId': ParamValue,'productId': ParamValue} }
    'api.merchant.categories.update': { paramsTuple: [ParamValue,ParamValue]; params: {'userId': ParamValue,'categoryId': ParamValue} }
    'api.merchant.coupons.update': { paramsTuple: [ParamValue,ParamValue]; params: {'userId': ParamValue,'couponId': ParamValue} }
    'api.tracking.update-status': { paramsTuple: [ParamValue]; params: {'orderId': ParamValue} }
  }
  DELETE: {
    'api.products.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'api.categories.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'api.cart.delete': { paramsTuple: [ParamValue]; params: {'itemId': ParamValue} }
    'api.merchant.products.delete': { paramsTuple: [ParamValue,ParamValue]; params: {'userId': ParamValue,'productId': ParamValue} }
    'api.merchant.categories.delete': { paramsTuple: [ParamValue,ParamValue]; params: {'userId': ParamValue,'categoryId': ParamValue} }
    'api.merchant.coupons.delete': { paramsTuple: [ParamValue,ParamValue]; params: {'userId': ParamValue,'couponId': ParamValue} }
  }
}
declare module '@adonisjs/core/types/http' {
  export interface RoutesList extends ScannedRoutes {}
}