import { Resolver, Query, Mutation, Args, ID } from "@nestjs/graphql";
import { PromoCodeService } from "./promocode.service";
import {
  CreatePromoCodeInput,
  Occasion,
  PaginationInput,
  PaginationInputOnly,
  PromoCode,
} from "@libs/data-access";
import { UpdatePromoCodeInput } from "@libs/data-access/dtos/input/update-promo-code.input";
import {
  OcassionListWithPaginationResponse,
  PromocodeListWithPaginationResponse,
} from "./types/promocode-paginated.type";
import { UseGuards } from "@nestjs/common";
import { AdminAuthGuard } from "@libs/guards/auth.admin.guard";
import { PromoCodeFindAllInput } from "@libs/data-access/dtos/input/promocode-filter.input";
import {
  PromocodeCreateResponse,
  PromocodeUpdateResponse,
} from "@libs/data-access/dtos/response/promocode.response";

@UseGuards(AdminAuthGuard)
@Resolver(() => PromoCode)
export class PromoCodeResolver {
  constructor(private readonly promoCodeService: PromoCodeService) {}

  @Mutation(() => PromocodeCreateResponse)
  async createPromoCode(
    @Args("input") input: CreatePromoCodeInput,
  ): Promise<PromocodeCreateResponse> {
    return this.promoCodeService.create(input);
  }

  @Query(() => PromoCode, { name: "promoCode" })
  async findOne(
    @Args("id", { type: () => ID }) id: string,
  ): Promise<PromoCode> {
    return this.promoCodeService.findById(id);
  }

  @Query(() => PromocodeListWithPaginationResponse, { name: "promoCodes" })
  async findAll(
    @Args("paginationInput") paginationInput: PromoCodeFindAllInput,
  ): Promise<PromocodeListWithPaginationResponse> {
    return this.promoCodeService.findAll(paginationInput);
  }

  @Query(() => [Occasion], { name: "occasion" })
  async findAllOccasion(
    @Args("paginationInput") paginationInput: PaginationInputOnly,
  ): Promise<Occasion[]> {
    return this.promoCodeService.findAllOcassions(paginationInput);
  }

  @Mutation(() => PromocodeUpdateResponse, {
    name: "updatePromoCode",
    description: "Updates a existing promo code",
  })
  async updatePromoCode(
    @Args("id", { type: () => ID }) id: string,
    @Args("input") input: UpdatePromoCodeInput,
  ): Promise<PromocodeUpdateResponse> {
    return this.promoCodeService.update(id, input);
  }

  // Status transitions — explicit mutations, not hidden inside update
  // This makes the intent clear on the frontend too
  @Mutation(() => PromoCode)
  async activatePromoCode(
    @Args("id", { type: () => ID }) id: string,
  ): Promise<PromoCode> {
    return this.promoCodeService.activate(id);
  }

  @Mutation(() => PromoCode)
  async deactivatePromoCode(
    @Args("id", { type: () => ID }) id: string,
  ): Promise<PromoCode> {
    return this.promoCodeService.deactivate(id);
  }

  @Mutation(() => Boolean)
  async removePromoCode(
    @Args("id", { type: () => ID }) id: string,
  ): Promise<boolean> {
    return this.promoCodeService.remove(id);
  }
}
