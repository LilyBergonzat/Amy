-- CreateTable
CREATE TABLE `setting` (
    `key` VARCHAR(255) NOT NULL,
    `value` TEXT NOT NULL,

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `thread` (
    `id` VARCHAR(191) NOT NULL,
    `idOpenedBy` VARCHAR(191) NOT NULL,
    `openedByData` TEXT NOT NULL,
    `openedByUser` BOOLEAN NOT NULL,
    `idRecipient` VARCHAR(191) NOT NULL,
    `recipientData` TEXT NOT NULL,
    `isOpen` ENUM('OPEN') NULL,
    `idChannel` VARCHAR(191) NULL,
    `scheduledClose` DATETIME(3) NULL,
    `openedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `closedAt` DATETIME(3) NULL,

    INDEX `thread_idChannel_idx`(`idChannel`),
    UNIQUE INDEX `thread_idRecipient_isOpen_key`(`idRecipient`, `isOpen`),
    UNIQUE INDEX `thread_idChannel_key`(`idChannel`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `thread_message` (
    `id` VARCHAR(191) NOT NULL,
    `idMessage` VARCHAR(191) NULL,
    `idThread` VARCHAR(191) NOT NULL,
    `idStaff` VARCHAR(191) NULL,
    `idTransferredMessage` VARCHAR(191) NULL,
    `senderData` TEXT NOT NULL,
    `messageData` TEXT NULL,
    `contents` TEXT NOT NULL,
    `internal` BOOLEAN NOT NULL,
    `anonymous` BOOLEAN NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
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
ALTER TABLE `snippet_alias` ADD CONSTRAINT `snippet_alias_idSnippet_fkey` FOREIGN KEY (`idSnippet`) REFERENCES `snippet`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
