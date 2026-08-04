import LoginForm from "@repo/frontend/modules/auth/components/LoginForm"
import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/auth/login")({
	component: LoginForm,
})
