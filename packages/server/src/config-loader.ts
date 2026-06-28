import { readFileSync } from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import {
  configSchema,
  validateConfigSemantics,
  type AppConfig,
  type ConfigDiagnostic,
} from "@timebank/shared";

export interface ConfigLoadResult {
  config: AppConfig;
  diagnostics: ConfigDiagnostic[];
}

export class ConfigError extends Error {
  constructor(public diagnostics: ConfigDiagnostic[]) {
    super(
      "配置校验失败：\n" +
        diagnostics.map((d) => `  - ${d.path}: ${d.message}`).join("\n")
    );
    this.name = "ConfigError";
  }
}

/**
 * 加载并校验 YAML 配置。
 * 任一错误抛出 ConfigError，附带可定位诊断。
 */
export function loadConfig(configPath: string): AppConfig {
  const abs = path.resolve(configPath);
  let raw: unknown;
  try {
    const text = readFileSync(abs, "utf8");
    raw = yaml.load(text);
  } catch (e) {
    throw new ConfigError([
      {
        path: abs,
        message: `YAML 解析失败: ${(e as Error).message}`,
      },
    ]);
  }

  const parsed = configSchema.safeParse(raw);
  if (!parsed.success) {
    const diags: ConfigDiagnostic[] = parsed.error.issues.map((iss) => ({
      path: iss.path.length ? iss.path.join(".") : "(root)",
      message: iss.message,
    }));
    throw new ConfigError(diags);
  }

  const semDiags = validateConfigSemantics(parsed.data);
  if (semDiags.length > 0) {
    throw new ConfigError(semDiags);
  }

  return parsed.data;
}
