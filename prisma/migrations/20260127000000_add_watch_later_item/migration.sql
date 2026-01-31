-- Add Watch Later feature

CREATE TABLE `WatchLaterItem` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `videoId` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `WatchLaterItem_userId_videoId_key`(`userId`, `videoId`),
  INDEX `WatchLaterItem_userId_createdAt_idx`(`userId`, `createdAt`),
  INDEX `WatchLaterItem_videoId_createdAt_idx`(`videoId`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `WatchLaterItem`
  ADD CONSTRAINT `WatchLaterItem_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `WatchLaterItem_videoId_fkey` FOREIGN KEY (`videoId`) REFERENCES `Video`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
