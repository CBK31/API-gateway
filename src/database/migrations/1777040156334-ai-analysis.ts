import { MigrationInterface, QueryRunner } from "typeorm";

export class AiAnalysis1777040156334 implements MigrationInterface {
    name = 'AiAnalysis1777040156334'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "ai_analysis" ("id" BIGSERIAL NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "window_start" TIMESTAMP WITH TIME ZONE NOT NULL, "window_end" TIMESTAMP WITH TIME ZONE NOT NULL, "requests_analyzed" integer NOT NULL, "risk_score" double precision NOT NULL, "verdict" text NOT NULL, "flagged_ips" jsonb NOT NULL DEFAULT '[]', "flagged_user_ids" jsonb NOT NULL DEFAULT '[]', "recommendations" text, "model" character varying(64) NOT NULL, "prompt_tokens" integer, "completion_tokens" integer, "traffic_summary" jsonb NOT NULL, "raw_response" jsonb, CONSTRAINT "PK_045e391dedf8f6a067bbbe6bfd5" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_5c3d3f960f353833aabc598483" ON "ai_analysis" ("created_at") `);
        await queryRunner.query(`CREATE INDEX "IDX_4e111ca28e5302aebe0537235b" ON "ai_analysis" ("risk_score") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_4e111ca28e5302aebe0537235b"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5c3d3f960f353833aabc598483"`);
        await queryRunner.query(`DROP TABLE "ai_analysis"`);
    }

}
