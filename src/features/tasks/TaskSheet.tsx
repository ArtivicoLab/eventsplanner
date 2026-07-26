// Add / edit sheet for a single Event Task — every task belongs to exactly
// one Event (the Event picker below is required unless the caller already
// knows the event, e.g. opened from inside an Event's own detail screen).
import { useMemo, useState } from "react";
import { BottomSheet } from "../../components/BottomSheet";
import { confirmDialog } from "../../stores/useConfirm";
import { useEventTasks } from "../../stores/useEventTasks";
import { useEvents } from "../../stores/useEvents";
import { useSettings } from "../../stores/useSettings";
import { PRIORITY_LABEL, TASK_STATUS_LABEL } from "../../lib/ui";
import { PRIORITIES, TASK_STATUSES, type Priority, type TaskStatus } from "../../lib/types";

interface Props {
  open: boolean;
  taskId: string | null;
  defaultEventId?: string;
  onClose: () => void;
}

export function TaskSheet({ open, taskId, defaultEventId, onClose }: Props) {
  const { items: tasks, add, update, remove } = useEventTasks();
  const { items: events } = useEvents();
  const { owners } = useSettings();

  const editing = taskId !== null;
  const editingTask = editing ? tasks.find((t) => t.id === taskId) ?? null : null;
  // Only lock the picker for a brand-new task opened with a known event
  // context — editing an existing task always shows the real, editable
  // picker so a mis-filed task can be moved to the right event.
  const lockEvent = !editing && !!defaultEventId;

  const [eventId, setEventId] = useState("");
  const [task, setTask] = useState("");
  const [priority, setPriority] = useState<Priority>("Medium");
  const [status, setStatus] = useState<TaskStatus>("NotStarted");
  const [dueDate, setDueDate] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [notes, setNotes] = useState("");

  // Reset fields on the open transition (and if the target task itself
  // changes while the sheet stays mounted) — never carry stale values into
  // the next time this form is shown.
  useMemo(() => {
    if (!open) return;
    if (editingTask) {
      setEventId(editingTask.eventId);
      setTask(editingTask.task);
      setPriority(editingTask.priority);
      setStatus(editingTask.status);
      setDueDate(editingTask.dueDate);
      setAssignedTo(editingTask.assignedTo);
      setNotes(editingTask.notes);
    } else {
      setEventId(defaultEventId ?? "");
      setTask("");
      setPriority("Medium");
      setStatus("NotStarted");
      setDueDate("");
      setAssignedTo("");
      setNotes("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, taskId, defaultEventId]);

  const eventName = events.find((e) => e.id === eventId)?.name || "";
  const canSave = task.trim() !== "" && eventId !== "";

  function save() {
    if (!canSave) return;
    const patch = {
      eventId,
      task: task.trim(),
      priority,
      status,
      dueDate,
      assignedTo: assignedTo.trim(),
      notes,
    };
    if (editing && taskId) update(taskId, patch);
    else add(patch);
    onClose();
  }

  async function onDelete() {
    if (!taskId) return;
    const ok = await confirmDialog({
      title: "Delete this task?",
      message: `"${task || "This task"}" will be removed for good.`,
      confirmLabel: "Delete task",
      danger: true,
    });
    if (!ok) return;
    remove(taskId);
    onClose();
  }

  return (
    <BottomSheet open={open} onClose={onClose} title={editing ? "Edit task" : "New task"}>
      <div className="field">
        <label className="field__label" htmlFor="task-event">Event</label>
        {lockEvent ? (
          <div className="input" style={{ opacity: 0.7 }} aria-disabled="true">
            {eventName || "—"}
          </div>
        ) : (
          <select
            id="task-event"
            className="select"
            value={eventId}
            onChange={(e) => setEventId(e.target.value)}
          >
            <option value="" disabled>
              {events.length ? "Choose an event…" : "No events yet — create one first"}
            </option>
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>{ev.name || "Untitled event"}</option>
            ))}
          </select>
        )}
      </div>

      <div className="field">
        <label className="field__label" htmlFor="task-title">Task</label>
        <input
          id="task-title"
          className="input"
          autoFocus
          value={task}
          placeholder="What needs doing?"
          onChange={(e) => setTask(e.target.value)}
        />
      </div>

      <div className="field-row" style={{ marginBottom: "var(--sp-4)" }}>
        <div className="field" style={{ marginBottom: 0 }}>
          <label className="field__label" htmlFor="task-priority">Priority</label>
          <select
            id="task-priority"
            className="select"
            value={priority}
            onChange={(e) => setPriority(e.target.value as Priority)}
          >
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>
            ))}
          </select>
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label className="field__label" htmlFor="task-status">Status</label>
          <select
            id="task-status"
            className="select"
            value={status}
            onChange={(e) => setStatus(e.target.value as TaskStatus)}
          >
            {TASK_STATUSES.map((s) => (
              <option key={s} value={s}>{TASK_STATUS_LABEL[s]}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="field-row" style={{ marginBottom: "var(--sp-4)" }}>
        <div className="field" style={{ marginBottom: 0 }}>
          <label className="field__label" htmlFor="task-due">Due date</label>
          <input
            id="task-due"
            type="date"
            className="input"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label className="field__label" htmlFor="task-assigned">Assigned to</label>
          <input
            id="task-assigned"
            className="input"
            list="task-owners-list"
            value={assignedTo}
            placeholder="Optional"
            onChange={(e) => setAssignedTo(e.target.value)}
          />
          <datalist id="task-owners-list">
            {owners.map((o) => (
              <option key={o} value={o} />
            ))}
          </datalist>
        </div>
      </div>

      <div className="field">
        <label className="field__label" htmlFor="task-notes">Notes</label>
        <textarea
          id="task-notes"
          className="textarea"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      <button className="btn btn--primary btn--stack" onClick={save} disabled={!canSave}>
        {editing ? "Save changes" : "Add task"}
      </button>
      {editing && (
        <button className="btn btn--danger" onClick={onDelete}>
          Delete task
        </button>
      )}
    </BottomSheet>
  );
}
