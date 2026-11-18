import { useNavigate } from "react-router-dom";
import { clearToken } from "../api";

export default function Boards() {
  const navigate = useNavigate();

  function logout() {
    clearToken();
    navigate("/login");
  }

  return (
    <div className="page">
      <h1>Your boards</h1>
      <p className="muted">You are logged in. Boards are coming next.</p>
      <button onClick={logout}>Log out</button>
    </div>
  );
}