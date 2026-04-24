import { MigrationInterface, QueryRunner } from "typeorm";

export class Init1777025224549 implements MigrationInterface {
    name = 'Init1777025224549'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."httpLog_method_enum" AS ENUM('GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD')`);
        await queryRunner.query(`CREATE TABLE "httpLog" ("id" BIGSERIAL NOT NULL, "request_id" uuid NOT NULL, "environment" character varying(20), "org_id" bigint, "client_ip" character varying(64), "headers" jsonb, "userId" bigint, "start_at" TIMESTAMP WITH TIME ZONE, "end_at" TIMESTAMP WITH TIME ZONE, "token" text, "method" "public"."httpLog_method_enum" NOT NULL, "url" text NOT NULL, "query" jsonb NOT NULL DEFAULT '{}', "status_code" integer, "routeParams" jsonb NOT NULL DEFAULT '{}', "requestBody" jsonb, "responseTimeMs" integer NOT NULL, "responseBody" jsonb, "raw_url" text NOT NULL, "url_version" character varying NOT NULL, "url_controller" character varying NOT NULL, "url_end_point" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "PK_fb227c78cdc814f496a240008b4" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_73a0edd2e8718944a99b7b7b79" ON "httpLog" ("request_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_ba1d036aec535b3cbb8e07f5c2" ON "httpLog" ("org_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_bbeada7792fd59975e0f91c71f" ON "httpLog" ("client_ip") `);
        await queryRunner.query(`CREATE INDEX "IDX_28e3f641ea90087fecb4b97480" ON "httpLog" ("userId") `);
        await queryRunner.query(`CREATE INDEX "IDX_fe68750aed4afe28f3facb2989" ON "httpLog" ("status_code") `);
        await queryRunner.query(`CREATE INDEX "IDX_a4f06a83c1b39015712a420874" ON "httpLog" ("url_version") `);
        await queryRunner.query(`CREATE INDEX "IDX_c8ce33441699ced50fdd7a0184" ON "httpLog" ("url_controller") `);
        await queryRunner.query(`CREATE INDEX "IDX_91f0f93cd005f143db02889aa2" ON "httpLog" ("createdAt") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_91f0f93cd005f143db02889aa2"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c8ce33441699ced50fdd7a0184"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a4f06a83c1b39015712a420874"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_fe68750aed4afe28f3facb2989"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_28e3f641ea90087fecb4b97480"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_bbeada7792fd59975e0f91c71f"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ba1d036aec535b3cbb8e07f5c2"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_73a0edd2e8718944a99b7b7b79"`);
        await queryRunner.query(`DROP TABLE "httpLog"`);
        await queryRunner.query(`DROP TYPE "public"."httpLog_method_enum"`);
    }

}
