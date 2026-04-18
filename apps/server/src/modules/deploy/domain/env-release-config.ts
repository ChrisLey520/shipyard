import { parseReleaseConfig, type ReleaseConfig } from '../../environments/domain/release-config.schema';

export function envReleaseConfig(raw: unknown | null | undefined): ReleaseConfig {
  if (raw == null) return parseReleaseConfig({});
  return parseReleaseConfig(raw);
}
