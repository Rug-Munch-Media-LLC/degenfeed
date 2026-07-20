import type { Env } from "../index";
import { jsonResponse } from "../index";

interface CoinGeckoPrice {
	usd: number;
	usd_24h_change?: number;
}

export async function handlePrices(
	request: Request,
	env: Env,
): Promise<Response> {
	const url = new URL(request.url);
	const ids = url.searchParams.get("ids") || "bitcoin,ethereum,solana";
	const vsCurrencies = url.searchParams.get("vs_currencies") || "usd";
	const cacheKey = `prices:${ids}:${vsCurrencies}`;

	if (env.CACHE) {
		const cached = await env.CACHE.get(cacheKey);
		if (cached) return jsonResponse(JSON.parse(cached));
	}

	try {
		const res = await fetch(
			`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=${vsCurrencies}&include_24hr_change=true`,
			{ headers: { accept: "application/json" } },
		);
		if (!res.ok) throw new Error(`CoinGecko returned ${res.status}`);
		const data = (await res.json()) as Record<string, CoinGeckoPrice>;

		if (env.CACHE) {
			await env.CACHE.put(cacheKey, JSON.stringify(data), {
				expirationTtl: 60,
			});
		}

		return jsonResponse(data);
	} catch {
		return jsonResponse({ error: "Price feed unavailable" }, 502);
	}
}
