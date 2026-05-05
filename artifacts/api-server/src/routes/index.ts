import { Router, type IRouter } from "express";
import healthRouter from "./health";
import usersRouter from "./users";
import gamesRouter from "./games";
import contestantsRouter from "./contestants";
import weeksRouter from "./weeks";
import questionsRouter from "./questions";
import answersRouter from "./answers";
import leaderboardRouter from "./leaderboard";
import storageRouter from "./storage";

const router: IRouter = Router();

router.use(healthRouter);
router.use(usersRouter);
router.use(gamesRouter);
router.use(contestantsRouter);
router.use(weeksRouter);
router.use(questionsRouter);
router.use(answersRouter);
router.use(leaderboardRouter);
router.use(storageRouter);

export default router;
