import { createBrowserClient } from "@supabase/ssr";

let client: ReturnType<typeof createBrowserClient> | undefined;
let loadingClient: Promise<ReturnType<typeof createBrowserClient>> | undefined;

export function createClient() {
  if (client) return Promise.resolve(client);
  if (!loadingClient) loadingClient = fetch("/api/config", { cache: "no-store" }).then(async (response) => {
    const config = await response.json() as { url?: string; publishableKey?: string; error?: string };
    if (!response.ok || !config.url || !config.publishableKey) throw new Error(config.error || "Supabase configuration is unavailable.");
    client = createBrowserClient(config.url, config.publishableKey);
    return client;
  });
  return loadingClient;
}
