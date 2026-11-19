import { Global, Module } from '@nestjs/common';
import { RealtimeService } from './services/realtime.service';
import { ImageWebpService } from './services/image-webp.service';
import { RequestContextService } from './services/request-context.service';
import { RequestContextInterceptor } from './interceptors/request-context.interceptor';

@Global()
@Module({
  providers: [
    RealtimeService,
    ImageWebpService,
    RequestContextService,
    RequestContextInterceptor,
  ],
  exports: [
    RealtimeService,
    ImageWebpService,
    RequestContextService,
    RequestContextInterceptor,
  ],
})
export class CommonModule {}

