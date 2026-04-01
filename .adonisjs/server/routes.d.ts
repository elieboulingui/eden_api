import '@adonisjs/core/types/http'

type ParamValue = string | number | bigint | boolean

export type ScannedRoutes = {
  ALL: {
    'pubs.get_all_pubs': { paramsTuple?: []; params?: {} }
    'pubs.create_pub': { paramsTuple?: []; params?: {} }
    'pubs.update_pub': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'pubs.delete_pub': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'pubs.toggle_pub_status': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
  GET: {
    'pubs.get_all_pubs': { paramsTuple?: []; params?: {} }
  }
  HEAD: {
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