import { copyFile, mkdir, readdir, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const DEFAULT_KEEP = 10;

function ts(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    d.getFullYear() +
    p(d.getMonth() + 1) +
    p(d.getDate()) +
    "-" +
    p(d.getHours()) +
    p(d.getMinutes()) +
    p(d.getSeconds())
  );
}

/**
 * 对每个孩子的 CSV 做启动备份。
 * backups/<child-id>-YYYYMMDD-HHmmss.csv
 * 保留最近 keep 份，超出删除最旧。
 */
export async function backupChildFiles(
  childIds: ReadonlyArray<string>,
  recordsDir: string,
  backupsDir: string,
  keep = DEFAULT_KEEP
): Promise<string[]> {
  if (!existsSync(backupsDir)) {
    await mkdir(backupsDir, { recursive: true });
  }
  const created: string[] = [];
  for (const childId of childIds) {
    const src = path.join(recordsDir, `${childId}.csv`);
    if (!existsSync(src)) continue;
    const name = `${childId}-${ts()}.csv`;
    const dst = path.join(backupsDir, name);
    await copyFile(src, dst);
    created.push(dst);
    await pruneBackups(backupsDir, childId, keep);
  }
  return created;
}

async function pruneBackups(
  backupsDir: string,
  childId: string,
  keep: number
): Promise<void> {
  const entries = await readdir(backupsDir);
  const mine = entries
    .filter((f) => f.startsWith(`${childId}-`) && f.endsWith(".csv"))
    .sort(); // 时间戳字典序 = 时间顺序
  while (mine.length > keep) {
    const oldest = mine.shift()!;
    await unlink(path.join(backupsDir, oldest));
  }
}
