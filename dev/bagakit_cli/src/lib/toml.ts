import { parseTomlFile as parseValidatorTomlFile } from "../../../validator/src/lib/toml.ts";

export function parseTomlFile(filePath: string, _label = filePath): unknown {
  return parseValidatorTomlFile(filePath);
}
