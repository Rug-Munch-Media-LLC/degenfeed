declare var process: { env: Record<string, string | undefined> } | undefined;

export function getEnv(key: string): string {
  if (process?.env) {
    const v = process.env[key];
    return v ?? '';
  }
  return '';
}

export function getEnvOrDefault(key: string, defaultValue: string): string {
  const v = getEnv(key);
  return v || defaultValue;
}

export function hasEnv(key: string): boolean {
  return getEnv(key) !== '';
}
