import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, questionsTable } from "@workspace/db";
import {
  ListQuestionsParams,
  ListQuestionsResponse,
  CreateQuestionParams,
  CreateQuestionBody,
  UpdateQuestionParams,
  UpdateQuestionBody,
  UpdateQuestionResponse,
  DeleteQuestionParams,
} from "@workspace/api-zod";
import { requireAuth } from "./users";
import { requireAdmin } from "./answers";
import { serialize } from "../lib/serialize";

const router: IRouter = Router();

router.get("/weeks/:weekId/questions", async (req, res): Promise<void> => {
  const params = ListQuestionsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const questions = await db.select().from(questionsTable)
    .where(eq(questionsTable.weekId, params.data.weekId))
    .orderBy(questionsTable.id);

  res.json(ListQuestionsResponse.parse(questions.map(q => serialize(q))));
});

router.post("/weeks/:weekId/questions", requireAuth, requireAdmin, async (req: any, res: any): Promise<void> => {
  const params = CreateQuestionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = CreateQuestionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [question] = await db.insert(questionsTable).values({
    weekId: params.data.weekId,
    text: parsed.data.text,
    pointValue: parsed.data.pointValue,
    answerType: parsed.data.answerType ?? "cast",
  }).returning();

  res.status(201).json(serialize(question));
});

router.patch("/questions/:questionId", requireAuth, requireAdmin, async (req: any, res: any): Promise<void> => {
  const params = UpdateQuestionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateQuestionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [updated] = await db.update(questionsTable).set(parsed.data as any).where(eq(questionsTable.id, params.data.questionId)).returning();
  if (!updated) {
    res.status(404).json({ error: "Question not found" });
    return;
  }

  res.json(UpdateQuestionResponse.parse(serialize(updated)));
});

router.delete("/questions/:questionId", requireAuth, requireAdmin, async (req: any, res: any): Promise<void> => {
  const params = DeleteQuestionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db.delete(questionsTable).where(eq(questionsTable.id, params.data.questionId)).returning();
  if (!deleted) {
    res.status(404).json({ error: "Question not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
