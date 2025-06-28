import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SubsidiariesService } from './subsidiaries.service';
import { SubsidiariesController } from './subsidiaries.controller';
import { Subsidiary, SubsidiarySchema } from './schemas/subsidiary/subsidiary';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Subsidiary.name, schema: SubsidiarySchema },
    ]),
  ],
  controllers: [SubsidiariesController],
  providers: [SubsidiariesService],
})
export class SubsidiariesModule {}
