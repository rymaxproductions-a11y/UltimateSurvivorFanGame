import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, questionsTable, choicesTable } from "@workspace/db";
import {
  ListQuestionsParams,
  ListQuestionsResponse,
  CreateQuestionParams,
  CreateQuestionBody,
  UpdateQuestionParams,
  UpdateQuestionBody,
  UpdateQuestionResponse,
  DeleteQuestionParams,
  CreateChoiceParams,
  CreateChoiceBody,
  DeleteChoiceParams,
} from "@workspace/api-zod";
import { requireAuth } from "./users";
import { serialize } from "../lib/serialize";

const router: IRouter = Router();

async function getQuestionWithChoices(questionId: number) {
  const [question] = await db.select().from(questionsTable).where(eq(questionsTable.id, questionId));
  if (!question) return null;
  const choices = await db.select().from(choicesTable).where(eq(choicesTable.questionId, questionId));
  return serialize({ ...question, choices });
}

router.get("/weeks/:weekId/questions", async (req, res): Promise<void> => {
  const params = ListQuestionsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const questions = await db.select().from(questionsTable)
    .where(eq(questionsTable.weekId, params.data.weekId))
    .orderBy(questionsTable.id);

  const questionsWithChoices = await Promise.all(
    questions.map(async (q) => {
      const choices = await db.select().from(choicesTable).where(eq(choicesTable.questionId, q.id));
      return serialize({ ...q, choices });
    })
  );

  res.json(ListQuestionsResponse.parse(questionsWithChoices));
});

router.post("/weeks/:weekId/questions", requireAuth, async (req: any, res: any): Promise<void> => {
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
  }).returning();

  if (parsed.data.choices && parsed.data.choices.length > 0) {
    await db.insert(choicesTable).values(
      parsed.data.choices.map((c: string) => ({ questionId: question.id, choiceText: c }))
    );
  }

  const qWithChoices = await getQuestionWithChoices(question.id);
  res.status(201).json(qWithChoices);
});

router.patch("/questions/:questionId", requireAuth, async (req: any, res: any): Promise<void> => {
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

  const qWithChoices = await getQuestionWithChoices(updated.id);
  res.json(UpdateQuestionResponse.parse(qWithChoices));
});

router.delete("/questions/:questionId", requireAuth, async (req: any, res: any): Promise<void> => {
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

router.post("/questions/:questionId/choices", requireAuth, async (req: any, res: any): Promise<void> => {
  const params = CreateChoiceParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = CreateChoiceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [choice] = await db.insert(choicesTable).values({
    questionId: params.data.questionId,
    choiceText: parsed.data.choiceText,
  }).returning();

  res.status(201).json(choice);
});

router.delete("/choices/:choiceId", requireAuth, async (req: any, res: any): Promise<void> => {
  const params = DeleteChoiceParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db.delete(choicesTable).where(eq(choicesTable.id, params.data.choiceId)).returning();
  if (!deleted) {
    res.status(404).json({ error: "Choice not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
