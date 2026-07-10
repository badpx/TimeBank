import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { loadConfig } from "./config-loader.js";
import { ChildStore, backupChildFiles } from "./store.js";
import { ScheduleStore } from "./schedule-store.js";
import { createApp } from "./app.js";

// 解析项目根目录：dist/index.js -> ../../.. 即仓库根
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..", "..", "..");

async function main() {
  const configPath = process.env.TIMEBANK_CONFIG || path.join(PROJECT_ROOT, "config/config.yaml");
  const recordsDir = process.env.TIMEBANK_DATA || path.join(PROJECT_ROOT, "data/records");
  const schedulesDir = process.env.TIMEBANK_SCHEDULES || path.join(PROJECT_ROOT, "data/schedules");
  const backupsDir = process.env.TIMEBANK_BACKUPS || path.join(PROJECT_ROOT, "backups");

  let config;
  try {
    config = loadConfig(configPath);
  } catch (e) {
    console.error((e as Error).message);
    process.exit(1);
  }

  // 时区
  const timezone = config.server.timezone || undefined;
  if (timezone) process.env.TZ = timezone;

  // 启动备份
  try {
    const backed = await backupChildFiles(
      config.children.map((c) => c.id),
      recordsDir,
      backupsDir
    );
    if (backed.length) {
      console.log(`已备份 ${backed.length} 个数据文件到 ${backupsDir}`);
    }
  } catch (e) {
    console.error("启动备份失败:", (e as Error).message);
    process.exit(1);
  }

  // 加载并校验每个孩子的流水
  const stores = new Map<string, ChildStore>();
  for (const child of config.children) {
    const file = path.join(recordsDir, `${child.id}.csv`);
    const store = new ChildStore(child.id, file);
    try {
      await store.load();
    } catch (e) {
      console.error((e as Error).message);
      process.exit(1);
    }
    stores.set(child.id, store);
  }

  // 加载并校验每个孩子的日程
  const scheduleStores = new Map<string, ScheduleStore>();
  for (const child of config.children) {
    const file = path.join(schedulesDir, `${child.id}.json`);
    const store = new ScheduleStore(child.id, file, config);
    try {
      await store.load();
    } catch (e) {
      console.error((e as Error).message);
      process.exit(1);
    }
    scheduleStores.set(child.id, store);
  }

  // 静态资源目录（生产构建产物）
  const staticDir = path.join(__dirname, "..", "public");

  const app = createApp({ config, stores, scheduleStores, timezone, staticDir });
  const { host, port } = config.server;
  app.listen(port, host, () => {
    const lanIp = getLanIp();
    console.log("TimeBank 已启动");
    console.log(`本机访问:   http://localhost:${port}`);
    if (lanIp) console.log(`局域网访问: http://${lanIp}:${port}`);
    console.log(`配置文件:   ${path.resolve(configPath)}`);
    console.log(`数据目录:   ${path.resolve(recordsDir)}`);
    console.log(`日程目录:   ${path.resolve(schedulesDir)}`);
    console.log(`备份目录:   ${path.resolve(backupsDir)}`);
  });
}

function getLanIp(): string | null {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === "IPv4" && !net.internal) {
        return net.address;
      }
    }
  }
  return null;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
