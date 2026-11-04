-- AlterTable
ALTER TABLE `thread_message` ADD COLUMN `mentionsData` TEXT NULL,
    ADD COLUMN `stickersData` TEXT NULL;

-- CreateTable
CREATE TABLE `thread_attachment` (
    `id` VARCHAR(191) NOT NULL,
    `idThreadMessage` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `contentType` VARCHAR(191) NULL,
    `size` INTEGER NOT NULL,
    `width` INTEGER NULL,
    `height` INTEGER NULL,
    `spoiler` BOOLEAN NOT NULL,
    `description` TEXT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `thread_attachment` ADD CONSTRAINT `thread_attachment_idThreadMessage_fkey` FOREIGN KEY (`idThreadMessage`) REFERENCES `thread_message`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
