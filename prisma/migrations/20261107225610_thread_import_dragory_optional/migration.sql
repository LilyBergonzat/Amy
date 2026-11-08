-- AlterTable
ALTER TABLE `thread` MODIFY `idOpenedBy` VARCHAR(191) NULL,
    MODIFY `openedByData` TEXT NULL,
    MODIFY `openedByUser` BOOLEAN NULL;
