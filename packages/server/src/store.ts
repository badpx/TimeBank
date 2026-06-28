import { writeFile, appendFile, mkdir } from "node:fs/promises";
import { existsSync, createReadStream } from "node:fs";
import path from "node:path";
import { parse } from "csv-parse";
import { stringify } from "csv-stringify";
import {
  CSV_HEADER,
  CSV_COLUMNS,
  csvFieldsToRecord,
  recordToCsvFields,
  type Record,
} from "@timebank/shared";

export class RecordError extends Error {
  constructor(public diagnostics: { file: string; row: number; message: string }[]) {
    super(
      "交易记录校验失败：\n" +
        diagnostics
          .map((d) => `  - ${d.file} 第 ${d.row} 行: ${d.message}`)
          .join("\n")
    );
    this.name = "RecordError";
  }
}

export interface RecordDiagnostic {
  file: string;
  row: number;
  message: string;
}

/**
 * 每童一个存储实例：加载/校验/顺序写入/幂等。
 * 同一孩子的并发写通过 promise 链串行化；不同孩子互不影响。
 */
export class ChildStore {
  private records: Record[] = [];
  private chain: Promise<unknown> = Promise.resolve();
  private readonly filePath: string;
  private readonly childId: string;

  constructor(childId: string, filePath: string) {
    this.childId = childId;
    this.filePath = filePath;
  }

  /** 启动时调用：确保文件存在（缺失则写表头），加载并校验全部记录 */
  async load(): Promise<void> {
    if (!existsSync(this.filePath)) {
      await mkdir(path.dirname(this.filePath), { recursive: true });
      await writeFile(this.filePath, CSV_HEADER + "\n", "utf8");
      this.records = [];
      return;
    }
    await this.loadAndValidate();
  }

  private async loadAndValidate(): Promise<void> {
    const rows: string[][] = [];
    await new Promise<void>((resolve, reject) => {
      const stream = createReadStream(this.filePath, "utf8");
      const parser = parse({
        columns: false,
        skip_empty_lines: true,
        trim: true,
      });
      stream.on("error", reject);
      parser.on("error", reject);
      parser.on("data", (row: string[]) => rows.push(row));
      parser.on("end", () => resolve());
      stream.pipe(parser);
    });

    if (rows.length === 0) {
      // 空文件或只有表头被 trim 掉的情况
      this.records = [];
      return;
    }

    // 第一行应为表头
    const header = rows[0];
    const expectedHeader = [...CSV_COLUMNS];
    const diags: RecordDiagnostic[] = [];

    const headerMatch =
      header.length === expectedHeader.length &&
      header.every((h, i) => h === expectedHeader[i]);

    const dataRows = headerMatch ? rows.slice(1) : rows;
    const recs: Record[] = [];

    dataRows.forEach((fields, idx) => {
      const rowNo = headerMatch ? idx + 2 : idx + 1;
      if (fields.length !== CSV_COLUMNS.length) {
        diags.push({
          file: this.filePath,
          row: rowNo,
          message: `列数错误: 期望 ${CSV_COLUMNS.length}, 实际 ${fields.length}`,
        });
        return;
      }
      try {
        const r = csvFieldsToRecord(fields);
        if (r.childId !== this.childId) {
          diags.push({
            file: this.filePath,
            row: rowNo,
            message: `child_id 不匹配: 文件属于 ${this.childId}, 记录为 ${r.childId}`,
          });
          return;
        }
        if (r.recordType === "task_checkin" && r.entertainmentMinutes <= 0) {
          diags.push({
            file: this.filePath,
            row: rowNo,
            message: `task_checkin 的 entertainment_minutes 必须为正`,
          });
          return;
        }
        if (r.recordType === "entertainment_redeem" && r.entertainmentMinutes >= 0) {
          diags.push({
            file: this.filePath,
            row: rowNo,
            message: `entertainment_redeem 的 entertainment_minutes 必须为负`,
          });
          return;
        }
        recs.push(r);
      } catch (e) {
        diags.push({
          file: this.filePath,
          row: rowNo,
          message: (e as Error).message,
        });
      }
    });

    // 语义校验：id 唯一、非空 requestId 唯一
    const idSet = new Set<string>();
    const reqSet = new Set<string>();
    recs.forEach((r, idx) => {
      const rowNo = headerMatch ? idx + 2 : idx + 1;
      if (idSet.has(r.id)) {
        diags.push({
          file: this.filePath,
          row: rowNo,
          message: `重复的记录 ID: ${r.id}`,
        });
      } else idSet.add(r.id);
      if (r.requestId && reqSet.has(r.requestId)) {
        diags.push({
          file: this.filePath,
          row: rowNo,
          message: `重复的 request_id: ${r.requestId}`,
        });
      } else if (r.requestId) reqSet.add(r.requestId);
    });

    if (diags.length > 0) throw new RecordError(diags);
    this.records = recs;
  }

  getRecords(): ReadonlyArray<Record> {
    return this.records;
  }

  /** 幂等检查：若 requestId 已存在则返回既有记录，否则返回 null */
  findByRequestId(requestId: string): Record | null {
    if (!requestId) return null;
    for (const r of this.records) {
      if (r.requestId === requestId) return r;
    }
    return null;
  }

  /**
   * 追加一条记录。序列化 → appendFile → fsync 后才更新内存并返回。
   * 通过 promise 链保证同孩子顺序。
   */
  append(record: Record): Promise<Record> {
    this.chain = this.chain.then(() => this.doAppend(record));
    return this.chain as Promise<Record>;
  }

  private async doAppend(record: Record): Promise<Record> {
    const fields = recordToCsvFields(record);
    const line: string = await new Promise((resolve, reject) => {
      stringify([fields], (err, output) => {
        if (err) reject(err);
        else resolve(output);
      });
    });
    // 确保以换行结尾
    const chunk = line.endsWith("\n") ? line : line + "\n";
    const fh = await appendFile(this.filePath, chunk, "utf8");
    // appendFile 已 flush；显式 sync 通过打开文件句柄 fsync 更稳妥
    await syncFile(this.filePath);
    void fh;
    this.records.push(record);
    return record;
  }
}

import { open } from "node:fs/promises";
async function syncFile(filePath: string): Promise<void> {
  const handle = await open(filePath, "r");
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

/** 启动备份：复制 CSV 到 backups/ 目录，时间戳命名，保留最近 N 份 */
export { backupChildFiles } from "./backup.js";
