import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { actorKey } from "../actors";
import { labelDisplayName } from "../labels";
import {
  taskPriorityLabel,
  taskStatusLabel,
  useTaskboardI18n,
} from "../i18n";
import {
  EMPTY_TASK_FILTERS,
  matchesTaskFilters,
  matchesTaskSearch,
  taskFilterCount,
  type TaskFilterKey,
  type TaskFilters,
} from "../taskFilters";
import { inferTaskCategory, taskCategoryLabel } from "../taskCategories";
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  type Task,
  type TaskPriority,
  type TaskStatus,
} from "../types";
import { LinearIcon } from "./LinearIcon";
import { TaskboardIcon } from "./TaskboardIcon";

interface TaskFilterMenuProps {
  tasks: Task[];
  search: string;
  labels: string[];
  filters: TaskFilters;
  onChange: (filters: TaskFilters) => void;
}

interface CountedOption<T extends string = string> {
  value: T;
  label: string;
  count: number;
}

interface MultiSelectDropdownProps<T extends string> {
  id: string;
  label: string;
  emptyLabel: string;
  options: CountedOption<T>[];
  values: T[];
  open: boolean;
  onOpen: () => void;
  onChange: (values: T[]) => void;
}

function sortByCountThenLabel<T extends string>(options: CountedOption<T>[]): CountedOption<T>[] {
  return [...options].sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
}

function toggleValue<T extends string>(values: T[], value: T, order: T[]): T[] {
  const selected = new Set(values);
  if (selected.has(value)) selected.delete(value);
  else selected.add(value);
  return order.filter((candidate) => selected.has(candidate));
}

function selectedSummary<T extends string>(options: CountedOption<T>[], values: T[], emptyLabel: string): string {
  if (!values.length) return emptyLabel;
  const labels = values.map((value) => options.find((option) => option.value === value)?.label ?? value);
  return labels.length <= 2 ? labels.join(", ") : `${labels.length}`;
}

