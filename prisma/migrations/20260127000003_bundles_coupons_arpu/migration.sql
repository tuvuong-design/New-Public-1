-- Bundles (topup bonus) + Coupons (topup/season-pass) + multi-tx per deposit

-- 1) Extend StarTransaction enum values (add BUNDLE_BONUS + COUPON_BONUS)
ALTER TABLE `StarTransaction`
  MODIFY COLUMN `type` ENUM('GIFT','STARS','ADMIN_GRANT','ADMIN_DEDUCT','BOOST_PURCHASE','TOPUP','REFUND','BUNDLE_BONUS','COUPON_BONUS','MEMBERSHIP_PURCHASE','NFT_MINT','NFT_SALE','NFT_EXPORT','HOLD_RELEASE','CREATOR_TIP','CREATOR_MEMBERSHIP_PURCHASE','PREMIUM_VIDEO_UNLOCK','SEASON_PASS_PURCHASE','REFERRAL_BONUS') NOT NULL DEFAULT 'STARS';

-- 2) Remove unique constraint on StarTransaction.depositId (make deposit multi-tx) and add idempotency unique
SET @idx := (
  SELECT `INDEX_NAME` FROM `information_schema`.`STATISTICS`
  WHERE `TABLE_SCHEMA` = DATABASE() AND `TABLE_NAME` = 'StarTransaction' AND `INDEX_NAME` = 'StarTransaction_depositId_key'
  LIMIT 1
);
SET @sql := IF(@idx IS NULL, 'SELECT 1', 'DROP INDEX `StarTransaction_depositId_key` ON `StarTransaction`');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE UNIQUE INDEX `StarTransaction_depositId_type_key` ON `StarTransaction`(`depositId`, `type`);
CREATE INDEX `StarTransaction_depositId_createdAt_idx` ON `StarTransaction`(`depositId`, `createdAt`);

-- 3) Extend StarTopupPackage for bundle bonus
ALTER TABLE `StarTopupPackage`
  ADD COLUMN `bonusStars` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `bundleLabel` VARCHAR(80) NULL;

-- 4) Create Coupon + CouponRedemption tables
CREATE TABLE `Coupon` (
  `id` VARCHAR(191) NOT NULL,
  `code` VARCHAR(64) NOT NULL,
  `kind` ENUM('PERCENT','FIXED') NOT NULL,
  `value` INTEGER NOT NULL,
  `appliesTo` ENUM('TOPUP','SEASON_PASS','ANY') NOT NULL DEFAULT 'ANY',
  `active` BOOLEAN NOT NULL DEFAULT true,
  `startsAt` DATETIME(3) NULL,
  `endsAt` DATETIME(3) NULL,
  `maxRedemptionsTotal` INTEGER NULL,
  `maxRedemptionsPerUser` INTEGER NULL,
  `note` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `Coupon_code_key`(`code`),
  INDEX `Coupon_active_createdAt_idx`(`active`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `CouponRedemption` (
  `id` VARCHAR(191) NOT NULL,
  `couponId` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `sourceKind` ENUM('TOPUP','SEASON_PASS') NOT NULL,
  `sourceId` VARCHAR(191) NOT NULL,
  `starsBonus` INTEGER NOT NULL DEFAULT 0,
  `starsDiscount` INTEGER NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `CouponRedemption_couponId_sourceKind_sourceId_key`(`couponId`, `sourceKind`, `sourceId`),
  INDEX `CouponRedemption_userId_createdAt_idx`(`userId`, `createdAt`),
  INDEX `CouponRedemption_couponId_createdAt_idx`(`couponId`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `CouponRedemption`
  ADD CONSTRAINT `CouponRedemption_couponId_fkey` FOREIGN KEY (`couponId`) REFERENCES `Coupon`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `CouponRedemption_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- 5) Extend StarDeposit with coupon fields
ALTER TABLE `StarDeposit`
  ADD COLUMN `couponId` VARCHAR(191) NULL,
  ADD COLUMN `couponCode` VARCHAR(64) NULL;

CREATE INDEX `StarDeposit_couponId_idx` ON `StarDeposit`(`couponId`);

ALTER TABLE `StarDeposit`
  ADD CONSTRAINT `StarDeposit_couponId_fkey` FOREIGN KEY (`couponId`) REFERENCES `Coupon`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- 6) Extend SeasonPassPurchase for breakdown + coupon fields
ALTER TABLE `SeasonPassPurchase`
  ADD COLUMN `originalPriceStars` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `discountStars` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `finalPriceStars` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `couponId` VARCHAR(191) NULL,
  ADD COLUMN `couponCode` VARCHAR(64) NULL;

ALTER TABLE `SeasonPassPurchase`
  ADD CONSTRAINT `SeasonPassPurchase_couponId_fkey` FOREIGN KEY (`couponId`) REFERENCES `Coupon`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE `SeasonPassPurchase`
  SET `originalPriceStars` = `starsSpent`, `finalPriceStars` = `starsSpent`
  WHERE (`originalPriceStars` = 0 OR `originalPriceStars` IS NULL)
    AND (`finalPriceStars` = 0 OR `finalPriceStars` IS NULL);
