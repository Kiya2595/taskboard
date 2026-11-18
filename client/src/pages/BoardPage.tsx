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

export default function BoardPage() {
  const { id } = useParams();
  const [board, setBoard] = useState<Board | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Board>(`/boards/${id}`)
      .then(setBoard)
      .catch((err) => setError(err instanceof Error ? err.message : "Something went wrong"));
  }, [id]);

  async function addList(title: string) {
    try {
      const list = await api<Omit<List, "cards">>(`/boards/${id}/lists`, {
        method: "POST",
        body: JSON.stringify({ title }),
      });
      setBoard((b) => b && { ...b, lists: [...b.lists, { ...list, cards: [] }] });
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
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
      setError(err instanceof Error ? err.message : "Something went wrong");
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
            <h3>{list.title}</h3>

            {list.cards.map((card) => (
              <div className="card" key={card.id}>
                <strong>{card.title}</strong>
                {card.description && <p className="muted">{card.description}</p>}
              </div>
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