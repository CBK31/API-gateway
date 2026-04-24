import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { map } from 'rxjs/operators';
import { Observable } from 'rxjs';

interface ResponseFormat<T> {
  status: string;
  data: T;
}

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, ResponseFormat<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ResponseFormat<T>> {
    return next.handle().pipe(
      map((data) => {
        if (data && typeof data === 'object' && 'data' in data) {
          return {
            ...(data as object),
            status: 'success',
          } as ResponseFormat<T>;
        }

        return {
          status: 'success',
          data,
        };
      }),
    );
  }
}
