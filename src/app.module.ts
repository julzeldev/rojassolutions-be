import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { EmployeesModule } from './employees/employees.module';
import { AuthModule } from './auth/auth.module';
import { SubsidiariesModule } from './subsidiaries/subsidiaries.module';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        uri:
          configService.get<string>('MONGODB_URI') ||
          'mongodb+srv://juliozeledondeveloper:pxxOwTHTm5eJR2uB@cluster0.2a4glno.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0',
      }),
      inject: [ConfigService],
    }),
    UsersModule,
    EmployeesModule,
    AuthModule,
    SubsidiariesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
