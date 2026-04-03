import '@adonisjs/core/types/http'

type ParamValue = string | number | bigint | boolean

export type ScannedRoutes = {
  ALL: {
    'orders.check_payment_status': { paramsTuple: [ParamValue]; params: {'orderId': ParamValue} }
    'orders.show': { paramsTuple: [ParamValue,ParamValue]; params: {'orderId': ParamValue,'userId': ParamValue} }
    'pubs.get_all_pubs': { paramsTuple?: []; params?: {} }
    'pubs.create_pub': { paramsTuple?: []; params?: {} }
    'pubs.update_pub': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'pubs.delete_pub': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'pubs.toggle_pub_status': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
  GET: {
    'orders.check_payment_status': { paramsTuple: [ParamValue]; params: {'orderId': ParamValue} }
    'orders.show': { paramsTuple: [ParamValue,ParamValue]; params: {'orderId': ParamValue,'userId': ParamValue} }
    'pubs.get_all_pubs': { paramsTuple?: []; params?: {} }
  }
  HEAD: {
    'orders.check_payment_status': { paramsTuple: [ParamValue]; params: {'orderId': ParamValue} }
    'orders.show': { paramsTuple: [ParamValue,ParamValue]; params: {'orderId': ParamValue,'userId': ParamValue} }
    'pubs.get_all_pubs': { paramsTuple?: []; params?: {} }
  }
  POST: {
    'pubs.create_pub': { paramsTuple?: []; params?: {} }
  }
  PUT: {
    'pubs.update_pub': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
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