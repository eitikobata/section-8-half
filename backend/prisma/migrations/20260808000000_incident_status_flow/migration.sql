-- Migrates IncidentStatus from the flat OPEN/INVESTIGATING/CLOSED/ESCALATED
-- enum to the triage-driven flow: NEW -> TRIAGED -> RESPONSE_DEPLOYED ->
-- CLOSED, with ESCALATED kept as a manual branch reachable from any
-- non-terminal state.
--
-- Mapping applied to existing rows:
--   OPEN          -> NEW                (nothing has happened yet)
--   INVESTIGATING -> TRIAGED            (closest existing equivalent —
--                                         someone was already looking at it)
--   ESCALATED     -> ESCALATED          (unchanged)
--   CLOSED        -> CLOSED             (unchanged)

-- Rename the old enum type out of the way
ALTER TYPE "IncidentStatus" RENAME TO "IncidentStatus_old";

-- Create the new enum type
CREATE TYPE "IncidentStatus" AS ENUM ('NEW', 'TRIAGED', 'RESPONSE_DEPLOYED', 'ESCALATED', 'CLOSED');

-- Drop the old default before changing the column type
ALTER TABLE "incidents" ALTER COLUMN "status" DROP DEFAULT;

-- Swap the column to the new type, mapping old values to new ones
ALTER TABLE "incidents"
  ALTER COLUMN "status" TYPE "IncidentStatus"
  USING (
    CASE "status"::text
      WHEN 'OPEN' THEN 'NEW'
      WHEN 'INVESTIGATING' THEN 'TRIAGED'
      WHEN 'ESCALATED' THEN 'ESCALATED'
      WHEN 'CLOSED' THEN 'CLOSED'
    END
  )::"IncidentStatus";

-- Restore the default with the new type's value
ALTER TABLE "incidents" ALTER COLUMN "status" SET DEFAULT 'NEW';

-- Drop the old enum type, no longer referenced
DROP TYPE "IncidentStatus_old";
