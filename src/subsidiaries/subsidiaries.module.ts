import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SubsidiariesService } from './subsidiaries.service';
import { SubsidiariesController } from './subsidiaries.controller';
import { Subsidiary, SubsidiarySchema } from './schemas/subsidiary.schema';
import { Employee, EmployeeSchema } from '../employees/schemas/employee.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Subsidiary.name, schema: SubsidiarySchema },
      { name: Employee.name, schema: EmployeeSchema },
    ]),
  ],
  controllers: [SubsidiariesController],
  providers: [SubsidiariesService],
  exports: [SubsidiariesService],
})
export class SubsidiariesModule {}
