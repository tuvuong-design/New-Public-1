-- Season Pass (30d) + Referral Stars

-- 1) Extend PaymentConfig
ALTER TABLE `PaymentConfig`
  ADD COLUMN `seasonPassEnabled` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `seasonPassPriceStars` INTEGER NOT NULL DEFAULT 300,
  ADD COLUMN `referralEnabled` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `referralPercent` INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN `referralApplyToTopups` BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN `referralApplyToEarnings` BOOLEAN NOT NULL DEFAULT true;

-- 2) Extend User (referrals)
ALTER TABLE `User`
  ADD COLUMN `referralCode` VARCHAR(24) NULL,
  ADD COLUMN `referredById` VARCHAR(191) NULL,
  ADD COLUMN `referredAt` DATETIME(3) NULL;

CREATE UNIQUE INDEX `User_referralCode_key` ON `User`(`referralCode`);
CREATE INDEX `User_referredById_idx` ON `User`(`referredById`);

ALTER TABLE `User`
  ADD CONSTRAINT `User_referredById_fkey` FOREIGN KEY (`referredById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- 3) Update StarTransaction enum values (add SEASON_PASS_PURCHASE + REFERRAL_BONUS)
ALTER TABLE `StarTransaction`
  MODIFY COLUMN `type` ENUM('GIFT','STARS','ADMIN_GRANT','ADMIN_DEDUCT','BOOST_PURCHASE','TOPUP','REFUND','MEMBERSHIP_PURCHASE','NFT_MINT','NFT_SALE','NFT_EXPORT','HOLD_RELEASE','CREATOR_TIP','CREATOR_MEMBERSHIP_PURCHASE','PREMIUM_VIDEO_UNLOCK','SEASON_PASS_PURCHASE','REFERRAL_BONUS') NOT NULL;

-- 4) SeasonPass tables
CREATE TABLE `SeasonPass` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `startsAt` DATETIME(3) NOT NULL,
  `endsAt` DATETIME(3) NOT NULL,
  `status` ENUM('ACTIVE','EXPIRED') NOT NULL DEFAULT 'ACTIVE',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `SeasonPass_userId_key`(`userId`),
  INDEX `SeasonPass_userId_endsAt_idx`(`userId`, `endsAt`),
  INDEX `SeasonPass_status_endsAt_idx`(`status`, `endsAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `SeasonPass`
  ADD CONSTRAINT `SeasonPass_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE `SeasonPassPurchase` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `starsSpent` INTEGER NOT NULL,
  `startsAt` DATETIME(3) NOT NULL,
  `endsAt` DATETIME(3) NOT NULL,
  `txId` VARCHAR(128) NOT NULL,
  `starTxId` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `SeasonPassPurchase_txId_key`(`txId`),
  UNIQUE INDEX `SeasonPassPurchase_starTxId_key`(`starTxId`),
  INDEX `SeasonPassPurchase_userId_createdAt_idx`(`userId`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `SeasonPassPurchase`
  ADD CONSTRAINT `SeasonPassPurchase_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `SeasonPassPurchase_starTxId_fkey` FOREIGN KEY (`starTxId`) REFERENCES `StarTransaction`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- 5) ReferralBonus
CREATE TABLE `ReferralBonus` (
  `id` VARCHAR(191) NOT NULL,
  `referrerId` VARCHAR(191) NOT NULL,
  `referredUserId` VARCHAR(191) NOT NULL,
  `percent` INTEGER NOT NULL,
  `baseStars` INTEGER NOT NULL,
  `bonusStars` INTEGER NOT NULL,
  `sourceKind` ENUM('TOPUP','EARN') NOT NULL,
  `sourceId` VARCHAR(191) NOT NULL,
  `baseStarTxId` VARCHAR(191) NULL,
  `bonusStarTxId` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `ReferralBonus_sourceKind_sourceId_key`(`sourceKind`, `sourceId`),
  UNIQUE INDEX `ReferralBonus_bonusStarTxId_key`(`bonusStarTxId`),
  INDEX `ReferralBonus_referrerId_createdAt_idx`(`referrerId`, `createdAt`),
  INDEX `ReferralBonus_referredUserId_createdAt_idx`(`referredUserId`, `createdAt`),
  INDEX `ReferralBonus_sourceKind_createdAt_idx`(`sourceKind`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `ReferralBonus`
  ADD CONSTRAINT `ReferralBonus_referrerId_fkey` FOREIGN KEY (`referrerId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `ReferralBonus_referredUserId_fkey` FOREIGN KEY (`referredUserId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `ReferralBonus_baseStarTxId_fkey` FOREIGN KEY (`baseStarTxId`) REFERENCES `StarTransaction`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `ReferralBonus_bonusStarTxId_fkey` FOREIGN KEY (`bonusStarTxId`) REFERENCES `StarTransaction`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
