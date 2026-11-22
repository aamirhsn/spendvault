import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { TODO_KEEP_DAYS, useStore } from '../lib/store';
import type { Todo } from '../lib/types';
import { daysUntil, parseISO, todayISO } from '../lib/format';
import { DeleteRow, FieldRow, Group, SaveBtn, Sheet, toast } from './ui';
import { ICalendar, ICheck, IEdit, IPlus } from './Icons';

/** Open items first (overdue → soonest due → newest), then nothing else. */
export function sortTodos(list: Todo[]) {
  return [...list].sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999') || b.createdAt - a.createdAt);
}

function DueTag({ due }: { due?: string }) {
  if (!due) return null;
  const d = daysUntil(parseISO(due));
  if (d < 0) return <span className="tag bad">{-d === 1 ? 'Yesterday' : `${-d}d overdue`}</span>;
  if (d === 0) return <span className="tag warn">Today</span>;
  if (d === 1) return <span className="tag warn">Tomorrow</span>;
  return <span className="tag gray">{d <= 6 ? parseISO(due).toLocaleDateString(undefined, { weekday: 'short' }) : parseISO(due).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</span>;
}

function Check({ done, onClick, label }: { done: boolean; onClick: () => void; label: string }) {
  return (
    <button className={`todo-check ${done ? 'on' : ''}`} onClick={onClick} aria-label={label} role="checkbox" aria-checked={done}>
      {done && <ICheck strokeWidth={3} />}
    </button>
  );
}

export function TodoRow({ t, onEdit }: { t: Todo; onEdit: (t: Todo) => void }) {
  const { toggleTodo } = useStore();
  return (
    <div className="cell" style={{ ['--inset' as string]: '54px', minHeight: 50 }}>
      <Check done={t.done} onClick={() => toggleTodo(t.id)} label={t.done ? `Mark “${t.title}” not done` : `Mark “${t.title}” done`} />
      <button className="grow" style={{ textAlign: 'left', minWidth: 0 }} onClick={() => onEdit(t)}>
        <div className={`t ellipsis ${t.done ? 'todo-done' : ''}`}>{t.title}</div>
        {t.notes && <div className="st ellipsis">{t.notes}</div>}
      </button>
      {!t.done && <DueTag due={t.due} />}
    </div>
  );
}

/** Single-line “add a to-do” row. */
export function QuickAdd() {
  const { saveTodo } = useStore();
  const [title, setTitle] = useState('');
  const add = async () => {
    const v = title.trim();
    if (!v) return;
    await saveTodo({ title: v });
    setTitle('');
  };
  return (
    <form className="cell" style={{ ['--inset' as string]: '54px' }} onSubmit={(e) => { e.preventDefault(); add(); }}>
      <span className="todo-check add"><IPlus strokeWidth={2.4} /></span>
      <input style={{ textAlign: 'left' }} placeholder="Add a to-do" value={title} onChange={(e) => setTitle(e.target.value)} enterKeyHint="done" aria-label="New to-do" />
      {title.trim() && <button type="submit" className="textbtn bold">Add</button>}
    </form>
  );
}

export function TodoEditor({ todo, onClose }: { todo?: Todo; onClose: () => void }) {
  const { saveTodo, deleteTodo } = useStore();
  const [title, setTitle] = useState(todo?.title ?? '');
  const [due, setDue] = useState(todo?.due ?? '');
  const [notes, setNotes] = useState(todo?.notes ?? '');
  const save = async () => {
    if (!title.trim()) return toast('Add a title first', { kind: 'warn' });
    await saveTodo({ id: todo?.id, title: title.trim(), due: due || undefined, notes: notes.trim() || undefined, done: todo?.done ?? false });
    onClose();
  };
  return (
    <Sheet open onClose={onClose} title={todo ? 'Edit To-do' : 'New To-do'} actions={<SaveBtn onClick={save} />}>
      <div className="stack-lg">
        <Group>
          <FieldRow icon={<IEdit />} label="Title"><input placeholder="e.g. Pay Infinia bill" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus={!todo} /></FieldRow>
          <FieldRow icon={<ICalendar />} label="Due"><input type="date" value={due} min={todo ? undefined : todayISO()} onChange={(e) => setDue(e.target.value)} /></FieldRow>
          <FieldRow label="Notes"><input placeholder="Optional" value={notes} onChange={(e) => setNotes(e.target.value)} /></FieldRow>
        </Group>
        {todo && <DeleteRow label="Delete to-do" onConfirm={async () => { await deleteTodo(todo.id); onClose(); }} />}
      </div>
    </Sheet>
  );
}

/** Full list: open items, then completed with “Clear”. */
export function TodoSheet({ onClose }: { onClose: () => void }) {
  const { data, clearDoneTodos } = useStore();
  const [edit, setEdit] = useState<Todo | null>(null);
  const todos = data.todos ?? [];
  const open = useMemo(() => sortTodos(todos.filter((t) => !t.done)), [todos]);
  const done = useMemo(() => todos.filter((t) => t.done).sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0)), [todos]);
  return (
    <Sheet open onClose={onClose} title="To-do">
      <div className="stack-lg">
        <Group header={`${open.length} open`}>
          <QuickAdd />
          {open.map((t) => <TodoRow key={t.id} t={t} onEdit={setEdit} />)}
        </Group>
        {done.length > 0 && (
          <section>
            <div className="section-label">Completed · {done.length} <button className="link" onClick={clearDoneTodos}>Clear</button></div>
            <div className="group">{done.map((t) => <TodoRow key={t.id} t={t} onEdit={setEdit} />)}</div>
            <div className="group-f">Completed items are removed automatically {TODO_KEEP_DAYS} days after you tick them off.</div>
          </section>
        )}
      </div>
      {edit && <TodoEditor todo={edit} onClose={() => setEdit(null)} />}
    </Sheet>
  );
}

/** Floating to-do button for Home: badge shows open items (orange when some are due). */
export function TodoFab({ open, due, onClick }: { open: number; due: number; onClick: () => void }) {
  return createPortal(
    <button className="add-fab todo-fab" onClick={onClick} aria-label={`To-do list, ${open} open`} title="To-do">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M10 6h10M10 12h10M10 18h10" /><path d="M3.5 6l1.5 1.5L7.5 5M3.5 12l1.5 1.5L7.5 11M3.5 18l1.5 1.5L7.5 17" /></svg>
      {open > 0 && <span className={`fab-badge ${due ? 'due' : ''}`}>{open}</span>}
    </button>,
    document.body,
  );
}
