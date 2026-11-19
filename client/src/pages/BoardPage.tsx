import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
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
  onSave,
  onDelete,
}: {
  card: Card;
  canEdit: boolean;
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
      <strong>{card.title}</strong>
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

export default function BoardPage() {
  const { id } = useParams();
  const [board, setBoard] = useState<Board | null>(null);
  const [error, setError] = useState("");

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

  if (!board) {
    return (
      <div className="page">
        <Link to="/boards">← Back to boards</Link>
        {error ? <p className="error">{error}</p> : <p className="muted">Loading...</p>}
      </div>
    );
  }

  const canEdit = board.role !== "VIEWER";

  return (
    <div className="page wide">
      <Link to="/boards">← Back to boards</Link>
      <h1>{board.title}</h1>
      {error && <p className="error">{error}</p>}

      <div className="lists">
        {board.lists.map((list) => (
          <div className="list" key={list.id}>
            <div className="list-header">
              <h3>{list.title}</h3>
              {canEdit && (
                <div className="row">
                  <button className="link" onClick={() => renameList(list)}>
                    Rename
                  </button>
                  <button className="link danger" onClick={() => deleteList(list)}>
                    Delete
                  </button>
                </div>
              )}
            </div>

            {list.cards.map((card) => (
              <CardItem
                key={card.id}
                card={card}
                canEdit={canEdit}
                onSave={updateCard}
                onDelete={deleteCard}
              />
            ))}

            {canEdit && (
              <AddForm
                placeholder="Add a card"
                label="Add"
                onAdd={(title) => addCard(list.id, title)}
              />
            )}
          </div>
        ))}

        {canEdit && (
          <div className="list">
            <AddForm placeholder="Add a list" label="Add list" onAdd={addList} />
          </div>
        )}
      </div>
    </div>
  );
}