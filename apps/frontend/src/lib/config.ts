export const APP_NAME = import.meta.env.VITE_APP_NAME ?? "Free POS"
export const AUTH_API_URL = (import.meta.env.VITE_AUTH_API_URL ?? "http://localhost:8787").replace(/\/+$/, "")
export const SHOP_API_URL = (import.meta.env.VITE_SHOP_API_URL ?? "http://localhost:8788").replace(/\/+$/, "")
