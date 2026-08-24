import { TASK_CATEGORIES, type Task, type TaskCategory } from "./types";
import type { TaskboardLanguage } from "./i18n";

export const OUTPUT_LABEL_CATEGORY: Record<string, TaskCategory> = {
  "output-web": "web",
  "output-code": "code",
  "output-spreadsheet": "spreadsheet",
  "output-document": "document",
  "output-image": "image",
  "output-video": "video",
  "output-copy": "copy",
  "output-research": "research",
  "output-automation": "automation",
  "output-action": "action",
  "output-task": "task",
};

const CATEGORY_LABELS: Record<TaskCategory, readonly [string, string]> = {
  web: ["网页", "Web"],
  code: ["代码", "Code"],
  spreadsheet: ["Excel", "Excel"],
  document: ["Word/文档", "Word/Doc"],
  image: ["图片", "Image"],
  video: ["视频", "Video"],
  copy: ["文案", "Copy"],
  research: ["研究/报告", "Research"],
  automation: ["自动化", "Automation"],
  action: ["操作", "Action"],
  task: ["任务", "Task"],
};

export function taskCategoryLabel(category: string | null | undefined, language: TaskboardLanguage): string {
  if (!category) return language === "zh" ? "未分类" : "Uncategorized";
  const known = CATEGORY_LABELS[category as TaskCategory];
  if (known) return language === "zh" ? known[0] : known[1];
  return category;
}

export function inferTaskCategory(task: Pick<Task, "category" | "labels">): string | null {
  if (task.category) return task.category;
  const outputLabel = task.labels.find((label) => OUTPUT_LABEL_CATEGORY[label]);
  return outputLabel ? OUTPUT_LABEL_CATEGORY[outputLabel] : null;
}

export function allTaskCategories(tasks: Task[]): string[] {
  const discovered = new Set(tasks.map(inferTaskCategory).filter((value): value is string => Boolean(value)));
  return [
    ...TASK_CATEGORIES.filter((category) => discovered.has(category)),
    ...[...discovered].filter((category) => !TASK_CATEGORIES.includes(category as TaskCategory)).sort(),
  ];
}
