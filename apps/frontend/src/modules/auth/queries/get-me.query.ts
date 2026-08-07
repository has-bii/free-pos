import { queryOptions } from "@tanstack/react-query"
import { authApi } from "../lib/api"

export const GET_ME_QUERY_KEY = ["me"] as const

export const getMeQueryOption = () => {
	return queryOptions({
		queryKey: GET_ME_QUERY_KEY,
		queryFn: async () => {
			const res = await authApi.me.$get()

			if (res.ok) {
				const data = await res.json()
				return data.data.user
			}

			const data = await res.json()

			throw new Error(data.message ?? "Unexpected error has occurred")
		},
	})
}
