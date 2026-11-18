import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/requireAuth";

const router = Router();

// Every route in this file needs a logged-in user
router.use(requireAuth);

const boardSchema = z.object({
  title: z.string().min(1, "Title is required").max(100, "Title is too long"),
});

// Create a board. The creator becomes its OWNER.
router.post("/", async (req, res) => {
  const parsed = boardSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ errors: parsed.error.issues.map((i) => i.message) });
    return;
  }

  const board = await prisma.board.create({
    data: {
      title: parsed.data.title,
      members: {
        create: { userId: res.locals.userId, role: "OWNER" },
      },
    },
  });

  res.status(201).json(board);
});

// List the boards the logged-in user belongs to
router.get("/", async (_req, res) => {
  const memberships = await prisma.boardMember.findMany({
    where: { userId: res.locals.userId },
    include: { board: true },
  });

  res.json(
    memberships.map((m) => ({
      id: m.board.id,
      title: m.board.title,
      role: m.role,
      createdAt: m.board.createdAt,
    }))
  );
});

// Get one board with its lists and cards (members only)
router.get("/:id", async (req, res) => {
  const boardId = Number(req.params.id);
  if (!Number.isInteger(boardId)) {
    res.status(400).json({ error: "Invalid board id" });
    return;
  }

  const membership = await prisma.boardMember.findUnique({
    where: { userId_boardId: { userId: res.locals.userId, boardId } },
  });
  if (!membership) {
    res.status(404).json({ error: "Board not found" });
    return;
  }

  const board = await prisma.board.findUnique({
    where: { id: boardId },
    include: {
      lists: {
        orderBy: { position: "asc" },
        include: { cards: { orderBy: { position: "asc" } } },
      },
    },
  });

  res.json({ ...board, role: membership.role });
});

export default router;