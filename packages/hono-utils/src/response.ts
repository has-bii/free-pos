export type SuccessResponse<T> = {
	success: true
	message: string
	data: T | null
}

export type ErrorResponse<T extends object = Record<string, unknown>> = {
	success: false
} & T

export const successResponse = <T>(message: string, data: T | null): SuccessResponse<T> => ({
	success: true,
	message,
	data,
})

export const errorResponse = <T extends object>(payload: T): ErrorResponse<T> =>
	({ ...payload, success: false }) as ErrorResponse<T>
