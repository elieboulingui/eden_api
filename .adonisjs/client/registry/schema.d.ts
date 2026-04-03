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
  'orders.show': {
    methods: ["GET","HEAD"]
    pattern: '/api/orders/:orderId/:userId'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue]
      params: { orderId: ParamValue; userId: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'orders.payment_status_callback': {
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
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/pubs_controller').default['getAllPubs']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/pubs_controller').default['getAllPubs']>>>
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
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/pubs_controller').default['createPub']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/pubs_controller').default['createPub']>>>
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
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/pubs_controller').default['updatePub']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/pubs_controller').default['updatePub']>>>
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
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/pubs_controller').default['deletePub']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/pubs_controller').default['deletePub']>>>
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
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/pubs_controller').default['togglePubStatus']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/pubs_controller').default['togglePubStatus']>>>
    }
  }
}
