-- AlterTable
ALTER TABLE "incidents" ADD COLUMN     "aiAgentSuggestion" JSONB,
ADD COLUMN     "analystDecision" JSONB,
ADD COLUMN     "suggestedSeverity" INTEGER;
