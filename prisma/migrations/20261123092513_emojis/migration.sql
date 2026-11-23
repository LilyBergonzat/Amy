-- CreateTable
CREATE TABLE `emoji` (
    `id` VARCHAR(191) NOT NULL,
    `idOriginal` VARCHAR(191) NOT NULL,
    `avatarHash` VARCHAR(191) NULL,
    `lastUsed` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `emoji_idOriginal_key`(`idOriginal`),
    UNIQUE INDEX `emoji_avatarHash_key`(`avatarHash`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
