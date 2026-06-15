/*
  Warnings:

  - A unique constraint covering the columns `[submissionNumber]` on the table `Submission` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Submission" ADD COLUMN     "submissionNumber" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "Submission_submissionNumber_key" ON "Submission"("submissionNumber");
