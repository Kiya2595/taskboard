import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { api } from "../api";

type Card = {
  id: number;
  title: string;
  description: string | null;
  position: number;
  listId: number;
};

type List = {
  id: number;
  title: string;
  position: number;
  cards: Card[];
};

type Board = {
  id: number;
  title: string;
  role: string;
  lists: List[];
};

type CardChanges = { title: string; description: string | null };

function AddForm({
  placeholder,
  label,
  onAdd,
}: {
  placeholder: string;
  label: string;
  onAdd: (title: string) => Promise<void>;
}) {
  const [title, setTitle] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    await onAdd(trimmed);
    setTitle("");
  }

  return (
    <form className="add-form" onSubmit={submit}>
      <input
        placeholder={placeholder}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <button type="submit">{label}</button>
    </form>
  );
}

function CardItem({
  card,
  canEdit,
  handle,
  onSave,
  onDelete,
}: {
  card: Card;
  canEdit: boolean;
  handle?: ReactNode;
  onSave: (cardId: number, changes: CardChanges) => Promise<void>;
  onDelete: (cardId: number) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(card.title);
  const [description, setDescription] = useState(card.description ?? "");

  async function save(e: FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    await onSave(card.id, {
      title: trimmed,
      description: description.trim() || null,
    });
    setEditing(false);
  }

  function cancel() {
    setTitle(card.title);
    setDescription(card.description ?? "");
    setEditing(false);
  }

  if (editing) {
    return (
      <form className="card" onSubmit={save}>
        <input value={title} onChange={(e) => setTitle(e.target.value)} />
        <textarea
          placeholder="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <div className="row">
          <button type="submit">Save</button>
          <button type="button" className="secondary" onClick={cancel}>
            Cancel
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="card">
      <div className="card-top">
        <strong>{card.title}</strong>
        {handle}
      </div>
      {card.description && <p className="muted">{card.description}</p>}
      {canEdit && (
        <div className="row">
          <button className="link" onClick={() => setEditing(true)}>
            Edit
          </button>
          <button
            className="link danger"
            onClick={() => {
              if (window.confirm("Delete this card?")) onDelete(card.id);
            }}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

function SortableCard({
  card,
  canEdit,
  onSave,
  onDelete,
}: {
  card: Card;
  canEdit: boolean;
  onSave: (cardId: number, changes: CardChanges) => Promise<void>;
  onDelete: (cardId: number) => Promise<void>;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: `c-${card.id}`, disabled: !canEdit });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <CardItem
        card={card}
        canEdit={canEdit}
        onSave={onSave}
        onDelete={onDelete}
        handle={
          canEdit ? (
            <span className="handle" title="Drag to move" {...attributes} {...listeners}>
              ⠿
            </span>
          ) : null
        }
      />
    </div>
  );
}

function ListColumn({
  list,
  canEdit,
  onRename,
  onDelete,
  onAddCard,
  onSaveCard,
  onDeleteCard,
}: {
  list: List;
  canEdit: boolean;
  onRename: (list: List) => void;
  onDelete: (list: List) => void;
  onAddCard: (listId: number, title: string) => Promise<void>;
  onSaveCard: (cardId: number, changes: CardChanges) => Promise<void>;
  onDeleteCard: (cardId: number) => Promise<void>;
}) {
  const { setNodeRef } = useDroppable({ id: `l-${list.id}`, disabled: !canEdit });

  return (
    <div className="list" ref={setNodeRef}>
      <div className="list-header">
        <h3>{list.title}</h3>
        {canEdit && (
          <div className="row">
            <button className="link" onClick={() => onRename(list)}>
              Rename
            </button>
            <button className="link danger" onClick={() => onDelete(list)}>
              Delete
            </button>
          </div>
        )}
      </div>

      <SortableContext
        items={list.cards.map((c) => `c-${c.id}`)}
        strategy={verticalListSortingStrategy}
      >
        {list.cards.map((card) => (
          <SortableCard
            key={card.id}
            card={card}
            canEdit={canEdit}
            onSave={onSaveCard}
            onDelete={onDeleteCard}
          />
        ))}
      </SortableContext>

      {canEdit && (
        <AddForm
          placeholder="Add a card"
          label="Add"
          onAdd={(title) => onAddCard(list.id, title)}
        />
      )}
    </div>
  );
}

export default function BoardPage() {
  const { id } = useParams();
  const [board, setBoard] = useState<Board | null>(null);
  const [error, setError] = useState("");
  const [activeCardId, setActiveCardId] = useState<number | null>(null);

  // A drag only starts after the pointer moves 5px, so clicks on buttons still work
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  function loadBoard() {
    api<Board>(`/boards/${id}`)
      .then(setBoard)
      .catch((err) => showError(err));
  }

  useEffect(() => {
    api<Board>(`/boards/${id}`)
      .then(setBoard)
      .catch((err) => setError(err instanceof Error ? err.message : "Something went wrong"));
  }, [id]);

  function showError(err: unknown) {
    setError(err instanceof Error ? err.message : "Something went wrong");
  }

  async function addList(title: string) {
    try {
      const list = await api<Omit<List, "cards">>(`/boards/${id}/lists`, {
        method: "POST",
        body: JSON.stringify({ title }),
      });
      setBoard((b) => b && { ...b, lists: [...b.lists, { ...list, cards: [] }] });
      setError("");
    } catch (err) {
      showError(err);
    }
  }

  async function renameList(list: List) {
    const title = window.prompt("Rename list", list.title)?.trim();
    if (!title || title === list.title) return;
    try {
      const updated = await api<Omit<List, "cards">>(`/lists/${list.id}`, {
        method: "PATCH",
        body: JSON.stringify({ title }),
      });
      setBoard(
        (b) =>
          b && {
            ...b,
            lists: b.lists.map((l) => (l.id === list.id ? { ...l, title: updated.title } : l)),
          }
      );
      setError("");
    } catch (err) {
      showError(err);
    }
  }

  async function deleteList(list: List) {
    const count = list.cards.length;
    const message = count
      ? `Delete "${list.title}" and its ${count} card(s)?`
      : `Delete "${list.title}"?`;
    if (!window.confirm(message)) return;
    try {
      await api(`/lists/${list.id}`, { method: "DELETE" });
      setBoard((b) => b && { ...b, lists: b.lists.filter((l) => l.id !== list.id) });
      setError("");
    } catch (err) {
      showError(err);
    }
  }

  async function addCard(listId: number, title: string) {
    try {
      const card = await api<Card>(`/lists/${listId}/cards`, {
        method: "POST",
        body: JSON.stringify({ title }),
      });
      setBoard(
        (b) =>
          b && {
            ...b,
            lists: b.lists.map((l) =>
              l.id === listId ? { ...l, cards: [...l.cards, card] } : l
            ),
          }
      );
      setError("");
    } catch (err) {
      showError(err);
    }
  }

  async function updateCard(cardId: number, changes: CardChanges) {
    try {
      const updated = await api<Card>(`/cards/${cardId}`, {
        method: "PATCH",
        body: JSON.stringify(changes),
      });
      setBoard(
        (b) =>
          b && {
            ...b,
            lists: b.lists.map((l) => ({
              ...l,
              cards: l.cards.map((c) => (c.id === cardId ? updated : c)),
            })),
          }
      );
      setError("");
    } catch (err) {
      showError(err);
    }
  }

  async function deleteCard(cardId: number) {
    try {
      await api(`/cards/${cardId}`, { method: "DELETE" });
      setBoard(
        (b) =>
          b && {
            ...b,
            lists: b.lists.map((l) => ({
              ...l,
              cards: l.cards.filter((c) => c.id !== cardId),
            })),
          }
      );
      setError("");
    } catch (err) {
      showError(err);
    }
  }

  function handleDragStart(event: DragStartEvent) {
    const activeId = String(event.active.id);
    if (activeId.startsWith("c-")) setActiveCardId(Number(activeId.slice(2)));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveCardId(null);
    const { active, over } = event;
    if (!over || !board) return;

    const activeId = String(active.id);
    const overId = String(over.id);
    if (!activeId.startsWith("c-") || activeId === overId) return;

    const cardId = Number(activeId.slice(2));
    const overIsList = overId.startsWith("l-");
    const overNumber = Number(overId.slice(2));

    const source = board.lists.find((l) => l.cards.some((c) => c.id === cardId));
    const target = overIsList
      ? board.lists.find((l) => l.id === overNumber)
      : board.lists.find((l) => l.cards.some((c) => c.id === overNumber));
    if (!source || !target) return;

    const card = source.cards.find((c) => c.id === cardId);
    if (!card) return;

    // Build the target list's new order
    let newCards: Card[];
    if (source.id === target.id) {
      const oldIndex = source.cards.findIndex((c) => c.id === cardId);
      const newIndex = overIsList
        ? source.cards.length - 1
        : source.cards.findIndex((c) => c.id === overNumber);
      if (oldIndex === newIndex) return;
      newCards = arrayMove(source.cards, oldIndex, newIndex);
    } else {
      const insertAt = overIsList
        ? target.cards.length
        : target.cards.findIndex((c) => c.id === overNumber);
      newCards = [...target.cards];
      newCards.splice(insertAt, 0, card);
    }

    // New position = between the neighbours (average of their positions)
    const index = newCards.findIndex((c) => c.id === cardId);
    const prev = newCards[index - 1]?.position;
    const next = newCards[index + 1]?.position;
    let position = 1;
    if (prev !== undefined && next !== undefined) position = (prev + next) / 2;
    else if (prev !== undefined) position = prev + 1;
    else if (next !== undefined) position = next - 1;

    newCards[index] = { ...card, listId: target.id, position };

    // Update the screen right away, then save to the server
    setBoard(
      (b) =>
        b && {
          ...b,
          lists: b.lists.map((l) => {
            if (l.id === target.id) return { ...l, cards: newCards };
            if (l.id === source.id) {
              return { ...l, cards: l.cards.filter((c) => c.id !== cardId) };
            }
            return l;
          }),
        }
    );
    setError("");

    api(`/cards/${cardId}/move`, {
      method: "PATCH",
      body: JSON.stringify({ listId: target.id, position }),
    }).catch((err) => {
      showError(err);
      loadBoard(); // put the screen back in sync with the server
    });
  }

  if (!board) {
    return (
      <div className="page">
        <Link to="/boards">← Back to boards</Link>
        {error ? <p className="error">{error}</p> : <p className="muted">Loading...</p>}
      </div>
    );
  }

  const canEdit = board.role !== "VIEWER";
  const activeCard =
    board.lists.flatMap((l) => l.cards).find((c) => c.id === activeCardId) ?? null;

  return (
    <div className="page wide">
      <Link to="/boards">← Back to boards</Link>
      <h1>{board.title}</h1>
      {error && <p className="error">{error}</p>}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveCardId(null)}
      >
        <div className="lists">
          {board.lists.map((list) => (
            <ListColumn
              key={list.id}
              list={list}
              canEdit={canEdit}
              onRename={renameList}
              onDelete={deleteList}
              onAddCard={addCard}
              onSaveCard={updateCard}
              onDeleteCard={deleteCard}
            />
          ))}

          {canEdit && (
            <div className="list">
              <AddForm placeholder="Add a list" label="Add list" onAdd={addList} />
            </div>
          )}
        </div>

        <DragOverlay>
          {activeCard ? (
            <div className="card dragging">
              <strong>{activeCard.title}</strong>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}