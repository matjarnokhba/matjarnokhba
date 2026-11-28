-- M2.1: company applications (self-registration awaits admin approval).
ALTER TYPE "LogisticsCompanyStatus" ADD VALUE IF NOT EXISTS 'PENDING';
ALTER TYPE "LogisticsCompanyStatus" ADD VALUE IF NOT EXISTS 'REJECTED';
