import { Args, Mutation, Resolver } from "@nestjs/graphql";
import { UseGuards } from "@nestjs/common";
import { AuthGuard, LangGuard } from "@libs/guards/guard";
import { CurrentLang, CurrentUser } from "@libs/common";
import { VehicleRegistrationResponse } from "./response/vehicle-registration.response";
import { VehicleService } from "./vehicle.service";
import { RegisterVehicleInput } from "./input/create-vehicle.input";


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
}