function MultiSelectDropdown<T extends string>({
  id,
  label,
  emptyLabel,
  options,
  values,
  open,
  onOpen,
  onChange,
}: MultiSelectDropdownProps<T>) {
  const orderedValues = options.map((option) => option.value);
  return (
    <div className="task-filter-field">
      <span>{label}</span>
      <div className="task-filter-select">
        <button
          type="button"
          className={`task-filter-select-trigger${values.length ? " is-selected" : ""}`}
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={onOpen}
        >
          <span>{selectedSummary(options, values, emptyLabel)}</span>
          <LinearIcon name="chevronDown" />
        </button>
        {open && (
          <div className="task-filter-select-menu" role="listbox" aria-label={label}>
            {options.length === 0 && <div className="task-filter-select-empty">{emptyLabel}</div>}
            {options.map((option) => {
              const selected = values.includes(option.value);
              return (
                <button
                  key={`${id}-${option.value}`}
                  type="button"
                  className={`task-filter-select-option${selected ? " is-selected" : ""}`}
                  role="option"
                  aria-selected={selected}
                  onClick={() => onChange(toggleValue(values, option.value, orderedValues))}
                >
                  <span className="task-filter-option-check">{selected && <LinearIcon name="check" />}</span>
                  <span className="task-filter-option-label">{option.label}</span>
                  <span className="task-filter-option-count">{option.count}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export function TaskFilterMenu({ tasks, search, labels: _labels, filters, onChange }: TaskFilterMenuProps) {
  const { language, text } = useTaskboardI18n();
  const [open, setOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [draft, setDraft] = useState<TaskFilters>(filters);
  const activeCount = taskFilterCount(filters);

  useEffect(() => {
    if (open) {
      setDraft(filters);
      setOpenDropdown(null);
    }
  }, [filters, open]);

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select, [contenteditable='true']")) return;
      if (event.key.toLowerCase() === "f" && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        setOpen((current) => !current);
      }
    }

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  useEffect(() => {
    if (!open) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (openDropdown) setOpenDropdown(null);
        else setOpen(false);
      }
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open, openDropdown]);

  function countFor(key: TaskFilterKey, predicate: (task: Task) => boolean): number {
    return tasks.filter(
      (task) => matchesTaskSearch(task, search, language)
        && matchesTaskFilters(task, draft, key)
        && predicate(task),
    ).length;
  }

  const statusOptions = useMemo<CountedOption<TaskStatus>[]>(() => sortByCountThenLabel(
    TASK_STATUSES.map((status) => ({
      value: status,
      label: taskStatusLabel(language, status),
      count: countFor("statuses", (task) => task.status === status),
    })).filter((option) => option.count > 0 || draft.statuses.includes(option.value)),
  ), [draft, language, search, tasks]);

  const priorityOptions = useMemo<CountedOption<TaskPriority>[]>(() => sortByCountThenLabel(
    TASK_PRIORITIES.map((priority) => ({
      value: priority,
      label: taskPriorityLabel(language, priority),
      count: countFor("priorities", (task) => task.priority === priority),
    })).filter((option) => option.count > 0 || draft.priorities.includes(option.value)),
  ), [draft, language, search, tasks]);

  const categoryOptions = useMemo<CountedOption[]>(() => {
    const values = new Set(tasks.map(inferTaskCategory).filter((value): value is string => Boolean(value)));
    draft.categories.forEach((category) => values.add(category));
    return sortByCountThenLabel([...values].map((category) => ({
      value: category,
      label: taskCategoryLabel(category, language),
      count: countFor("categories", (task) => inferTaskCategory(task) === category),
    })).filter((option) => option.count > 0 || draft.categories.includes(option.value)));
  }, [draft, language, search, tasks]);

  const labelOptions = useMemo<CountedOption[]>(() => {
    const values = new Set(tasks.flatMap((task) => task.labels));
    draft.labels.forEach((label) => values.add(label));
    return sortByCountThenLabel([...values].map((label) => ({
      value: label,
      label: labelDisplayName(label, language),
      count: countFor("labels", (task) => task.labels.includes(label)),
    })).filter((option) => option.count > 0 || draft.labels.includes(option.value)));
  }, [draft, language, search, tasks]);

  const assigneeOptions = useMemo<CountedOption[]>(() => {
    const actors = new Map<string, string>();
    for (const task of tasks) actors.set(actorKey(task.assignee), task.assignee.name);
    draft.assignees.forEach((assignee) => {
      if (!actors.has(assignee)) actors.set(assignee, assignee);
    });
    return sortByCountThenLabel([...actors].map(([assignee, label]) => ({
      value: assignee,
      label,
      count: countFor("assignees", (task) => actorKey(task.assignee) === assignee),
    })).filter((option) => option.count > 0 || draft.assignees.includes(option.value)));
  }, [draft, search, tasks]);

  function applyFilters() {
    onChange(draft);
    setOpen(false);
  }

  function resetFilters() {
    setDraft(EMPTY_TASK_FILTERS);
    setOpenDropdown(null);
    onChange(EMPTY_TASK_FILTERS);
  }

  function dropdown(node: ReactNode) {
    return <div onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) setOpenDropdown(null);
    }}>{node}</div>;
  }

  const panel = open ? createPortal(
    <div className="task-filter-drawer-layer" role="presentation">
      <button
        type="button"
        className="task-filter-drawer-backdrop"
        aria-label={text("关闭筛选", "Close filters")}
        onClick={() => setOpen(false)}
      />
      <aside className="task-filter-drawer" aria-label={text("筛选任务", "Filter tasks")}>
        <header className="task-filter-drawer-header">
          <div>
            <h2>{text("筛选", "Filters")}</h2>
            <p>{text("按实际任务统计筛选项，数量多的排在前面", "Options are counted from visible tasks and sorted by count")}</p>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label={text("关闭筛选", "Close filters")}
            onClick={() => setOpen(false)}
          >
            <LinearIcon name="close" />
          </button>
        </header>

        <div className="task-filter-drawer-body">
          {dropdown((
            <MultiSelectDropdown
              id="statuses"
              label={text("状态", "Status")}
              emptyLabel={text("全部状态", "All statuses")}
              options={statusOptions}
              values={draft.statuses}
              open={openDropdown === "statuses"}
              onOpen={() => setOpenDropdown((current) => current === "statuses" ? null : "statuses")}
              onChange={(statuses) => setDraft((current) => ({ ...current, statuses }))}
            />
          ))}

          {dropdown((
            <MultiSelectDropdown
              id="priorities"
              label={text("优先级", "Priority")}
              emptyLabel={text("全部优先级", "All priorities")}
              options={priorityOptions}
              values={draft.priorities}
              open={openDropdown === "priorities"}
              onOpen={() => setOpenDropdown((current) => current === "priorities" ? null : "priorities")}
              onChange={(priorities) => setDraft((current) => ({ ...current, priorities }))}
            />
          ))}

          {dropdown((
            <MultiSelectDropdown
              id="categories"
              label={text("类别", "Category")}
              emptyLabel={text("全部类别", "All categories")}
              options={categoryOptions}
              values={draft.categories}
              open={openDropdown === "categories"}
              onOpen={() => setOpenDropdown((current) => current === "categories" ? null : "categories")}
              onChange={(categories) => setDraft((current) => ({ ...current, categories }))}
            />
          ))}

          {dropdown((
            <MultiSelectDropdown
              id="labels"
              label={text("标签", "Labels")}
              emptyLabel={text("全部标签", "All labels")}
              options={labelOptions}
              values={draft.labels}
              open={openDropdown === "labels"}
              onOpen={() => setOpenDropdown((current) => current === "labels" ? null : "labels")}
              onChange={(nextLabels) => setDraft((current) => ({ ...current, labels: nextLabels }))}
            />
          ))}

          {dropdown((
            <MultiSelectDropdown
              id="assignees"
              label={text("负责人", "Assignee")}
              emptyLabel={text("全部负责人", "All assignees")}
              options={assigneeOptions}
              values={draft.assignees}
              open={openDropdown === "assignees"}
              onOpen={() => setOpenDropdown((current) => current === "assignees" ? null : "assignees")}
              onChange={(assignees) => setDraft((current) => ({ ...current, assignees }))}
            />
          ))}

          <label className="task-filter-field">
            <span>{text("内容", "Content")}</span>
            <input
              value={draft.content}
              placeholder={text("搜索标题或描述", "Search title or description")}
              onFocus={() => setOpenDropdown(null)}
              onChange={(event) => setDraft((current) => ({ ...current, content: event.target.value }))}
            />
          </label>
        </div>

        <footer className="task-filter-drawer-footer">
          <button type="button" className="secondary-button" onClick={resetFilters}>
            {text("重置", "Reset")}
          </button>
          <button type="button" className="primary-button" onClick={applyFilters}>
            {text("搜索", "Search")}
          </button>
        </footer>
      </aside>
    </div>,
    document.body,
  ) : null;

  return (
    <>
      <button
        type="button"
        className={`task-filter-trigger${activeCount ? " is-active" : ""}${open ? " is-open" : ""}`}
        aria-label={activeCount
          ? text(`筛选任务，已启用 ${activeCount} 个条件`, `Filter tasks, ${activeCount} active`)
          : text("筛选任务", "Filter tasks")}
        title={activeCount
          ? text(`已启用 ${activeCount} 个筛选条件 (F)`, `${activeCount} active filters (F)`)
          : text("筛选任务 (F)", "Filter tasks (F)")}
        onClick={() => setOpen(true)}
      >
        <TaskboardIcon name="filter" className="filter-icon" />
        {activeCount > 0 && <span className="task-filter-active-dot" aria-hidden="true" />}
      </button>
      {panel}
    </>
  );
}
