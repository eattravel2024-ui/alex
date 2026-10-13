-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CANCELLED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "EventEligibility" AS ENUM ('ACCOUNT', 'MEMBER');

-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('CONFIRMED', 'WAITLISTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "EventRecord" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "agenda" JSONB NOT NULL,
    "startsAt" TIMESTAMPTZ(3) NOT NULL,
    "endsAt" TIMESTAMPTZ(3) NOT NULL,
    "registrationDeadline" TIMESTAMPTZ(3) NOT NULL,
    "status" "EventStatus" NOT NULL DEFAULT 'DRAFT',
    "eligibility" "EventEligibility" NOT NULL DEFAULT 'ACCOUNT',
    "capacity" INTEGER NOT NULL,
    "registrationEnabled" BOOLEAN NOT NULL DEFAULT false,
    "waitlistEnabled" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDemo" BOOLEAN NOT NULL DEFAULT true,
    "updatedById" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "EventRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventRegistration" (
    "id" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "status" "RegistrationStatus" NOT NULL,
    "queueOrder" BIGSERIAL NOT NULL,
    "checkedInAt" TIMESTAMPTZ(3),
    "checkedInById" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "EventRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventRegistrationChange" (
    "id" UUID NOT NULL,
    "registrationId" UUID NOT NULL,
    "fromStatus" "RegistrationStatus",
    "toStatus" "RegistrationStatus" NOT NULL,
    "note" TEXT NOT NULL,
    "actorId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventRegistrationChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EventRecord_slug_key" ON "EventRecord"("slug");

-- CreateIndex
CREATE INDEX "EventRecord_status_startsAt_idx" ON "EventRecord"("status", "startsAt");

-- CreateIndex
CREATE INDEX "EventRecord_category_status_idx" ON "EventRecord"("category", "status");

-- CreateIndex
CREATE UNIQUE INDEX "EventRegistration_queueOrder_key" ON "EventRegistration"("queueOrder");

-- CreateIndex
CREATE INDEX "EventRegistration_eventId_status_queueOrder_idx" ON "EventRegistration"("eventId", "status", "queueOrder");

-- CreateIndex
CREATE INDEX "EventRegistration_userId_createdAt_idx" ON "EventRegistration"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "EventRegistration_eventId_userId_key" ON "EventRegistration"("eventId", "userId");

-- CreateIndex
CREATE INDEX "EventRegistrationChange_registrationId_createdAt_idx" ON "EventRegistrationChange"("registrationId", "createdAt");

-- AddForeignKey
ALTER TABLE "EventRecord" ADD CONSTRAINT "EventRecord_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventRegistration" ADD CONSTRAINT "EventRegistration_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "EventRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventRegistration" ADD CONSTRAINT "EventRegistration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventRegistration" ADD CONSTRAINT "EventRegistration_checkedInById_fkey" FOREIGN KEY ("checkedInById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventRegistrationChange" ADD CONSTRAINT "EventRegistrationChange_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "EventRegistration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventRegistrationChange" ADD CONSTRAINT "EventRegistrationChange_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Event business invariants. Existing membership constraints are unchanged.
ALTER TABLE "EventRecord" ADD CONSTRAINT "event_valid_period" CHECK ("endsAt" > "startsAt");
ALTER TABLE "EventRecord" ADD CONSTRAINT "event_valid_deadline" CHECK ("registrationDeadline" <= "startsAt");
ALTER TABLE "EventRecord" ADD CONSTRAINT "event_valid_capacity" CHECK (capacity BETWEEN 1 AND 1000);
ALTER TABLE "EventRecord" ADD CONSTRAINT "event_positive_version" CHECK (version > 0);
ALTER TABLE "EventRegistration" ADD CONSTRAINT "event_checkin_pair" CHECK (("checkedInAt" IS NULL) = ("checkedInById" IS NULL));
