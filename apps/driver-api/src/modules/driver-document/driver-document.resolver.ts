import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';
import { DriverDocumentService } from './driver-document.service';
import { DriverDocument } from './entities/driver-document.entity';
import { CreateDriverDocumentInput } from './dto/create-driver-document.input';
import { UpdateDriverDocumentInput } from './dto/update-driver-document.input';

@Resolver(() => DriverDocument)
export class DriverDocumentResolver {
  constructor(private readonly driverDocumentService: DriverDocumentService) {}

  @Mutation(() => DriverDocument)
  createDriverDocument(@Args('createDriverDocumentInput') createDriverDocumentInput: CreateDriverDocumentInput) {
    return this.driverDocumentService.create(createDriverDocumentInput);
  }

  @Query(() => [DriverDocument], { name: 'driverDocument' })
  findAll() {
    return this.driverDocumentService.findAll();
  }

  @Query(() => DriverDocument, { name: 'driverDocument' })
  findOne(@Args('id', { type: () => Int }) id: number) {
    return this.driverDocumentService.findOne(id);
  }

  @Mutation(() => DriverDocument)
  updateDriverDocument(@Args('updateDriverDocumentInput') updateDriverDocumentInput: UpdateDriverDocumentInput) {
    return this.driverDocumentService.update(updateDriverDocumentInput.id, updateDriverDocumentInput);
  }

  @Mutation(() => DriverDocument)
  removeDriverDocument(@Args('id', { type: () => Int }) id: number) {
    return this.driverDocumentService.remove(id);
  }
}
