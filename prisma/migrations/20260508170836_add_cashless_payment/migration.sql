-- CreateTable
CREATE TABLE "StudentAccount" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "studentIdNumber" TEXT NOT NULL,
    "accountType" TEXT NOT NULL DEFAULT 'student',
    "fullName" TEXT NOT NULL,
    "course" TEXT NOT NULL,
    "year" TEXT NOT NULL,
    "photoUrl" TEXT NOT NULL DEFAULT '',
    "pinHash" TEXT NOT NULL,
    "isTemporaryPin" BOOLEAN NOT NULL DEFAULT true,
    "balance" REAL NOT NULL DEFAULT 0,
    "qrToken" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "pinAttempts" INTEGER NOT NULL DEFAULT 0,
    "pinLockedUntil" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activatedAt" DATETIME,
    "activatedById" INTEGER,
    CONSTRAINT "StudentAccount_activatedById_fkey" FOREIGN KEY ("activatedById") REFERENCES "AdminUser" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StudentTransaction" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "studentAccountId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "balanceBefore" REAL NOT NULL,
    "balanceAfter" REAL NOT NULL,
    "orderId" INTEGER,
    "adminId" INTEGER,
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StudentTransaction_studentAccountId_fkey" FOREIGN KEY ("studentAccountId") REFERENCES "StudentAccount" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StudentTransaction_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "StudentTransaction_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "AdminUser" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Order" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "orderNumber" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "paymentMethod" TEXT NOT NULL,
    "paymentStatus" TEXT NOT NULL DEFAULT 'unpaid',
    "totalAmount" REAL NOT NULL,
    "gcashAccountId" INTEGER,
    "confirmedById" INTEGER,
    "notes" TEXT NOT NULL DEFAULT '',
    "cancelReason" TEXT NOT NULL DEFAULT '',
    "studentAccountId" INTEGER,
    "refundStatus" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Order_gcashAccountId_fkey" FOREIGN KEY ("gcashAccountId") REFERENCES "GCashAccount" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Order_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "AdminUser" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Order_studentAccountId_fkey" FOREIGN KEY ("studentAccountId") REFERENCES "StudentAccount" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Order" ("confirmedById", "createdAt", "gcashAccountId", "id", "notes", "orderNumber", "paymentMethod", "paymentStatus", "status", "totalAmount", "updatedAt") SELECT "confirmedById", "createdAt", "gcashAccountId", "id", "notes", "orderNumber", "paymentMethod", "paymentStatus", "status", "totalAmount", "updatedAt" FROM "Order";
DROP TABLE "Order";
ALTER TABLE "new_Order" RENAME TO "Order";
CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "StudentAccount_studentIdNumber_key" ON "StudentAccount"("studentIdNumber");

-- CreateIndex
CREATE UNIQUE INDEX "StudentAccount_qrToken_key" ON "StudentAccount"("qrToken");
