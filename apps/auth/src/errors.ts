export class EmailAlreadyExistsError extends Error {
	constructor(email: string) {
		super(`Email already registered: ${email}`)
		this.name = "EmailAlreadyExistsError"
	}
}

/** The same Google identity was claimed by another local user. */
export class GoogleAccountConflictError extends Error {
	constructor() {
		super("Google account is already linked to another user")
		this.name = "GoogleAccountConflictError"
	}
}
