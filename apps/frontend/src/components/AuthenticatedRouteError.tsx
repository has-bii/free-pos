import RouteError from "@repo/frontend/components/RouteError"
import { useAuth } from "@repo/frontend/modules/auth/context/AuthContext"
import {
	isShopUnauthorizedError,
	refetchMyShop,
	ShopApiError,
} from "@repo/frontend/modules/shop/queries/get-my-shop.query"
import { useQueryClient } from "@tanstack/react-query"
import type { ErrorComponentProps } from "@tanstack/react-router"
import { useRouter } from "@tanstack/react-router"

export default function AuthenticatedRouteError(props: ErrorComponentProps) {
	const queryClient = useQueryClient()
	const router = useRouter()
	const { logout } = useAuth()
	const isShopError = props.error instanceof ShopApiError

	const retryShopState = async () => {
		try {
			await refetchMyShop(queryClient)
		} catch (error) {
			if (!isShopUnauthorizedError(error)) throw error

			try {
				await logout()
			} catch {
				// The login redirect is still the correct outcome if logout fails.
			} finally {
				await router.navigate({ to: "/auth/login", replace: true })
			}

			return false
		}
	}

	const shopErrorProps = isShopError
		? {
				description: <p>Please retry before continuing to the POS.</p>,
				onRetry: retryShopState,
				title: "We couldn't load your shop setup",
			}
		: {}

	return <RouteError {...props} {...shopErrorProps} />
}
