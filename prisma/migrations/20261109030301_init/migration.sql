-- CreateTable
CREATE TABLE `setting` (
    `key` VARCHAR(255) NOT NULL,
    `value` TEXT NOT NULL,

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `thread` (
    `id` VARCHAR(191) NOT NULL,
    `idOpenedBy` VARCHAR(191) NULL,
    `openedByData` TEXT NULL,
    `openedByUser` BOOLEAN NULL,
    `idRecipient` VARCHAR(191) NOT NULL,
    `recipientData` TEXT NOT NULL,
    `isOpen` ENUM('OPEN') NULL,
    `idChannel` VARCHAR(191) NULL,
    `scheduledClose` DATETIME(3) NULL,
    `source` ENUM('AMY', 'DRAGORY', 'KYB3R') NOT NULL DEFAULT 'AMY',
    `idLegacy` VARCHAR(191) NULL,
    `legacyNumber` INTEGER NULL,
    `openedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `closedAt` DATETIME(3) NULL,

    INDEX `thread_idChannel_idx`(`idChannel`),
    UNIQUE INDEX `thread_idRecipient_isOpen_key`(`idRecipient`, `isOpen`),
    UNIQUE INDEX `thread_idChannel_key`(`idChannel`),
    UNIQUE INDEX `thread_source_idLegacy_key`(`source`, `idLegacy`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `thread_message` (
    `id` VARCHAR(191) NOT NULL,
    `idMessage` VARCHAR(191) NULL,
    `idThread` VARCHAR(191) NOT NULL,
    `idStaff` VARCHAR(191) NULL,
    `idTransferredMessage` VARCHAR(191) NULL,
    `idMirrorMessage` VARCHAR(191) NULL,
    `senderData` TEXT NOT NULL,
    `messageData` TEXT NULL,
    `contents` TEXT NOT NULL,
    `stickersData` TEXT NULL,
    `mentionsData` TEXT NULL,
    `internal` BOOLEAN NOT NULL,
    `anonymous` BOOLEAN NULL,
    `forwarded` BOOLEAN NOT NULL DEFAULT false,
    `idLegacy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `editedAt` DATETIME(3) NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `thread_message_idMessage_idx`(`idMessage`),
    INDEX `thread_message_idMirrorMessage_idx`(`idMirrorMessage`),
    INDEX `thread_message_idTransferredMessage_idx`(`idTransferredMessage`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `thread_message_edit` (
    `id` VARCHAR(191) NOT NULL,
    `idThreadMessage` VARCHAR(191) NOT NULL,
    `idEditor` VARCHAR(191) NULL,
    `contents` TEXT NOT NULL,
    `mentionsData` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `thread_message_edit_idThreadMessage_createdAt_idx`(`idThreadMessage`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

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

    PRIMARY KEY (`id`, `idThreadMessage`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `snippet` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `content` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `snippet_alias` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `idSnippet` INTEGER NOT NULL,
    `alias` VARCHAR(191) NOT NULL,
    `isPrimary` ENUM('PRIMARY') NULL,

    UNIQUE INDEX `snippet_alias_alias_key`(`alias`),
    UNIQUE INDEX `snippet_alias_idSnippet_isPrimary_key`(`idSnippet`, `isPrimary`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `thread_message` ADD CONSTRAINT `thread_message_idThread_fkey` FOREIGN KEY (`idThread`) REFERENCES `thread`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `thread_message_edit` ADD CONSTRAINT `thread_message_edit_idThreadMessage_fkey` FOREIGN KEY (`idThreadMessage`) REFERENCES `thread_message`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `thread_attachment` ADD CONSTRAINT `thread_attachment_idThreadMessage_fkey` FOREIGN KEY (`idThreadMessage`) REFERENCES `thread_message`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `snippet_alias` ADD CONSTRAINT `snippet_alias_idSnippet_fkey` FOREIGN KEY (`idSnippet`) REFERENCES `snippet`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
