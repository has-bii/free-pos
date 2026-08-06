import type { QueryClient } from "@tanstack/react-query"
import { queryOptions } from "@tanstack/react-query"
import { shopApi } from "../lib/api"

export const GET_MY_SHOP_QUERY_KEY = ["shop", "me"] as const
export const ONBOARDING_COMPLETION_QUERY_KEY = ["shop", "onboarding-complete"] as const

export class ShopApiError extends Error {
	readonly status: number

	constructor(message: string, status: number) {
		super(message)
		this.name = "ShopApiError"
		this.status = status
	}
}

const getMyShop = async () => {
	const response = await shopApi.shops.me.$get()
	const data = await response.json()

	if (!response.ok || !("data" in data)) {
		throw new ShopApiError(data.message ?? "Unable to load your shop.", response.status)
	}

	return data.data.shop
}

export type Shop = NonNullable<Awaited<ReturnType<typeof getMyShop>>>

export const getMyShopQueryOptions = () =>
	queryOptions({
		queryKey: GET_MY_SHOP_QUERY_KEY,
		queryFn: getMyShop,
		staleTime: Infinity,
	})

export const isShopUnauthorizedError = (error: unknown): error is ShopApiError =>
	error instanceof ShopApiError && error.status === 401

export const cacheCreatedShop = (queryClient: QueryClient, shop: Shop) => {
	queryClient.setQueryData(GET_MY_SHOP_QUERY_KEY, shop)
	queryClient.setQueryData(ONBOARDING_COMPLETION_QUERY_KEY, true)
}

export const refetchMyShop = async (queryClient: QueryClient) => {
	await queryClient.invalidateQueries({ queryKey: GET_MY_SHOP_QUERY_KEY, exact: true })
	return queryClient.fetchQuery({ ...getMyShopQueryOptions(), staleTime: 0 })
}

export const consumeOnboardingCompletion = (queryClient: QueryClient) => {
	if (queryClient.getQueryData(ONBOARDING_COMPLETION_QUERY_KEY) !== true) return false

	queryClient.removeQueries({ queryKey: ONBOARDING_COMPLETION_QUERY_KEY, exact: true })
	return true
}
