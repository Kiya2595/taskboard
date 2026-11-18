import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/requireAuth";

const router = Router();

router.use(requireAuth);

const listSchema = z.object({
  title: z.string().min(1, "Title is required").max(100, "Title is too long"),
});

const cardSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title is too long"),
  description: z.string().max(2000).optional(),
});

// Returns the user's role on a board, or null if they are not a member
async function getRole(userId: number, boardId: number) {
  const m = await prisma.boardMember.findUnique({
    where: { userId_boardId: { userId, boardId } },
  });
  return m ? m.role : null;
}

// Create a list in a board (OWNER or MEMBER)
router.post("/boards/:boardId/lists", async (req, res) => {
  const boardId = Number(req.params.boardId);
  if (!Number.isInteger(boardId)) {
    res.status(400).json({ error: "Invalid board id" });
    return;
  }

  const role = await getRole(res.locals.userId, boardId);
  if (!role) {
    res.status(404).json({ error: "Board not found" });
    return;
  }
  if (role === "VIEWER") {
    res.status(403).json({ error: "Viewers cannot edit this board" });
    return;
  }

  const parsed = listSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ errors: parsed.error.issues.map((i) => i.message) });
    return;
  }

  // Put the new list after the last one
  const last = await prisma.list.findFirst({
    where: { boardId },
    orderBy: { position: "desc" },
  });

  const list = await prisma.list.create({
    data: {
      title: parsed.data.title,
      boardId,
      position: last ? last.position + 1 : 1,
    },
  });

  res.status(201).json(list);
});

// Create a card in a list (OWNER or MEMBER)
router.post("/lists/:listId/cards", async (req, res) => {
  const listId = Number(req.params.listId);
  if (!Number.isInteger(listId)) {
    res.status(400).json({ error: "Invalid list id" });
    return;
  }

  const list = await prisma.list.findUnique({ where: { id: listId } });
  if (!list) {
    res.status(404).json({ error: "List not found" });
    return;
  }

  const role = await getRole(res.locals.userId, list.boardId);
  if (!role) {
    res.status(404).json({ error: "List not found" });
    return;
  }
  if (role === "VIEWER") {
    res.status(403).json({ error: "Viewers cannot edit this board" });
    return;
  }

  const parsed = cardSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ errors: parsed.error.issues.map((i) => i.message) });
    return;
  }

  const last = await prisma.card.findFirst({
    where: { listId },
    orderBy: { position: "desc" },
  });

  const card = await prisma.card.create({
    data: {
      title: parsed.data.title,
      description: parsed.data.description,
      listId,
      position: last ? last.position + 1 : 1,
    },
  });

  res.status(201).json(card);
});

export default router;