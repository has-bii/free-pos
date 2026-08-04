import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@repo/ui/components/ui/input-group"
import { Eye, EyeOff } from "lucide-react"
import { type ComponentProps, useState } from "react"

type Props = ComponentProps<typeof InputGroupInput>

export default function InputPassword(props: Props) {
	const [showPassword, setShowPassword] = useState(false)

	return (
		<InputGroup>
			<InputGroupInput {...props} type={showPassword ? "text" : "password"} />
			<InputGroupAddon align="inline-end">
				<InputGroupButton
					type="button"
					size="icon-xs"
					aria-label={showPassword ? "Hide password" : "Show password"}
					onClick={() => setShowPassword((prev) => !prev)}
				>
					{showPassword ? <EyeOff /> : <Eye />}
				</InputGroupButton>
			</InputGroupAddon>
		</InputGroup>
	)
}
