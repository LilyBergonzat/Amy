/*
  Warnings:

  - A unique constraint covering the columns `[source,idLegacy]` on the table `thread` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `thread` ADD COLUMN `idLegacy` VARCHAR(191) NULL,
    ADD COLUMN `legacyNumber` INTEGER NULL,
    ADD COLUMN `source` ENUM('AMY', 'DRAGORY', 'KYB3R') NOT NULL DEFAULT 'AMY';

-- CreateIndex
CREATE UNIQUE INDEX `thread_source_idLegacy_key` ON `thread`(`source`, `idLegacy`);
