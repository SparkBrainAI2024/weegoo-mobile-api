import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { PromoCodeService } from './promocode.service';
import { CreatePromoCodeInput, PaginationInput, PromoCode } from '@libs/data-access';
import { UpdatePromoCodeInput } from '@libs/data-access/dtos/input/update-promo-code.input';
import { PromoCodePaginatedResult } from './types/promocode-paginated.type';


@Resolver(() => PromoCode)
export class PromoCodeResolver {
  constructor(private readonly promoCodeService: PromoCodeService) {}

  @Mutation(() => PromoCode)
  async createPromoCode(
    @Args('input') input: CreatePromoCodeInput,
  ): Promise<PromoCode> {
    return this.promoCodeService.create(input);
  }

  @Query(() => PromoCode, { name: 'promoCode' })
  async findOne(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<PromoCode> {
    return this.promoCodeService.findById(id);
  }

  @Query(() => PromoCodePaginatedResult, { name: 'promoCodes' })
  async findAll(
    @Args('paginationInput') paginationInput: PaginationInput,
  ): Promise<PromoCodePaginatedResult> {
    return this.promoCodeService.findAll(paginationInput);
  }

  @Mutation(() => PromoCode)
  async updatePromoCode(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdatePromoCodeInput,
  ): Promise<PromoCode> {
    return this.promoCodeService.update(id, input);
  }

  // Status transitions — explicit mutations, not hidden inside update
  // This makes the intent clear on the frontend too
  @Mutation(() => PromoCode)
  async activatePromoCode(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<PromoCode> {
    return this.promoCodeService.activate(id);
  }

  @Mutation(() => PromoCode)
  async deactivatePromoCode(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<PromoCode> {
    return this.promoCodeService.deactivate(id);
  }

  @Mutation(() => Boolean)
  async removePromoCode(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    return this.promoCodeService.remove(id);
  }
}