-- CreateTable
CREATE TABLE "classrooms" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "subject" TEXT NOT NULL,
    "grade" TEXT,
    "difficulty" TEXT,
    "style" TEXT,
    "version_type" TEXT,
    "scenes" JSONB NOT NULL,
    "scene_count" INTEGER NOT NULL,
    "duration" INTEGER NOT NULL,
    "parent_topic" TEXT,
    "generation_method" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "classrooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "classroom_knowledge_points" (
    "id" TEXT NOT NULL,
    "classroom_id" TEXT NOT NULL,
    "knowledge_point_id" TEXT NOT NULL,

    CONSTRAINT "classroom_knowledge_points_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "classrooms_identifier_key" ON "classrooms"("identifier");

-- CreateIndex
CREATE INDEX "classrooms_subject_grade_idx" ON "classrooms"("subject", "grade");

-- CreateIndex
CREATE INDEX "classrooms_parent_topic_idx" ON "classrooms"("parent_topic");

-- CreateIndex
CREATE INDEX "classrooms_version_type_idx" ON "classrooms"("version_type");

-- CreateIndex
CREATE INDEX "classrooms_created_at_idx" ON "classrooms"("created_at");

-- CreateIndex
CREATE INDEX "classroom_knowledge_points_knowledge_point_id_idx" ON "classroom_knowledge_points"("knowledge_point_id");

-- CreateIndex
CREATE UNIQUE INDEX "classroom_knowledge_points_classroom_id_knowledge_point_id_key" ON "classroom_knowledge_points"("classroom_id", "knowledge_point_id");

-- AddForeignKey
ALTER TABLE "classroom_knowledge_points" ADD CONSTRAINT "classroom_knowledge_points_classroom_id_fkey" FOREIGN KEY ("classroom_id") REFERENCES "classrooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classroom_knowledge_points" ADD CONSTRAINT "classroom_knowledge_points_knowledge_point_id_fkey" FOREIGN KEY ("knowledge_point_id") REFERENCES "knowledge_points"("id") ON DELETE CASCADE ON UPDATE CASCADE;
