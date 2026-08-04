import { Button } from "@repo/ui/components/ui/button"
import { Loader } from "lucide-react"
import type { ComponentProps } from "react"

type Props = ComponentProps<typeof Button> & { isLoading: boolean | undefined }

export default function SubmitButton({ children, isLoading, disabled, ...props }: Props) {
	return (
		<Button disabled={disabled || isLoading} {...props}>
			{isLoading ? (
				<>
					<span>Loading...</span>
					<Loader data-icon="inline-end" className="animate-spin" />
				</>
			) : (
				children
			)}
		</Button>
	)
}
