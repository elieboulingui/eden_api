import '@adonisjs/core/types/http'

type ParamValue = string | number | bigint | boolean

export type ScannedRoutes = {
  ALL: {
    'orders.check_payment_status': { paramsTuple: [ParamValue]; params: {'orderId': ParamValue} }
    'orders.payment_status_callbacks': { paramsTuple: [ParamValue]; params: {'transactionId': ParamValue} }
    'pubs.get_all_pubs': { paramsTuple?: []; params?: {} }
    'pubs.create_pub': { paramsTuple?: []; params?: {} }
    'pubs.update_pub': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'pubs.delete_pub': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'pubs.toggle_pub_status': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'orders.store': { paramsTuple?: []; params?: {} }
    'orders.index': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'orders.show': { paramsTuple: [ParamValue,ParamValue]; params: {'orderId': ParamValue,'userId': ParamValue} }
    'orders.cancel': { paramsTuple: [ParamValue]; params: {'orderId': ParamValue} }
    'orders.invoice': { paramsTuple: [ParamValue,ParamValue]; params: {'orderId': ParamValue,'userId': ParamValue} }
    'orders.update_status': { paramsTuple: [ParamValue]; params: {'orderId': ParamValue} }
  }
  GET: {
    'orders.check_payment_status': { paramsTuple: [ParamValue]; params: {'orderId': ParamValue} }
    'orders.payment_status_callbacks': { paramsTuple: [ParamValue]; params: {'transactionId': ParamValue} }
    'pubs.get_all_pubs': { paramsTuple?: []; params?: {} }
    'orders.index': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'orders.show': { paramsTuple: [ParamValue,ParamValue]; params: {'orderId': ParamValue,'userId': ParamValue} }
    'orders.invoice': { paramsTuple: [ParamValue,ParamValue]; params: {'orderId': ParamValue,'userId': ParamValue} }
  }
  HEAD: {
    'orders.check_payment_status': { paramsTuple: [ParamValue]; params: {'orderId': ParamValue} }
    'orders.payment_status_callbacks': { paramsTuple: [ParamValue]; params: {'transactionId': ParamValue} }
    'pubs.get_all_pubs': { paramsTuple?: []; params?: {} }
    'orders.index': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'orders.show': { paramsTuple: [ParamValue,ParamValue]; params: {'orderId': ParamValue,'userId': ParamValue} }
    'orders.invoice': { paramsTuple: [ParamValue,ParamValue]; params: {'orderId': ParamValue,'userId': ParamValue} }
  }
  POST: {
    'pubs.create_pub': { paramsTuple?: []; params?: {} }
    'orders.store': { paramsTuple?: []; params?: {} }
    'orders.cancel': { paramsTuple: [ParamValue]; params: {'orderId': ParamValue} }
  }
  PUT: {
    'pubs.update_pub': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'orders.update_status': { paramsTuple: [ParamValue]; params: {'orderId': ParamValue} }
  }
  DELETE: {
    'pubs.delete_pub': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
  PATCH: {
    'pubs.toggle_pub_status': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
}
declare module '@adonisjs/core/types/http' {
  export interface RoutesList extends ScannedRoutes {}
}