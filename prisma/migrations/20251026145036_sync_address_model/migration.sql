/*
  Warnings:

  - The values [ACCEPTED] on the enum `ApplicationStatus` will be removed. If these variants are still used in the database, this will fail.
  - The values [SUPERADMIN] on the enum `RoleType` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `area` on the `Address` table. All the data in the column will be lost.
  - You are about to drop the column `workSamplePreviewUrl` on the `Employee` table. All the data in the column will be lost.
  - You are about to drop the column `workSampleUrl` on the `Employee` table. All the data in the column will be lost.
  - You are about to drop the column `location` on the `Job` table. All the data in the column will be lost.
  - You are about to drop the column `salary` on the `Job` table. All the data in the column will be lost.
  - You are about to drop the column `GSTDetails` on the `SuperAdmin` table. All the data in the column will be lost.
  - You are about to drop the column `aboutOrganzation` on the `SuperAdmin` table. All the data in the column will be lost.
  - You are about to drop the column `establishedYear` on the `SuperAdmin` table. All the data in the column will be lost.
  - You are about to drop the column `functionArea` on the `SuperAdmin` table. All the data in the column will be lost.
  - You are about to drop the column `industry` on the `SuperAdmin` table. All the data in the column will be lost.
  - You are about to drop the column `workSamplePreviewUrl` on the `SuperAdmin` table. All the data in the column will be lost.
  - You are about to drop the column `workSampleUrl` on the `SuperAdmin` table. All the data in the column will be lost.
  - You are about to drop the column `dob` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `gender` on the `User` table. All the data in the column will be lost.
  - Added the required column `companyEmail` to the `Job` table without a default value. This is not possible if the table is not empty.
  - Added the required column `companyName` to the `Job` table without a default value. This is not possible if the table is not empty.
  - Added the required column `logoPreviewUrl` to the `Job` table without a default value. This is not possible if the table is not empty.
  - Added the required column `logoUrl` to the `Job` table without a default value. This is not possible if the table is not empty.
  - Added the required column `responsibilities` to the `Job` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `JobApplication` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "public"."JobMode" AS ENUM ('REMOTE', 'ON_SITE', 'HYBRID');

-- CreateEnum
CREATE TYPE "public"."EmploymentType" AS ENUM ('FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP', 'FREELANCE');

-- AlterEnum
BEGIN;
CREATE TYPE "public"."ApplicationStatus_new" AS ENUM ('PENDING', 'APPLIED', 'WITHDRAW', 'RE_APPLIED', 'REJECTED', 'RESUME_VIEWED', 'WAITING_EMPLOYER_ACTION', 'APPLICATION_SEND', 'CONTACT_VIEW', 'SELECTED');
ALTER TABLE "public"."JobApplication" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "public"."JobApplication" ALTER COLUMN "status" TYPE "public"."ApplicationStatus_new" USING ("status"::text::"public"."ApplicationStatus_new");
ALTER TYPE "public"."ApplicationStatus" RENAME TO "ApplicationStatus_old";
ALTER TYPE "public"."ApplicationStatus_new" RENAME TO "ApplicationStatus";
DROP TYPE "public"."ApplicationStatus_old";
ALTER TABLE "public"."JobApplication" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "public"."RoleType_new" AS ENUM ('EMPLOYEE', 'EMPLOYER', 'SUPER_ADMIN', 'ADMIN');
ALTER TABLE "public"."User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "public"."User" ALTER COLUMN "role" TYPE "public"."RoleType_new" USING ("role"::text::"public"."RoleType_new");
ALTER TYPE "public"."RoleType" RENAME TO "RoleType_old";
ALTER TYPE "public"."RoleType_new" RENAME TO "RoleType";
DROP TYPE "public"."RoleType_old";
ALTER TABLE "public"."User" ALTER COLUMN "role" SET DEFAULT 'EMPLOYEE';
COMMIT;

-- DropForeignKey
ALTER TABLE "public"."Job" DROP CONSTRAINT "Job_employerId_fkey";

-- AlterTable
ALTER TABLE "public"."Address" DROP COLUMN "area",
ADD COLUMN     "jobId" TEXT;

-- AlterTable
ALTER TABLE "public"."Employee" DROP COLUMN "workSamplePreviewUrl",
DROP COLUMN "workSampleUrl",
ADD COLUMN     "dob" TIMESTAMP(3),
ADD COLUMN     "gender" "public"."UserGender",
ADD COLUMN     "workSamplePreviewUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "workSampleUrls" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "public"."Job" DROP COLUMN "location",
DROP COLUMN "salary",
ADD COLUMN     "companyEmail" TEXT NOT NULL,
ADD COLUMN     "companyName" TEXT NOT NULL,
ADD COLUMN     "createdBy" TEXT,
ADD COLUMN     "deadline" TIMESTAMP(3),
ADD COLUMN     "education" TEXT,
ADD COLUMN     "employmentType" "public"."EmploymentType",
ADD COLUMN     "experienceRange" TEXT,
ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "jobPostAddressId" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "logoPreviewUrl" TEXT NOT NULL,
ADD COLUMN     "logoUrl" TEXT NOT NULL,
ADD COLUMN     "mode" "public"."JobMode",
ADD COLUMN     "openings" INTEGER DEFAULT 1,
ADD COLUMN     "responsibilities" TEXT NOT NULL,
ADD COLUMN     "salaryRange" TEXT,
ADD COLUMN     "skillsRequired" TEXT[],
ADD COLUMN     "superAdminId" TEXT,
ADD COLUMN     "updatedBy" TEXT,
ALTER COLUMN "requirements" SET NOT NULL,
ALTER COLUMN "requirements" SET DATA TYPE TEXT,
ALTER COLUMN "employerId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "public"."JobApplication" ADD COLUMN     "appliedBy" TEXT,
ADD COLUMN     "howFitRole" TEXT,
ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "resumePreviewUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "resumeUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "statusReason" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "updatedBy" TEXT,
ADD COLUMN     "userId" TEXT,
ADD COLUMN     "withdrawBy" TEXT,
ADD COLUMN     "workSamplePreviewUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "workSampleUrls" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "public"."SuperAdmin" DROP COLUMN "GSTDetails",
DROP COLUMN "aboutOrganzation",
DROP COLUMN "establishedYear",
DROP COLUMN "functionArea",
DROP COLUMN "industry",
DROP COLUMN "workSamplePreviewUrl",
DROP COLUMN "workSampleUrl",
ADD COLUMN     "dob" TIMESTAMP(3),
ADD COLUMN     "gender" "public"."UserGender";

-- AlterTable
ALTER TABLE "public"."User" DROP COLUMN "dob",
DROP COLUMN "gender";

-- CreateTable
CREATE TABLE "public"."SavedJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "savedBy" TEXT,

    CONSTRAINT "SavedJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ViewedJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "viewedBy" TEXT,

    CONSTRAINT "ViewedJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CompanyReview" (
    "id" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "pros" TEXT,
    "cons" TEXT,
    "employerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "reviewDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "reviedBy" TEXT,
    "approvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "type" TEXT,
    "readAt" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Message" (
    "id" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "receiverId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."Address" ADD CONSTRAINT "Address_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "public"."Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Job" ADD CONSTRAINT "Job_employerId_fkey" FOREIGN KEY ("employerId") REFERENCES "public"."Employer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Job" ADD CONSTRAINT "Job_superAdminId_fkey" FOREIGN KEY ("superAdminId") REFERENCES "public"."SuperAdmin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SavedJob" ADD CONSTRAINT "SavedJob_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "public"."Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SavedJob" ADD CONSTRAINT "SavedJob_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "public"."Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SavedJob" ADD CONSTRAINT "SavedJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ViewedJob" ADD CONSTRAINT "ViewedJob_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "public"."Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ViewedJob" ADD CONSTRAINT "ViewedJob_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "public"."Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ViewedJob" ADD CONSTRAINT "ViewedJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CompanyReview" ADD CONSTRAINT "CompanyReview_employerId_fkey" FOREIGN KEY ("employerId") REFERENCES "public"."Employer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CompanyReview" ADD CONSTRAINT "CompanyReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Message" ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Message" ADD CONSTRAINT "Message_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
