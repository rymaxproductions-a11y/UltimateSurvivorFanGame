import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import adminRouter from "./admin";
import gamesRouter from "./games";
import contestantsRouter from "./contestants";
import showTribesRouter from "./showTribes";
import weeksRouter from "./weeks";
import questionsRouter from "./questions";
import answersRouter from "./answers";
import leaderboardRouter from "./leaderboard";
import storageRouter from "./storage";
import tribesRouter from "./tribes";
import chatRouter from "./chat";
import notificationsRouter from "./notifications";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(usersRouter);
router.use(adminRouter);
router.use(gamesRouter);
router.use(contestantsRouter);
router.use(showTribesRouter);
router.use(weeksRouter);
router.use(questionsRouter);
router.use(answersRouter);
router.use(leaderboardRouter);
router.use(storageRouter);
router.use(tribesRouter);
router.use(chatRouter);
router.use(notificationsRouter);

export default router;
