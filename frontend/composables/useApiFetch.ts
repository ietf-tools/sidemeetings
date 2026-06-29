export function useApiFetch<T = unknown>(
  path: string,
  options: Record<string, unknown> = {}
): Promise<T> {
  const config = useRuntimeConfig()

  // Pre-serialize plain-object bodies ourselves. ofetch's isJSONSerializable()
  // heuristic treats any body with a truthy `buffer` property as a binary blob
  // (it's meant to detect TypedArray.buffer), so a payload field literally named
  // `buffer` makes ofetch skip JSON.stringify and send "[object Object]".
  const opts = { ...options }
  const body = opts.body
  if (
    body &&
    typeof body === 'object' &&
    Object.getPrototypeOf(body) === Object.prototype
  ) {
    opts.body = JSON.stringify(body)
    opts.headers = {
      'content-type': 'application/json',
      ...(opts.headers as Record<string, string>)
    }
  }

  return $fetch<T>(config.public.apiUrl + path, {
    credentials: 'include',
    ...opts
  })
}
