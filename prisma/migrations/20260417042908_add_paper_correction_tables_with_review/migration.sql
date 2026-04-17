-- CreateTable
CREATE TABLE "paper_correction_records" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "grade" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "imageUrl" TEXT,
    "total_questions" INTEGER NOT NULL,
    "correct_count" INTEGER NOT NULL,
    "score" DOUBLE PRECISION,
    "needs_review" BOOLEAN NOT NULL DEFAULT false,
    "review_reason" TEXT,
    "low_confidence_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "paper_correction_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wrong_questions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "question_content" TEXT NOT NULL,
    "student_answer" TEXT,
    "correct_answer" TEXT,
    "analysis" TEXT,
    "knowledge_points" JSONB,
    "wrong_count" INTEGER NOT NULL DEFAULT 1,
    "mastered" BOOLEAN NOT NULL DEFAULT false,
    "needs_review" BOOLEAN NOT NULL DEFAULT false,
    "confidence" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wrong_questions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "paper_correction_records_userId_created_at_idx" ON "paper_correction_records"("userId", "created_at");

-- CreateIndex
CREATE INDEX "paper_correction_records_subject_idx" ON "paper_correction_records"("subject");

-- CreateIndex
CREATE INDEX "paper_correction_records_needs_review_idx" ON "paper_correction_records"("needs_review");

-- CreateIndex
CREATE INDEX "wrong_questions_userId_subject_idx" ON "wrong_questions"("userId", "subject");

-- CreateIndex
CREATE INDEX "wrong_questions_userId_mastered_idx" ON "wrong_questions"("userId", "mastered");

-- CreateIndex
CREATE INDEX "wrong_questions_userId_needs_review_idx" ON "wrong_questions"("userId", "needs_review");

-- CreateIndex
CREATE UNIQUE INDEX "wrong_questions_userId_question_id_key" ON "wrong_questions"("userId", "question_id");
