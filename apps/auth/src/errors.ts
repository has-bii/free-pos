export class EmailAlreadyExistsError extends Error {
	constructor(email: string) {
		super(`Email already registered: ${email}`)
		this.name = "EmailAlreadyExistsError"
	}
}
