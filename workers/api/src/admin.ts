export function authenticateApiKey(
	authHeader: string,
	...expectedKeys: (string | undefined)[]
): { ok: boolean } {
	const token = authHeader.replace(/^Bearer\s+/i, "").trim();
	return {
		ok:
			token !== "" &&
			expectedKeys.some((k) => k !== undefined && k !== "" && token === k),
	};
}
