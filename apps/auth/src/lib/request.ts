export function requestMeta(c: {
	req: { header: (name: string) => string | undefined }
}) {
	return {
		ipAddress: c.req.header("CF-Connecting-IP") ?? null,
		userAgent: c.req.header("User-Agent") ?? null,
	}
}
