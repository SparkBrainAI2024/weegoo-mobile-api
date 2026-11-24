import { Module } from "@nestjs/common";
import { DriverInvoiceResolver } from "./invoice.resolver";
import { InvoiceService } from "@libs/services/invoice/invoice.service";
import { S3Module } from "@libs/s3";
import { SendGridMailModule } from "@libs/services/mail";
import { MongooseModule } from "@nestjs/mongoose";
import { UserPersistenceModule } from "@libs/services/user/user-persistent.module";
import { MaintenanceInfoPersistenceModule } from "@libs/services/maintenance-info/maintenance-info.persistence.module";
import { Transaction, TransactionSchema } from "@libs/data-access/entities/transaction.entity";
import { Rides, RidesSchema } from "@libs/data-access/entities/rides.entity";
import { UserDetails, UserDetailsSchema } from "@libs/data-access/entities/user-details.entity";
import { User, UserSchema } from "@libs/data-access/entities/user.entity";

@Module({
  imports: [
    S3Module,
    SendGridMailModule,
    UserPersistenceModule,
    MaintenanceInfoPersistenceModule,
    MongooseModule.forFeature([
      { name: Transaction.name, schema: TransactionSchema },
      { name: Rides.name, schema: RidesSchema },
      { name: UserDetails.name, schema: UserDetailsSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  providers: [DriverInvoiceResolver, InvoiceService],
  exports: [DriverInvoiceResolver],
})
export class DriverInvoiceModule {}