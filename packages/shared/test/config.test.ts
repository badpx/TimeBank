import { describe, it, expect } from "vitest";
import { configSchema, validateConfigSemantics } from "../src/config.js";

const validBase = {
  children: [
    { id: "alice", name: "Alice", avatar: "🦊", pin: "1234", enabled: true },
    { id: "bob", name: "Bob", avatar: "🐻", pin: "5678", enabled: true },
  ],
  tasks: [
    {
      id: "read",
      name: "阅读",
      category: "reading",
      taskMinutes: 30,
      rewardMinutes: 15,
      childIds: ["*"],
      dailyLimit: 2,
      enabled: true,
    },
  ],
  redemptionOptions: [15, 30, 60],
  encouragements: ["真棒！", "继续加油！"],
  session: { lifetimeDays: 30 },
  server: {
    host: "0.0.0.0",
    port: 3000,
    sessionSecret: "this-is-a-long-secret-16+",
  },
};

describe("configSchema", () => {
  it("parses valid config with defaults", () => {
    const c = configSchema.parse(validBase);
    expect(c.children).toHaveLength(2);
    expect(c.tasks[0].childIds).toEqual(["*"]);
    expect(c.session.lifetimeDays).toBe(30);
  });

  it("rejects bad pin", () => {
    const bad = { ...validBase, children: [{ ...validBase.children[0], pin: "12a4" }] };
    expect(() => configSchema.parse(bad)).toThrow();
  });

  it("rejects empty children", () => {
    const bad = { ...validBase, children: [] };
    expect(() => configSchema.parse(bad)).toThrow();
  });

  it("rejects empty redemptionOptions", () => {
    const bad = { ...validBase, redemptionOptions: [] };
    expect(() => configSchema.parse(bad)).toThrow();
  });
});

describe("validateConfigSemantics", () => {
  it("passes for valid config", () => {
    const c = configSchema.parse(validBase);
    expect(validateConfigSemantics(c)).toEqual([]);
  });

  it("flags duplicate child ids", () => {
    const c = configSchema.parse({
      ...validBase,
      children: [
        { id: "alice", name: "A", avatar: "🦊", pin: "1234", enabled: true },
        { id: "alice", name: "B", avatar: "🐻", pin: "5678", enabled: true },
      ],
    });
    const diags = validateConfigSemantics(c);
    expect(diags.some((d) => d.message.includes("alice"))).toBe(true);
  });

  it("flags no enabled children", () => {
    const c = configSchema.parse({
      ...validBase,
      children: [
        { id: "alice", name: "A", avatar: "🦊", pin: "1234", enabled: false },
        { id: "bob", name: "B", avatar: "🐻", pin: "5678", enabled: false },
      ],
    });
    const diags = validateConfigSemantics(c);
    expect(diags.some((d) => d.message.includes("至少需要 1 个启用"))).toBe(true);
  });

  it("flags task referencing unknown child", () => {
    const c = configSchema.parse({
      ...validBase,
      tasks: [
        {
          id: "read",
          name: "阅读",
          category: "reading",
          taskMinutes: 30,
          rewardMinutes: 15,
          childIds: ["ghost"],
          dailyLimit: 2,
          enabled: true,
        },
      ],
    });
    const diags = validateConfigSemantics(c);
    expect(diags.some((d) => d.message.includes("ghost"))).toBe(true);
  });

  it("flags short sessionSecret at schema level", () => {
    expect(() =>
      configSchema.parse({
        ...validBase,
        server: { host: "0.0.0.0", port: 3000, sessionSecret: "short" },
      })
    ).toThrow();
  });
});
