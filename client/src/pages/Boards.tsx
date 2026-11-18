import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, clearToken } from "../api";

type BoardSummary = {
  id: number;
  title: string;
  role: string;
  createdAt: string;
};

export default function Boards() {
  const navigate = useNavigate();
  const [boards, setBoards] = useState<BoardSummary[]>([]);
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  function logout() {
    clearToken();
    navigate("/login");
  }

  useEffect(() => {
    api<BoardSummary[]>("/boards")
      .then(setBoards)
      .catch((err) => {
        const message = err instanceof Error ? err.message : "Something went wrong";
        if (message.includes("token")) {
          clearToken();
          navigate("/login");
        } else {
          setError(message);
        }
      })
      .finally(() => setLoading(false));
  }, [navigate]);

  async function createBoard(e: FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;

    try {
      const board = await api<{ id: number; title: string; createdAt: string }>("/boards", {
        method: "POST",
        body: JSON.stringify({ title: trimmed }),
      });
      setBoards([...boards, { ...board, role: "OWNER" }]);
      setTitle("");
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Your boards</h1>
        <button className="secondary" onClick={logout}>
          Log out
        </button>
      </div>

      <form className="add-form" onSubmit={createBoard}>
        <input
          placeholder="New board name"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <button type="submit">Create board</button>
      </form>

      {error && <p className="error">{error}</p>}
      {loading && <p className="muted">Loading...</p>}
      {!loading && boards.length === 0 && (
        <p className="muted">No boards yet. Create your first one above.</p>
      )}

      <div className="board-grid">
        {boards.map((b) => (
          <Link key={b.id} className="board-tile" to={`/boards/${b.id}`}>
            <strong>{b.title}</strong>
            <span className="muted">{b.role}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}