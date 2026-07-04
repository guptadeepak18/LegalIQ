import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import otpRouter from "./otp.js";
import leadsRouter from "./leads.js";
import questionsRouter from "./questions.js";
import sessionRouter from "./session.js";
import submitRouter from "./submit.js";
import consultRouter from "./consult.js";
import reviewsRouter from "./reviews.js";
import authRouter from "./auth.js";
import adminRouter from "./admin.js";
import statsRouter from "./stats.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(otpRouter);
router.use(leadsRouter);
router.use(questionsRouter);
router.use(sessionRouter);
router.use(submitRouter);
router.use(consultRouter);
router.use(reviewsRouter);
router.use(authRouter);
router.use(adminRouter);
router.use(statsRouter);

export default router;
