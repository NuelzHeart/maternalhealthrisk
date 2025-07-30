-- CreateTable
CREATE TABLE "admins" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "health_assessments" (
    "id" SERIAL NOT NULL,
    "patient_name" TEXT NOT NULL,
    "age" INTEGER NOT NULL,
    "systolic" INTEGER NOT NULL,
    "diastolic" INTEGER NOT NULL,
    "blood_sugar" INTEGER NOT NULL,
    "temperature" DOUBLE PRECISION NOT NULL,
    "is_fasting" BOOLEAN NOT NULL,
    "bp_risk_level" TEXT NOT NULL,
    "bp_risk_score" INTEGER NOT NULL,
    "sugar_risk_level" TEXT NOT NULL,
    "sugar_risk_score" INTEGER NOT NULL,
    "temp_risk_level" TEXT NOT NULL,
    "temp_risk_score" INTEGER NOT NULL,
    "total_score" INTEGER NOT NULL,
    "overall_risk" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "health_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admins_email_key" ON "admins"("email");
