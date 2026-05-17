import { Args, Mutation, Query, Resolver } from "@nestjs/graphql";
import { UseGuards } from "@nestjs/common";
import { AuthGuard, LangGuard } from "@libs/guards/guard";
import { CurrentLang, CurrentUser } from "@libs/common";
import { VehicleService } from "../vehicle.service";
import { RegisterVehicleInput } from "@libs/data-access/dtos/input/create-vehicle.input";
import { EditVehicleInput } from "@libs/data-access/dtos/input/update-vehicle.input";
import { VehicleRegistrationResponse } from "@libs/data-access/dtos/response/vehicle-registration.response";
import { Vehicle } from "@libs/data-access/entities/vehicle.entity";
import { BasicResponse } from "@libs/data-access";



@Resolver()
@UseGuards(LangGuard)
@UseGuards(AuthGuard)
export class VehicleResolver {
  constructor(private readonly vehicleService: VehicleService) {}

  @Mutation(() => VehicleRegistrationResponse)
  registerVehicle(
    @Args("input") input: RegisterVehicleInput,
    @CurrentUser() user,
    @CurrentLang() lang: string,
  ) {
    return this.vehicleService.registerVehicle(user._id, input, lang);
  }

@Mutation(() => VehicleRegistrationResponse)
async editVehicle(
  @CurrentUser() user: { _id: string },
  @CurrentLang() lang: string,
  @Args("vehicleId") vehicleId: string,      // ← separate 
  @Args("input") input: EditVehicleInput,
) {
  return this.vehicleService.editVehicle(user._id, vehicleId, input, lang);
}
  // @Query(() => GetMyVehiclesResponse)
  // async myVehicles(
  //   @CurrentUser() user: { _id: string },@CurrentLang() lang: string,
  // ): Promise<GetMyVehiclesResponse> {
  //   return this.vehicleService.getVehiclesByDriver(user._id, lang);
  // }

  @Query(() => Vehicle)
async getVehicle(
  @CurrentLang() lang: string,
  @CurrentUser() user: { _id: string },
  @Args("vehicleId") vehicleId: string,
): Promise<BasicResponse> {
  return this.vehicleService.getVehicle(vehicleId, user._id, lang);
}
}