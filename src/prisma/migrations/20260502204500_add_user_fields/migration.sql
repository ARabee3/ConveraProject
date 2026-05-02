-- AlterTable
ALTER TABLE `users` ADD COLUMN `isActive` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `preferredLocale` VARCHAR(191) NOT NULL DEFAULT 'en';
