import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

type TaskStatus = "active" | "pending" | "completed" | "paused";

type Task = {
  id: string;
  status: TaskStatus;
  depends_on: string[];
};

type Queue = {
  project: string;
  active_task_id: string;
  tasks: Task[];
};

describe("Living Memory execution handoff", () => {
  const queue = JSON.parse(
    readFileSync(new URL("../../docs/EXECUTION/TASK_QUEUE.json", import.meta.url), "utf8")
  ) as Queue;

  it("has exactly one active bounded task", () => {
    const active = queue.tasks.filter((task) => task.status === "active");

    expect(queue.project).toBe("memoriesmystory");
    expect(active).toHaveLength(1);
    expect(active[0]?.id).toBe(queue.active_task_id);
  });

  it("uses a valid forward-only dependency graph", () => {
    const positions = new Map(queue.tasks.map((task, index) => [task.id, index]));
    expect(new Set(queue.tasks.map((task) => task.id)).size).toBe(queue.tasks.length);

    for (const [index, task] of queue.tasks.entries()) {
      expect(task.depends_on).not.toContain(task.id);
      for (const dependency of task.depends_on) {
        expect(positions.has(dependency)).toBe(true);
        expect(positions.get(dependency)).toBeLessThan(index);
      }
    }
  });

  it("preserves prior packet evidence and advances from ratification to landing positioning", () => {
    const statusById = new Map(queue.tasks.map((task) => [task.id, task.status]));

    expect(statusById.get("packet-1")).toBe("completed");
    expect(statusById.get("packet-2")).toBe("completed");
    expect(statusById.get("packet-3")).toBe("completed");
    expect(statusById.get("packet-4")).toBe("paused");
    expect(statusById.get("living-memory-ratification")).toBe("completed");
    expect(statusById.get("landing-positioning")).toBe("active");
    expect(queue.active_task_id).toBe("landing-positioning");
  });
});
