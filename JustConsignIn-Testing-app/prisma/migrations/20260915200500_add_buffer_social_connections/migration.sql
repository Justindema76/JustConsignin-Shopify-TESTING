-- CreateTable
CREATE TABLE "BufferConnection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "expiresAt" DATETIME,
    "scope" TEXT,
    "accountId" TEXT,
    "accountName" TEXT,
    "organizationId" TEXT,
    "organizationName" TEXT,
    "channelsJson" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "BufferOAuthState" (
    "state" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "codeVerifier" TEXT NOT NULL,
    "host" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "BufferConnection_shop_key" ON "BufferConnection"("shop");

-- CreateIndex
CREATE INDEX "BufferOAuthState_shop_idx" ON "BufferOAuthState"("shop");

-- CreateIndex
CREATE INDEX "BufferOAuthState_expiresAt_idx" ON "BufferOAuthState"("expiresAt");
