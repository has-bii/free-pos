const ALGORITHM = "pbkdf2-sha256"
const ITERATIONS = 50_000
const SALT_BYTES = 16
const KEY_BYTES = 32

const toBase64 = (bytes: Uint8Array): string => {
	return btoa(String.fromCharCode(...bytes))
}

const fromBase64 = (value: string): Uint8Array => {
	const binary = atob(value)
	const bytes = new Uint8Array(binary.length)
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i)
	}
	return bytes
}

const timingSafeEqual = (a: Uint8Array, b: Uint8Array): boolean => {
	if (a.length !== b.length) return false
	let diff = 0
	for (let i = 0; i < a.length; i++) {
		diff |= (a[i] ?? 0) ^ (b[i] ?? 0)
	}
	return diff === 0
}

const derive = async (password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> => {
	const keyMaterial = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, [
		"deriveBits",
	])
	const bits = await crypto.subtle.deriveBits(
		{ name: "PBKDF2", hash: "SHA-256", salt, iterations },
		keyMaterial,
		KEY_BYTES * 8,
	)
	return new Uint8Array(bits)
}

// Iteration count is capped by the Workers Free tier's 10ms CPU budget — see
// docs/prd/user-registration.md#43-password-hashing for the benchmark and trade-off.
const hashPassword = async (password: string): Promise<string> => {
	const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES))
	const hash = await derive(password, salt, ITERATIONS)
	return `${ALGORITHM}$${ITERATIONS}$${toBase64(salt)}$${toBase64(hash)}`
}

const verifyPassword = async (password: string, stored: string): Promise<boolean> => {
	const parts = stored.split("$")
	if (parts.length !== 4) return false
	const [algorithm, iterationsStr, saltBase64, hashBase64] = parts
	if (algorithm !== ALGORITHM) return false

	const iterations = Number(iterationsStr)
	if (!Number.isInteger(iterations) || iterations <= 0) return false

	let salt: Uint8Array
	let expectedHash: Uint8Array
	try {
		salt = fromBase64(saltBase64 as string)
		expectedHash = fromBase64(hashBase64 as string)
	} catch {
		return false
	}

	const derivedHash = await derive(password, salt, iterations)
	return timingSafeEqual(derivedHash, expectedHash)
}

export const Password = {
	hashPassword,
	verifyPassword,
}
