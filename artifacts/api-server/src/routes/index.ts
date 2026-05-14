import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import adminRouter from "./admin";
import gamesRouter from "./games";
import contestantsRouter from "./contestants";
import weeksRouter from "./weeks";
import questionsRouter from "./questions";
import answersRouter from "./answers";
import leaderboardRouter from "./leaderboard";
import storageRouter from "./storage";
import tribesRouter from "./tribes";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(usersRouter);
router.use(adminRouter);
router.use(gamesRouter);
router.use(contestantsRouter);
router.use(weeksRouter);
router.use(questionsRouter);
router.use(answersRouter);
router.use(leaderboardRouter);
router.use(storageRouter);
router.use(tribesRouter);

export default router;
