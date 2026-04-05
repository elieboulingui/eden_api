import '@adonisjs/core/types/http'

type ParamValue = string | number | bigint | boolean

export type ScannedRoutes = {
  ALL: {
    'home': { paramsTuple?: []; params?: {} }
    'new_account.create': { paramsTuple?: []; params?: {} }
    'new_account.web.store': { paramsTuple?: []; params?: {} }
    'session.create': { paramsTuple?: []; params?: {} }
    'session.store': { paramsTuple?: []; params?: {} }
    'session.web.destroy': { paramsTuple?: []; params?: {} }
    'dashboard.admin': { paramsTuple?: []; params?: {} }
    'dashboard.secretary': { paramsTuple?: []; params?: {} }
    'dashboard.manager': { paramsTuple?: []; params?: {} }
    'dashboard.promotions': { paramsTuple?: []; params?: {} }
    'orders.check_payment_status': { paramsTuple: [ParamValue]; params: {'orderId': ParamValue} }
    'orders.payment_status_callbacks': { paramsTuple: [ParamValue]; params: {'transactionId': ParamValue} }
    'promotions.index': { paramsTuple?: []; params?: {} }
    'promotions.banners': { paramsTuple?: []; params?: {} }
    'promotions.flash_sales': { paramsTuple?: []; params?: {} }
    'promotions.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'promotions.store': { paramsTuple?: []; params?: {} }
    'promotions.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'promotions.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'pubs.get_all_pubs': { paramsTuple?: []; params?: {} }
    'pubs.create_pub': { paramsTuple?: []; params?: {} }
    'pubs.update_pub': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'pubs.delete_pub': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'pubs.toggle_pub_status': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'merchant_dashboard.give_change': { paramsTuple?: []; params?: {} }
    'merchant_dashboard.get_withdrawal_history': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'merchant_dashboard.get_wallet': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'merchant_dashboard.dashboard': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'merchant_dashboard.get_stats': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'merchant_dashboard.get_merchant_orders': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'merchant_dashboard.get_pending_orders': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'merchant_dashboard.get_order_details': { paramsTuple: [ParamValue,ParamValue]; params: {'userId': ParamValue,'orderId': ParamValue} }
    'merchant_dashboard.get_recent_orders': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'merchant_dashboard.get_products': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'merchant_dashboard.create_product': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'merchant_dashboard.update_product': { paramsTuple: [ParamValue,ParamValue]; params: {'userId': ParamValue,'productId': ParamValue} }
    'merchant_dashboard.delete_product': { paramsTuple: [ParamValue,ParamValue]; params: {'userId': ParamValue,'productId': ParamValue} }
    'merchant_dashboard.get_categories': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'merchant_dashboard.create_category': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'merchant_dashboard.update_category': { paramsTuple: [ParamValue,ParamValue]; params: {'userId': ParamValue,'categoryId': ParamValue} }
    'merchant_dashboard.delete_category': { paramsTuple: [ParamValue,ParamValue]; params: {'userId': ParamValue,'categoryId': ParamValue} }
    'merchant_dashboard.get_coupons': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'merchant_dashboard.create_coupon': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'merchant_dashboard.update_coupon': { paramsTuple: [ParamValue,ParamValue]; params: {'userId': ParamValue,'couponId': ParamValue} }
    'merchant_dashboard.delete_coupon': { paramsTuple: [ParamValue,ParamValue]; params: {'userId': ParamValue,'couponId': ParamValue} }
    'coupons.index': { paramsTuple?: []; params?: {} }
    'coupons.apply': { paramsTuple?: []; params?: {} }
    'coupons.verify': { paramsTuple?: []; params?: {} }
    'coupons.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'new_account.store': { paramsTuple?: []; params?: {} }
    'session.client.store': { paramsTuple?: []; params?: {} }
    'session.login': { paramsTuple?: []; params?: {} }
    'session.api.login': { paramsTuple?: []; params?: {} }
    'session.update': { paramsTuple?: []; params?: {} }
    'session.destroy': { paramsTuple?: []; params?: {} }
    'users.index': { paramsTuple?: []; params?: {} }
    'users.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'products.index': { paramsTuple?: []; params?: {} }
    'products.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'produits.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'products.store': { paramsTuple?: []; params?: {} }
    'products.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'products.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'categories.index': { paramsTuple?: []; params?: {} }
    'categories.show': { paramsTuple: [ParamValue]; params: {'slug': ParamValue} }
    'categories.store': { paramsTuple?: []; params?: {} }
    'categories.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'categories.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'categories.create_product': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'cart.get_cart': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'cart.show': { paramsTuple?: []; params?: {} }
    'cart.add': { paramsTuple?: []; params?: {} }
    'cart.update': { paramsTuple?: []; params?: {} }
    'cart.delete_item': { paramsTuple: [ParamValue]; params: {'itemId': ParamValue} }
    'cart.clear': { paramsTuple?: []; params?: {} }
    'favorites.add': { paramsTuple?: []; params?: {} }
    'favorites.remove': { paramsTuple?: []; params?: {} }
    'favorites.index': { paramsTuple?: []; params?: {} }
    'favorites.check': { paramsTuple?: []; params?: {} }
    'orders.store': { paramsTuple?: []; params?: {} }
    'orders.all_orders': { paramsTuple?: []; params?: {} }
    'orders.index': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'orders.show': { paramsTuple: [ParamValue,ParamValue]; params: {'orderId': ParamValue,'userId': ParamValue} }
    'orders.cancel': { paramsTuple: [ParamValue]; params: {'orderId': ParamValue} }
    'orders.invoice': { paramsTuple: [ParamValue,ParamValue]; params: {'orderId': ParamValue,'userId': ParamValue} }
    'orders.update_status': { paramsTuple: [ParamValue]; params: {'orderId': ParamValue} }
    'order_tracking.search': { paramsTuple?: []; params?: {} }
    'order_tracking.get_tracking_events': { paramsTuple: [ParamValue]; params: {'orderId': ParamValue} }
    'order_tracking.add_tracking_event': { paramsTuple: [ParamValue]; params: {'orderId': ParamValue} }
    'order_tracking.update_order_status': { paramsTuple: [ParamValue]; params: {'orderId': ParamValue} }
    'newsletter.subscribe': { paramsTuple?: []; params?: {} }
  }
  GET: {
    'home': { paramsTuple?: []; params?: {} }
    'new_account.create': { paramsTuple?: []; params?: {} }
    'session.create': { paramsTuple?: []; params?: {} }
    'dashboard.admin': { paramsTuple?: []; params?: {} }
    'dashboard.secretary': { paramsTuple?: []; params?: {} }
    'dashboard.manager': { paramsTuple?: []; params?: {} }
    'dashboard.promotions': { paramsTuple?: []; params?: {} }
    'orders.check_payment_status': { paramsTuple: [ParamValue]; params: {'orderId': ParamValue} }
    'orders.payment_status_callbacks': { paramsTuple: [ParamValue]; params: {'transactionId': ParamValue} }
    'promotions.index': { paramsTuple?: []; params?: {} }
    'promotions.banners': { paramsTuple?: []; params?: {} }
    'promotions.flash_sales': { paramsTuple?: []; params?: {} }
    'promotions.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'pubs.get_all_pubs': { paramsTuple?: []; params?: {} }
    'merchant_dashboard.get_withdrawal_history': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'merchant_dashboard.get_wallet': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'merchant_dashboard.dashboard': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'merchant_dashboard.get_stats': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'merchant_dashboard.get_merchant_orders': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'merchant_dashboard.get_pending_orders': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'merchant_dashboard.get_order_details': { paramsTuple: [ParamValue,ParamValue]; params: {'userId': ParamValue,'orderId': ParamValue} }
    'merchant_dashboard.get_recent_orders': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'merchant_dashboard.get_products': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'merchant_dashboard.get_categories': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'merchant_dashboard.get_coupons': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'coupons.index': { paramsTuple?: []; params?: {} }
    'coupons.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'users.index': { paramsTuple?: []; params?: {} }
    'users.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'products.index': { paramsTuple?: []; params?: {} }
    'products.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'produits.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'categories.index': { paramsTuple?: []; params?: {} }
    'categories.show': { paramsTuple: [ParamValue]; params: {'slug': ParamValue} }
    'cart.get_cart': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'favorites.index': { paramsTuple?: []; params?: {} }
    'favorites.check': { paramsTuple?: []; params?: {} }
    'orders.all_orders': { paramsTuple?: []; params?: {} }
    'orders.index': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'orders.show': { paramsTuple: [ParamValue,ParamValue]; params: {'orderId': ParamValue,'userId': ParamValue} }
    'orders.invoice': { paramsTuple: [ParamValue,ParamValue]; params: {'orderId': ParamValue,'userId': ParamValue} }
    'order_tracking.get_tracking_events': { paramsTuple: [ParamValue]; params: {'orderId': ParamValue} }
  }
  HEAD: {
    'home': { paramsTuple?: []; params?: {} }
    'new_account.create': { paramsTuple?: []; params?: {} }
    'session.create': { paramsTuple?: []; params?: {} }
    'dashboard.admin': { paramsTuple?: []; params?: {} }
    'dashboard.secretary': { paramsTuple?: []; params?: {} }
    'dashboard.manager': { paramsTuple?: []; params?: {} }
    'dashboard.promotions': { paramsTuple?: []; params?: {} }
    'orders.check_payment_status': { paramsTuple: [ParamValue]; params: {'orderId': ParamValue} }
    'orders.payment_status_callbacks': { paramsTuple: [ParamValue]; params: {'transactionId': ParamValue} }
    'promotions.index': { paramsTuple?: []; params?: {} }
    'promotions.banners': { paramsTuple?: []; params?: {} }
    'promotions.flash_sales': { paramsTuple?: []; params?: {} }
    'promotions.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'pubs.get_all_pubs': { paramsTuple?: []; params?: {} }
    'merchant_dashboard.get_withdrawal_history': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'merchant_dashboard.get_wallet': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'merchant_dashboard.dashboard': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'merchant_dashboard.get_stats': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'merchant_dashboard.get_merchant_orders': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'merchant_dashboard.get_pending_orders': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'merchant_dashboard.get_order_details': { paramsTuple: [ParamValue,ParamValue]; params: {'userId': ParamValue,'orderId': ParamValue} }
    'merchant_dashboard.get_recent_orders': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'merchant_dashboard.get_products': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'merchant_dashboard.get_categories': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'merchant_dashboard.get_coupons': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'coupons.index': { paramsTuple?: []; params?: {} }
    'coupons.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'users.index': { paramsTuple?: []; params?: {} }
    'users.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'products.index': { paramsTuple?: []; params?: {} }
    'products.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'produits.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'categories.index': { paramsTuple?: []; params?: {} }
    'categories.show': { paramsTuple: [ParamValue]; params: {'slug': ParamValue} }
    'cart.get_cart': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'favorites.index': { paramsTuple?: []; params?: {} }
    'favorites.check': { paramsTuple?: []; params?: {} }
    'orders.all_orders': { paramsTuple?: []; params?: {} }
    'orders.index': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'orders.show': { paramsTuple: [ParamValue,ParamValue]; params: {'orderId': ParamValue,'userId': ParamValue} }
    'orders.invoice': { paramsTuple: [ParamValue,ParamValue]; params: {'orderId': ParamValue,'userId': ParamValue} }
    'order_tracking.get_tracking_events': { paramsTuple: [ParamValue]; params: {'orderId': ParamValue} }
  }
  POST: {
    'new_account.web.store': { paramsTuple?: []; params?: {} }
    'session.store': { paramsTuple?: []; params?: {} }
    'session.web.destroy': { paramsTuple?: []; params?: {} }
    'promotions.store': { paramsTuple?: []; params?: {} }
    'pubs.create_pub': { paramsTuple?: []; params?: {} }
    'merchant_dashboard.give_change': { paramsTuple?: []; params?: {} }
    'merchant_dashboard.create_product': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'merchant_dashboard.create_category': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'merchant_dashboard.create_coupon': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'coupons.apply': { paramsTuple?: []; params?: {} }
    'coupons.verify': { paramsTuple?: []; params?: {} }
    'new_account.store': { paramsTuple?: []; params?: {} }
    'session.client.store': { paramsTuple?: []; params?: {} }
    'session.login': { paramsTuple?: []; params?: {} }
    'session.api.login': { paramsTuple?: []; params?: {} }
    'session.destroy': { paramsTuple?: []; params?: {} }
    'products.store': { paramsTuple?: []; params?: {} }
    'categories.store': { paramsTuple?: []; params?: {} }
    'categories.create_product': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'cart.show': { paramsTuple?: []; params?: {} }
    'cart.add': { paramsTuple?: []; params?: {} }
    'favorites.add': { paramsTuple?: []; params?: {} }
    'favorites.remove': { paramsTuple?: []; params?: {} }
    'orders.store': { paramsTuple?: []; params?: {} }
    'orders.cancel': { paramsTuple: [ParamValue]; params: {'orderId': ParamValue} }
    'order_tracking.search': { paramsTuple?: []; params?: {} }
    'order_tracking.add_tracking_event': { paramsTuple: [ParamValue]; params: {'orderId': ParamValue} }
    'newsletter.subscribe': { paramsTuple?: []; params?: {} }
  }
  PUT: {
    'promotions.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'pubs.update_pub': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'merchant_dashboard.update_product': { paramsTuple: [ParamValue,ParamValue]; params: {'userId': ParamValue,'productId': ParamValue} }
    'merchant_dashboard.update_category': { paramsTuple: [ParamValue,ParamValue]; params: {'userId': ParamValue,'categoryId': ParamValue} }
    'merchant_dashboard.update_coupon': { paramsTuple: [ParamValue,ParamValue]; params: {'userId': ParamValue,'couponId': ParamValue} }
    'session.update': { paramsTuple?: []; params?: {} }
    'products.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'categories.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'cart.update': { paramsTuple?: []; params?: {} }
    'orders.update_status': { paramsTuple: [ParamValue]; params: {'orderId': ParamValue} }
    'order_tracking.update_order_status': { paramsTuple: [ParamValue]; params: {'orderId': ParamValue} }
  }
  DELETE: {
    'promotions.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'pubs.delete_pub': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'merchant_dashboard.delete_product': { paramsTuple: [ParamValue,ParamValue]; params: {'userId': ParamValue,'productId': ParamValue} }
    'merchant_dashboard.delete_category': { paramsTuple: [ParamValue,ParamValue]; params: {'userId': ParamValue,'categoryId': ParamValue} }
    'merchant_dashboard.delete_coupon': { paramsTuple: [ParamValue,ParamValue]; params: {'userId': ParamValue,'couponId': ParamValue} }
    'products.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'categories.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'cart.delete_item': { paramsTuple: [ParamValue]; params: {'itemId': ParamValue} }
    'cart.clear': { paramsTuple?: []; params?: {} }
  }
  PATCH: {
    'pubs.toggle_pub_status': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
}
declare module '@adonisjs/core/types/http' {
  export interface RoutesList extends ScannedRoutes {}
}