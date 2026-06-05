import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { IpfsService } from './ipfs.service';
import { IpfsController } from './ipfs.controller';

@Module({
  imports: [ConfigModule],
  providers: [IpfsService],
  controllers: [IpfsController],
  exports: [IpfsService],
})
export class IpfsModule {}
