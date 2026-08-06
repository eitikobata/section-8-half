-- CreateEnum
CREATE TYPE "IncidentStatus" AS ENUM ('OPEN', 'INVESTIGATING', 'CLOSED', 'ESCALATED');

-- CreateTable
CREATE TABLE "entities" (
    "id" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "label" TEXT,
    "type" TEXT,
    "location" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "entities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "raw_events" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "location" TEXT,
    "severityRaw" INTEGER NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "incidentId" TEXT,

    CONSTRAINT "raw_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incidents" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "status" "IncidentStatus" NOT NULL DEFAULT 'OPEN',
    "severity" INTEGER,
    "summary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "incidents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "entities_externalId_key" ON "entities"("externalId");

-- CreateIndex
CREATE INDEX "raw_events_entityId_occurredAt_idx" ON "raw_events"("entityId", "occurredAt");

-- CreateIndex
CREATE INDEX "incidents_entityId_status_idx" ON "incidents"("entityId", "status");

-- AddForeignKey
ALTER TABLE "raw_events" ADD CONSTRAINT "raw_events_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raw_events" ADD CONSTRAINT "raw_events_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "incidents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
