-- Add FraudAlert for Fraud Radar (Payments)

CREATE TABLE `FraudAlert` (
  `id` VARCHAR(191) NOT NULL,
  `kind` ENUM('DUP_TX_HASH','TOPUP_RATE_LIMIT','MANUAL_CREDIT_LARGE','WEBHOOK_FAIL_SPIKE','NEEDS_REVIEW_BURST') NOT NULL,
  `severity` ENUM('LOW','MEDIUM','HIGH','CRITICAL') NOT NULL DEFAULT 'MEDIUM',
  `status` ENUM('OPEN','ACKED','RESOLVED') NOT NULL DEFAULT 'OPEN',

  `dedupeKey` VARCHAR(191) NOT NULL,

  `userId` VARCHAR(191) NULL,
  `depositId` VARCHAR(191) NULL,

  `title` VARCHAR(191) NOT NULL,
  `message` TEXT NULL,
  `payloadJson` TEXT NULL,

  `acknowledgedById` VARCHAR(191) NULL,
  `acknowledgedAt` DATETIME(3) NULL,
  `resolvedById` VARCHAR(191) NULL,
  `resolvedAt` DATETIME(3) NULL,

  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `FraudAlert_kind_dedupeKey_key`(`kind`, `dedupeKey`),
  INDEX `FraudAlert_status_createdAt_idx`(`status`, `createdAt`),
  INDEX `FraudAlert_severity_createdAt_idx`(`severity`, `createdAt`),
  INDEX `FraudAlert_userId_createdAt_idx`(`userId`, `createdAt`),
  INDEX `FraudAlert_depositId_createdAt_idx`(`depositId`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `FraudAlert`
  ADD CONSTRAINT `FraudAlert_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `FraudAlert_depositId_fkey` FOREIGN KEY (`depositId`) REFERENCES `StarDeposit`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `FraudAlert_acknowledgedById_fkey` FOREIGN KEY (`acknowledgedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `FraudAlert_resolvedById_fkey` FOREIGN KEY (`resolvedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
