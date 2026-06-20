import { onRequestOptions as __recommend_js_onRequestOptions } from "C:\\Users\\hayoung\\Desktop\\네이버지도즐겨찾기정리\\app\\functions\\recommend.js"
import { onRequestPost as __recommend_js_onRequestPost } from "C:\\Users\\hayoung\\Desktop\\네이버지도즐겨찾기정리\\app\\functions\\recommend.js"
import { onRequest as ___middleware_js_onRequest } from "C:\\Users\\hayoung\\Desktop\\네이버지도즐겨찾기정리\\app\\functions\\_middleware.js"

export const routes = [
    {
      routePath: "/recommend",
      mountPath: "/",
      method: "OPTIONS",
      middlewares: [],
      modules: [__recommend_js_onRequestOptions],
    },
  {
      routePath: "/recommend",
      mountPath: "/",
      method: "POST",
      middlewares: [],
      modules: [__recommend_js_onRequestPost],
    },
  {
      routePath: "/",
      mountPath: "/",
      method: "",
      middlewares: [___middleware_js_onRequest],
      modules: [],
    },
  ]