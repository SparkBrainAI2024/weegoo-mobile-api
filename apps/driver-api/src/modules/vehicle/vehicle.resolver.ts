import { Args, Mutation, Query, Resolver } from "@nestjs/graphql";
import { UseGuards } from "@nestjs/common";
import { AuthGuard, LangGuard } from "@libs/guards/guard";
import { CurrentLang, CurrentUser } from "@libs/common";
import { VehicleService } from "./vehicle.service";
import { Vehicle } from "./entities/vehicle.entity";
import { GetMyVehiclesResponse, VehicleRegistrationResponse } from "./response/vehicle-registration.response";
import { RegisterVehicleInput } from "./input/create-vehicle.input";
import { EditVehicleInput } from "./input/update-vehicle.input";



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
  @Args("vehicleId") vehicleId: string,      // ← separate arg
  @Args("input") input: EditVehicleInput,
) {
  return this.vehicleService.editVehicle(user._id, vehicleId, input, lang);
}
  @Query(() => GetMyVehiclesResponse)
  async myVehicles(
    @CurrentUser() user: { _id: string },@CurrentLang() lang: string,
  ): Promise<GetMyVehiclesResponse> {
    return this.vehicleService.getVehiclesByDriver(user._id, lang);
  }
}