import { useQueryClient } from "@tanstack/react-query"
import { useRouter } from "@tanstack/react-router"
import { authApi } from "../lib/api"

export function useLogout() {
	const queryClient = useQueryClient()
	const router = useRouter()

	return async () => {
		try {
			await authApi.logout.$post()
		} finally {
			// Make the active auth query unauthenticated immediately. Removing an
			// active query alone can leave its observer holding the old user.
			queryClient.clear()
			await router.navigate({ to: "/auth/login" })
		}
	}
}
