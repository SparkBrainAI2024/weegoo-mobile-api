import { Driver } from "@libs/data-access/dtos/response/driver-w-documents.response";
import { DriverDocument } from "@libs/data-access/entities/driver-document.entity";
import { DriverDocumentService } from "@libs/services/driver-document/driver-document.service";
import { Parent, ResolveField, Resolver } from "@nestjs/graphql";

@Resolver(() => Driver) // <-- added a new resolver for Driver to resolve documents field
export class DriverDocumentFieldResolver {
  // <-- renamed, no more duplicate
  constructor(private readonly driverDocumentService: DriverDocumentService) {}

  @ResolveField(() => [DriverDocument])
  async documents(@Parent() driver: Driver) {
    return this.driverDocumentService.getDriverDocuments(driver.id);
  }
}
