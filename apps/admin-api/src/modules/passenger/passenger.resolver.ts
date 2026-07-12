import { Args, ID, Mutation, Query, Resolver } from "@nestjs/graphql";

import { User } from "@libs/data-access";
import {
  PassengerListItem,
  PassengerListResponse,
} from "@libs/data-access/dtos/response/passenger-list.response";

import { PassengerService } from "@libs/services/passenger/passenger.service";
import { PassengerListInput } from "@libs/data-access/dtos/input/passenger-list.input";
import { DeletePassengerInput } from "@libs/data-access/dtos/input/delete-passenger.input";

// @UseGuards(AuthGuard, RoleGuard)
// @SetMetadata("roles", [roles.ADMIN])
@Resolver(() => User)
export class PassengerResolver {
  constructor(private readonly passengerService: PassengerService) {}

  @Query(() => PassengerListResponse)
  async getPassengers(
    @Args("input", { nullable: true, type: () => PassengerListInput })
    input?: PassengerListInput,
  ): Promise<PassengerListResponse> {
    const result = await this.passengerService.listPassengers(
      input ?? new PassengerListInput(),
    );
    return result;
  }

  @Mutation(() => Boolean)
  async deletePassenger(
    @Args("input") input: DeletePassengerInput,
  ): Promise<boolean> {
    return this.passengerService.softDeletePassenger(input.passengerId);
  }

  @Mutation(() => PassengerListItem)
  async blockPassenger(
    @Args("id", { type: () => ID }) id: string,
  ): Promise<Pick<PassengerListItem, "id" | "suspended">> {
    return this.passengerService.setSuspended(id, true);
  }

  @Mutation(() => PassengerListItem)
  async unblockPassenger(
    @Args("id", { type: () => ID }) id: string,
  ): Promise<Pick<PassengerListItem, "id" | "suspended">> {
    return this.passengerService.setSuspended(id, false);
  }
}
