import { APP_NAME } from "@repo/frontend/lib/config"
import { getMeQueryOption } from "@repo/frontend/modules/auth/queries/get-me.query"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { LoaderCircle } from "lucide-react"
import type { PropsWithChildren } from "react"
import { createContext, useContext } from "react"
import { authApi } from "../lib/api"

export interface AuthContextType {
	isLoading: boolean
	isAuthenticated: boolean
	logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: PropsWithChildren) {
	const meQuery = useQuery(getMeQueryOption())
	const queryClient = useQueryClient()

	const logout = async () => {
		try {
			await authApi.logout.$post()
		} finally {
			queryClient.clear()
			await meQuery.refetch()
		}
	}

	const auth: AuthContextType = {
		isLoading: meQuery.isPending,
		isAuthenticated: Boolean(meQuery.data),
		logout,
	}

	if (auth.isLoading) {
		return (
			<div className="flex min-h-svh flex-col items-center justify-center gap-4" role="status" aria-live="polite">
				<span className="text-lg font-semibold">{APP_NAME}</span>
				<LoaderCircle className="size-6 animate-spin" aria-hidden="true" />
				<span className="sr-only">Loading authentication state</span>
			</div>
		)
	}

	return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextType {
	const auth = useContext(AuthContext)
	if (!auth) throw new Error("useAuth must be used within AuthProvider")
	return auth
}
