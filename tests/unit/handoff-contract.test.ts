import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

type Task = {
  id: string;
  status: "active" | "pending" | "completed";
  depends_on: string[];
};

type Queue = {
  project: string;
  active_task_id: string;
  tasks: Task[];
};

describe("Phase 1 execution handoff", () => {
  const queue = JSON.parse(
    readFileSync(new URL("../../docs/EXECUTION/TASK_QUEUE.json", import.meta.url), "utf8")
  ) as Queue;

  it("has exactly one active bounded packet", () => {
    const active = queue.tasks.filter((task) => task.status === "active");

    expect(queue.project).toBe("memoriesmystory");
    expect(active).toHaveLength(1);
    expect(active[0]?.id).toBe(queue.active_task_id);
  });

  it("orders every later packet behind its predecessor", () => {
    expect(queue.tasks.map((task) => task.id)).toEqual(
      Array.from({ length: 8 }, (_, index) => `packet-${index + 1}`)
    );

    for (const [index, task] of queue.tasks.entries()) {
      expect(task.depends_on).toEqual(index === 0 ? [] : [`packet-${index}`]);
    }
  });
});
