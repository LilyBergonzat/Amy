/*
  Warnings:

  - The primary key for the `thread_attachment` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- AlterTable
ALTER TABLE `thread_attachment` DROP PRIMARY KEY,
    ADD PRIMARY KEY (`id`, `idThreadMessage`);
