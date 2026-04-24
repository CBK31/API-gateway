import { HttpLog, HttpMethod } from '../../../../domain/httpLog';
import { HttpLogEntity } from '../entities/httpLog.entity';

export class HttpLogMapper {
  static toDomain(raw: HttpLogEntity): HttpLog {
    const domain = new HttpLog();

    domain.id = raw.id;
    domain.requestId = raw.requestId;
    domain.environment = raw.environment ?? undefined;
    domain.orgId = raw.orgId ?? undefined;
    domain.clientIp = raw.clientIp ?? undefined;
    domain.headers = raw.headers ?? undefined;
    domain.userId = raw.userId ?? undefined;

    domain.startAt = raw.startAt ?? null;
    domain.endAt = raw.endAt ?? null;
    domain.token = raw.token ?? undefined;
    domain.method = raw.method as HttpMethod;
    domain.url = raw.url;
    domain.query = raw.query;
    domain.routeParams = raw.routeParams;
    domain.requestBody = raw.requestBody;
    domain.statusCode = raw.statusCode;
    domain.responseTimeMs = raw.responseTimeMs;
    domain.responseBody = raw.responseBody;

    domain.rawUrl = raw.rawUrl;
    domain.urlVersion = raw.urlVersion;
    domain.urlController = raw.urlController;
    domain.urlEndPoint = raw.urlEndPoint ?? undefined;

    domain.createdAt = raw.createdAt;
    domain.updatedAt = raw.updatedAt;
    domain.deletedAt = raw.deletedAt;

    return domain;
  }

  static toPersistence(domain: Partial<HttpLog>): HttpLogEntity {
    const entity = new HttpLogEntity();

    if (domain.id !== undefined) entity.id = domain.id;
    entity.requestId = domain.requestId!;
    entity.environment = domain.environment ?? null;
    entity.orgId = domain.orgId ?? null;
    entity.clientIp = domain.clientIp ?? null;
    entity.headers = domain.headers ?? null;
    entity.userId = domain.userId ?? null;

    entity.startAt = domain.startAt ?? null;
    entity.endAt = domain.endAt ?? null;

    entity.method = domain.method!;
    entity.url = domain.url!;
    entity.query = domain.query ?? {};
    entity.routeParams = domain.routeParams ?? {};
    entity.requestBody = domain.requestBody ?? null;
    entity.statusCode = domain.statusCode ?? null;
    entity.responseTimeMs = domain.responseTimeMs!;
    entity.responseBody = domain.responseBody ?? null;
    entity.token = domain.token ?? null;

    entity.rawUrl = domain.rawUrl!;
    entity.urlVersion = domain.urlVersion!;
    entity.urlController = domain.urlController!;
    entity.urlEndPoint = domain.urlEndPoint ?? null;

    return entity;
  }
}
