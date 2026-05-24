-- AlterTable: add country-of-residence fields to User
ALTER TABLE "User" ADD COLUMN "countryOfResidenceCode" TEXT;
ALTER TABLE "User" ADD COLUMN "countryOfResidenceName" TEXT;

-- CreateTable: UserVisa
CREATE TABLE IF NOT EXISTS "UserVisa" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "citizenshipId" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "countryName" TEXT NOT NULL,
    "visaType" TEXT,
    "documentNumber" TEXT,
    "validUntil" TEXT,
    CONSTRAINT "UserVisa_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserVisa_citizenshipId_fkey" FOREIGN KEY ("citizenshipId") REFERENCES "UserCitizenship" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
