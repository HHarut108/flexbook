-- CreateTable: PriceCalendarDay caches the cheapest fare we've seen on a given
-- (origin, destination, date). cheapestUsd is nullable so we can record
-- "checked, no flights" without refetching that day until ttlUntil expires.
CREATE TABLE "PriceCalendarDay" (
    "origin" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "cheapestUsd" REAL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "bookingUrl" TEXT,
    "source" TEXT NOT NULL,
    "sampledAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ttlUntil" DATETIME NOT NULL,

    PRIMARY KEY ("origin", "destination", "date")
);

-- CreateIndex
CREATE INDEX "PriceCalendarDay_origin_destination_idx"
    ON "PriceCalendarDay"("origin", "destination");
